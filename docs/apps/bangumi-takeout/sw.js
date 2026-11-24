'use strict'

const scopeUrl = new URL(self.registration.scope)
const scopePath = scopeUrl.pathname
const cachePrefix = 'bangumi-takeout:static:'
const manifestPath = 'assets/resources/meta/file-cache.json'
const manifestUrl = new URL(manifestPath, scopeUrl).href
const recordUrl = new URL('__cache-record__', scopeUrl).href
const criticalExts = ['js', 'css', 'html']
const fontExts = ['woff2', 'woff', 'ttf', 'otf', 'eot']
const saveEvery = 20
const stages = ['critical', 'fonts', 'rest']
const rootPaths = [scopePath]
const hashHex = /^[0-9a-f]{16}$/i
const foregroundIdleTimeoutMs = 15000
const backgroundIdleTimeoutMs = 30000
const manifestTimeoutMs = 10000
const stuckFetchMs = 5000
const failureLimit = 3
const retiredTokensMax = 50
const pauseSessionsMax = 50
const tokenSequence = /^[1-9][0-9]*$/

let pathHash = null
let serving = []
let currentCache = null
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

function backgroundPaused () {
    if (backupPauses.size > 0) return true
    return visibleClients.size === 0 && hiddenClients.size > 0
}

function extOf (path) {
    const name = path.slice(path.lastIndexOf('/') + 1)
    const i = name.lastIndexOf('.')
    return i < 1 ? '' : name.slice(i + 1).toLowerCase()
}

function ownCacheNames () {
    return caches.keys().then(function (names) {
        return names.filter(function (name) {
            return name.indexOf(cachePrefix) === 0
        })
    })
}

function pathHashOf (manifest) {
    const map = {}
    const files = (manifest && manifest.files) || []
    for (let i = 0; i < files.length; i++) {
        map[new URL(files[i].path, scopeUrl).pathname] = files[i].hash
    }
    return map
}

function splitStages (files) {
    const groups = [[], [], []]
    for (let i = 0; i < files.length; i++) {
        const ext = extOf(files[i].path)
        if (criticalExts.indexOf(ext) !== -1) groups[0].push(files[i])
        else if (fontExts.indexOf(ext) !== -1) groups[1].push(files[i])
        else groups[2].push(files[i])
    }
    return groups
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

function saveRecord (cache, record) {
    return cache.put(recordUrl, new Response(JSON.stringify(record), {
        headers: { 'content-type': 'application/json' }
    }))
}

function allowOf (record, hashes) {
    const allow = {}
    if (!record || !record.files) return allow
    for (const path in record.files) {
        const pathname = new URL(path, scopeUrl).pathname
        if (hashes[pathname] === record.files[path]) allow[pathname] = true
    }
    return allow
}

async function loadState () {
    const generation = ++stateGeneration
    const names = await ownCacheNames()
    const list = []
    let manifest = null
    for (const name of names) {
        const cache = await caches.open(name)
        const record = await readRecord(cache)
        list.push({ cache: cache, record: record })
        if (!manifest) manifest = await readSnapshot(cache)
    }
    const hashes = manifest ? pathHashOf(manifest) : {}
    list.sort(function (a, b) {
        const rankA = a.record && a.record.stage === 'done' ? 1 : 0
        const rankB = b.record && b.record.stage === 'done' ? 1 : 0
        return rankA - rankB
    })
    if (generation !== stateGeneration) return
    let preferred = null
    for (const item of list) {
        if (item.record && item.record.stage === 'done') preferred = item.cache
    }
    pathHash = hashes
    currentCache = preferred || (list[0] && list[0].cache) || null
    serving = list.map(function (item) {
        const done = item.record && item.record.stage === 'done'
        return { cache: item.cache, allow: done ? null : allowOf(item.record, hashes) }
    })
}

function ensureState () {
    if (!statePromise) {
        statePromise = loadState().catch(function () {
            statePromise = null
            pathHash = null
            serving = []
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
        return { entry: existing, creator: false }
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
        failed: false,
        error: null,
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
        entry.failed = true
        entry.error = error
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
    return { entry: entry, creator: true }
}

function writeShared (entry, cache, url, hash) {
    return entry.buffered.then(async function (bytes) {
        if (!cache || !entry.meta) return false
        if (entry.meta.status < 200 || entry.meta.status >= 300) return false
        if (!await contentMatches(bytes, hash)) return false
        try {
            await cache.put(url, responseOf(entry, bytes))
            return true
        } catch {
            return false
        }
    }).catch(function () {
        return false
    }).finally(function () {
        releaseShared(entry)
    })
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

function networkResult (url, hash, signal) {
    let entry = null
    let released = false
    const releaseForeground = function () {
        if (released) return
        released = true
        if (!entry) return
        if (entry.foreground > 0) entry.foreground -= 1
        if (entry.foreground === 0) scheduleStuckAbort(entry)
    }
    const shared = sharedFetch(url, hash, 'high', {
        foreground: true,
        onForegroundEnd: releaseForeground,
    })
    entry = shared.entry
    entry.buffered.then(releaseForeground, releaseForeground)
    if (signal) signal.addEventListener('abort', releaseForeground, { once: true })
    const response = shared.creator
        ? entry.head.then(function () {
            return entry.response || gatewayTimeout()
        })
        : entry.buffered.then(function (bytes) {
            return responseOf(entry, bytes)
        }).catch(function () {
            return gatewayTimeout()
        })
    return { response: response, write: writeShared(entry, currentCache, url, hash) }
}

async function serve (pathname, signal) {
    const url = new URL(pathname, scopeUrl).href
    for (let i = 0; i < serving.length; i++) {
        const item = serving[i]
        if (item.allow && !item.allow[pathname]) continue
        const hit = await item.cache.match(url)
        if (hit) return { response: Promise.resolve(hit), write: null }
    }
    const hash = pathHash ? pathHash[pathname] : ''
    return networkResult(url, hash, signal)
}

function serveKey (pathname) {
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

async function download (ctx, url, entry) {
    try {
        const hit = await ctx.cache.match(url)
        if (hit) return 'ok'
    } catch {   }
    if (backgroundPaused()) return 'paused'
    const shared = sharedFetch(url, entry.hash, 'low')
    const item = shared.entry
    backgroundFetches.add(item)
    try {
        const bytes = await item.buffered
        if (item.failed || !item.meta) return pausedRejection(item, item.error) ? 'paused' : 'failed'
        if (item.meta.status < 200 || item.meta.status >= 300) return 'failed'
        if (!await contentMatches(bytes, entry.hash)) return 'mismatch'
        await ctx.cache.put(url, responseOf(item, bytes))
        return 'ok'
    } catch (error) {
        return pausedRejection(item, error) ? 'paused' : 'failed'
    } finally {
        if (item.stuckTimer) clearTimeout(item.stuckTimer)
        backgroundFetches.delete(item)
        releaseShared(item)
    }
}

async function copyFromSource (ctx, url, entry) {
    if (!ctx.source || !ctx.source.record) return false
    if (ctx.source.record.files[entry.path] !== entry.hash) return false
    if (!isDigest(entry.hash)) return false
    try {
        const hit = await ctx.source.cache.match(url)
        if (!hit) return false
        const bytes = new Uint8Array(await hit.arrayBuffer())
        if (!await contentMatches(bytes, entry.hash)) return false
        const status = hit.status
        const body = status === 204 || status === 205 || status === 304 ? null : bytes
        await ctx.cache.put(url, new Response(body, {
            status: status,
            statusText: hit.statusText,
            headers: responseHeaders(hit.headers),
        }))
        return true
    } catch {
        return false
    }
}

async function copyGroup (ctx, list) {
    let sinceSave = 0
    for (let i = 0; i < list.length; i++) {
        if (backgroundPaused()) {
            await saveRecord(ctx.cache, ctx.record)
            return false
        }
        const entry = list[i]
        if (ctx.record.files[entry.path] === entry.hash) continue
        const url = new URL(entry.path, scopeUrl).href
        if (!await copyFromSource(ctx, url, entry)) continue
        ctx.record.files[entry.path] = entry.hash
        sinceSave += 1
        if (sinceSave >= saveEvery) {
            sinceSave = 0
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    await saveRecord(ctx.cache, ctx.record)
    return true
}

async function acquire (ctx, url, entry) {
    return download(ctx, url, entry)
}

async function runGroup (ctx, list) {
    let sinceSave = 0
    let pending = 0
    for (let i = 0; i < list.length; i++) {
        if (backgroundPaused()) {
            await saveRecord(ctx.cache, ctx.record)
            return false
        }
        const entry = list[i]
        if (ctx.record.files[entry.path] === entry.hash) {
            if (ctx.record.misses[entry.path]) delete ctx.record.misses[entry.path]
            if (ctx.record.reasons[entry.path]) delete ctx.record.reasons[entry.path]
            continue
        }
        const attempts = ctx.record.misses[entry.path] || 0
        if (attempts >= failureLimit) continue
        const url = new URL(entry.path, scopeUrl).href
        const result = await acquire(ctx, url, entry)
        if (result === 'paused') {
            await saveRecord(ctx.cache, ctx.record)
            return false
        }
        if (result !== 'ok') {
            const next = result === 'mismatch' ? failureLimit : attempts + 1
            ctx.record.misses[entry.path] = next
            ctx.record.reasons[entry.path] = result
            if (!ctx.repair && next < failureLimit) pending += 1
            sinceSave += 1
            if (sinceSave >= saveEvery) {
                sinceSave = 0
                await saveRecord(ctx.cache, ctx.record)
            }
            continue
        }
        if (ctx.record.misses[entry.path]) delete ctx.record.misses[entry.path]
        if (ctx.record.reasons[entry.path]) delete ctx.record.reasons[entry.path]
        ctx.record.files[entry.path] = entry.hash
        sinceSave += 1
        if (sinceSave >= saveEvery) {
            sinceSave = 0
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    await saveRecord(ctx.cache, ctx.record)
    return pending === 0
}

async function runGroups (ctx, groups, index) {
    for (let i = index; i < groups.length; i++) {
        if (!await runGroup(ctx, groups[i])) return false
        if (i + 1 < stages.length && !ctx.repair) {
            ctx.record.stage = stages[i + 1]
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    return true
}

function manifestCovers (record, manifest) {
    if (!record || record.stage !== 'done') return false
    const files = (manifest && manifest.files) || []
    for (let i = 0; i < files.length; i++) {
        if (record.files[files[i].path] !== files[i].hash) return false
    }
    return true
}

function missingOf (record, manifest) {
    const missing = []
    const files = (manifest && manifest.files) || []
    for (let i = 0; i < files.length; i++) {
        if (record.files[files[i].path] !== files[i].hash) missing.push(files[i].path)
    }
    return missing
}

function reportMissing (record) {
    if (!record.missing || !record.missing.length) return Promise.resolve()
    if (!self.clients || typeof self.clients.matchAll !== 'function') return Promise.resolve()
    const reasons = {}
    for (const pathname of record.missing) {
        if (record.reasons && record.reasons[pathname]) reasons[pathname] = record.reasons[pathname]
    }
    const message = {
        type: 'CACHE_MISSING',
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
        return await response.json()
    } finally {
        clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
    }
}

function pickSource (others) {
    for (let i = 0; i < others.length; i++) {
        if (others[i].record) return others[i]
    }
    return null
}

async function collectOthers (targetName, hashes) {
    const names = await ownCacheNames()
    const others = []
    for (const name of names) {
        if (name === targetName) continue
        const cache = await caches.open(name)
        const record = await readRecord(cache)
        if (record && (!record.files || typeof record.files !== 'object' || Array.isArray(record.files))) record.files = {}
        others.push({ cache: cache, record: record, allow: allowOf(record, hashes) })
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
        if (controller.signal.aborted || backgroundPaused()) return
        let manifest = null
        try {
            manifest = await fetchManifest(controller.signal)
        } catch {
            return
        }
        if (backgroundPaused()) return

        const hashes = pathHashOf(manifest)
        stateGeneration++
        pathHash = hashes
        const targetName = cachePrefix + manifest.version + ':' + manifest.hash
        const target = await caches.open(targetName)
        currentCache = target
        const record = (await readRecord(target)) || { stage: 'critical', files: {}, misses: {}, reasons: {} }
        if (!record.files) record.files = {}
        if (!record.misses) record.misses = {}
        if (!record.reasons) record.reasons = {}
        const others = await collectOthers(targetName, hashes)
        serving = [{ cache: target, allow: null }].concat(others)

        if (manifestCovers(record, manifest)) {
            serving = [{ cache: target, allow: null }]
            await pruneOthers(targetName)
            return
        }

        const ctx = {
            cache: target,
            record: record,
            source: pickSource(others),
            repair: record.stage === 'done',
        }
        if (!await copyGroup(ctx, manifest.files || [])) return
        const groups = splitStages(manifest.files || [])
        const index = ctx.repair ? 0 : Math.max(0, stages.indexOf(record.stage))
        if (!await runGroups(ctx, groups, index)) return

        await target.put(manifestUrl, new Response(JSON.stringify(manifest), {
            headers: { 'content-type': 'application/json' }
        }))
        record.stage = 'done'
        record.missing = missingOf(record, manifest)
        await saveRecord(target, record)
        await reportMissing(record)
        serving = [{ cache: target, allow: null }]
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
        if (resumeRequested && !backgroundPaused()) start()
    })
    return runPromise
}

async function handleNavigation (request) {
    const pathname = new URL(request.url).pathname
    await ensureState()
    const key = serveKey(pathname)
    if (!key) return { response: networkOrFail(request), write: null }
    return serve(key, request.signal)
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
    return start()
}

function attach (event, result) {
    event.respondWith(result.then(function (item) { return item.response }))
    event.waitUntil(result.then(function (item) { return item.write }).catch(function () {}))
}

function isCacheableRequest (request) {
    if (request.headers.get('range')) return false
    if (request.destination === 'video' || request.destination === 'audio') return false
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
    if (scopePath !== '/' && url.pathname.indexOf(scopePath) !== 0) return

    event.waitUntil(pruneClosedPauses().catch(function () {}))

    if (!pathHash) {
        if (event.request.mode !== 'navigate') return
        attach(event, handleNavigation(event.request))
        return
    }

    const key = serveKey(url.pathname)
    if (!key) return
    attach(event, serve(key, event.request.signal))
})

self.addEventListener('message', function (event) {
    event.waitUntil(handleMessage(event))
})

ensureState()
