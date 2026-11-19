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
const rootPaths = [scopePath]

let pathHash = null
let serving = null
let statePromise = null
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
    } catch (error) {
        return null
    }
}

function readRecord (cache) {
    return readJson(cache, recordUrl)
}

function saveRecord (cache, record) {
    return cache.put(recordUrl, new Response(JSON.stringify(record), {
        headers: { 'content-type': 'application/json' }
    }))
}

/* worker 空闲回收后 activate 不会再来，状态必须能从缓存恢复：
   进度取自记录，路径哈希取自已缓存的清单。 */
async function loadState () {
    const names = await ownCacheNames()
    let target = null
    let manifest = null
    for (const name of names) {
        const cache = await caches.open(name)
        if (!await readRecord(cache)) continue
        const snapshot = await readJson(cache, manifestUrl)
        if (!snapshot) continue
        target = cache
        manifest = snapshot
    }
    pathHash = manifest ? pathHashOf(manifest) : {}
    serving = target
}

function ensureState () {
    if (!statePromise) {
        statePromise = loadState().catch(function () {
            statePromise = null
            pathHash = null
            serving = null
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
    if (!serving) return networkOrFail(request)
    const hit = await serving.match(new URL(pathname, scopeUrl).href)
    return hit || networkOrFail(request)
}

/** 只有作用域根目录才回退到 index.html。其它路径可能属于兄弟项目，
 *  用本项目首页顶替会把别的页面内容换掉。 */
function serveKey (pathname) {
    if (!pathHash) return null
    if (pathHash[pathname]) return pathname
    if (rootPaths.indexOf(pathname) === -1) return null
    const key = scopePath + 'index.html'
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

async function runGroup (ctx, list) {
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

async function runGroups (ctx, groups, index) {
    for (let i = index; i < groups.length; i++) {
        if (!await runGroup(ctx, groups[i])) return false
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
    pathHash = hashes
    const targetName = cachePrefix + manifest.version + ':' + manifest.hash
    const target = await caches.open(targetName)
    const record = (await readRecord(target)) || { stage: 'critical', files: {} }
    serving = target

    if (record.stage === 'done') {
        await pruneOthers(targetName)
        return
    }

    const ctx = { cache: target, record: record }
    const groups = splitStages(manifest.files || [])
    const index = Math.max(0, stages.indexOf(record.stage))
    if (!await runGroups(ctx, groups, index)) return

    await target.put(manifestUrl, new Response(JSON.stringify(manifest), {
        headers: { 'content-type': 'application/json' }
    }))
    record.stage = 'done'
    await saveRecord(target, record)
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
    if (data.type === 'START') event.waitUntil(start())
    else if (data.type === 'PAUSE') paused = true
})

ensureState()
