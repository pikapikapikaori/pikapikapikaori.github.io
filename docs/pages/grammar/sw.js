/* Service Worker · 缓存应用 shell，数据仍走 IndexedDB */
const CACHE = 'langnotebook-shell-v67'

const SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/css/reset.css',
    './assets/css/variables.css',
    './assets/css/fonts.css',
    './assets/css/base.css',
    './assets/css/layout.css',
    './assets/css/components.css',
    './assets/css/pages.css',
    './assets/js/main.js',
    './assets/js/router.js',
    './assets/js/app-state.js',
    './assets/js/config/config.js',
    './assets/js/utils/dom.js',
    './assets/js/utils/id.js',
    './assets/js/utils/date.js',
    './assets/js/utils/events.js',
    './assets/js/utils/text-normalize.js',
    './assets/js/store/db.js',
    './assets/js/store/user-store.js',
    './assets/js/store/word-store.js',
    './assets/js/store/settings-store.js',
    './assets/js/models/user.js',
    './assets/js/models/word.js',
    './assets/js/models/grammar.js',
    './assets/js/services/word-service.js',
    './assets/js/services/review-service.js',
    './assets/js/services/grammar-service.js',
    './assets/js/services/import-export-service.js',
    './assets/js/services/font-service.js',
    './assets/js/data/languages.js'
]

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) =>
            // 单个失败不影响其它；用 addAll 会整批失败
            Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))
        ).then(() => self.skipWaiting())
    )
})

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (e) => {
    const req = e.request
    if (req.method !== 'GET') return
    const url = new URL(req.url)
    if (url.origin !== self.location.origin) return

    // 语法 JSON / 语言档案 / 字体：stale-while-revalidate
    if (url.pathname.includes('/data/grammar/')
        || url.pathname.includes('/data/paradigm/')
        || url.pathname.includes('/resources/fonts/')) {
        e.respondWith(swr(req))
        return
    }

    // 其余静态资源：cache-first
    e.respondWith(cacheFirst(req))
})

async function cacheFirst(req) {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(req)
    if (hit) return hit
    try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
    } catch (err) {
        return new Response('离线且未缓存', { status: 504 })
    }
}

async function swr(req) {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(req)
    const network = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone())
        return res
    }).catch(() => null)
    return hit || (await network) || new Response('离线且未缓存', { status: 504 })
}
