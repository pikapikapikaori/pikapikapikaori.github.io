import {
    fetchWithTimeout, groupEpisodesByType, timeoutError,
} from './bangumi-api.js'
import { abortError, isAbortError } from '../../js/abort.js'
import { parseShard } from './chunk-worker.js'
import { postServiceWorkerMessage } from '../../js/worker/messages.js'

const chunkWorkerTimeoutMs = 30000

const pauseHeartbeatMs = 20000

const pauseIdleMs = 3000

// Chunks reach ~11 MB; timing by idle gap keeps a slow download alive past 30s.
const staticDataIdleTimeoutMs = 60000

// These caps stop a damaged or crafted response before it fills the tab.
const staticChunkMaxBytes = 64 * 1024 * 1024
const staticChunkMaxOutputBytes = 128 * 1024 * 1024

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
        return new Worker(new URL('./chunk-worker.js', import.meta.url), { type: 'module' })
    } catch {
        return null
    }
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
        entries: 0,
    }
}

// The stage note names the reason for a wider read; the retry note stays neutral.
const noteUnreliable = '（清单不可靠，扫描全部分片）'
const noteRetry = '（分片读取失败，补读其余分片）'

// The service worker prefetches every shard in the manifest, so a stored shard costs no request.
export function createBgmSource({
    base, signal = null, onStage = null, onProgress = null, onLog = null,
} = {}) {
    if (!base) throw new Error('缺少静态数据地址')
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
        // The caller decides what to do with the entries: this source only reads and parses.
        // Without a snapshot `data` is null, so the caller skips the fill and the gap accounting.
        async readSubjects(ids, { countMiss = true } = {}) {
            const stats = createStaticStats()
            const idSet = new Set(ids)
            if (!idSet.size) return { data: new Map(), stats }
            const data = await withPause(async () => {
                const source = await readManifest('subject', stats)
                if (!source || !source.manifest.chunks.length) return null
                return loadStaticData('subject', source, idSet, 'id', stats, { countMiss })
            })
            return { data, stats }
        },

        async readEpisodes(ids) {
            const stats = createStaticStats()
            const idSet = new Set(ids)
            if (!idSet.size) return { data: new Map(), stats }
            const data = await withPause(async () => {
                const source = await readManifest('episode', stats)
                if (!source || !source.manifest.chunks.length) return null
                return loadStaticData('episode', source, idSet, 'subject_id', stats)
            })
            if (data == null) return { data: null, stats }
            const grouped = new Map()
            for (const [id, episodes] of data) {
                if (!episodes.length) continue
                grouped.set(id, groupEpisodesByType(episodes))
            }
            return { data: grouped, stats }
        },

        // The run holds the pause from its first request to its last, so the prefetch behind
        // it stays stopped for the list, the static reads and the API calls.
        pause: holdPause,
        close,
    }
}

