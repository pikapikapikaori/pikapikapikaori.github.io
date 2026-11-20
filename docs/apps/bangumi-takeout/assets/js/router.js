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

const baseTitle = document.title

const routes = {
    '/': { name: 'overview', nav: 'collection', render: renderOverviewPage },
    '/detail': { name: 'detail', nav: 'collection', title: '详情', render: renderDetailPage },
    '/backup': { name: 'backup', nav: 'source', title: '备份', render: renderBackupPage },
    '/import': { name: 'import', nav: 'source', title: '导入', render: renderImportPage },
    '/users': { name: 'users', nav: 'source', title: '选择用户', render: renderUsersPage },
    '/data': { name: 'data', nav: 'data', title: '数据管理', render: renderDataPage },
    '/about': { name: 'about', nav: 'about', title: '关于', render: renderAboutPage },
}

// Only the collection page restores its scroll, and only when returning from detail.
const scrollMemory = new Map()

let renderSeq = 0
let activeKey = ''
let activePath = ''
let previousPath = ''
let started = false

// Callers that keep a mask up wait on this list; the render owning the last
// sequence settles it, and the timeout frees a mask whose render is lost.
const navigateTimeout = 10000
let renderWaiters = []

function settleRenderWaiters() {
    const waiters = renderWaiters
    renderWaiters = []
    waiters.forEach(resolve => resolve())
}

export function navigate(target) {
    return new Promise(resolve => {
        if (target === location.hash) {
            resolve()
            return
        }
        let settled = false
        const finish = () => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            const index = renderWaiters.indexOf(finish)
            if (index !== -1) renderWaiters.splice(index, 1)
            resolve()
        }
        const timer = setTimeout(finish, navigateTimeout)
        renderWaiters.push(finish)
        location.href = target
    })
}

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

// A page passes the item name so the title follows the page; '' restores the document title.
function setTitle(title) {
    document.title = title ? title + ' - ' + baseTitle : baseTitle
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
    setTitle(route.title)
    main.dataset.route = 'error'
    main.innerHTML = `
        <div class="empty">
            页面加载失败：${escapeHtml(error?.message || String(error))}
            <button type="button" class="btn" id="route-retry">重试</button>
        </div>
    `
    main.querySelector('#route-retry')?.addEventListener('click', () => {
        renderRoute(true)
    })
}

async function renderRoute(force = false) {
    const main = document.getElementById('main')
    if (!main) return

    let { path, params } = parseHash()
    let route = routes[path]
    if (!route || (path === '/detail' && !params.get('id'))) {
        // Unknown or incomplete routes fall back to the collection page without
        // adding a history entry.
        history.replaceState(history.state, '', '#/')
        path = '/'
        params = new URLSearchParams()
        route = routes[path]
    }

    const key = routeKey(path, params)
    if (!force && key === activeKey) return
    // Taken after the shortcut above, so a repeated hash does not discard the render.
    const seq = ++renderSeq
    // Popups live outside #main, so replacing the page would leave them
    // floating over the next route.
    closeMenu()
    closeSearch()
    closeHeaderPopovers()

    const returning = activePath === '/detail' && path === '/'
    if (activePath && activePath !== path) scrollMemory.set(activePath, window.scrollY)

    // The route is committed before any await, so a failure page still belongs to it.
    previousPath = activePath
    activePath = path
    activeKey = key

    setActiveNav(route.nav)
    syncHeader()
    setTitle(route.title)
    main.dataset.route = route.name
    // Replacing a page that held the focus would otherwise drop it on the body.
    const refocusMain = main.contains(document.activeElement)
    main.innerHTML = ''

    // A page that reads before it paints asks this first. Two detail routes share one
    // `dataset.route`, so the address is compared too.
    const isCurrent = () => {
        if (seq !== renderSeq) return false
        const now = parseHash()
        return routeKey(now.path, now.params) === key
    }

    let failed = false
    try {
        await route.render({ params, goBack, setTitle, isCurrent })
    } catch (error) {
        // An error from a superseded render must not replace the new page.
        if (seq !== renderSeq) return
        failed = true
        renderError(main, error, route)
    } finally {
        // A page from the data-source menu keeps its mask until it has painted.
        if (seq === renderSeq) settleRenderWaiters()
    }
    if (failed) return
    if (seq !== renderSeq) return

    if (refocusMain && document.activeElement === document.body) {
        main.tabIndex = -1
        main.focus({ preventScroll: true })
    }

    const targetY = returning ? (scrollMemory.get('/') || 0) : 0
    // Wait for the new page's first layout; the document height is not final yet.
    requestAnimationFrame(() => {
        if (seq !== renderSeq) return
        window.scrollTo(0, targetY)
    })
    syncHeader()
}

export function startRouter() {
    if (started) return
    started = true
    history.scrollRestoration = 'manual'
    window.addEventListener('hashchange', () => renderRoute())
    // Re-assigning the current hash fires no hashchange, so an explicit repaint is asked.
    window.addEventListener('app:rerender', () => renderRoute(true))
    // The first paint happens on load; module scripts normally run before it.
    if (document.readyState === 'complete') renderRoute()
    else window.addEventListener('load', () => renderRoute(), { once: true })
}
