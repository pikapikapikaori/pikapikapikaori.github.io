'use strict'

const scopeUrl = new URL(self.registration.scope)
const scopePath = scopeUrl.pathname
const cachePrefix = 'pikapikapi:indexpage:static:'
const manifestPath = 'assets/resources/meta/file-cache.json'
const manifestUrl = new URL(manifestPath, scopeUrl).href
const recordUrl = new URL('__cache-record__', scopeUrl).href
const criticalExts = ['js', 'css', 'html']
const fontExts = ['woff2', 'woff', 'ttf', 'otf', 'eot']
const saveEvery = 20
const stages = ['critical', 'fonts', 'rest']
const entryDirs = ['']

let pathHash = null
let serving = []
let statePromise = null
let stateGeneration = 0
let runPromise = null
let paused = false
let pendingProject = null
let pendingFull = false

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

function withFiles (record) {
    if (!record) return record
    if (!record.files || typeof record.files !== 'object' || Array.isArray(record.files)) {
        record.files = {}
    }
    return record
}

function saveRecord (cache, record) {
    return cache.put(recordUrl, new Response(JSON.stringify(record), {
        headers: { 'content-type': 'application/json' }
    }))
}

function writeSnapshot (cache, manifest) {
    return cache.put(manifestUrl, new Response(JSON.stringify(manifest), {
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
    let manifestDone = true
    for (const name of names) {
        const cache = await caches.open(name)
        const record = withFiles(await readRecord(cache))
        list.push({ cache: cache, record: record })
        const snapshot = await readSnapshot(cache)
        if (!snapshot) continue
        const done = record && record.stage === 'done'
        if (!manifest || (manifestDone && !done)) {
            manifest = snapshot
            manifestDone = done
        }
    }
    const hashes = manifest ? pathHashOf(manifest) : {}
    list.sort(function (a, b) {
        const rankA = a.record && a.record.stage === 'done' ? 1 : 0
        const rankB = b.record && b.record.stage === 'done' ? 1 : 0
        return rankA - rankB
    })
    if (generation !== stateGeneration) return
    pathHash = hashes
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

async function networkOrFail (request) {
    try {
        return await fetch(request)
    } catch {
        return new Response('', { status: 504, statusText: 'Gateway Timeout' })
    }
}

async function serve (pathname, request) {
    const url = new URL(pathname, scopeUrl).href
    for (let i = 0; i < serving.length; i++) {
        const item = serving[i]
        if (item.allow && !item.allow[pathname]) continue
        const hit = await item.cache.match(url)
        if (hit) return hit
    }
    return networkOrFail(request)
}

function serveKey (pathname) {
    if (!pathHash) return null
    if (pathHash[pathname]) return pathname
    if (pathname.indexOf(scopePath) !== 0) return null
    const relative = pathname.slice(scopePath.length)
    if (entryDirs.indexOf(relative) === -1) return null
    const key = scopePath + relative + 'index.html'
    return pathHash[key] ? key : null
}

async function download (ctx, url) {
    try {
        const response = await fetch(url, { cache: 'no-store', priority: 'low' })
        if (!response.ok) return false
        await ctx.cache.put(url, response)
        return true
    } catch {
        return false
    }
}

async function copyFromSource (ctx, url, entry) {
    if (!ctx.source || !ctx.source.record) return false
    if (ctx.source.record.files[entry.path] !== entry.hash) return false
    try {
        const hit = await ctx.source.cache.match(url)
        if (!hit) return false
        await ctx.cache.put(url, hit)
        return true
    } catch {
        return false
    }
}

async function copyStage (ctx, list) {
    let sinceSave = 0
    for (let i = 0; i < list.length; i++) {
        if (paused) {
            await saveRecord(ctx.cache, ctx.record)
            return false
        }
        const entry = list[i]
        if (ctx.record.files[entry.path] === entry.hash) continue
        const url = new URL(entry.path, scopeUrl).href
        if (!await copyFromSource(ctx, url, entry)) continue
        ctx.record.files[entry.path] = entry.hash
        sinceSave++
        if (sinceSave >= saveEvery) {
            sinceSave = 0
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    await saveRecord(ctx.cache, ctx.record)
    return true
}

async function downloadStage (ctx, list) {
    let sinceSave = 0
    let failed = 0
    for (let i = 0; i < list.length; i++) {
        if (paused) break
        const entry = list[i]
        if (ctx.record.files[entry.path] === entry.hash) continue
        const url = new URL(entry.path, scopeUrl).href
        if (!await download(ctx, url)) {
            failed++
            continue
        }
        ctx.record.files[entry.path] = entry.hash
        sinceSave++
        if (sinceSave >= saveEvery) {
            sinceSave = 0
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    await saveRecord(ctx.cache, ctx.record)
    return failed === 0 && !paused
}

async function runStages (ctx, groups, index) {
    for (let i = index; i < groups.length; i++) {
        if (!await downloadStage(ctx, groups[i])) return false
        if (i + 1 < stages.length) {
            ctx.record.stage = stages[i + 1]
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    return true
}

function fetchManifest () {
    return fetch(manifestUrl, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('manifest ' + response.status)
        return response.json()
    })
}

function pickSource (others) {
    let best = null
    let bestCount = -1
    for (let i = 0; i < others.length; i++) {
        const item = others[i]
        if (!item.record) continue
        const count = Object.keys(item.record.files).length
        if (count > bestCount) {
            best = item
            bestCount = count
        }
    }
    return best
}

async function collectOthers (targetName, hashes) {
    const names = await ownCacheNames()
    const others = []
    for (const name of names) {
        if (name === targetName) continue
        const cache = await caches.open(name)
        const record = withFiles(await readRecord(cache))
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

async function hasRootCache () {
    const names = await ownCacheNames()
    for (let i = 0; i < names.length; i++) {
        const cache = await caches.open(names[i])
        const record = withFiles(await readRecord(cache))
        if (record && record.full) return true
    }
    return false
}

async function run (project, resumeOnly) {
    await ensureState()

    if (resumeOnly && (await ownCacheNames()).length === 0) return

    let manifest = null
    try {
        manifest = await fetchManifest()
    } catch {
        return
    }

    const hashes = pathHashOf(manifest)
    stateGeneration++
    pathHash = hashes
    const targetName = cachePrefix + manifest.version + ':' + manifest.hash
    const hadCache = await hasRootCache()
    if (resumeOnly && !(await caches.has(targetName))) return
    const target = await caches.open(targetName)
    const record = withFiles(await readRecord(target)) || { stage: 'critical', files: {} }
    const others = await collectOthers(targetName, hashes)
    serving = [{ cache: target, allow: null }].concat(others)

    if (record.stage === 'done') {
        serving = [{ cache: target, allow: null }]
        await pruneOthers(targetName)
        return
    }

    if (resumeOnly && !record.full) return

    const ctx = { cache: target, record: record, source: pickSource(others) }
    const files = manifest.files || []

    if (project) {
        const own = files.filter(function (entry) {
            return entry.path.indexOf(project) === 0
        })
        if (!await copyStage(ctx, own)) {
            await writeSnapshot(target, manifest)
            return
        }
        const groups = splitStages(own)
        let ok = true
        for (let i = 0; i < groups.length; i++) {
            ok = await downloadStage(ctx, groups[i])
            if (!ok) break
        }
        await writeSnapshot(target, manifest)
        if (!ok || !hadCache) return
    }

    record.full = true
    await saveRecord(target, record)
    if (!await copyStage(ctx, files)) return
    const groups = splitStages(files)
    const index = Math.max(0, stages.indexOf(record.stage))
    if (!await runStages(ctx, groups, index)) return

    await writeSnapshot(target, manifest)
    record.stage = 'done'
    await saveRecord(target, record)
    serving = [{ cache: target, allow: null }]
    await pruneOthers(targetName)
}

function projectOf (value) {
    if (typeof value !== 'string') return null
    const path = value.replace(/^\//, '')
    if (!path || entryDirs.indexOf(path) === -1) return null
    return path
}

async function loop (first, firstResumeOnly) {
    let project = first
    let resumeOnly = !!firstResumeOnly
    for (;;) {
        try {
            await run(project || null, resumeOnly)
        } catch {
            pendingFull = false
            pendingProject = null
            return
        }
        resumeOnly = false
        if (paused) {
            pendingFull = false
            pendingProject = null
            return
        }
        if (pendingFull) {
            pendingFull = false
            pendingProject = null
            project = null
            continue
        }
        if (pendingProject) {
            project = pendingProject
            pendingProject = null
            continue
        }
        return
    }
}

function start (project) {
    paused = false
    if (runPromise) {
        if (project) pendingProject = project
        else pendingFull = true
        return runPromise
    }
    runPromise = loop(project || null, false).finally(function () {
        runPromise = null
    })
    return runPromise
}

function resume () {
    paused = false
    if (runPromise) return runPromise
    runPromise = loop(null, true).finally(function () {
        runPromise = null
    })
    return runPromise
}

async function handleNavigation (request) {
    const pathname = new URL(request.url).pathname
    await ensureState()
    const key = serveKey(pathname)
    if (!key) return networkOrFail(request)
    return serve(key, request)
}

self.addEventListener('activate', function (event) {
    event.waitUntil(ensureState().then(function () {
        return self.clients.claim()
    }))
})

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return
    const url = new URL(event.request.url)
    if (url.origin !== scopeUrl.origin) return
    if (scopePath !== '/' && url.pathname.indexOf(scopePath) !== 0) return

    if (!pathHash) {
        if (event.request.mode !== 'navigate') return
        event.respondWith(handleNavigation(event.request))
        return
    }

    const key = serveKey(url.pathname)
    if (!key) return
    event.respondWith(serve(key, event.request))
})

self.addEventListener('message', function (event) {
    const data = event.data || {}
    if (data.type === 'START') {
        if (data.reason === 'backup') {
            event.waitUntil(resume())
            return
        }
        if (data.project === undefined) {
            event.waitUntil(start(null))
            return
        }
        const project = projectOf(data.project)
        if (project) event.waitUntil(start(project))
    } else if (data.type === 'PAUSE') paused = true
})

ensureState()
