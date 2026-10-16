/**
 * 应用入口
 * - 打开 IndexedDB
 * - 注册 Service Worker
 * - 初始化主题
 * - 挂载路由
 */

import { openDB } from './store/db.js'
import { getUser, listUsers } from './store/user-store.js'
import { getSettings } from './store/settings-store.js'
import { createRouter } from './router.js'
import { appStore, setUser, setLanguage, setSettings, setRoute } from './app-state.js'
import { h, replace, qs } from './utils/dom.js'
import { attachVerticalPopover, hideVerticalPopover } from './components/vertical-popover.js'

const LS_USER_KEY = 'ln.currentUser'
const LS_THEME_KEY = 'ln.theme'
const LS_FONT_KEY = 'ln.font.mode'

/* ---------------- 主题 ---------------- */

function applyTheme(theme) {
    const t = ['auto', 'light', 'dark'].includes(theme) ? theme : 'auto'
    document.documentElement.setAttribute('data-theme', t)
    try { localStorage.setItem(LS_THEME_KEY, t) } catch { /* ignore */ }
}

/* ---------------- Shell 渲染 ---------------- */

const NO_HEADER_ROUTES = new Set(['/', '/welcome'])
const NO_LAYOUT_ROUTES = new Set(['/', '/welcome'])

function getShell() {
    return qs('#app')
}

function renderHeader() {
    return h('header', { class: 'app-header' },
        h('a', { class: 'app-header__brand', href: '#/languages' }, '生词本'),
        h('nav', { class: 'app-header__crumbs', 'aria-label': '面包屑' },
            h('span', { class: 'crumb-slot' })
        ),
        h('div', { class: 'app-header__spacer' }),
        h('div', { class: 'app-header__actions' },
            h('button', {
                class: 'btn btn--ghost btn--icon', title: '设置',
                onclick: () => router.navigate('/settings')
            }, '⚙'),
            h('button', {
                class: 'btn btn--ghost', title: '切换用户',
                onclick: () => router.navigate('/welcome')
            }, '用户')
        )
    )
}

function renderShell({ withHeader, withMain }) {
    const root = getShell()
    root.className = 'app'

    if (!withMain) {
        replace(root)
        return root
    }

    replace(root)
    if (withHeader) root.appendChild(renderHeader())
    const main = h('main', { class: 'app-main', id: 'view' })
    root.appendChild(main)
    return main
}

function renderFatal(message) {
    const root = getShell()
    replace(root, h('div', { class: 'welcome' },
        h('div', { class: 'welcome__panel' },
            h('h1', { class: 'welcome__title' }, '无法启动'),
            h('p', { class: 'welcome__sub' }, message)
        )
    ))
}

/* ---------------- 视图加载 ---------------- */

const VIEW_MODULES = {
    welcome: () => import('./views/welcome-view.js'),
    languages: () => import('./views/language-select-view.js'),
    words: () => import('./views/word-list-view.js'),
    wordNew: () => import('./views/word-form-view.js'),
    wordEdit: () => import('./views/word-form-view.js'),
    review: () => import('./views/review-view.js'),
    search: () => import('./views/search-view.js'),
    grammar: () => import('./views/grammar-view.js'),
    settings: () => import('./views/settings-view.js')
}

async function loadView(name) {
    const loader = VIEW_MODULES[name]
    if (!loader) throw new Error(`未知视图：${name}`)
    const mod = await loader()
    return mod.default || mod
}

/**
 * 视图模块约定：
 * export default {
 *   needsUser: boolean,
 *   layout: 'full' | 'shell' | 'main',
 *   async mount(ctx) {}
 * }
 */

/* ---------------- 路由 ---------------- */

const router = createRouter([
    { path: '/welcome',              view: (ctx) => mountView('welcome',    ctx) },
    { path: '/languages',            view: (ctx) => mountView('languages',  ctx) },
    { path: '/lang/:lang/words',     view: (ctx) => mountView('words',      ctx) },
    { path: '/lang/:lang/words/new', view: (ctx) => mountView('wordNew',    ctx) },
    { path: '/lang/:lang/words/:id', view: (ctx) => mountView('wordEdit',   ctx) },
    { path: '/lang/:lang/review',    view: (ctx) => mountView('review',     ctx) },
    { path: '/lang/:lang/search',    view: (ctx) => mountView('search',     ctx) },
    { path: '/grammar',              view: (ctx) => mountView('grammar',    ctx) },
    { path: '/grammar/:lang',        view: (ctx) => mountView('grammar',    ctx) },
    { path: '/settings',             view: (ctx) => mountView('settings',   ctx) },
    { path: '/',                     view: () => router.navigate('/welcome', { replace: true }) }
])

let currentUnmount = null

async function mountView(name, ctx) {
    const view = await loadView(name)
    const isFull = view.layout === 'full'
    || NO_LAYOUT_ROUTES.has(ctx.path)

    // 清理上一个视图
    if (typeof currentUnmount === 'function') {
        try { currentUnmount() } catch (err) { console.warn('[view] unmount error', err) }
        currentUnmount = null
    }
    
    hideVerticalPopover()

    const container = isFull
        ? renderShell({ withHeader: false, withMain: false })
        : renderShell({
            withHeader: view.layout !== 'none' && !NO_HEADER_ROUTES.has(ctx.path),
            withMain: true
        })

    if (view.needsUser && !appStore.get().userId) {
        router.navigate('/welcome', { replace: true })
        return
    }

    if (ctx.params && ctx.params.lang) {
        setLanguage(ctx.params.lang)
    }

    setRoute(name, ctx.params, ctx.query)
    const unmount = await view.mount(container || getShell(), ctx)
    if (typeof unmount === 'function') currentUnmount = unmount
}

/* ---------------- 启动 ---------------- */

async function bootstrap() {
    try {
        await openDB()
    } catch (err) {
        renderFatal(`IndexedDB 初始化失败：${err.message}`)
        return
    }

    // 主题
    let theme = 'auto'
    try { theme = localStorage.getItem(LS_THEME_KEY) || 'auto' } catch { /* ignore */ }
    applyTheme(theme)

    // 当前用户
    let cur = null
    let uid = null
    try { uid = localStorage.getItem(LS_USER_KEY) } catch { /* ignore */ }
    if (uid) {
        cur = await getUser(uid)
        if (!cur) {
            try { localStorage.removeItem(LS_USER_KEY) } catch { /* ignore */ }
        }
    }
    if (cur) {
        setUser(cur)
        const s = await getSettings(cur.id)
        setSettings(s)
        applyTheme(s.theme || theme)
    }

    router.start()

    router.onNotFound(() => {
        router.navigate('/welcome', { replace: true })
    })

    router.onError(({ error }) => {
        console.error(error)
        const main = document.getElementById('view')
        if (main) {
            replace(main,
                h('div', { class: 'empty' },
                    h('div', { class: 'empty__title' }, '页面加载失败'),
                    h('div', { class: 'empty__desc' }, String(error && error.message || error))
                )
            )
        }
    })

    // 暴露给调试使用
    window.__ln = { router, appStore }

    // Service Worker
    registerServiceWorker()
    attachVerticalPopover()
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        return
    }
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
            console.warn('[sw] 注册失败', err)
        })
    })
}

bootstrap()
