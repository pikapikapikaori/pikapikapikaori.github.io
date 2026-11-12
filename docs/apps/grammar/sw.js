/* Service Worker · 缓存应用 shell，数据仍走 IndexedDB */
const CACHE = 'langnotebook-shell-v1'

const SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/css/reset.css',
    './assets/css/variables.css',
    './assets/css/fonts.css',
    './assets/css/lang.css',
    './assets/css/base.css',
    './assets/css/layout.css',
    './assets/css/components.css',
    './assets/css/pages.css',
    './assets/css/notes.css',
    './assets/css/nonstandard/base.css',
    './assets/css/nonstandard/reset.css',
    './assets/css/nonstandard/components.css',
    './assets/css/nonstandard/pages.css',
    './assets/css/nonstandard/notes.css',
    './assets/js/main.js',
    './assets/js/router.js',
    './assets/js/app-state.js',
    './assets/js/config/config.js',
    './assets/js/utils/dom.js',
    './assets/js/utils/id.js',
    './assets/js/utils/date.js',
    './assets/js/utils/events.js',
    './assets/js/utils/text-normalize.js',
    './assets/js/utils/view-toggles.js',
    './assets/js/store/db.js',
    './assets/js/store/user-store.js',
    './assets/js/store/word-store.js',
    './assets/js/store/note-store.js',
    './assets/js/store/settings-store.js',
    './assets/js/models/user.js',
    './assets/js/models/word.js',
    './assets/js/models/grammar.js',
    './assets/js/services/word-service.js',
    './assets/js/services/review-service.js',
    './assets/js/services/grammar-service.js',
    './assets/js/services/import-export-service.js',
    './assets/js/services/font-service.js',
    './assets/js/services/schema-service.js',
    './assets/js/utils/markdown.js',
    './assets/js/utils/note-markdown.js',
    './assets/js/components/json-input.js',
    './assets/js/components/input-helper.js',
    './assets/js/adapters/text-field.js',
    './assets/js/utils/ime-compose.js',
    './assets/js/utils/breve.js',
    './assets/js/utils/dual-text.js',
    './assets/js/components/note-editor.js',
    './assets/js/components/note-toolbar.js',
    './assets/js/views/notes-view.js',
    './assets/js/services/ime-service.js',
    './assets/js/dev/index.js',
    './assets/js/dev/grammar.js',
    './assets/js/data/languages.js',
    './assets/js/components/analyze-modal.js',
    './assets/js/components/card-overlay.js',
    './assets/js/components/editable-input.js',
    './assets/js/components/entry-lists.js',
    './assets/js/components/form-field.js',
    './assets/js/components/ghost-input.js',
    './assets/js/components/grammar-table.js',
    './assets/js/components/grammar-verify-modal.js',
    './assets/js/components/icons.js',
    './assets/js/components/import-words-modal.js',
    './assets/js/components/modal.js',
    './assets/js/components/page-tools.js',
    './assets/js/components/pagination.js',
    './assets/js/components/paradigm-table.js',
    './assets/js/components/select-field.js',
    './assets/js/components/select-menu.js',
    './assets/js/components/tabs.js',
    './assets/js/components/theme-toggle.js',
    './assets/js/components/toast.js',
    './assets/js/components/vertical-popover.js',
    './assets/js/models/paradigm-generate.js',
    './assets/js/services/analyze-service.js',
    './assets/js/services/http.js',
    './assets/js/services/import-words-service.js',
    './assets/js/store/http-cache.js',
    './assets/js/store/pending-lookup.js',
    './assets/js/utils/bdi.js',
    './assets/js/utils/breadcrumbs.js',
    './assets/js/utils/caret.js',
    './assets/js/utils/pos.js',
    './assets/js/utils/space-filter.js',
    './assets/js/views/grammar-view.js',
    './assets/js/views/language-select-view.js',
    './assets/js/views/review-view.js',
    './assets/js/views/schema-view.js',
    './assets/js/views/settings-view.js',
    './assets/js/views/welcome-view.js',
    './assets/js/views/word-form-view.js',
    './assets/js/views/word-list-view.js'
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

    // 语法 JSON / 语言档案 / 默认数据源 / 字体：stale-while-revalidate
    if (url.pathname.includes('/data/language/')
        || url.pathname.includes('/data/schema/')
        || url.pathname.includes('/data/user/')
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
