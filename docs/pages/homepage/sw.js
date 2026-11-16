'use strict'

const SCOPE_URL = new URL(self.registration.scope)
const SCOPE_PATH = SCOPE_URL.pathname
const CACHE_PREFIX = 'pikapikapi:homepage:static:'
const MANIFEST_PATH = 'assets/resources/meta/file-cache.json'
const MANIFEST_URL = new URL(MANIFEST_PATH, SCOPE_URL).href
const RECORD_URL = new URL('__cache-record__', SCOPE_URL).href
const CRITICAL_EXTS = ['js', 'css', 'html']
const FONT_EXTS = ['woff2', 'woff', 'ttf', 'otf', 'eot']
const SAVE_EVERY = 20
const STAGES = ['critical', 'fonts', 'rest']
const ROOT_PATHS = [SCOPE_PATH]

let pathHash = null
let serving = []
let statePromise = null
let stateGeneration = 0
let runPromise = null
let paused = false

function extOf (path) {
    const name = path.slice(path.lastIndexOf('/') + 1)
    const i = name.lastIndexOf('.')
    return i < 1 ? '' : name.slice(i + 1).toLowerCase()
}

function ownCacheNames () {
    return caches.keys().then(function (names) {
        return names.filter(function (name) {
            return name.indexOf(CACHE_PREFIX) === 0
        })
    })
}

function pathHashOf (manifest) {
    const map = {}
    const files = (manifest && manifest.files) || []
    for (let i = 0; i < files.length; i++) {
        map[new URL(files[i].path, SCOPE_URL).pathname] = files[i].hash
    }
    return map
}

function splitStages (files) {
    const groups = [[], [], []]
    for (let i = 0; i < files.length; i++) {
        const ext = extOf(files[i].path)
        if (CRITICAL_EXTS.indexOf(ext) !== -1) groups[0].push(files[i])
        else if (FONT_EXTS.indexOf(ext) !== -1) groups[1].push(files[i])
        else groups[2].push(files[i])
    }
    return groups
}

async function readJson (cache, url) {
    try {
        const hit = await cache.match(url)
        return hit ? await hit.json() : null
    } catch (error) {
        return null
    }
}

function readRecord (cache) {
    return readJson(cache, RECORD_URL)
}

function readSnapshot (cache) {
    return readJson(cache, MANIFEST_URL)
}

function saveRecord (cache, record) {
    return cache.put(RECORD_URL, new Response(JSON.stringify(record), {
        headers: { 'content-type': 'application/json' }
    }))
}

/* 旧缓存只在文件内容与当前清单一致时才服务，避免迁移期间新旧版本混用。 */
function allowOf (record, hashes) {
    const allow = {}
    if (!record || !record.files) return allow
    for (const path in record.files) {
        const pathname = new URL(path, SCOPE_URL).pathname
        if (hashes[pathname] === record.files[path]) allow[pathname] = true
    }
    return allow
}

/* worker 空闲回收后 activate 不会再来，状态必须能从缓存恢复。 */
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
    /* 未完成的缓存排前面，迁移期间优先取新内容 */
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
    } catch (error) {
        return new Response('', { status: 504, statusText: 'Gateway Timeout' })
    }
}

async function serve (pathname, request) {
    const url = new URL(pathname, SCOPE_URL).href
    for (let i = 0; i < serving.length; i++) {
        const item = serving[i]
        if (item.allow && !item.allow[pathname]) continue
        const hit = await item.cache.match(url)
        if (hit) return hit
    }
    return networkOrFail(request)
}

/** 只有作用域根目录才回退到 index.html。其它路径可能属于兄弟项目，
 *  用本项目首页顶替会把别的页面内容换掉。 */
function serveKey (pathname) {
    if (!pathHash) return null
    if (pathHash[pathname]) return pathname
    if (ROOT_PATHS.indexOf(pathname) === -1) return null
    const key = SCOPE_PATH + 'index.html'
    return pathHash[key] ? key : null
}

async function download (ctx, url) {
    try {
        const response = await fetch(url, { cache: 'no-store', priority: 'low' })
        if (!response.ok) return false
        await ctx.cache.put(url, response)
        return true
    } catch (error) {
        return false
    }
}

async function moveFromSource (ctx, url, entry) {
    if (!ctx.source || !ctx.source.record) return false
    if (ctx.source.record.files[entry.path] !== entry.hash) return false
    try {
        const hit = await ctx.source.cache.match(url)
        if (!hit) return false
        await ctx.cache.put(url, hit)
        await ctx.source.cache.delete(url)
        return true
    } catch (error) {
        return false
    }
}

async function acquire (ctx, url, entry) {
    if (await moveFromSource(ctx, url, entry)) return true
    return download(ctx, url)
}

async function runGroup (ctx, list) {
    let sinceSave = 0
    let failed = 0
    for (let i = 0; i < list.length; i++) {
        if (paused) break
        const entry = list[i]
        if (ctx.record.files[entry.path] === entry.hash) continue
        const url = new URL(entry.path, SCOPE_URL).href
        if (!await acquire(ctx, url, entry)) {
            failed++
            continue
        }
        ctx.record.files[entry.path] = entry.hash
        sinceSave++
        if (sinceSave >= SAVE_EVERY) {
            sinceSave = 0
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    await saveRecord(ctx.cache, ctx.record)
    return failed === 0 && !paused
}

async function runGroups (ctx, groups, index) {
    for (let i = index; i < groups.length; i++) {
        if (!await runGroup(ctx, groups[i])) return false
        if (i + 1 < STAGES.length) {
            ctx.record.stage = STAGES[i + 1]
            await saveRecord(ctx.cache, ctx.record)
        }
    }
    return true
}

function fetchManifest () {
    return fetch(MANIFEST_URL, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('manifest ' + response.status)
        return response.json()
    })
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
    await ensureState()

    let manifest = null
    try {
        manifest = await fetchManifest()
    } catch (error) {
        return
    }

    const hashes = pathHashOf(manifest)
    stateGeneration++
    pathHash = hashes
    const targetName = CACHE_PREFIX + manifest.version + ':' + manifest.hash
    const target = await caches.open(targetName)
    const record = (await readRecord(target)) || { stage: 'critical', files: {} }
    const others = await collectOthers(targetName, hashes)
    serving = [{ cache: target, allow: null }].concat(others)

    if (record.stage === 'done') {
        serving = [{ cache: target, allow: null }]
        await pruneOthers(targetName)
        return
    }

    const ctx = { cache: target, record: record, source: pickSource(others) }
    const groups = splitStages(manifest.files || [])
    const index = Math.max(0, STAGES.indexOf(record.stage))
    if (!await runGroups(ctx, groups, index)) return

    await target.put(MANIFEST_URL, new Response(JSON.stringify(manifest), {
        headers: { 'content-type': 'application/json' }
    }))
    record.stage = 'done'
    await saveRecord(target, record)
    serving = [{ cache: target, allow: null }]
    await pruneOthers(targetName)
}

function start () {
    paused = false
    if (runPromise) return runPromise
    runPromise = run().finally(function () {
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
    if (url.origin !== SCOPE_URL.origin) return
    if (SCOPE_PATH !== '/' && url.pathname.indexOf(SCOPE_PATH) !== 0) return

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
    if (data.type === 'START') event.waitUntil(start())
    else if (data.type === 'PAUSE') paused = true
})

ensureState()
