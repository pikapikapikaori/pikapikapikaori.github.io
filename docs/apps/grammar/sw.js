'use strict'

const failureLimit = 3
const cacheLimitMB = 500
const scopeUrl = new URL(self.registration.scope)
const scopePath = pathKey(scopeUrl.pathname)
const cachePrefix = 'grammar:static:'
const manifestUrl = new URL('assets/resources/meta/file-cache.json', scopeUrl).href
const recordUrl = new URL('__cache-record__', scopeUrl).href
const entryDirs = ['']

let context = null
let statePromise = null
let mutation = Promise.resolve()
let runPromise = null
let activeRound = null
let startQueue = Promise.resolve()
const transfers = new Map()
const reservations = new Map()
const activeVisits = new Set()
const pausedVisits = new Set()

function locked (fn) {
    const next = mutation.then(fn, fn)
    mutation = next.catch(function () {})
    return next
}

function pathKey (pathname) {
    // 逐段处理以保留编码斜线，并让 @ 与 %40 等价。
    return pathname.split('/').map(function (part) {
        try { return encodeURIComponent(decodeURIComponent(part)) } catch { return encodeURIComponent(part) }
    }).join('/')
}

function urlFor (path) {
    return new URL(path.split('/').map(encodeURIComponent).join('/'), scopeUrl).href
}

function entriesOf (manifest) {
    if (!manifest || manifest.schemaVersion !== 2 || typeof manifest.version !== 'string' ||
        !/^[a-f0-9]{16}$/.test(manifest.hash) || !Array.isArray(manifest.batches) || manifest.batches.length !== 3) {
        throw new Error('Invalid cache manifest')
    }
    const entries = new Map()
    const modes = ['precache', 'on-demand', 'network-only']
    manifest.batches.forEach(function (batch, index) {
        if (batch.priority !== index + 1 || batch.mode !== modes[index] || !Array.isArray(batch.files)) {
            throw new Error('Invalid cache batch')
        }
        batch.files.forEach(function (file) {
            if (typeof file.path !== 'string' || !file.path || file.path.split('/').some(function (part) {
                return !part || part === '.' || part === '..'
            }) || !/^[a-f0-9]{16}$/.test(file.hash) || !Number.isSafeInteger(file.size) || file.size < 0) {
                throw new Error('Invalid cache entry')
            }
            const url = urlFor(file.path)
            const pathname = pathKey(new URL(url).pathname)
            if (entries.has(pathname)) throw new Error('Duplicate cache entry')
            entries.set(pathname, { path: file.path, hash: file.hash, size: file.size, priority: batch.priority, url: url })
        })
    })
    return entries
}

async function ownCacheNames () {
    return (await caches.keys()).filter(function (name) { return name.indexOf(cachePrefix) === 0 })
}

async function readJson (cache, url) {
    try {
        const response = await cache.match(url)
        return response ? await response.json() : null
    } catch {
        return null
    }
}

function emptyRecord () {
    return { schemaVersion: 2, files: {}, metadata: {}, missing: {}, visits: {}, rounds: {}, clients: {}, stage: 'pending', full: false, updatedAt: 0 }
}

function recordOf (record) {
    if (!record || record.schemaVersion !== 2) return emptyRecord()
    for (const field of ['files', 'metadata', 'missing', 'visits', 'rounds', 'clients']) {
        if (!record[field] || typeof record[field] !== 'object' || Array.isArray(record[field])) record[field] = {}
    }
    return record
}

async function save (ctx) {
    ctx.record.updatedAt = Date.now()
    try {
        await ctx.cache.put(recordUrl, new Response(JSON.stringify(ctx.record), { headers: { 'content-type': 'application/json' } }))
        return true
    } catch {
        return false
    }
}

async function makeContext (manifest) {
    const entries = entriesOf(manifest)
    const name = cachePrefix + manifest.version + ':' + manifest.hash
    const cache = await caches.open(name)
    const record = recordOf(await readJson(cache, recordUrl))
    const ctx = { entries: entries, name: name, cache: cache, record: record, p1Size: 0 }
    entries.forEach(function (entry) { if (entry.priority === 1) ctx.p1Size += entry.size })
    // 持久记录不保证响应仍在磁盘上，容量计算前检查实际缓存。
    for (const path of Object.keys(record.files)) {
        const entry = entries.get(pathKey(new URL(urlFor(path)).pathname))
        const response = entry && entry.priority !== 3 && entry.hash === record.files[path]
            ? await cache.match(entry.url) : null
        if (!response || response.status !== 200) {
            delete record.files[path]
            delete record.metadata[path]
            if (entry) await cache.delete(entry.url).catch(function () {})
        } else {
            record.metadata[path] = {
                size: entry.size,
                priority: entry.priority,
                lastAccess: Number(record.metadata[path] && record.metadata[path].lastAccess) || 0
            }
        }
    }
    for (const path of Object.keys(record.missing)) {
        const entry = entries.get(pathKey(new URL(urlFor(path)).pathname))
        if (!entry || entry.priority === 3) delete record.missing[path]
    }
    try {
        await cache.put(manifestUrl, new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }))
    } catch {}
    await save(ctx)
    return ctx
}

async function loadState () {
    let newest = null
    for (const name of await ownCacheNames()) {
        const cache = await caches.open(name)
        const manifest = await readJson(cache, manifestUrl)
        try { entriesOf(manifest) } catch { continue }
        const record = recordOf(await readJson(cache, recordUrl))
        if (!newest || record.updatedAt > newest.record.updatedAt) newest = { manifest: manifest, record: record }
    }
    if (newest) context = await makeContext(newest.manifest)
    return context
}

function ensureState () {
    if (!statePromise) statePromise = locked(loadState).catch(function () { statePromise = null; return null })
    return statePromise
}

async function refresh (resumeOnly) {
    await ensureState()
    if (resumeOnly || runPromise) return context
    let manifest
    try {
        const response = await fetch(manifestUrl, { cache: 'no-store' })
        if (response.status !== 200) throw new Error('Manifest unavailable')
        manifest = await response.json()
        entriesOf(manifest)
    } catch {
        return context
    }
    return locked(async function () {
        if (!context || context.name !== cachePrefix + manifest.version + ':' + manifest.hash) {
            context = await makeContext(manifest)
            await migrate(context)
        }
        return context
    })
}

function p2Used (ctx) {
    return Object.keys(ctx.record.metadata).reduce(function (sum, path) {
        const metadata = ctx.record.metadata[path]
        return sum + (metadata.priority === 2 ? metadata.size : 0)
    }, 0)
}

function p2Reserved (ctx) {
    let size = 0
    reservations.forEach(function (item) { if (item.name === ctx.name && item.priority === 2) size += item.size })
    return size
}

async function reserve (ctx, entry) {
    const limit = cacheLimitMB * 1024 * 1024
    if (entry.priority === 2 && ctx.p1Size + entry.size > limit) return false
    const needed = entry.priority === 2 ? entry.size : 0
    const victims = Object.keys(ctx.record.metadata).filter(function (path) {
        return ctx.record.metadata[path].priority === 2 && !reservations.has(ctx.name + ':' + path)
    }).sort(function (a, b) {
        return ctx.record.metadata[a].lastAccess - ctx.record.metadata[b].lastAccess || a.localeCompare(b)
    })
    while (ctx.p1Size + p2Used(ctx) + p2Reserved(ctx) + needed > limit && victims.length) {
        const path = victims.shift()
        if (!await ctx.cache.delete(urlFor(path))) continue
        delete ctx.record.files[path]
        delete ctx.record.metadata[path]
    }
    if (entry.priority === 2 && ctx.p1Size + p2Used(ctx) + p2Reserved(ctx) + needed > limit) {
        await save(ctx)
        return false
    }
    reservations.set(ctx.name + ':' + entry.path, { name: ctx.name, size: entry.size, priority: entry.priority })
    await save(ctx)
    return true
}

async function migrate (ctx) {
    const candidates = []
    for (const name of await ownCacheNames()) {
        if (name === ctx.name) continue
        const source = await caches.open(name)
        const snapshot = await readJson(source, manifestUrl)
        let previous
        try { previous = entriesOf(snapshot) } catch { continue }
        const record = recordOf(await readJson(source, recordUrl))
        for (const entry of ctx.entries.values()) {
            const old = previous.get(pathKey(new URL(entry.url).pathname))
            if (entry.priority === 3 || !old || old.priority === 3 || old.hash !== entry.hash ||
                ctx.record.files[entry.path] === entry.hash || record.files[entry.path] !== entry.hash) continue
            candidates.push({
                entry: entry, source: source,
                lastAccess: Number(record.metadata[entry.path] && record.metadata[entry.path].lastAccess) || 0
            })
        }
    }
    // 容量不足时先保留最近访问的旧资源，不让较旧的迁入文件挤走它们。
    candidates.sort(function (a, b) {
        return a.entry.priority - b.entry.priority || b.lastAccess - a.lastAccess || a.entry.path.localeCompare(b.entry.path)
    })
    for (const candidate of candidates) {
        const entry = candidate.entry
        if (ctx.record.files[entry.path] === entry.hash) continue
        if (entry.priority === 2 && ctx.p1Size + p2Used(ctx) + entry.size > cacheLimitMB * 1024 * 1024) continue
        const response = await candidate.source.match(entry.url)
        if (!response || response.status !== 200) continue
        let valid = false
        try { valid = await matchesHash(response, entry) } catch {}
        if (!valid || !await reserve(ctx, entry)) continue
        try {
            await ctx.cache.put(entry.url, response)
            ctx.record.files[entry.path] = entry.hash
            ctx.record.metadata[entry.path] = { size: entry.size, priority: entry.priority, lastAccess: candidate.lastAccess }
        } catch {} finally {
            reservations.delete(ctx.name + ':' + entry.path)
        }
    }
    await save(ctx)
}

async function matchesHash (response, entry) {
    if (response.status !== 200) return false
    const bytes = await response.clone().arrayBuffer()
    if (bytes.byteLength !== entry.size) return false
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = Array.from(new Uint8Array(digest)).map(function (value) { return value.toString(16).padStart(2, '0') }).join('').slice(0, 16)
    return hash === entry.hash
}

async function cached (ctx, entry) {
    return locked(async function () {
        if (ctx.record.files[entry.path] !== entry.hash) return null
        const response = await ctx.cache.match(entry.url)
        if (!response || response.status !== 200) {
            delete ctx.record.files[entry.path]
            delete ctx.record.metadata[entry.path]
            await save(ctx)
            return null
        }
        ctx.record.metadata[entry.path] = { size: entry.size, priority: entry.priority, lastAccess: Date.now() }
        delete ctx.record.missing[entry.path]
        await save(ctx)
        return response
    })
}

async function markFailure (ctx, entry, roundId, reason) {
    return locked(async function () {
        roundId = ctx.record.visits[roundId] || roundId
        const round = ctx.record.rounds[roundId]
        ctx.record.missing[entry.path] = { reason: reason, attempts: round ? round.attempts[entry.path] || 0 : 0, roundId: roundId }
        await save(ctx)
    })
}

async function beginAttempt (ctx, entry, roundId) {
    return locked(async function () {
        roundId = ctx.record.visits[roundId] || roundId
        const round = ctx.record.rounds[roundId]
        if (!round || (round.attempts[entry.path] || 0) >= failureLimit) return 'limited'
        round.attempts[entry.path] = (round.attempts[entry.path] || 0) + 1
        // 尝试数先落盘，进程重启不能重新获得同轮额度。
        if (await save(ctx)) return 'ready'
        ctx.record.missing[entry.path] = { reason: 'record-write', attempts: round.attempts[entry.path], roundId: roundId }
        return 'unrecorded'
    })
}

function transfer (ctx, entry, roundId) {
    const key = ctx.name + ':' + entry.path
    if (transfers.has(key)) return transfers.get(key)
    const promise = (async function () {
        const attempt = await beginAttempt(ctx, entry, roundId)
        if (attempt !== 'ready') return { response: null, stored: false, limited: attempt === 'limited', unrecorded: attempt === 'unrecorded' }
        let admitted = false
        try { admitted = await locked(function () { return reserve(ctx, entry) }) } catch {
            await markFailure(ctx, entry, roundId, 'cache-write')
        }
        let response
        try {
            response = await fetch(entry.url, { cache: 'no-store', priority: 'low' })
        } catch {
            await markFailure(ctx, entry, roundId, 'network')
            return { response: null, stored: false }
        }
        let stored = false
        try {
            if (await matchesHash(response, entry)) {
                if (admitted) {
                    stored = await locked(async function () {
                        await ctx.cache.put(entry.url, response.clone())
                        ctx.record.files[entry.path] = entry.hash
                        ctx.record.metadata[entry.path] = { size: entry.size, priority: entry.priority, lastAccess: Date.now() }
                        delete ctx.record.missing[entry.path]
                        reservations.delete(key)
                        const attempts = Object.values(ctx.record.rounds).map(function (round) { return [round, round.attempts[entry.path]] })
                        attempts.forEach(function (item) { delete item[0].attempts[entry.path] })
                        if (await save(ctx)) return true
                        attempts.forEach(function (item) { if (item[1] !== undefined) item[0].attempts[entry.path] = item[1] })
                        delete ctx.record.files[entry.path]
                        delete ctx.record.metadata[entry.path]
                        await ctx.cache.delete(entry.url).catch(function () {})
                        return false
                    })
                } else if (entry.priority === 2) {
                    await locked(async function () {
                        for (const round of Object.values(ctx.record.rounds)) delete round.attempts[entry.path]
                        delete ctx.record.missing[entry.path]
                        await save(ctx)
                    })
                }
            } else {
                await markFailure(ctx, entry, roundId, response.status === 200 ? 'hash' : 'status ' + response.status)
            }
        } catch {
            await markFailure(ctx, entry, roundId, 'cache-write')
        } finally {
            await locked(async function () { reservations.delete(key) })
        }
        if (!stored && admitted && !ctx.record.missing[entry.path]) await markFailure(ctx, entry, roundId, 'cache-write')
        return { response: response, stored: stored }
    })().finally(async function () {
        transfers.delete(key)
        await locked(async function () { reservations.delete(key) })
    })
    transfers.set(key, promise)
    return promise
}

function visitKey (data, source) {
    if (typeof data.visitId === 'string' && data.visitId.length > 0 && data.visitId.length <= 200) return data.visitId
    return 'client:' + (source && source.id ? source.id : 'unknown')
}

async function roundFor (ctx, key, source, join) {
    return locked(async function () {
        let id = ctx.record.visits[key]
        if (!id || !ctx.record.rounds[id]) {
            const previous = source && source.id && ctx.record.clients[source.id]
            const navigation = previous && previous.indexOf('navigation:') === 0 && ctx.record.visits[previous]
            id = join || navigation || key
            ctx.record.visits[key] = id
            if (!ctx.record.rounds[id]) ctx.record.rounds[id] = { attempts: {}, stage: 'pending' }
            if (navigation && navigation !== id && ctx.record.rounds[navigation]) {
                const attempts = ctx.record.rounds[id].attempts
                const previousAttempts = ctx.record.rounds[navigation].attempts
                for (const path of Object.keys(previousAttempts)) {
                    attempts[path] = Math.min(failureLimit, (attempts[path] || 0) + previousAttempts[path])
                }
                // 合入在途轮时带入导航已用额度，旧别名也须指向同轮。
                for (const visit of Object.keys(ctx.record.visits)) {
                    if (ctx.record.visits[visit] === navigation) ctx.record.visits[visit] = id
                }
                for (const missing of Object.values(ctx.record.missing)) {
                    if (missing.roundId === navigation) missing.roundId = id
                }
                delete ctx.record.rounds[navigation]
            }
        }
        if (source && source.id) ctx.record.clients[source.id] = key
        await save(ctx)
        return id
    })
}

async function pruneOthers (ctx) {
    for (const name of await ownCacheNames()) {
        if (name !== ctx.name) await caches.delete(name)
    }
}

function projectOf (value) {
    return typeof value === 'string' && entryDirs.indexOf(value) !== -1 && value ? value : null
}

async function precache (ctx, roundId, project) {
    const entries = Array.from(ctx.entries.values()).filter(function (entry) { return entry.priority === 1 })
    if (project) entries.sort(function (a, b) {
        return Number(b.path.indexOf(project) === 0) - Number(a.path.indexOf(project) === 0)
    })
    await locked(async function () {
        ctx.record.full = true
        ctx.record.stage = 'precache'
        ctx.record.rounds[roundId].stage = 'precache'
        await save(ctx)
    })
    for (const entry of entries) {
        if (!activeVisits.size) return
        if (await cached(ctx, entry)) continue
        while ((ctx.record.rounds[roundId].attempts[entry.path] || 0) < failureLimit) {
            if (!activeVisits.size) return
            const result = await transfer(ctx, entry, roundId)
            if (result.stored || result.limited || result.unrecorded) break
        }
        if (ctx.record.files[entry.path] !== entry.hash && !ctx.record.missing[entry.path]) {
            await markFailure(ctx, entry, roundId, 'interrupted')
        }
    }
    if (!activeVisits.size) return
    await locked(async function () {
        ctx.record.stage = 'done'
        ctx.record.rounds[roundId].stage = 'done'
        ctx.record.offlineComplete = !entries.some(function (entry) { return ctx.record.files[entry.path] !== entry.hash })
        if (await save(ctx)) await pruneOthers(ctx)
    })
    try {
        const missing = entries.filter(function (entry) { return ctx.record.files[entry.path] !== entry.hash }).map(function (entry) { return entry.path })
        const clients = await self.clients.matchAll({ type: 'window' })
        clients.forEach(function (client) {
            client.postMessage({ type: missing.length ? 'CACHE_MISSING' : 'CACHE_DONE', missing: missing, offlineComplete: !missing.length })
        })
    } catch {}
}

function start (data, source) {
    const setup = startQueue.then(async function () {
        const key = visitKey(data, source)
        const backup = data.reason === 'backup'
        const ctx = await refresh(backup)
        if (!ctx || (backup && !ctx.record.full)) return null
        const currentKey = backup ? source && ctx.record.clients[source.id] : key
        if (!currentKey) return null
        if (backup) pausedVisits.delete(currentKey)
        if (pausedVisits.has(currentKey)) return null
        activeVisits.add(currentKey)
        const roundId = await roundFor(ctx, currentKey, source, runPromise ? activeRound : null)
        if (!runPromise) {
            activeRound = roundId
            runPromise = precache(ctx, roundId, projectOf(data.project)).catch(function () {}).finally(function () {
                runPromise = null
                activeRound = null
            })
        }
        return { running: runPromise }
    })
    startQueue = setup.then(function () {}, function () {})
    return setup.then(function (result) { return result && result.running }).catch(function () {})
}

async function network (request) {
    try { return await fetch(request) } catch { return new Response('', { status: 504, statusText: 'Gateway Timeout' }) }
}

function entryFor (ctx, pathname) {
    pathname = pathKey(pathname)
    let entry = ctx.entries.get(pathname)
    if (!entry && pathname.indexOf(scopePath) === 0) {
        const relative = pathname.slice(scopePath.length)
        if (entryDirs.indexOf(relative) !== -1) entry = ctx.entries.get(pathname + 'index.html')
    }
    return entry
}

async function rangeResponse (response, range) {
    if (!range || response.status !== 200) return response
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) return null
    const bytes = await response.arrayBuffer()
    const size = bytes.byteLength
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
    const end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1
    if (start >= size || end < start) return new Response('', { status: 416, headers: { 'content-range': 'bytes */' + size } })
    const headers = new Headers(response.headers)
    headers.set('content-range', 'bytes ' + start + '-' + end + '/' + size)
    headers.set('content-length', String(end - start + 1))
    headers.set('accept-ranges', 'bytes')
    headers.delete('content-encoding')
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: headers })
}

async function serve (event) {
    await ensureState()
    const ctx = context
    if (!ctx) return network(event.request)
    const entry = entryFor(ctx, new URL(event.request.url).pathname)
    if (!entry || entry.priority === 3) return network(event.request)
    const range = event.request.headers.get('range')
    if (entry.priority === 2 && ctx.p1Size + entry.size > cacheLimitMB * 1024 * 1024) return network(event.request)
    try {
        const navigation = event.request.mode === 'navigate'
        const clientId = navigation ? event.resultingClientId || event.clientId : event.clientId
        // 导航先于页面 START，临时轮次须随新文档变化，并由其 START 接续。
        if (navigation && !clientId) return network(event.request)
        let key = ctx.record.clients[clientId]
        if (!key) key = (navigation ? 'navigation:' : 'client:') + (clientId || 'unknown')
        const roundId = await roundFor(ctx, key, { id: clientId }, null)
        const hit = await cached(ctx, entry)
        if (hit) return (await rangeResponse(hit, range)) || network(event.request)
        const result = await transfer(ctx, entry, roundId)
        if (result.unrecorded || (result.limited && ctx.record.missing[entry.path] &&
            ['cache-write', 'record-write'].indexOf(ctx.record.missing[entry.path].reason) !== -1)) return network(event.request)
        if (result.response) return (await rangeResponse(result.response.clone(), range)) || network(event.request)
        return new Response('', { status: 504, statusText: 'Cache attempt limit or network failure' })
    } catch {
        return network(event.request)
    }
}

self.addEventListener('activate', function (event) {
    event.waitUntil(ensureState().then(function () { return self.clients.claim() }))
})

self.addEventListener('fetch', function (event) {
    const url = new URL(event.request.url)
    if (event.request.method !== 'GET' || url.origin !== scopeUrl.origin || pathKey(url.pathname).indexOf(scopePath) !== 0) return
    event.respondWith(serve(event))
})

self.addEventListener('message', function (event) {
    const data = event.data || {}
    if (data.type === 'START') {
        pausedVisits.delete(visitKey(data, event.source))
        event.waitUntil(start(data, event.source))
    } else if (data.type === 'PAUSE') {
        const key = visitKey(data, event.source)
        pausedVisits.add(key)
        activeVisits.delete(key)
        event.waitUntil(ensureState().then(function () {
            const original = context && event.source && context.record.clients[event.source.id]
            if (original) {
                pausedVisits.add(original)
                activeVisits.delete(original)
            }
        }))
    }
})
