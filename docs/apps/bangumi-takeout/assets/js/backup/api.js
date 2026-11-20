// Bangumi API requests plus the static subject and episode data source.
// api.bgm.tv sends no CORS headers, so every request goes through the proxy.
import {
    API_BASE, PROXY_URL, REQUEST_INTERVAL_LIMITS, REQUEST_RETRY_LIMITS, REQUEST_TIMEOUT_MS,
    RETRY_AFTER_MAX_MS, RETRY_WAIT_MS, STATIC_CHUNK_MAX_BYTES, STATIC_CHUNK_MAX_OUTPUT_BYTES,
    STATIC_DATA_IDLE_TIMEOUT_MS,
} from '../config.js'
import { parseShard } from '../worker/chunk.js'

// A wedged worker must not hold the backup open forever; a shard parses well
// under this bound, and the caller falls back to the main thread.
const CHUNK_WORKER_TIMEOUT_MS = 30000

// A hidden page throttles timers to about once a minute, so one beat per
// 20 seconds still lets a restarted worker restore the pause.
const PAUSE_HEARTBEAT_MS = 20000

// A static read releases the pause a moment after it ends; the next read of the
// same source keeps it, so no download starts between two phases. The backup
// run itself holds the pause and never waits for this timer.
const PAUSE_IDLE_MS = 3000

// /v0/episodes accepts these types only; asking for another one fails.
const EP_TYPE_KEYS = [0, 1, 2, 3, 4, 6]

// An episode without a usable type still exists in the static snapshot. Both
// data paths keep it in this fixed bucket so the two shapes stay comparable.
const EP_TYPE_UNKNOWN = 'unknown'

function emptyEpisodeGroups() {
    const groups = {}
    for (const key of EP_TYPE_KEYS) groups[String(key)] = []
    groups[EP_TYPE_UNKNOWN] = []
    return groups
}

function groupEpisodesByType(episodes) {
    const grouped = emptyEpisodeGroups()
    for (const episode of episodes) {
        const key = episode.type == null ? EP_TYPE_UNKNOWN : String(episode.type)
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
        interval: clampTo(interval, REQUEST_INTERVAL_LIMITS),
        maxRetries: clampTo(maxRetries, REQUEST_RETRY_LIMITS),
    }
}

const ABORT_MESSAGE = '__ABORTED__'

export function abortError() {
    const error = new Error(ABORT_MESSAGE)
    error.name = 'AbortedError'
    return error
}

export function isAbortError(error) {
    return !!error && (error.name === 'AbortedError'
        || error.name === 'AbortError'
        || error.message === ABORT_MESSAGE)
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

export function proxied(url) {
    if (!PROXY_URL) return url
    let base = PROXY_URL
    if (!base.includes('?url=') && !base.includes('?target=')) {
        base = base.replace(/\?$/, '') + (base.includes('?') ? '&' : '?') + 'url='
    }
    return base + encodeURIComponent(url)
}

function timeoutError(ms, { idle = false } = {}) {
    const shown = ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms)}ms`
    const error = new Error(idle ? `请求超时 ${shown}（读取空闲超时）` : `请求超时 ${shown}`)
    error.name = 'TimeoutError'
    error.timeout = true
    return error
}

// The body is read under the same abort signal as the request, so a stalled
// body stream is bounded by the caller's abort and by the request deadline.
// With `idleTimeout`, the stream is consumed incrementally and `onActivity`
// restarts the timer on every chunk; a multi-megabyte static chunk therefore
// only fails when the transfer truly stops sending data.
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
                // A cancelled, timed-out or broken stream rejects cancel();
                // handle that rejection so the stop path never logs an
                // unhandled promise rejection.
                reader.cancel().catch(() => {})
            }
        }
        return { text: parts.join(''), complete }
    } catch (error) {
        if (signal?.aborted || isAbortError(error)) throw abortError()
        // The stream failed before `done`; record that the body really is
        // incomplete instead of leaving the flag permanently true.
        if (error && typeof error === 'object') error.complete = false
        throw error
    }
}

// Every fetch goes through here: a stalled proxy must not hang a backup, and
// the caller's abort signal must still win over the local timer. The timer is
// cleared only after the body was read, never when the response head arrives.
// `signal` is a third-argument option on purpose: fetch init also accepts a
// `signal`, and passing both silently drops the caller's abort, so an init
// signal is rejected loudly instead of being ignored.
export async function fetchWithTimeout(url, init = {}, {
    signal = null, timeout = REQUEST_TIMEOUT_MS, idleTimeout = null,
} = {}) {
    if (init && Object.prototype.hasOwnProperty.call(init, 'signal')) {
        const error = new Error('fetchWithTimeout: signal 必须通过第三个参数传入，不能放在 fetch init 中')
        // A wiring mistake is not a transport failure: retrying cannot fix it.
        error.retryable = false
        throw error
    }
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
        // The response head proves the connection is alive; start a fresh
        // idle window before waiting for the first body chunk.
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
    const mb = Math.round(STATIC_CHUNK_MAX_BYTES / 1024 / 1024)
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

// A shard may be a ZIP or a plain JSONL file. The body is counted as it
// arrives so a missing or false Content-Length cannot bypass the cap.
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
        }, STATIC_DATA_IDLE_TIMEOUT_MS)
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
        if (Number.isFinite(header) && header > STATIC_CHUNK_MAX_BYTES) throw chunkTooLargeError()
        if (response.body && typeof response.body.getReader === 'function') arm()
        return await readBodyBytes(response, controller.signal, {
            arm, maxBytes: STATIC_CHUNK_MAX_BYTES,
        })
    } catch (error) {
        if (signal?.aborted) throw abortError()
        if (timedOut || error?.name === 'TimeoutError') {
            throw timeoutError(STATIC_DATA_IDLE_TIMEOUT_MS, { idle: true })
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

// The page and the worker use one parser; a worker that cannot start or dies
// falls back to the main thread without turning a readable shard into a loss.
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

// Returns the parsed delay in milliseconds and whether the value exceeded the
// cap. Callers clamp and log once per request, with the request path.
function retryAfterMs(value) {
    if (!value) return { ms: null, truncated: false }
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) {
        const ms = Math.round(seconds * 1000)
        return { ms, truncated: ms > RETRY_AFTER_MAX_MS }
    }
    const date = Date.parse(value)
    if (!Number.isNaN(date)) {
        const ms = Math.max(0, date - Date.now())
        return { ms, truncated: ms > RETRY_AFTER_MAX_MS }
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
    // Chrome/V8 says "Unexpected end of JSON input", Safari says
    // "Unexpected EOF"; both mean the body ended before the JSON did.
    return /unexpected end|unexpected eof|unterminated|\beof\b/i.test(String(message || ''))
}

function invalidJsonError(path, response, text, cause) {
    const type = response.headers.get('content-type') || '(none)'
    const parser = String(cause?.message || '(none)')
    const error = new Error(`响应不是有效的 JSON: ${path} · HTTP ${response.status} · Content-Type: ${type} · ${text.slice(0, 120)} · 解析错误: ${parser}`)
    error.status = response.status
    error.code = 'INVALID_JSON'
    // An empty or parser-confirmed truncated body is a transport failure worth
    // retrying; a complete non-JSON body is an answer, not a dropped packet.
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
        let url = API_BASE + path
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
                // The abort signal belongs in the options argument; putting it
                // in the fetch init made fetchWithTimeout drop it silently.
                ({ response, text } = await fetchWithTimeout(proxied(this.buildUrl(path, params)), {
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'Accept': 'application/json',
                    },
                }, { signal: this.signal }))
            } catch (error) {
                if (isAbortError(error) || this.signal?.aborted) throw abortError()
                // A wiring error is not a transport failure; retrying it would
                // only repeat the same mistake after a pointless wait.
                if (error?.retryable === false) throw error
                // Timeouts and transport failures are retried; a cancelled run
                // above is never rewritten into a parse or network error.
                lastError = error
                if (attempt < this.maxRetries) {
                    this.onRetry?.(`请求失败: ${error.message}`, attempt, this.maxRetries, RETRY_WAIT_MS)
                    await sleep(RETRY_WAIT_MS, this.signal)
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
                        this.onRetry?.(`请求失败: ${invalid.message}`, attempt, this.maxRetries, RETRY_WAIT_MS)
                        await sleep(RETRY_WAIT_MS, this.signal)
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
                        retryAfter = Math.min(parsed.ms, RETRY_AFTER_MAX_MS)
                        if (parsed.truncated && !retryAfterLogged) {
                            retryAfterLogged = true
                            this.onLog?.(`Retry-After 超过上限: ${path} · ${parsed.ms}ms 已截断为 ${RETRY_AFTER_MAX_MS}ms`, 'warn')
                        }
                    }
                }
                const wait = retryAfter ?? RETRY_WAIT_MS
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
    for (const typeKey of EP_TYPE_KEYS) {
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

const BGM_DIRS = { subject: 'subjects', episode: 'episodes' }

// Each kind is sorted by one id, and a shard declares the range it covers.
const SHARD_RANGES = {
    subject: { minKey: 'min_id', maxKey: 'max_id' },
    episode: { minKey: 'min_subject_id', maxKey: 'max_subject_id' },
}

// Returns the reason a manifest cannot be trusted for range lookup, or an empty
// string. A wrong range silently sends the lookup to a shard without the id, so
// the caller scans every shard instead of trusting a bad order.
function manifestProblem(kind, data) {
    const { minKey, maxKey } = SHARD_RANGES[kind]
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
    // Only the subject shards are packed by entry count. The episode shards are
    // packed by subject count, so their shard number cannot be derived from
    // `total` and is left unchecked.
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

// A chunk without a usable name cannot be requested at all; a full scan skips
// it instead of asking the server for an empty address. A repeated name is the
// same shard, so it is read once.
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

// A shard read in the retry pass can hold an entry the located pass already
// returned, so episode lists are merged by episode id.
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

// The one static-data statistics shape shared by the source and the runner.
export function createStaticStats() {
    return {
        chunks: 0, chunk_failures: 0, parse_failures: 0, manifest_failures: 0,
        manifest_unreliable: 0, snapshot_miss: 0, snapshot_miss_unreliable: 0,
        episode_shortfall: 0, entries: 0,
    }
}

// `eps` counts the main episodes only, so the main type is the comparable one.
// A snapshot that carries no type at all falls back to its total.
function staticEpisodeCount(episodes) {
    const typed = episodes.some(episode => Number.isInteger(episode.type))
    if (!typed) return episodes.length
    return episodes.filter(episode => episode.type === 0).length
}

// A snapshot can lag by an episode or two, so a small difference is accepted.
// One tolerated episode is deliberate: a two-episode subject with one hit stays
// writable, which is the agreed tolerance, while a three-episode subject with
// one hit cannot pass as complete.
function staticEpisodesShort(available, expected) {
    if (!Number.isInteger(expected) || expected <= 0) return false
    if (available === 0) return true
    return expected - available > Math.max(1, Math.ceil(expected / 10))
}

// Only the first few per-subject notes are written, so shard failures stay
// visible in the log; the rest are counted in one closing line.
const EPISODE_NOTE_LIMIT = 5

// The stage note tells the reader which reason started a wider read. The retry
// note stays neutral because a failed fetch and a shard-level unzip error share
// the same retry pass.
const NOTE_UNRELIABLE = '（清单不可靠，扫描全部分片）'
const NOTE_RETRY = '（分片读取失败，补读其余分片）'

// The service worker caches the app's own files listed in its manifest. Static
// data shards are not in that list: the backup page reads them on demand and
// keeps no copy, so the next run fetches a shard again.
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

    // terminate() never settles the Promises posted to the worker. Rejecting
    // them here keeps a closing source from leaving a caller waiting forever.
    // The error is not an abort error: a closed worker is not a user
    // cancellation, and reporting it as one would stop the whole run.
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

    // One worker failure disables the worker for the rest of the run. Parsing
    // every later shard on the main thread costs less than a full worker
    // timeout per shard, and the parser is the same in both paths.
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
                // The worker ran fine and reported a bad shard. That is not a
                // worker failure: the worker stays usable, and replying the same
                // buffer on the main thread could not change the outcome, so the
                // shard is counted as failed and skipped.
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
            }, CHUNK_WORKER_TIMEOUT_MS)
            try {
                worker.postMessage({ id, buffer, ...options })
            } catch (error) {
                workerCalls.delete(id)
                cleanup()
                // A worker that cannot take a message is unusable; the later
                // catch closes it and parses this shard on the main thread.
                failWorker(error)
                reject(error)
            }
        }).catch(error => {
            if (isAbortError(error) || signal?.aborted) throw abortError()
            // The worker itself ran fine and reported a bad shard. Parsing the
            // same buffer again cannot change that, so the shard is counted as
            // failed and the worker stays usable.
            if (error?.shardFailure) throw error
            failWorker(error)
            return parseShard(buffer, options)
        })
    }

    // The pause lives in the worker's memory and lasts until the backup ends;
    // resending it only lets a restarted worker pick the pause up again.
    function heartbeatPause() {
        if (!pauseToken) return
        postServiceWorkerMessage('PAUSE', { reason: 'backup', token: pauseToken })
    }

    // One pause covers every static read of a run: the list and the manifest
    // read happen inside it, and two phases never leave a gap where the
    // prefetch could resume.
    function openPause() {
        if (pauseIdleTimer) {
            clearTimeout(pauseIdleTimer)
            pauseIdleTimer = null
        }
        if (pauseToken) return
        pauseSequence += 1
        pauseToken = `${backupSession}:${pauseSequence}`
        heartbeatPause()
        pauseHeartbeat = setInterval(heartbeatPause, PAUSE_HEARTBEAT_MS)
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

    // A source used without a held run releases its pause once no read is left,
    // so the prefetch behind it is not stopped forever. A run that holds the
    // pause keeps it across the stages instead.
    function releasePauseWhenIdle() {
        if (pauseHolds > 0 || pauseReads > 0 || !pauseToken) return
        if (pauseIdleTimer) clearTimeout(pauseIdleTimer)
        pauseIdleTimer = setTimeout(function () {
            pauseIdleTimer = null
            if (pauseHolds > 0 || pauseReads > 0) return
            closePause()
        }, PAUSE_IDLE_MS)
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

    // One warning per source and kind: a manifest repaired after a rescan must
    // not repeat the same note on every fill call, but each read still counts.
    function markUnreliable(kind, stats, reason) {
        stats.manifest_unreliable += 1
        if (notified.has(kind)) return
        notified.add(kind)
        onLog?.(`静态 ${kind} 清单不可靠: ${reason}，改为读取全部分片`, 'warn')
    }

    // A static snapshot is optional: a broken manifest or chunk is reported and
    // counted, never fatal, because the API fallback still covers every item.
    async function readManifest(kind, stats) {
        if (manifests.has(kind)) return manifests.get(kind)
        const url = `${base}/${BGM_DIRS[kind]}/manifest.json`
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

    // Every shard file is read at most once per fill. A file in `attempted`,
    // whether it succeeded or failed, is skipped here and only advances the
    // progress, so a retry pass reads just the shards never tried before.
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
                    `${base}/${BGM_DIRS[kind]}/${chunk.file}`,
                    { signal },
                )
                const parsed = await parseChunk(buffer, {
                    ids,
                    idKey,
                    maxOutputBytes: STATIC_CHUNK_MAX_OUTPUT_BYTES,
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

    // Reads one kind of static data. The range lookup stays in charge unless a
    // located shard fails to load; an id the snapshot does not cover is counted
    // as a miss and left to the API, never answered with a full scan.
    async function loadStaticData(kind, source, idSet, idKey, stats) {
        const ids = Array.from(idSet)
        const attempted = new Set()
        const failuresBefore = stats.chunk_failures + stats.parse_failures
        // A miss is an id the snapshot never held. A failed or partly unread
        // shard already hides its ids, so those reads are not counted again as
        // coverage gaps; the shard failure counters own them.
        const noteMiss = (data, reliable) => {
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
            return noteMiss(await scanAll(NOTE_UNRELIABLE), false)
        }
        const { minKey, maxKey } = SHARD_RANGES[kind]
        const located = locateChunks(source.manifest, ids, minKey, maxKey)
        if (!located.length) return noteMiss(new Map(), true)
        const failures = stats.chunk_failures
        const data = await loadChunks(kind, located, idSet, ids, idKey, stats, { attempted })
        // A listed shard could not be read, so its range proves nothing; the
        // retry reads only the shards that were never tried.
        const merged = stats.chunk_failures === failures
            ? data
            : mergeChunkData(data, await scanAll(NOTE_RETRY))
        return noteMiss(merged, true)
    }

    return {
        async fillSubjects(items) {
            const stats = createStaticStats()
            const ids = new Set()
            for (const item of items) {
                if (item.subject_data == null) ids.add(item.subject_id)
            }
            if (!ids.size) return { filled: 0, stats }
            const data = await withPause(async () => {
                const source = await readManifest('subject', stats)
                if (!source || !source.manifest.chunks.length) return null
                return loadStaticData('subject', source, ids, 'id', stats)
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
                    // An empty or short list is counted as well: the API then
                    // fetches the complete one instead of a partial record.
                    stats.episode_shortfall += 1
                    if (noted < EPISODE_NOTE_LIMIT) {
                        noted += 1
                        onLog?.(`静态分集少于条目话数 subject=${item.subject_id}: 本篇 ${available}/${item.subject_data.eps}，留给接口补取`, 'warn')
                    }
                    continue
                }
                if (!episodes.length) continue
                item.ep_data = groupEpisodesByType(episodes)
                filled++
            }
            if (stats.episode_shortfall > EPISODE_NOTE_LIMIT) {
                onLog?.(`静态分集少于条目话数 ${stats.episode_shortfall} 条，已交给接口补取`, 'warn')
            }
            return { filled, stats }
        },

        // The backup run holds the pause from its first request to its last:
        // the list, the static reads and the API calls all run while the
        // prefetch behind them is stopped.
        pause: holdPause,
        close,
    }
}
