import { config } from './config.js'
import { escapeHtml, safeUrl } from './dom.js'

const texts = config.texts[config.currentLocale]
const statusTones = ['fast', 'medium', 'slow', 'unknown']
const statusLoading = { tone: 'loading', label: texts.statusText.loading }
const statusUnknown = { tone: 'unknown', label: texts.statusText.unknown }

const statusCache = new Map()
let pendingStatuses = new Set()
let probeRun = null
let statusNodeIndex = null

function usableStatus (entry) {
    return !!entry &&
        statusTones.indexOf(entry.tone) !== -1 &&
        typeof entry.label === 'string' &&
        typeof entry.at === 'number' &&
        Date.now() - entry.at <= config.probeCacheTtlMs
}

export function readStatusCache () {
    let raw = ''
    try {
        raw = localStorage.getItem(config.probeCacheKey) || ''
    } catch (error) {
        return
    }
    if (!raw) return
    let parsed = null
    try {
        parsed = JSON.parse(raw)
    } catch (error) {
        return
    }
    if (!parsed || typeof parsed !== 'object') return
    Object.keys(parsed).forEach(function (key) {
        const entry = parsed[key]
        if (!usableStatus(entry)) return
        statusCache.set(key, { tone: entry.tone, label: entry.label, at: entry.at })
    })
}

function writeStatusCache () {
    const payload = {}
    const now = Date.now()
    statusCache.forEach(function (entry, key) {
        if (!usableStatus(entry) || now - entry.at > config.probeCacheTtlMs) return
        payload[key] = { tone: entry.tone, label: entry.label, at: entry.at }
    })
    try {
        localStorage.setItem(config.probeCacheKey, JSON.stringify(payload))
    } catch (error) {
        /* 存储不可用时仅本次会话复用 */
    }
}

export function statusForSite (site) {
    const cached = statusCache.get(site.url)
    if (usableStatus(cached)) return cached
    if (pendingStatuses.has(site.url)) return statusLoading
    return statusUnknown
}

export function statusInner (status) {
    return '<span class="status-dot" aria-hidden="true"></span>' +
        '<span class="status-text">' + escapeHtml(status.label) + '</span>'
}

export function statusMarkup (site) {
    const status = statusForSite(site)
    return '<span class="site-status" data-tone="' + status.tone + '" data-status-url="' +
        escapeHtml(site.url) + '" title="' + escapeHtml(texts.statusTitle + status.label) + '">' +
        statusInner(status) + '</span>'
}

export function invalidateStatusIndex () {
    statusNodeIndex = null
}

/* 每次渲染后重建一次索引；探测结果按 URL 直取节点，避免逐条全文档扫描。 */
function rebuildStatusNodeIndex () {
    const index = new Map()
    const nodes = document.querySelectorAll('[data-status-url]')
    Array.prototype.forEach.call(nodes, function (node) {
        const key = node.getAttribute('data-status-url')
        const list = index.get(key)
        if (list) list.push(node)
        else index.set(key, [node])
    })
    statusNodeIndex = index
}

function updateStatusNodes (url, status) {
    if (!statusNodeIndex) rebuildStatusNodeIndex()
    const nodes = statusNodeIndex.get(url) || []
    nodes.forEach(function (node) {
        node.setAttribute('data-tone', status.tone)
        node.setAttribute('title', texts.statusTitle + status.label)
        const text = node.querySelector('.status-text')
        if (text) text.textContent = status.label
    })
}

/* no-cors 读不到状态码：404 也算有响应，按耗时着色；
   仅网络错误、超时与混合内容拦截算失败，标灰。 */
function probeTarget (siteUrl) {
    const absolute = safeUrl(siteUrl)
    if (!absolute) return ''
    try {
        const parsed = new URL(absolute)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
        return new URL(config.probePath, parsed.origin + '/').href
    } catch (error) {
        return ''
    }
}

function classifyStatus (elapsed) {
    if (elapsed <= config.statusFast) return { tone: 'fast', label: texts.statusText.fast }
    if (elapsed <= config.statusSlow) return { tone: 'medium', label: texts.statusText.medium }
    return { tone: 'slow', label: texts.statusText.slow }
}

function probeSite (siteUrl, runSignal) {
    const target = probeTarget(siteUrl)
    if (!target) return Promise.resolve(statusUnknown)

    return new Promise(function (resolve) {
        const requestController = new AbortController()
        let timer = 0
        let settled = false

        function relayAbort () {
            requestController.abort()
        }

        function finish (status) {
            if (settled) return
            settled = true
            window.clearTimeout(timer)
            runSignal.removeEventListener('abort', relayAbort)
            resolve(status)
        }

        if (runSignal.aborted) {
            resolve(null)
            return
        }

        runSignal.addEventListener('abort', relayAbort, { once: true })
        timer = window.setTimeout(function () {
            requestController.abort()
        }, config.statusTimeout)

        const started = performance.now()
        fetch(target, {
            mode: 'no-cors',
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: requestController.signal
        }).then(function () {
            if (runSignal.aborted) {
                finish(null)
                return
            }
            finish(classifyStatus(performance.now() - started))
        }).catch(function () {
            finish(runSignal.aborted ? null : statusUnknown)
        })
    })
}

function abortProbes () {
    if (probeRun) probeRun.controller.abort()
    probeRun = null
    pendingStatuses = new Set()
}

export function startProbes (group) {
    abortProbes()

    const targets = group.sites.filter(function (site) {
        const cached = statusCache.get(site.url)
        return !usableStatus(cached) && !!probeTarget(site.url)
    })
    pendingStatuses = new Set(targets.map(function (site) { return site.url }))
    group.sites.forEach(function (site) {
        if (pendingStatuses.has(site.url)) updateStatusNodes(site.url, statusLoading)
    })
    if (!targets.length) return

    const controller = new AbortController()
    const run = { controller: controller }
    probeRun = run
    let cursor = 0

    function worker () {
        if (cursor >= targets.length || controller.signal.aborted || probeRun !== run) {
            return Promise.resolve()
        }
        const site = targets[cursor]
        cursor++
        return probeSite(site.url, controller.signal).then(function (status) {
            if (!status || controller.signal.aborted || probeRun !== run) return
            statusCache.set(site.url, {
                tone: status.tone,
                label: status.label,
                at: Date.now()
            })
            pendingStatuses.delete(site.url)
            updateStatusNodes(site.url, status)
        }).catch(function () {
            /* 单个站点失败不中止整组 */
        }).then(worker)
    }

    const workers = []
    const count = Math.min(config.statusConcurrency, targets.length)
    for (let index = 0; index < count; index++) workers.push(worker())
    Promise.all(workers).then(function () {
        writeStatusCache()
    }).catch(function () {})
}
