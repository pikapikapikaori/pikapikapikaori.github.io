'use strict'

const failureLimit = 3
const cacheLimitMB = 500

const scopeUrl = new URL(self.registration.scope)
const scopePath = pathKey(scopeUrl.pathname)
const cachePrefix = 'bangumi-takeout:static:'
const manifestPath = 'assets/resources/meta/file-cache.json'
const manifestUrl = new URL(manifestPath, scopeUrl).href
const recordUrl = new URL('__cache-record__', scopeUrl).href
const rootPaths = [scopePath]
const hashHex = /^[0-9a-f]{16}$/i
const foregroundIdleTimeoutMs = 15000
const backgroundIdleTimeoutMs = 30000
const manifestTimeoutMs = 10000
const stuckFetchMs = 5000
const retiredTokensMax = 50
const pauseSessionsMax = 50
const tokenSequence = /^[1-9][0-9]*$/

let pathHash = null
let currentContext = null
let pendingVisit = null
let activeContext = null
const joiningVisits = new Set()
let mutation = Promise.resolve()
const transfers = new Map()
let statePromise = null
let stateGeneration = 0
let runPromise = null
let runAbort = null
let resumeRequested = false
const visibleClients = new Set()
const hiddenClients = new Map()
const backupPauses = new Map()
const retiredTokens = new Map()
const pauseWatermarks = new Map()
const inflight = new Map()
const backgroundFetches = new Set()

function pathKey (pathname) {
    return pathname.split('/').map(function (part) {
        try { return encodeURIComponent(decodeURIComponent(part)) } catch { return encodeURIComponent(part) }
    }).join('/')
}

function urlFor (path) {
    return new URL(path.split('/').map(encodeURIComponent).join('/'), scopeUrl).href
}

function backgroundPaused () {
    if (backupPauses.size > 0) return true
    return visibleClients.size === 0 && hiddenClients.size > 0
}

function ownCacheNames () {
    return caches.keys().then(function (names) {
        return names.filter(function (name) {
            return name.indexOf(cachePrefix) === 0
        })
    })
}

function validManifest (manifest) {
    if (!manifest || manifest.schemaVersion !== 2 || typeof manifest.version !== 'string' || typeof manifest.hash !== 'string') return false
    if (!Array.isArray(manifest.batches) || manifest.batches.length !== 3) return false
    const modes = { 1: 'precache', 2: 'on-demand', 3: 'network-only' }
    const priorities = new Set()
    const paths = new Set()
    for (const batch of manifest.batches) {
        if (!modes[batch.priority] || priorities.has(batch.priority) || batch.mode !== modes[batch.priority] || !Array.isArray(batch.files)) return false
        priorities.add(batch.priority)
        for (const file of batch.files) {
            if (!file || typeof file.path !== 'string' || !file.path || file.path.startsWith('/') || file.path.includes('\\') || file.path.split('/').includes('..')) return false
            if (paths.has(file.path) || !isDigest(file.hash) || !Number.isSafeInteger(file.size) || file.size < 0) return false
            const url = new URL(urlFor(file.path))
            if (url.origin !== scopeUrl.origin || !pathKey(url.pathname).startsWith(scopePath) || url.search || url.hash) return false
            paths.add(file.path)
        }
    }
    return true
}

function manifestFiles (manifest) {
    if (!manifest || manifest.schemaVersion !== 2 || !Array.isArray(manifest.batches)) return []
    const files = []
    for (const batch of manifest.batches) {
        if (![1, 2, 3].includes(batch.priority)) continue
        for (const file of batch.files || []) files.push({ ...file, priority: batch.priority })
    }
    return files
}

function pathHashOf (manifest) {
    const map = {}
    for (const file of manifestFiles(manifest)) map[pathKey(new URL(urlFor(file.path)).pathname)] = file.hash
    return map
}

function serial (fn) {
    const result = mutation.then(fn)
    mutation = result.catch(function () {})
    return result
}

function contextOf (cache, manifest, record) {
    const files = manifestFiles(manifest)
    record = record || {}
    for (const field of ['files', 'metadata', 'misses', 'reasons', 'visits', 'clients']) {
        if (!record[field] || typeof record[field] !== 'object') record[field] = {}
    }
    record.roundId = record.roundId || 'initial'
    return {
        cache: cache, manifest: manifest, record: record,
        files: files, byPath: new Map(files.map(file => [pathKey(new URL(urlFor(file.path)).pathname), file])),
        p1Size: files.filter(file => file.priority === 1).reduce((sum, file) => sum + file.size, 0),
        reservations: new Map(),
    }
}

async function readJson (cache, url) {
    try {
        const hit = await cache.match(url)
        return hit ? await hit.json() : null
    } catch {
        return null
    }
}

function readRecord (cache) {
    return readJson(cache, recordUrl)
}

function readSnapshot (cache) {
    return readJson(cache, manifestUrl)
}

async function saveRecord (cache, record) {
    try {
        await cache.put(recordUrl, new Response(JSON.stringify(record), {
            headers: { 'content-type': 'application/json' }
        }))
        return true
    } catch {
        return false
    }
}

async function loadState () {
    const generation = ++stateGeneration
    const names = await ownCacheNames()
    const list = []
    for (const name of names) {
        const cache = await caches.open(name)
        const manifest = await readSnapshot(cache)
        if (!validManifest(manifest)) continue
        list.push({ cache: cache, record: await readRecord(cache), manifest: manifest })
    }
    if (generation !== stateGeneration || !list.length) return
    const preferred = list[list.length - 1]
    pathHash = pathHashOf(preferred.manifest)
    currentContext = contextOf(preferred.cache, preferred.manifest, preferred.record)
}

function ensureState () {
    if (!statePromise) {
        statePromise = loadState().catch(function () {
            statePromise = null
            pathHash = null
        })
    }
    return statePromise
}

function isDigest (hash) {
    return typeof hash === 'string' && hashHex.test(hash)
}

function digestPrefix (buffer) {
    const view = new Uint8Array(buffer).subarray(0, 8)
    let out = ''
    for (let i = 0; i < view.length; i++) out += view[i].toString(16).padStart(2, '0')
    return out
}

async function contentMatches (buffer, hash) {
    if (!isDigest(hash)) return false
    if (!self.crypto || !self.crypto.subtle) return false
    const digest = await self.crypto.subtle.digest('SHA-256', buffer)
    return digestPrefix(digest) === hash.toLowerCase()
}

const omittedHeaders = [
    'content-encoding', 'content-length', 'connection', 'keep-alive',
    'transfer-encoding', 'te', 'trailer', 'upgrade',
    'proxy-authenticate', 'proxy-authorization',
]

function responseHeaders (source) {
    const headers = new Headers()
    for (const [name, value] of source) {
        if (omittedHeaders.indexOf(name.toLowerCase()) !== -1) continue
        headers.append(name, value)
    }
    return headers
}

function responseOf (entry, bytes) {
    const meta = entry.meta
    const status = meta ? meta.status : 200
    const body = status === 204 || status === 205 || status === 304 ? null : bytes
    return new Response(body, {
        status: status,
        statusText: meta ? meta.statusText : '',
        headers: meta ? meta.headers : undefined,
    })
}

function gatewayTimeout () {
    return new Response('', { status: 504, statusText: 'Gateway Timeout' })
}

async function readStream (stream, onChunk = null) {
    const reader = stream.getReader()
    const chunks = []
    let total = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (onChunk) onChunk()
        chunks.push(value)
        total += value.byteLength
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (let i = 0; i < chunks.length; i++) {
        out.set(chunks[i], offset)
        offset += chunks[i].byteLength
    }
    return out
}

function releaseShared (entry) {
    entry.holders -= 1
    if (entry.settled && entry.holders <= 0 && inflight.get(entry.key) === entry) {
        inflight.delete(entry.key)
    }
}

function abortShared (entry) {
    if (inflight.get(entry.key) === entry) inflight.delete(entry.key)
    try {
        entry.controller.abort()
    } catch {   }
}

function watchedStream (stream, onEnd) {
    const reader = stream.getReader()
    let ended = false
    let reading = false
    let holdTimer = null
    const end = function () {
        if (ended) return
        ended = true
        if (holdTimer) clearTimeout(holdTimer)
        holdTimer = null
        onEnd()
    }
    const waitForReader = function () {
        if (ended || reading) return
        if (holdTimer) clearTimeout(holdTimer)
        holdTimer = setTimeout(end, foregroundIdleTimeoutMs)
    }
    waitForReader()
    return new ReadableStream({
        async pull (controller) {
            if (holdTimer) clearTimeout(holdTimer)
            holdTimer = null
            reading = true
            try {
                const result = await reader.read()
                reading = false
                if (result.done) {
                    end()
                    controller.close()
                    return
                }
                controller.enqueue(result.value)
                waitForReader()
            } catch (error) {
                reading = false
                if (ended) return
                end()
                controller.error(error)
            }
        },
        cancel (reason) {
            end()
            return reader.cancel(reason)
        },
    })
}

/* Foreground and background requests for the same content version share one
 *  network read. The record stays until every cache write finished, so a
 *  request made while the body is still arriving joins the first read. The
 *  first caller gets a live stream; later callers get the buffered copy. */
function sharedFetch (url, hash, priority, { foreground = false, onForegroundEnd = null } = {}) {
    const key = (hash || '') + '\n' + url
    const existing = inflight.get(key)
    if (existing) {
        existing.holders += 1
        if (foreground) {
            existing.foreground += 1
            if (existing.stuckTimer) {
                clearTimeout(existing.stuckTimer)
                existing.stuckTimer = null
            }
            existing.arm()
        }
        return { entry: existing }
    }
    const controller = new AbortController()
    const entry = {
        key: key,
        controller: controller,
        holders: 1,
        foreground: foreground ? 1 : 0,
        lastActivity: Date.now(),
        idleTimer: null,
        meta: null,
        response: null,
        pausedAbort: false,
        settled: false,
        stuckTimer: null,
    }
    entry.buffered = new Promise(function (resolve, reject) {
        entry.resolveBody = resolve
        entry.rejectBody = reject
    })
    entry.arm = function () {
        if (entry.settled) return
        entry.lastActivity = Date.now()
        if (entry.idleTimer) clearTimeout(entry.idleTimer)
        entry.idleTimer = setTimeout(function () {
            abortShared(entry)
        }, entry.foreground > 0 ? foregroundIdleTimeoutMs : backgroundIdleTimeoutMs)
    }
    const fail = function (error) {
        entry.rejectBody(error)
    }
    const finish = function () {
        if (entry.settled) return
        entry.settled = true
        if (entry.idleTimer) clearTimeout(entry.idleTimer)
        entry.idleTimer = null
        releaseShared(entry)
    }
    entry.buffered.then(finish, finish)
    entry.arm()
    entry.head = fetch(url, { cache: 'no-store', priority: priority, signal: controller.signal })
        .then(function (response) {
            entry.meta = {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders(response.headers),
            }
            if (!response.body) {
                entry.response = response
                entry.resolveBody(new Uint8Array(0))
                return
            }
            let branches = null
            try {
                branches = response.body.tee()
                entry.response = new Response(
                    foreground && onForegroundEnd
                        ? watchedStream(branches[0], onForegroundEnd)
                        : branches[0],
                    entry.meta,
                )
            } catch (error) {
                fail(error)
                return
            }
            entry.arm()
            readStream(branches[1], entry.arm).then(function (bytes) {
                entry.resolveBody(bytes)
            }, fail)
        }, fail)
    inflight.set(key, entry)
    return { entry: entry }
}

async function reserve (ctx, file, evict = true) {
    return serial(async function () {
        if (ctx.reservations.has(file.path)) return true
        const limit = cacheLimitMB * 1024 * 1024
        if (file.priority === 2 && ctx.p1Size + file.size > limit) return false
        let used = ctx.p1Size
        for (const meta of Object.values(ctx.record.metadata)) {
            if (meta.priority === 2) used += meta.size
        }
        for (const [path, size] of ctx.reservations) {
            if (path !== file.path) used += size
        }
        if (file.priority === 2) {
            const victims = (evict ? Object.entries(ctx.record.metadata) : [])
                .filter(([path, meta]) => meta.priority === 2 && !ctx.reservations.has(path))
                .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
            for (const [path, meta] of victims) {
                if (used + file.size <= limit) break
                try {
                    await ctx.cache.delete(urlFor(path))
                } catch {
                    return false
                }
                delete ctx.record.metadata[path]
                delete ctx.record.files[path]
                used -= meta.size
            }
            if (used + file.size > limit) return false
            ctx.reservations.set(file.path, file.size)
        } else {
            // P1 space is reserved for the whole manifest before any P2 admission.
            ctx.reservations.set(file.path, 0)
        }
        await saveRecord(ctx.cache, ctx.record)
        return true
    })
}

async function remember (ctx, file, lastAccess = Date.now()) {
    return serial(async function () {
        ctx.record.files[file.path] = file.hash
        ctx.record.metadata[file.path] = { size: file.size, priority: file.priority, lastAccess: lastAccess }
        delete ctx.record.misses[file.path]
        delete ctx.record.reasons[file.path]
        await saveRecord(ctx.cache, ctx.record)
    })
}

async function transfer (ctx, file, foreground, signal, request = null) {
    const url = urlFor(file.path)
    const key = ctx.manifest.version + ':' + ctx.manifest.hash + '\n' + file.path
    let task = transfers.get(key)
    let creator = false
    if (!task) {
        creator = true
        task = (async function () {
            const admitted = await reserve(ctx, file)
            if (!admitted && !foreground) return { result: 'capacity' }
            if (!foreground && backgroundPaused()) return { result: 'paused' }
            const roundId = ctx.record.roundId
            const attempts = ctx.record.misses[file.path] || 0
            if (attempts >= failureLimit) return { result: 'limited' }
            const durable = await serial(async function () {
                ctx.record.misses[file.path] = attempts + 1
                ctx.record.reasons[file.path] = 'interrupted'
                return saveRecord(ctx.cache, ctx.record)
            })
            if (!durable) {
                ctx.record.reasons[file.path] = 'record'
                return { result: 'record' }
            }
            let item
            let ownerReleased = false
            const releaseOwnerForeground = function () {
                if (ownerReleased || !foreground) return
                ownerReleased = true
                if (item && item.foreground > 0) item.foreground -= 1
                if (item) scheduleStuckAbort(item)
            }
            const shared = sharedFetch(url, file.hash, foreground ? 'high' : 'low', {
                foreground: foreground,
                onForegroundEnd: foreground ? releaseOwnerForeground : null,
            })
            item = shared.entry
            if (!foreground) backgroundFetches.add(item)
            const write = item.buffered.then(async function (bytes) {
                if (!item.meta || item.meta.status !== 200) return 'failed'
                if (!await contentMatches(bytes, file.hash)) return 'mismatch'
                if (!admitted) {
                    await serial(async function () {
                        delete ctx.record.misses[file.path]
                        delete ctx.record.reasons[file.path]
                        await saveRecord(ctx.cache, ctx.record)
                    })
                    return 'capacity'
                }
                try {
                    await ctx.cache.put(url, responseOf(item, bytes))
                    await remember(ctx, file)
                    return 'ok'
                } catch {
                    return 'write'
                }
            }).catch(function (error) {
                return pausedRejection(item, error) ? 'paused' : 'failed'
            }).then(async function (result) {
                await serial(async function () {
                    ctx.reservations.delete(file.path)
                    if (result !== 'ok' && result !== 'capacity' && ctx.record.roundId === roundId) {
                        ctx.record.reasons[file.path] = result
                    }
                    await saveRecord(ctx.cache, ctx.record)
                })
                return result
            }).finally(function () {
                if (item.stuckTimer) clearTimeout(item.stuckTimer)
                backgroundFetches.delete(item)
                releaseShared(item)
                transfers.delete(key)
            })
            return { entry: item, write: write, releaseOwnerForeground: releaseOwnerForeground }
        })()
        transfers.set(key, task)
        task.then(function (value) {
            if (!value.entry) {
                ctx.reservations.delete(file.path)
                transfers.delete(key)
            }
        }, function () { ctx.reservations.delete(file.path); transfers.delete(key) })
    }
    const operation = await task
    if (!operation.entry) {
        const storageFailure = ['write', 'record', 'capacity'].includes(ctx.record.reasons[file.path])
        return {
            response: foreground
                ? operation.result === 'limited' && !storageFailure
                    ? Promise.resolve(gatewayTimeout())
                    : networkOrFail(request || new Request(url))
                : null,
            write: Promise.resolve(operation.result),
        }
    }
    const item = operation.entry
    if (!foreground) return { response: null, write: operation.write }
    let released = false
    const releaseForeground = function () {
        if (released) return
        released = true
        if (creator) operation.releaseOwnerForeground()
        else {
            if (item.foreground > 0) item.foreground -= 1
            releaseShared(item)
        }
        if (item.foreground === 0) scheduleStuckAbort(item)
    }
    if (!creator) sharedFetch(url, file.hash, 'high', { foreground: true })
    item.buffered.then(releaseForeground, releaseForeground)
    if (signal) signal.addEventListener('abort', releaseForeground, { once: true })
    const response = creator
        ? item.head.then(function () { return item.response || gatewayTimeout() })
        : item.buffered.then(function (bytes) { return responseOf(item, bytes) }).catch(gatewayTimeout)
    return { response: response, write: operation.write }
}

function scheduleStuckAbort (entry) {
    if (!backgroundFetches.has(entry)) return
    if (!backgroundPaused()) return
    if (entry.settled || entry.pausedAbort) return
    if (entry.foreground > 0) return
    if (entry.stuckTimer) clearTimeout(entry.stuckTimer)
    const wait = Math.max(0, stuckFetchMs - (Date.now() - entry.lastActivity))
    entry.stuckTimer = setTimeout(function () {
        entry.stuckTimer = null
        if (entry.settled || entry.pausedAbort) return
        if (entry.foreground > 0) return
        if (!backgroundPaused()) return
        entry.pausedAbort = true
        abortShared(entry)
    }, wait)
}

async function serve (pathname, request) {
    pathname = pathKey(pathname)
    const ctx = currentContext
    const file = ctx && ctx.byPath.get(pathname)
    if (!file || file.priority === 3) return { response: networkOrFail(request), write: null }
    const url = urlFor(file.path)
    try {
        const hit = await ctx.cache.match(url)
        if (hit && ctx.record.files[file.path] === file.hash) {
            const meta = ctx.record.metadata[file.path]
            await remember(ctx, file, Math.max(Date.now(), (meta && meta.lastAccess || 0) + 1))
            return { response: Promise.resolve(await rangeResponse(hit, request)), write: null }
        }
    } catch {   }
    if (file.priority === 2 && ctx.p1Size + file.size > cacheLimitMB * 1024 * 1024) return { response: networkOrFail(request), write: null }
    const result = await transfer(ctx, file, true, request.signal, request)
    if (!request.headers.get('range')) return result
    return {
        response: result.response.then(function (response) {
            return response.status === 200 ? rangeResponse(response, request) : response
        }),
        write: result.write,
    }
}

async function rangeResponse (response, request) {
    const range = request.headers.get('range')
    if (!range) return response
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) return networkOrFail(request)
    const bytes = new Uint8Array(await response.arrayBuffer())
    let start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]))
    let end = match[1] && match[2] ? Number(match[2]) : bytes.length - 1
    if (start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { 'content-range': 'bytes */' + bytes.length } })
    end = Math.min(end, bytes.length - 1)
    const headers = new Headers(response.headers)
    headers.set('content-range', 'bytes ' + start + '-' + end + '/' + bytes.length)
    headers.set('content-length', String(end - start + 1))
    headers.set('accept-ranges', 'bytes')
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: headers })
}

function serveKey (pathname) {
    pathname = pathKey(pathname)
    if (!pathHash) return null
    if (pathHash[pathname]) return pathname
    if (rootPaths.indexOf(pathname) === -1) return null
    const key = scopePath + 'index.html'
    return pathHash[key] ? key : null
}

function pausedRejection (entry, error) {
    if (!entry.pausedAbort) return false
    return !error || error.name === 'AbortError'
}

async function copyFromSource (ctx, file, sources) {
    const url = urlFor(file.path)
    for (const source of sources) {
        if (!source.record || source.record.files[file.path] !== file.hash) continue
        try {
            const hit = await source.cache.match(url)
            if (!hit || hit.status !== 200) continue
            const bytes = new Uint8Array(await hit.arrayBuffer())
            if (!await contentMatches(bytes, file.hash)) continue
            if (!await reserve(ctx, file, false)) return false
            try {
                await ctx.cache.put(url, new Response(bytes, { status: 200, headers: responseHeaders(hit.headers) }))
                const meta = source.record.metadata && source.record.metadata[file.path]
                await remember(ctx, file, meta && meta.lastAccess || Date.now())
                return true
            } finally {
                ctx.reservations.delete(file.path)
            }
        } catch {   }
    }
    return false
}

async function runFiles (ctx, sources) {
    const latest = function (file) {
        return Math.max(0, ...sources.map(source => source.record.metadata && source.record.metadata[file.path] && source.record.metadata[file.path].lastAccess || 0))
    }
    const files = ctx.files.slice().sort((a, b) => a.priority - b.priority || (a.priority === 2 ? latest(b) - latest(a) : 0))
    for (const file of files) {
        if (file.priority === 3) continue
        if (backgroundPaused()) return false
        const url = urlFor(file.path)
        let hit = null
        try { hit = await ctx.cache.match(url) } catch {   }
        if (hit && ctx.record.files[file.path] === file.hash) continue
        await serial(async function () {
            delete ctx.record.files[file.path]
            delete ctx.record.metadata[file.path]
        })
        if (await copyFromSource(ctx, file, sources)) continue
        if (file.priority !== 1) continue
        while ((ctx.record.misses[file.path] || 0) < failureLimit) {
            if (backgroundPaused()) return false
            const result = await transfer(ctx, file, false)
            const status = await result.write
            if (status === 'paused' || backgroundPaused()) return false
            if (status === 'ok') break
            if (status === 'record' || status === 'capacity') return false
        }
    }
    return true
}

function missingOf (record, manifest) {
    return manifestFiles(manifest).filter(file => file.priority === 1 && record.files[file.path] !== file.hash).map(file => file.path)
}

function reportMissing (record) {
    if (!self.clients || typeof self.clients.matchAll !== 'function') return Promise.resolve()
    const reasons = {}
    for (const pathname of record.missing) {
        if (record.reasons && record.reasons[pathname]) reasons[pathname] = record.reasons[pathname]
    }
    const message = {
        type: record.missing.length ? 'CACHE_MISSING' : 'CACHE_DONE',
        offlineComplete: record.missing.length === 0,
        missing: record.missing,
        count: record.missing.length,
        paths: record.missing,
        reasons: reasons,
    }
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (const client of list) {
            try {
                client.postMessage(message)
            } catch {   }
        }
    }).catch(function () {})
}

async function fetchManifest (signal) {
    const controller = new AbortController()
    const timer = setTimeout(function () {
        controller.abort()
    }, manifestTimeoutMs)
    const onAbort = function () {
        controller.abort()
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    try {
        const response = await fetch(manifestUrl, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('manifest ' + response.status)
        const manifest = await response.json()
        if (!validManifest(manifest)) throw new Error('invalid manifest')
        return manifest
    } finally {
        clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
    }
}

async function collectOthers (targetName) {
    const others = []
    for (const name of await ownCacheNames()) {
        if (name === targetName) continue
        const cache = await caches.open(name)
        const snapshot = await readSnapshot(cache)
        if (!validManifest(snapshot)) continue
        const record = await readRecord(cache)
        if (record && record.files) others.push({ cache: cache, record: record })
    }
    return others
}

async function pruneOthers (keep) {
    const names = await ownCacheNames()
    for (const name of names) {
        if (name !== keep) await caches.delete(name)
    }
}

async function run () {
    if (backgroundPaused()) return
    await ensureState()
    if (backgroundPaused()) return
    const controller = new AbortController()
    runAbort = controller
    try {
        let manifest
        try { manifest = await fetchManifest(controller.signal) } catch { return }
        if (manifest.schemaVersion !== 2 || backgroundPaused()) return
        const targetName = cachePrefix + manifest.version + ':' + manifest.hash
        const target = await caches.open(targetName)
        const sources = await collectOthers(targetName)
        let ctx = currentContext
        if (!ctx || ctx.manifest.hash !== manifest.hash || ctx.manifest.version !== manifest.version) {
            const record = await readRecord(target)
            ctx = contextOf(target, manifest, record)
            if (!record && sources.length) {
                const source = sources[sources.length - 1].record
                ctx.record.visits = { ...source.visits }
                ctx.record.clients = { ...source.clients }
                ctx.record.roundId = source.roundId || 'initial'
                ctx.record.misses = { ...source.misses }
                ctx.record.reasons = { ...source.reasons }
            }
        }
        const visit = pendingVisit
        pendingVisit = null
        activeContext = ctx
        await serial(async function () {
            if (visit && !ctx.record.visits[visit]) {
                if (transfers.size === 0) {
                    ctx.record.roundId = visit
                    ctx.record.misses = {}
                }
                ctx.record.visits[visit] = ctx.record.roundId
            }
            for (const joined of joiningVisits) ctx.record.visits[joined] = ctx.record.roundId
            joiningVisits.clear()
            ctx.record.stage = 'precache'
            await saveRecord(target, ctx.record)
            try {
                await target.put(manifestUrl, new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }))
            } catch {   }
        })
        stateGeneration++
        pathHash = pathHashOf(manifest)
        currentContext = ctx
        if (!await runFiles(ctx, sources) || backgroundPaused()) return
        ctx.record.stage = 'done'
        ctx.record.missing = missingOf(ctx.record, manifest)
        if (!await saveRecord(target, ctx.record)) return
        await reportMissing(ctx.record)
        await pruneOthers(targetName)
    } finally {
        if (runAbort === controller) runAbort = null
    }
}

function cancelBackground () {
    if (runAbort) {
        runAbort.abort()
        runAbort = null
    }
    for (const entry of backgroundFetches) scheduleStuckAbort(entry)
}

function resumeBackground () {
    for (const entry of backgroundFetches) {
        if (!entry.stuckTimer) continue
        clearTimeout(entry.stuckTimer)
        entry.stuckTimer = null
    }
}

function start () {
    resumeRequested = true
    if (backgroundPaused()) return Promise.resolve()
    resumeBackground()
    if (runPromise) return runPromise
    resumeRequested = false
    runPromise = run().finally(function () {
        runPromise = null
        activeContext = null
        if (resumeRequested && !backgroundPaused()) start()
    })
    return runPromise
}

async function registerNavigation (clientId) {
    await ensureState()
    const ctx = currentContext
    if (!ctx || !clientId) return
    await serial(async function () {
        if (ctx.record.clients[clientId]) return
        if (!activeContext) {
            ctx.record.roundId = 'navigation:' + clientId
            ctx.record.misses = {}
        }
        ctx.record.clients[clientId] = ctx.record.roundId
        ctx.record.visits['navigation:' + clientId] = ctx.record.roundId
        await saveRecord(ctx.cache, ctx.record)
    })
}

async function handleNavigation (request, clientId) {
    await registerNavigation(clientId)
    const pathname = new URL(request.url).pathname
    const key = serveKey(pathname)
    if (!key) return { response: networkOrFail(request), write: null }
    return serve(key, request)
}

async function networkOrFail (request) {
    try {
        return await fetch(request)
    } catch {
        return new Response('', { status: 504, statusText: 'Gateway Timeout' })
    }
}

async function pruneClients (currentId) {
    if (!self.clients || typeof self.clients.matchAll !== 'function') return 0
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const alive = new Set(list.map(function (client) { return client.id }))
    for (const id of Array.from(visibleClients)) {
        if (id !== currentId && !alive.has(id)) visibleClients.delete(id)
    }
    for (const id of Array.from(hiddenClients.keys())) {
        if (id !== currentId && !alive.has(id)) hiddenClients.delete(id)
    }
    let removed = 0
    for (const key of Array.from(backupPauses.keys())) {
        if (key.indexOf('token:') === 0) continue
        if (key !== currentId && !alive.has(key)) {
            backupPauses.delete(key)
            removed += 1
        }
    }
    return removed
}

async function pruneClosedPauses () {
    const paused = backupPauses.size > 0
    await pruneClients('')
    if (!paused || backupPauses.size > 0) return
    return start()
}

function retireToken (token) {
    if (!token) return
    const order = tokenOrderOf(token)
    if (order) {
        const held = pauseWatermarks.get(order.session) || 0
        pauseWatermarks.delete(order.session)
        pauseWatermarks.set(order.session, Math.max(held, order.sequence))
        while (pauseWatermarks.size > pauseSessionsMax) {
            pauseWatermarks.delete(pauseWatermarks.keys().next().value)
        }
        return
    }
    retiredTokens.set(token, true)
    while (retiredTokens.size > retiredTokensMax) {
        retiredTokens.delete(retiredTokens.keys().next().value)
    }
}

function isResumedPause (token) {
    if (!token) return false
    if (retiredTokens.has(token)) return true
    const order = tokenOrderOf(token)
    if (!order) return false
    return (pauseWatermarks.get(order.session) || 0) >= order.sequence
}

function tokenOrderOf (token) {
    const text = String(token)
    const at = text.lastIndexOf(':')
    if (at <= 0) return null
    const digits = text.slice(at + 1)
    if (!tokenSequence.test(digits)) return null
    const sequence = Number(digits)
    if (!Number.isSafeInteger(sequence)) return null
    return { session: text.slice(0, at), sequence: sequence }
}

function pauseBackup (id, token) {
    const key = id || 'token:' + token
    if (isResumedPause(token)) {
        return false
    }
    const current = backupPauses.get(key)
    if (current === undefined) {
        backupPauses.set(key, token)
        return true
    }
    if (current === token) return true
    const next = tokenOrderOf(token)
    const held = tokenOrderOf(current)
    if (!next) {
        if (token.indexOf(':') === -1 && held) {
            retireToken(current)
            backupPauses.set(key, token)
            return true
        }
        return false
    }
    if (!held || next.session !== held.session || next.sequence > held.sequence) {
        retireToken(current)
        backupPauses.set(key, token)
        return true
    }
    return false
}

function clearPausedRun (id, token) {
    if (!token) return
    for (const key of Array.from(backupPauses.keys())) {
        const held = backupPauses.get(key)
        if (!held) continue
        if (key === id) {
            if (held === token) backupPauses.delete(key)
            continue
        }
        if (!sameRunToken(token, held)) continue
        backupPauses.delete(key)
    }
}

function sameRunToken (token, held) {
    if (held === token) return true
    const next = tokenOrderOf(token)
    const previous = tokenOrderOf(held)
    if (!next || !previous) return false
    return previous.session === next.session && previous.sequence < next.sequence
}

async function handleMessage (event) {
    const data = event.data || {}
    const id = (event.source && event.source.id) || String(data.clientId || '')
    const token = String(data.token || '')
    await pruneClients(id)
    if (data.type === 'PAUSE') {
        if (data.reason === 'backup') {
            if (pauseBackup(id, token)) cancelBackground()
            return
        }
        if (id) {
            visibleClients.delete(id)
            hiddenClients.set(id, Date.now())
        }
        cancelBackground()
        return
    }
    if (data.type !== 'START') return
    if (data.reason === 'backup') {
        clearPausedRun(id, token)
        retireToken(token)
    } else if (id) {
        hiddenClients.delete(id)
        visibleClients.add(id)
    }
    if (data.reason !== 'backup' && data.visitId) {
        const visit = String(data.visitId)
        const navigationContext = currentContext
        if (navigationContext && navigationContext.record.clients[id] && !navigationContext.record.visits[visit]) {
            await serial(async function () {
                navigationContext.record.visits[visit] = navigationContext.record.clients[id]
                await saveRecord(navigationContext.cache, navigationContext.record)
            })
            return start()
        }
        joiningVisits.add(visit)
        if (runPromise) {
            const ctx = activeContext
            if (ctx) await serial(async function () {
                ctx.record.visits[visit] = ctx.record.roundId
                joiningVisits.delete(visit)
                await saveRecord(ctx.cache, ctx.record)
            })
            return runPromise
        }
        pendingVisit = visit
    }
    return start()
}

function attach (event, result) {
    event.respondWith(result.then(function (item) { return item.response }))
    event.waitUntil(result.then(function (item) { return item.write }).catch(function () {}))
}

function isCacheableRequest (request) {
    const mode = request.mode
    return mode === 'navigate' || mode === 'same-origin' || mode === 'cors' || mode === 'no-cors'
}

self.addEventListener('activate', function (event) {
    event.waitUntil(ensureState().then(function () {
        return self.clients.claim()
    }))
})

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return
    if (!isCacheableRequest(event.request)) return
    const url = new URL(event.request.url)
    if (url.origin !== scopeUrl.origin) return
    if (scopePath !== '/' && pathKey(url.pathname).indexOf(scopePath) !== 0) return

    event.waitUntil(pruneClosedPauses().catch(function () {}))

    if (event.request.mode === 'navigate') {
        attach(event, handleNavigation(event.request, event.resultingClientId || event.clientId))
        return
    }
    attach(event, ensureState().then(function () {
        const key = serveKey(url.pathname)
        if (!key) return { response: fetch(event.request), write: null }
        return serve(key, event.request)
    }))
})

self.addEventListener('message', function (event) {
    event.waitUntil(handleMessage(event))
})

ensureState()
