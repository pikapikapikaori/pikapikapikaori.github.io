import { renderOverviewPage } from './pages/overview.js'
import { renderDetailPage } from './pages/detail.js'
import { renderBackupPage } from './pages/backup.js'
import { renderImportPage } from './pages/import.js'
import { renderUsersPage } from './pages/users.js'
import { renderDataPage } from './pages/data.js'
import { renderAboutPage } from './pages/about.js'
import { setActiveNav, syncHeader, closeHeaderPopovers } from './layout.js'
import { closeMenu } from './ui/menu.js'
import { closeSearch } from './search.js'
import { escapeHtml } from './dom.js'

const BASE_TITLE = document.title

const ROUTES = {
    '/': { name: 'overview', nav: 'collection', render: renderOverviewPage },
    '/detail': { name: 'detail', nav: 'collection', template: 'detail', render: renderDetailPage },
    '/backup': { name: 'backup', nav: 'source', template: 'backup', render: renderBackupPage },
    '/import': { name: 'import', nav: 'source', template: 'import', render: renderImportPage },
    '/users': { name: 'users', nav: 'source', template: 'users', render: renderUsersPage },
    '/data': { name: 'data', nav: 'data', template: 'data', render: renderDataPage },
    '/about': { name: 'about', nav: 'about', template: 'about', render: renderAboutPage },
}

// Templates are fetched once per session; the parsed title and skeleton are
// kept so a repeat visit needs no request.
const templateCache = new Map()
// The collection page is the only route whose scroll position is restored, and
// only when coming back from detail.
const scrollMemory = new Map()

let renderSeq = 0
let activeKey = ''
let activePath = ''
let previousPath = ''
let started = false

function parseHash() {
    const raw = location.hash.slice(1)
    const split = raw.indexOf('?')
    const path = split === -1 ? raw : raw.slice(0, split)
    return {
        path: path || '/',
        params: new URLSearchParams(split === -1 ? '' : raw.slice(split + 1)),
    }
}

function routeKey(path, params) {
    const query = params.toString()
    return query ? path + '?' + query : path
}

function loadTemplate(name) {
    const cached = templateCache.get(name)
    if (cached) return cached
    const promise = fetch('./assets/html/' + name + '.html', { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('template ' + response.status)
            return response.text()
        })
        .then(html => {
            const doc = new DOMParser().parseFromString(html, 'text/html')
            const host = doc.getElementById('main')
            return { title: doc.title, markup: host ? host.innerHTML : '' }
        })
    // A rejected promise must leave the cache, otherwise retry would replay the
    // same failure without another request.
    promise.catch(() => templateCache.delete(name))
    templateCache.set(name, promise)
    return promise
}

function goBack() {
    // Only a real collection entry can be popped; any other origin jumps
    // straight to the collection route so the label matches the result.
    if (previousPath === '/') {
        history.back()
        return
    }
    location.hash = '#/'
}

function renderError(main, error, route) {
    setActiveNav(route.nav)
    document.title = BASE_TITLE
    main.dataset.route = 'error'
    main.innerHTML = `
        <div class="empty">
            页面加载失败：${escapeHtml(error?.message || String(error))}
            <button type="button" class="btn" id="route-retry">重试</button>
        </div>
    `
    main.querySelector('#route-retry')?.addEventListener('click', () => {
        if (route.template) templateCache.delete(route.template)
        renderRoute(true)
    })
}

async function renderRoute(force = false) {
    const seq = ++renderSeq
    const main = document.getElementById('main')
    if (!main) return

    let { path, params } = parseHash()
    let route = ROUTES[path]
    if (!route || (path === '/detail' && !params.get('id'))) {
        // Unknown or incomplete routes fall back to the collection page without
        // adding a history entry.
        history.replaceState(history.state, '', '#/')
        path = '/'
        params = new URLSearchParams()
        route = ROUTES[path]
    }

    const key = routeKey(path, params)
    if (!force && key === activeKey) return
    // Popups live outside #main, so replacing the page would leave them
    // floating over the next route.
    closeMenu()
    closeSearch()
    closeHeaderPopovers()

    const returning = activePath === '/detail' && path === '/'
    if (activePath && activePath !== path) scrollMemory.set(activePath, window.scrollY)

    // Commit the route before any await: a failure page still belongs to this
    // route, and a stale key would swallow the next visit to the old route.
    previousPath = activePath
    activePath = path
    activeKey = key

    let template = null
    if (route.template) {
        try {
            template = await loadTemplate(route.template)
        } catch (error) {
            if (seq !== renderSeq) return
            renderError(main, error, route)
            return
        }
        if (seq !== renderSeq) return
    }

    setActiveNav(route.nav)
    syncHeader()
    document.title = template?.title || BASE_TITLE
    main.dataset.route = route.name
    main.innerHTML = template?.markup || ''

    try {
        await route.render({ params, goBack })
    } catch (error) {
        // An error from a superseded render must not replace the new page.
        if (seq !== renderSeq) return
        renderError(main, error, route)
        return
    }
    if (seq !== renderSeq) return

    const targetY = returning ? (scrollMemory.get('/') || 0) : 0
    // Wait for the new page's first layout; the document height is not final yet.
    requestAnimationFrame(() => window.scrollTo(0, targetY))
    syncHeader()
}

export function startRouter() {
    if (started) return
    started = true
    history.scrollRestoration = 'manual'
    window.addEventListener('hashchange', () => renderRoute())
    // Re-assigning the current hash fires no hashchange, so callers that clear
    // the viewed user request an explicit repaint instead.
    window.addEventListener('app:rerender', () => renderRoute(true))
    // The first paint happens on load; module scripts normally run before it.
    if (document.readyState === 'complete') renderRoute()
    else window.addEventListener('load', () => renderRoute(), { once: true })
}
