import { abortError, isAbortError } from '../../js/abort.js'

export const apiBase = 'https://api.bgm.tv'
export const authBase = 'https://bgm.tv/oauth'
export const proxyUrl = '/_cross_origin?url='
export const retryWaitMs = 5000
// Every request carries a deadline so a stalled proxy cannot hang a backup.
export const requestTimeoutMs = 30000
// A larger Retry-After is clamped, so a hostile header cannot park a run for hours.
const retryAfterMaxMs = 60000

// /v0/episodes accepts these types only; asking for another one fails.
const epTypeKeys = [0, 1, 2, 3, 4, 6]

// An episode without a usable type still exists in the static snapshot. 
const epTypeUnknown = 'unknown'

function emptyEpisodeGroups() {
    const groups = {}
    for (const key of epTypeKeys) groups[String(key)] = []
    groups[epTypeUnknown] = []
    return groups
}

export function groupEpisodesByType(episodes) {
    const grouped = emptyEpisodeGroups()
    for (const episode of episodes) {
        const key = episode.type == null ? epTypeUnknown : String(episode.type)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(episode)
    }
    return grouped
}

// `eps` counts main episodes, so only type 0 compares; a snapshot without types uses its total.
// The static source returns episodes grouped by type, so the groups are flattened first.
export function mainEpisodeCount(episodes) {
    const list = Array.isArray(episodes) ? episodes : Object.values(episodes).flat()
    const typed = list.some(episode => Number.isInteger(episode.type))
    if (!typed) return list.length
    return list.filter(episode => episode.type === 0).length
}

function sleep(ms, signal = null) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            if (signal) signal.removeEventListener('abort', onAbort)
        }
        const onAbort = () => {
            clearTimeout(timer)
            cleanup()
            reject(abortError())
        }
        if (signal?.aborted) {
            reject(abortError())
            return
        }
        const timer = setTimeout(() => {
            cleanup()
            resolve()
        }, ms)
        if (signal) signal.addEventListener('abort', onAbort, { once: true })
    })
}

function proxyBase() {
    if (!proxyUrl) return ''
    if (proxyUrl.includes('?url=') || proxyUrl.includes('?target=')) return proxyUrl
    return proxyUrl.replace(/\?$/, '') + (proxyUrl.includes('?') ? '&' : '?') + 'url='
}

export function proxied(url) {
    const base = proxyBase()
    return base ? base + encodeURIComponent(url) : url
}

export const proxyMarkerHeader = 'x-cross-origin'

let storagePrefix = ''
let proxyMissingKey = ''

// The session key belongs to the project; the prefix arrives once at boot.
export function configureExternal({ storagePrefix: prefix = '' } = {}) {
    storagePrefix = prefix
    proxyMissingKey = prefix ? prefix + 'proxy-missing' : ''
}

// Session keys carry the project prefix, which arrives at boot.
export function storageKey(name) {
    return storagePrefix ? storagePrefix + name : name
}

let proxyMissing = false
let proxyChecked = false

function proxyReached(response) {
    return !!response.headers.get(proxyMarkerHeader)
}

function proxyAbsent(response) {
    return response.status === 404 && !proxyReached(response)
}

function relayMissing() {
    if (proxyChecked) return proxyMissing
    proxyChecked = true
    if (proxyMissingKey) {
        try {
            proxyMissing = sessionStorage.getItem(proxyMissingKey) === '1'
        } catch {
            // Without storage the page-level flag still covers this load.
        }
    }
    return proxyMissing
}

function markRelayMissing() {
    proxyMissing = true
    if (!proxyMissingKey) return
    try {
        sessionStorage.setItem(proxyMissingKey, '1')
    } catch {}
}

function proxyTargetOf(url) {
    const base = proxyBase()
    if (!base || !url.startsWith(base)) return ''
    try {
        return decodeURIComponent(url.slice(base.length))
    } catch {
        return ''
    }
}

// The proxy injects client_secret, so the token endpoint has no direct fallback.
function isTokenRequest(target) {
    const endpoint = authBase + '/access_token'
    return target === endpoint || target.startsWith(endpoint + '?')
}

function proxyUnavailableError(cause) {
    const error = new Error('代理不可用，无法完成令牌交换')
    error.code = 'PROXY_UNAVAILABLE'
    error.retryable = false
    if (cause) error.cause = cause
    return error
}

export function timeoutError(ms, { idle = false } = {}) {
    const shown = ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms)}ms`
    const error = new Error(idle ? `请求超时 ${shown}（读取空闲超时）` : `请求超时 ${shown}`)
    error.name = 'TimeoutError'
    error.timeout = true
    return error
}

async function readBody(response, signal, { idleTimeout = null, onActivity = null } = {}) {
    try {
        if (idleTimeout == null || !response.body || typeof response.body.getReader !== 'function') {
            return { text: await response.text(), complete: true }
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        const parts = []
        let complete = false
        try {
            for (;;) {
                const { done, value } = await reader.read()
                if (done) {
                    complete = true
                    break
                }
                onActivity?.()
                parts.push(decoder.decode(value, { stream: true }))
            }
            parts.push(decoder.decode())
        } finally {
            if (!complete) {
                reader.cancel().catch(() => {})
            }
        }
        return { text: parts.join(''), complete }
    } catch (error) {
        if (signal?.aborted || isAbortError(error)) throw abortError()
        if (error && typeof error === 'object') error.complete = false
        throw error
    }
}

// `signal` is the third argument on purpose: `init` goes to fetch as it is.
export async function fetchWithTimeout(url, init = {}, {
    signal = null, timeout = requestTimeoutMs, idleTimeout = null,
} = {}) {
    if (init && Object.prototype.hasOwnProperty.call(init, 'signal')) {
        const error = new Error('fetchWithTimeout: signal 必须通过第三个参数传入，不能放在 fetch init 中')
        error.retryable = false
        throw error
    }
    const direct = proxyTargetOf(url)
    const options = { signal, timeout, idleTimeout }
    if (!direct) return fetchOnce(url, init, options)
    const token = isTokenRequest(direct)
    if (relayMissing()) {
        if (token) throw proxyUnavailableError()
        return fetchOnce(direct, init, options)
    }
    let result
    try {
        result = await fetchOnce(url, init, options)
    } catch (error) {
        if (isAbortError(error) || error?.timeout) throw error
        if (token) throw proxyUnavailableError(error)
        return fetchOnce(direct, init, options)
    }
    if (!proxyAbsent(result.response)) return result
    markRelayMissing()
    if (token) throw proxyUnavailableError()
    return fetchOnce(direct, init, options)
}

async function fetchOnce(url, init, { signal, timeout, idleTimeout }) {
    if (signal?.aborted) throw abortError()
    const controller = new AbortController()
    let timedOut = false
    const deadline = idleTimeout ?? timeout
    let timer = null
    const arm = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            timedOut = true
            controller.abort()
        }, deadline)
    }
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    arm()
    try {
        const response = await fetch(url, { ...init, signal: controller.signal })
        if (idleTimeout != null) arm()
        const { text, complete } = await readBody(response, controller.signal, {
            idleTimeout,
            onActivity: idleTimeout != null ? arm : null,
        })
        return { response, text, complete }
    } catch (error) {
        if (signal?.aborted) throw abortError()
        if (timedOut || error?.name === 'TimeoutError') {
            const timeout = timeoutError(deadline, { idle: idleTimeout != null })
            timeout.complete = false
            throw timeout
        }
        if (isAbortError(error)) throw abortError()
        throw error
    } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
    }
}

function isRetryableStatus(status) {
    return status === 429 || status >= 500
}

function retryAfterMs(value) {
    if (!value) return { ms: null, truncated: false }
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) {
        const ms = Math.round(seconds * 1000)
        return { ms, truncated: ms > retryAfterMaxMs }
    }
    const date = Date.parse(value)
    if (!Number.isNaN(date)) {
        const ms = Math.max(0, date - Date.now())
        return { ms, truncated: ms > retryAfterMaxMs }
    }
    return { ms: null, truncated: false }
}

function httpError(status, path, text, contentType) {
    const type = contentType || '(none)'
    const error = new Error(`HTTP ${status} ${path} · Content-Type: ${type} · ${String(text || '').slice(0, 120)}`)
    error.status = status
    return error
}

function unauthorizedError() {
    const error = new Error('访问令牌无效或已过期，请重新登录')
    error.status = 401
    error.code = 'AUTH_REQUIRED'
    return error
}

function isTruncatedJsonMessage(message) {
    // Chrome says "Unexpected end of JSON input", Safari "Unexpected EOF"; both mean a cut body.
    return /unexpected end|unexpected eof|unterminated|\beof\b/i.test(String(message || ''))
}

function invalidJsonError(path, response, text, cause) {
    const type = response.headers.get('content-type') || '(none)'
    const parser = String(cause?.message || '(none)')
    const error = new Error(`响应不是有效的 JSON: ${path} · HTTP ${response.status} · Content-Type: ${type} · ${text.slice(0, 120)} · 解析错误: ${parser}`)
    error.status = response.status
    error.code = 'INVALID_JSON'
    error.retryable = text.trim() === '' || isTruncatedJsonMessage(parser)
    return error
}

export class BangumiApi {
    // `onUnauthorized` refreshes the token once; the caller decides how.
    constructor({
        token = '', interval = 0, maxRetries = 1, signal = null, onRetry = null, onLog = null,
        onUnauthorized = null,
    } = {}) {
        this.token = token
        this.interval = interval
        this.maxRetries = Math.max(1, Math.round(maxRetries))
        this.signal = signal
        this.onRetry = onRetry
        this.onLog = onLog
        this.onUnauthorized = onUnauthorized
    }

    buildUrl(path, params) {
        let url = apiBase + path
        if (params) {
            const query = new URLSearchParams(params).toString()
            url += (url.includes('?') ? '&' : '?') + query
        }
        return url
    }

    async getJson(path, params) {
        let lastError = null
        let refreshed = false
        let retryAfterLogged = false
        let attempt = 0
        while (attempt < this.maxRetries) {
            if (this.signal?.aborted) throw abortError()
            attempt += 1
            await sleep(this.interval, this.signal)
            let response
            let text
            try {
                ({ response, text } = await fetchWithTimeout(proxied(this.buildUrl(path, params)), {
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'Accept': 'application/json',
                    },
                }, { signal: this.signal }))
            } catch (error) {
                if (isAbortError(error) || this.signal?.aborted) throw abortError()
                if (error?.retryable === false) throw error
                lastError = error
                if (attempt < this.maxRetries) {
                    this.onRetry?.(`请求失败: ${error.message}`, attempt, this.maxRetries, retryWaitMs)
                    await sleep(retryWaitMs, this.signal)
                }
                continue
            }
            if (response.ok) {
                if (this.signal?.aborted) throw abortError()
                try {
                    return JSON.parse(text)
                } catch (error) {
                    if (this.signal?.aborted || isAbortError(error)) throw abortError()
                    const invalid = invalidJsonError(path, response, text, error)
                    lastError = invalid
                    if (!invalid.retryable) throw invalid
                    if (attempt < this.maxRetries) {
                        this.onRetry?.(`请求失败: ${invalid.message}`, attempt, this.maxRetries, retryWaitMs)
                        await sleep(retryWaitMs, this.signal)
                    }
                    continue
                }
            }
            const status = response.status
            if (status === 401) {
                if (!refreshed && this.onUnauthorized) {
                    refreshed = true
                    attempt -= 1
                    this.token = await this.onUnauthorized()
                    continue
                }
                throw unauthorizedError()
            }
            const error = httpError(status, path, text, response.headers.get('content-type'))
            if (!isRetryableStatus(status)) throw error
            lastError = error
            if (attempt < this.maxRetries) {
                let retryAfter = null
                if (status === 429 || status === 503) {
                    const parsed = retryAfterMs(response.headers.get('retry-after'))
                    if (parsed.ms != null) {
                        retryAfter = Math.min(parsed.ms, retryAfterMaxMs)
                        if (parsed.truncated && !retryAfterLogged) {
                            retryAfterLogged = true
                            this.onLog?.(`Retry-After 超过上限: ${path} · ${parsed.ms}ms 已截断为 ${retryAfterMaxMs}ms`, 'warn')
                        }
                    }
                }
                const wait = retryAfter ?? retryWaitMs
                this.onRetry?.(`请求失败: ${error.message}`, attempt, this.maxRetries, wait)
                await sleep(wait, this.signal)
            }
        }
        throw lastError || new Error('请求失败')
    }

    getMe() {
        return this.getJson('/v0/me')
    }

    getUserInfo(username) {
        return this.getJson(`/v0/users/${encodeURIComponent(username)}`)
    }

    getUserCollectionsPage(username, offset = 0, limit = 30) {
        return this.getJson(`/v0/users/${encodeURIComponent(username)}/collections`, { limit, offset })
    }

    getSubject(id) {
        return this.getJson(`/v0/subjects/${id}`)
    }

    getEpisodesPage(subjectId, typeKey, offset = 0, limit = 100) {
        return this.getJson('/v0/episodes', { subject_id: subjectId, type: typeKey, limit, offset })
    }

    getUserProgress(username, subjectId) {
        return this.getJson(`/user/${encodeURIComponent(username)}/progress`, { subject_id: subjectId })
    }
}

async function fetchEpisodeType(api, subjectId, typeKey) {
    const first = await api.getEpisodesPage(subjectId, typeKey, 0, 100)
    if (!first || !Array.isArray(first.data) || !Number.isInteger(first.total)) {
        throw new Error(`分集列表响应异常 subject=${subjectId} type=${typeKey}`)
    }
    const total = first.total
    let list = first.data.slice()
    if (list.length > total) {
        throw new Error(`分集列表条数异常 subject=${subjectId} type=${typeKey}: ${list.length}/${total}`)
    }
    while (list.length < total) {
        const offset = list.length
        const page = await api.getEpisodesPage(subjectId, typeKey, offset, 100)
        if (!page || !Array.isArray(page.data)) {
            throw new Error(`分集列表分页响应异常 subject=${subjectId} type=${typeKey}`)
        }
        if (!page.data.length) {
            throw new Error(`分集列表分页为空 subject=${subjectId} type=${typeKey}: ${list.length}/${total}`)
        }
        list = list.concat(page.data)
        if (list.length <= offset) {
            throw new Error(`分集列表分页未增长 subject=${subjectId} type=${typeKey}: ${list.length}/${total}`)
        }
    }
    if (list.length !== total) {
        throw new Error(`分集列表不完整 subject=${subjectId} type=${typeKey}: ${list.length}/${total}`)
    }
    return list
}

export async function fetchEpisodeData(api, subjectId, { onSkip = null } = {}) {
    const result = emptyEpisodeGroups()
    for (const typeKey of epTypeKeys) {
        try {
            result[typeKey] = await fetchEpisodeType(api, subjectId, typeKey)
        } catch (error) {
            if (/not valid episode type/i.test(error.message)) {
                onSkip?.(typeKey)
                continue
            }
            throw error
        }
    }
    return result
}

// A 200 body of `null` says the endpoint has no progress; a 404 proves nothing.
export async function readProgress(api, username, subjectId) {
    let data
    try {
        data = await api.getUserProgress(username, subjectId)
    } catch (error) {
        if (error.status === 404) return { ok: false, status: 404 }
        throw error
    }
    if (data && data.code === 401 && data.error) {
        const error = new Error('unauthorized')
        error.code = 'unauthorized'
        error.status = 401
        throw error
    }
    if (data == null) return { ok: true, progress: { eps: [] } }
    if (Array.isArray(data)) return { ok: true, progress: { eps: data } }
    if (data && typeof data === 'object' && Array.isArray(data.eps)) return { ok: true, progress: data }
    return { ok: false }
}
