import {
    apiBase, authBase, proxyUrl, requestIntervalLimits, requestRetryLimits, requestTimeoutMs,
    retryAfterMaxMs, retryWaitMs, staticChunkMaxBytes, staticChunkMaxOutputBytes,
    staticDataIdleTimeoutMs, storagePrefix,
} from '../config.js'
import { parseShard } from '../worker/chunk.js'

const chunkWorkerTimeoutMs = 30000

const pauseHeartbeatMs = 20000

const pauseIdleMs = 3000

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

function groupEpisodesByType(episodes) {
    const grouped = emptyEpisodeGroups()
    for (const episode of episodes) {
        const key = episode.type == null ? epTypeUnknown : String(episode.type)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(episode)
    }
    return grouped
}

function clampTo(value, limit) {
    const number = Number(value)
    if (!Number.isFinite(number)) return limit.fallback
    return Math.min(limit.max, Math.max(limit.min, Math.round(number)))
}

export function normalizeRequestSettings({ interval, maxRetries } = {}) {
    return {
        interval: clampTo(interval, requestIntervalLimits),
        maxRetries: clampTo(maxRetries, requestRetryLimits),
    }
}

const abortMessage = '__ABORTED__'

export function abortError() {
    const error = new Error(abortMessage)
    error.name = 'AbortedError'
    return error
}

export function isAbortError(error) {
    return !!error && (error.name === 'AbortedError'
        || error.name === 'AbortError'
        || error.message === abortMessage)
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

const proxyMarkerHeader = 'x-cross-origin'

const proxyMissingKey = storagePrefix + 'proxy-missing'
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
    try {
        proxyMissing = sessionStorage.getItem(proxyMissingKey) === '1'
    } catch {
        // Without storage the page-level flag still covers this load.
    }
    return proxyMissing
}

function markRelayMissing() {
    proxyMissing = true
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

function timeoutError(ms, { idle = false } = {}) {
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

function chunkTooLargeError() {
    const mb = Math.round(staticChunkMaxBytes / 1024 / 1024)
    return new Error(`静态分片超过 ${mb} MB 上限`)
}

async function readBodyBytes(response, signal, { arm = null, maxBytes }) {
    try {
        if (!response.body || typeof response.body.getReader !== 'function') {
            const buffer = await response.arrayBuffer()
            if (buffer.byteLength > maxBytes) throw chunkTooLargeError()
            return buffer
        }
        const reader = response.body.getReader()
        const chunks = []
        let total = 0
        let complete = false
        try {
            for (;;) {
                const { done, value } = await reader.read()
                if (done) {
                    complete = true
                    break
                }
                arm?.()
                total += value.byteLength
                if (total > maxBytes) throw chunkTooLargeError()
                chunks.push(value)
            }
        } finally {
            if (!complete) reader.cancel().catch(() => {})
        }
        const out = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) {
            out.set(chunk, offset)
            offset += chunk.byteLength
        }
        return out.buffer
    } catch (error) {
        if (signal?.aborted || isAbortError(error)) throw abortError()
        throw error
    }
}

async function fetchChunkBytes(url, { signal = null } = {}) {
    if (signal?.aborted) throw abortError()
    const controller = new AbortController()
    let timedOut = false
    let timer = null
    const arm = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            timedOut = true
            controller.abort()
        }, staticDataIdleTimeoutMs)
    }
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    arm()
    try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status} ${response.statusText}`)
            error.status = response.status
            throw error
        }
        const header = Number(response.headers.get('content-length'))
        if (Number.isFinite(header) && header > staticChunkMaxBytes) throw chunkTooLargeError()
        if (response.body && typeof response.body.getReader === 'function') arm()
        return await readBodyBytes(response, controller.signal, {
            arm, maxBytes: staticChunkMaxBytes,
        })
    } catch (error) {
        if (signal?.aborted) throw abortError()
        if (timedOut || error?.name === 'TimeoutError') {
            throw timeoutError(staticDataIdleTimeoutMs, { idle: true })
        }
        if (isAbortError(error)) throw abortError()
        throw error
    } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
    }
}

function createChunkWorker() {
    if (typeof Worker !== 'function') return null
    try {
        return new Worker(new URL('../worker/chunk.js', import.meta.url), { type: 'module' })
    } catch {
        return null
    }
}

function postServiceWorkerMessage(type, payload = {}) {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const message = { type, ...payload }
    const send = worker => {
        try {
            worker?.postMessage(message)
        } catch { /* a replaced worker must not break the backup */ }
    }
    if (navigator.serviceWorker.controller) {
        send(navigator.serviceWorker.controller)
        return
    }
    navigator.serviceWorker.ready.then(registration => send(registration.active)).catch(() => {})
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

const bgmDirs = { subject: 'subjects', episode: 'episodes' }

// Each kind is sorted by one id, and a shard declares the range it covers.
const shardRanges = {
    subject: { minKey: 'min_id', maxKey: 'max_id' },
    episode: { minKey: 'min_subject_id', maxKey: 'max_subject_id' },
}

// Returns why a manifest cannot be trusted for range lookup, or ''. A wrong range
// sends the lookup into a shard without the id, so the caller scans all shards.
function manifestProblem(kind, data) {
    const { minKey, maxKey } = shardRanges[kind]
    const chunks = data.chunks
    if (!chunks.length) return '清单没有分片'
    let previousMax = null
    const names = new Set()
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        if (typeof chunk?.file !== 'string' || !chunk.file) return `分片 ${i} 缺少文件名`
        if (names.has(chunk.file)) return `分片文件名重复 ${chunk.file}`
        names.add(chunk.file)
        const min = chunk[minKey]
        const max = chunk[maxKey]
        if (!Number.isInteger(min) || !Number.isInteger(max)) {
            return `分片 ${chunk.file} 区间无效`
        }
        if (min > max) return `分片 ${chunk.file} 区间倒置 ${min}-${max}`
        if (previousMax != null && min <= previousMax) {
            return `分片 ${chunk.file} 与上一片重叠 ${min} <= ${previousMax}`
        }
        previousMax = max
    }
    const counted = chunks.every(chunk => Number.isInteger(chunk?.count) && chunk.count >= 0)
    if (!counted || !Number.isInteger(data.total)) return ''
    const sum = chunks.reduce((total, chunk) => total + chunk.count, 0)
    if (sum !== data.total) return `分片条目合计 ${sum} 与 total ${data.total} 不一致`
    // Episode shards are packed by subject count, so their count cannot come from `total`.
    if (kind !== 'subject') return ''
    if (!Number.isInteger(data.chunk_size) || data.chunk_size <= 0) return ''
    const expected = Math.ceil(data.total / data.chunk_size)
    if (chunks.length !== expected) {
        return `分片数 ${chunks.length} 与按 total 计算的 ${expected} 不一致`
    }
    return ''
}

function binarySearchChunk(chunks, id, minKey, maxKey) {
    let low = 0
    let high = chunks.length - 1
    while (low <= high) {
        const mid = (low + high) >> 1
        const chunk = chunks[mid]
        if (id < chunk[minKey]) high = mid - 1
        else if (id > chunk[maxKey]) low = mid + 1
        else return mid
    }
    return -1
}

function locateChunks(manifest, ids, minKey, maxKey) {
    const result = new Set()
    for (const id of ids) {
        const index = binarySearchChunk(manifest.chunks, id, minKey, maxKey)
        if (index >= 0) result.add(manifest.chunks[index])
    }
    return Array.from(result)
}

// A chunk without a file name cannot be requested; a repeated name is one shard.
function usableChunks(manifest) {
    const seen = new Set()
    const list = []
    for (const chunk of manifest.chunks) {
        if (typeof chunk?.file !== 'string' || !chunk.file) continue
        if (seen.has(chunk.file)) continue
        seen.add(chunk.file)
        list.push(chunk)
    }
    return list
}

// The retry pass can repeat entries the located pass returned, so lists merge by entry id.
function mergeChunkData(target, extra) {
    for (const [id, value] of extra) {
        if (!Array.isArray(value)) {
            if (!target.has(id)) target.set(id, value)
            continue
        }
        if (!target.has(id)) target.set(id, [])
        const list = target.get(id)
        const seen = new Set(list.map(entry => entry.id))
        for (const entry of value) {
            if (entry.id != null && seen.has(entry.id)) continue
            if (entry.id != null) seen.add(entry.id)
            list.push(entry)
        }
    }
    return target
}

// The statistics shape shared with runner.js.
export function createStaticStats() {
    return {
        chunks: 0, chunk_failures: 0, parse_failures: 0, manifest_failures: 0,
        manifest_unreliable: 0, snapshot_miss: 0, snapshot_miss_unreliable: 0,
        episode_shortfall: 0, entries: 0,
    }
}

// `eps` counts main episodes, so only type 0 compares; a snapshot without types uses its total.
function staticEpisodeCount(episodes) {
    const typed = episodes.some(episode => Number.isInteger(episode.type))
    if (!typed) return episodes.length
    return episodes.filter(episode => episode.type === 0).length
}

// A lag of an episode or two is accepted: one hit of two stays usable, one hit
// of three does not.
function staticEpisodesShort(available, expected) {
    if (!Number.isInteger(expected) || expected <= 0) return false
    if (available === 0) return true
    return expected - available > Math.max(1, Math.ceil(expected / 10))
}

// Only the first notes are logged; the rest are counted in one closing line.
const episodeNoteLimit = 5

// The stage note names the reason for a wider read; the retry note stays neutral.
const noteUnreliable = '（清单不可靠，扫描全部分片）'
const noteRetry = '（分片读取失败，补读其余分片）'

// The service worker prefetches every shard in the manifest, so a stored shard costs no request.
export function createBgmSource({
    base, signal = null, onStage = null, onProgress = null, onLog = null,
} = {}) {
    const manifests = new Map()
    const notified = new Set()
    let chunkWorker = null
    let workerDisabled = false
    let workerSequence = 0
    const workerCalls = new Map()
    const backupSession = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random()
    let pauseSequence = 0
    let pauseToken = ''
    let pauseHolds = 0
    let pauseReads = 0
    let pauseIdleTimer = null
    let pauseHeartbeat = null

    // terminate() never settles posted Promises, so rejecting them keeps a closing
    // source from leaving a caller waiting. It is not an abort; the run continues.
    function closeWorker() {
        for (const call of workerCalls.values()) {
            call.cleanup()
            call.reject(new Error('静态分片 Worker 已关闭'))
        }
        workerCalls.clear()
        if (chunkWorker) {
            chunkWorker.terminate()
            chunkWorker = null
        }
    }

    // One worker failure disables the worker for the run: main-thread parsing of later
    // shards costs less than a timeout each.
    function failWorker(error) {
        workerDisabled = true
        for (const call of workerCalls.values()) {
            call.cleanup()
            call.reject(error)
        }
        workerCalls.clear()
        if (chunkWorker) {
            chunkWorker.terminate()
            chunkWorker = null
        }
    }

    function ensureWorker() {
        if (workerDisabled) return null
        if (chunkWorker) return chunkWorker
        const worker = createChunkWorker()
        if (!worker) return null
        worker.onmessage = event => {
            const data = event.data || {}
            const call = workerCalls.get(data.id)
            if (!call) return
            workerCalls.delete(data.id)
            call.cleanup()
            if (data.ok) {
                call.resolve({
                    entries: data.entries || [],
                    parseFailures: data.parseFailures || 0,
                })
            } else {
                // A bad-shard report is not a worker failure: the worker stays usable and the shard
                // is counted as failed, since a main-thread retry would fail the same way.
                const error = new Error(data.message || '静态分片解压失败')
                error.shardFailure = true
                call.reject(error)
            }
        }
        worker.onerror = event => {
            failWorker(new Error(event.message || '静态分片 Worker 失败'))
        }
        chunkWorker = worker
        return worker
    }

    function parseChunk(buffer, options) {
        const worker = ensureWorker()
        if (!worker) return parseShard(buffer, options)
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(abortError())
                return
            }
            const id = ++workerSequence
            let timer = null
            const cleanup = () => {
                signal?.removeEventListener('abort', onAbort)
                if (timer) clearTimeout(timer)
            }
            const onAbort = () => {
                const call = workerCalls.get(id)
                workerCalls.delete(id)
                call?.cleanup()
                reject(abortError())
                failWorker(abortError())
            }
            workerCalls.set(id, { resolve, reject, cleanup })
            signal?.addEventListener('abort', onAbort, { once: true })
            timer = setTimeout(() => {
                const call = workerCalls.get(id)
                if (!call) return
                workerCalls.delete(id)
                const error = new Error('静态分片 Worker 超时')
                error.name = 'TimeoutError'
                call.cleanup()
                call.reject(error)
                failWorker(error)
            }, chunkWorkerTimeoutMs)
            try {
                worker.postMessage({ id, buffer, ...options })
            } catch (error) {
                workerCalls.delete(id)
                cleanup()
                // A worker that cannot take a message is unusable; the catch closes it and parses here.
                failWorker(error)
                reject(error)
            }
        }).catch(error => {
            if (isAbortError(error) || signal?.aborted) throw abortError()
            if (error?.shardFailure) throw error
            failWorker(error)
            return parseShard(buffer, options)
        })
    }

    // The pause lives in the worker's memory; resending lets a restarted worker pick it up.
    function heartbeatPause() {
        if (!pauseToken) return
        postServiceWorkerMessage('PAUSE', { reason: 'backup', token: pauseToken })
    }

    // One pause covers every static read of a run, so no gap lets the prefetch resume.
    function openPause() {
        if (pauseIdleTimer) {
            clearTimeout(pauseIdleTimer)
            pauseIdleTimer = null
        }
        if (pauseToken) return
        pauseSequence += 1
        pauseToken = `${backupSession}:${pauseSequence}`
        heartbeatPause()
        pauseHeartbeat = setInterval(heartbeatPause, pauseHeartbeatMs)
    }

    function closePause() {
        if (pauseIdleTimer) {
            clearTimeout(pauseIdleTimer)
            pauseIdleTimer = null
        }
        if (!pauseToken) return
        if (pauseHeartbeat) {
            clearInterval(pauseHeartbeat)
            pauseHeartbeat = null
        }
        postServiceWorkerMessage('START', { reason: 'backup', token: pauseToken })
        pauseToken = ''
    }

    // A source without a held run releases its pause when idle; a held run keeps it across stages.
    function releasePauseWhenIdle() {
        if (pauseHolds > 0 || pauseReads > 0 || !pauseToken) return
        if (pauseIdleTimer) clearTimeout(pauseIdleTimer)
        pauseIdleTimer = setTimeout(function () {
            pauseIdleTimer = null
            if (pauseHolds > 0 || pauseReads > 0) return
            closePause()
        }, pauseIdleMs)
    }

    async function withPause(work) {
        pauseReads += 1
        openPause()
        try {
            return await work()
        } finally {
            pauseReads -= 1
            releasePauseWhenIdle()
        }
    }

    function holdPause() {
        pauseHolds += 1
        openPause()
    }

    function close() {
        pauseHolds = 0
        pauseReads = 0
        closePause()
        closeWorker()
    }

    // One warning per kind: a repaired manifest must not repeat it, but every read still counts.
    function markUnreliable(kind, stats, reason) {
        stats.manifest_unreliable += 1
        if (notified.has(kind)) return
        notified.add(kind)
        onLog?.(`静态 ${kind} 清单不可靠: ${reason}，改为读取全部分片`, 'warn')
    }

    // A static snapshot is optional: a broken manifest is counted and logged, never fatal.
    async function readManifest(kind, stats) {
        if (manifests.has(kind)) return manifests.get(kind)
        const url = `${base}/${bgmDirs[kind]}/manifest.json`
        try {
            const { response, text } = await fetchWithTimeout(url, { cache: 'no-store' }, { signal })
            if (response.status === 404) {
                manifests.set(kind, null)
                return null
            }
            if (!response.ok) throw new Error(`manifest HTTP ${response.status}`)
            const data = JSON.parse(text)
            if (!data || !Array.isArray(data.chunks)) throw new Error('manifest 格式不正确')
            const problem = manifestProblem(kind, data)
            const entry = { manifest: data, reliable: !problem, problem }
            manifests.set(kind, entry)
            return entry
        } catch (error) {
            if (isAbortError(error) || signal?.aborted) throw abortError()
            stats.manifest_failures += 1
            onLog?.(`静态 ${kind} 清单读取失败: ${error.message}`, 'warn')
            manifests.set(kind, null)
            return null
        }
    }

    // Each shard file is read once per fill; a file in `attempted` only advances progress.
    async function loadChunks(kind, chunks, idSet, ids, idKey, stats, { note = '', attempted }) {
        const result = new Map()
        onStage?.(`读取静态 ${kind} 数据${note}`, chunks.length)
        for (let i = 0; i < chunks.length; i++) {
            if (signal?.aborted) throw abortError()
            const chunk = chunks[i]
            if (attempted.has(chunk.file)) {
                onProgress?.(i + 1)
                continue
            }
            attempted.add(chunk.file)
            stats.chunks += 1
            let entries = []
            let parseFailures = 0
            try {
                const buffer = await fetchChunkBytes(
                    `${base}/${bgmDirs[kind]}/${chunk.file}`,
                    { signal },
                )
                const parsed = await parseChunk(buffer, {
                    ids,
                    idKey,
                    maxOutputBytes: staticChunkMaxOutputBytes,
                })
                entries = parsed.entries
                parseFailures = parsed.parseFailures
            } catch (error) {
                if (isAbortError(error) || signal?.aborted) throw abortError()
                stats.chunk_failures += 1
                onLog?.(`读取静态 ${kind} 分片 ${chunk.file} 失败: ${error.message}`, 'warn')
                onProgress?.(i + 1)
                continue
            }
            stats.parse_failures += parseFailures
            for (const entry of entries) {
                const id = entry[idKey]
                if (id == null || !idSet.has(id)) continue
                if (kind === 'episode') {
                    if (!result.has(id)) result.set(id, [])
                    result.get(id).push(entry)
                } else {
                    result.set(id, entry)
                }
                stats.entries += 1
            }
            onProgress?.(i + 1)
        }
        return result
    }

    // The range lookup stays in charge unless a located shard fails; a miss goes to the API.
    async function loadStaticData(kind, source, idSet, idKey, stats, { countMiss = true } = {}) {
        const ids = Array.from(idSet)
        const attempted = new Set()
        const failuresBefore = stats.chunk_failures + stats.parse_failures
        // A failed or partly unread shard already hides its ids, so those reads are not
        // counted again as misses.
        const noteMiss = (data, reliable) => {
            if (!countMiss) return data
            if (stats.chunk_failures + stats.parse_failures > failuresBefore) return data
            let missed = 0
            for (const id of ids) if (!data.has(id)) missed += 1
            if (!missed) return data
            if (reliable) {
                stats.snapshot_miss += missed
                onLog?.(`静态 ${kind} 快照未覆盖 ${missed} 条，交给接口补取`, 'info')
            } else {
                stats.snapshot_miss_unreliable += missed
                onLog?.(`静态 ${kind} 全部分片仍未取得 ${missed} 条，交给接口补取`, 'info')
            }
            return data
        }
        const scanAll = note => loadChunks(
            kind, usableChunks(source.manifest), idSet, ids, idKey, stats, { note, attempted },
        )
        if (!source.reliable) {
            markUnreliable(kind, stats, source.problem)
            return noteMiss(await scanAll(noteUnreliable), false)
        }
        const { minKey, maxKey } = shardRanges[kind]
        const located = locateChunks(source.manifest, ids, minKey, maxKey)
        if (!located.length) return noteMiss(new Map(), true)
        const failures = stats.chunk_failures
        const data = await loadChunks(kind, located, idSet, ids, idKey, stats, { attempted })
        // A listed shard failed, so its range proves nothing; the retry reads only untried shards.
        const merged = stats.chunk_failures === failures
            ? data
            : mergeChunkData(data, await scanAll(noteRetry))
        return noteMiss(merged, true)
    }

    return {
        async fillSubjects(items, { countMiss = true } = {}) {
            const stats = createStaticStats()
            const ids = new Set()
            for (const item of items) {
                if (item.subject_data == null) ids.add(item.subject_id)
            }
            if (!ids.size) return { filled: 0, stats }
            const data = await withPause(async () => {
                const source = await readManifest('subject', stats)
                if (!source || !source.manifest.chunks.length) return null
                return loadStaticData('subject', source, ids, 'id', stats, { countMiss })
            })
            if (!data) return { filled: 0, stats }
            let filled = 0
            for (const item of items) {
                if (item.subject_data == null && data.has(item.subject_id)) {
                    item.subject_data = data.get(item.subject_id)
                    filled++
                }
            }
            return { filled, stats }
        },

        async fillEpisodes(items) {
            const stats = createStaticStats()
            const ids = new Set()
            for (const item of items) {
                if (item.ep_data == null) ids.add(item.subject_id)
            }
            if (!ids.size) return { filled: 0, stats }
            const data = await withPause(async () => {
                const source = await readManifest('episode', stats)
                if (!source || !source.manifest.chunks.length) return null
                return loadStaticData('episode', source, ids, 'subject_id', stats)
            })
            if (!data) return { filled: 0, stats }
            let filled = 0
            let noted = 0
            for (const item of items) {
                if (item.ep_data != null) continue
                const episodes = data.get(item.subject_id) || []
                const available = staticEpisodeCount(episodes)
                if (staticEpisodesShort(available, item.subject_data?.eps)) {
                    // An empty or short list is counted too: the API then fetches the complete one.
                    stats.episode_shortfall += 1
                    if (noted < episodeNoteLimit) {
                        noted += 1
                        onLog?.(`静态分集少于条目话数 subject=${item.subject_id}: 本篇 ${available}/${item.subject_data.eps}，留给接口补取`, 'warn')
                    }
                    continue
                }
                if (!episodes.length) continue
                item.ep_data = groupEpisodesByType(episodes)
                filled++
            }
            if (stats.episode_shortfall > episodeNoteLimit) {
                onLog?.(`静态分集少于条目话数 ${stats.episode_shortfall} 条，已交给接口补取`, 'warn')
            }
            return { filled, stats }
        },

        // The run holds the pause from its first request to its last, so the prefetch behind
        // it stays stopped for the list, the static reads and the API calls.
        pause: holdPause,
        close,
    }
}
