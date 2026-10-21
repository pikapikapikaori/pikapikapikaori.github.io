/**
 * 应用入口
 * - 打开 IndexedDB
 * - 注册 Service Worker
 * - 初始化主题
 * - 挂载路由
 */

import { openDB } from './store/db.js'
import { getUser, listUsers } from './store/user-store.js'
import { getSettings, saveSettings } from './store/settings-store.js'
import { createRouter } from './router.js'
import { appStore, setUser, setLanguage, setSettings, setRoute } from './app-state.js'
import { h, replace, qs } from './utils/dom.js'
import { attachVerticalPopover, hideVerticalPopover } from './components/vertical-popover.js'
import { createThemeToggle } from './components/theme-toggle.js'
import { settingsIcon } from './components/icons.js'
import { clearBreadcrumbs, applyBreadcrumbs } from './utils/breadcrumbs.js'
import { isDevHost } from './utils/env.js'
import { loadLanguages } from './data/languages.js'

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
    const themeToggle = createThemeToggle({
        onChange: async (t) => {
            const { userId } = appStore.get()
            if (!userId) return
            try {
                const s = await saveSettings(userId, { theme: t })
                setSettings(s)
            } catch (err) {
                console.warn('[theme] 保存失败', err)
            }
        }
    })

    return h('header', { class: 'app-header' },
        h('a', { class: 'app-header__brand', href: '#/languages' }, '生词本'),
        h('div', { class: 'app-header__spacer' }),
        h('div', { class: 'app-header__actions' },
            themeToggle,
            h('button', {
                class: 'btn btn--ghost btn--icon', title: '设置',
                onclick: () => router.navigate('/settings')
            }, settingsIcon()),
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
    { path: '/grammar',              view: () => router.navigate('/languages', { replace: true }) },
    { path: '/grammar/:lang/:group',  view: (ctx) => mountView('grammar',    ctx) },
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
    
    clearBreadcrumbs()
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
    applyBreadcrumbs()
}

/* ---------------- 启动 ---------------- */

/** 隐藏启动遮罩（首帧渲染完成后再淡出） */
function hideBootLoader() {
    const el = document.getElementById('boot-loader')
    if (!el) return
    el.classList.add('boot-loader--hidden')
    setTimeout(() => el.remove(), 400)
}

/** 启动遮罩里显示一段提示（例如致命错误） */
function setBootLoaderText(text) {
    const el = document.querySelector('#boot-loader .boot-loader__text')
    if (el) el.textContent = text
}

async function bootstrap() {
    try {
        await openDB()
    } catch (err) {
        renderFatal(`IndexedDB 初始化失败：${err.message}`)
        hideBootLoader()
        return
    }

    // 主题
    let theme = 'auto'
    try { theme = localStorage.getItem(LS_THEME_KEY) || 'auto' } catch { /* ignore */ }
    applyTheme(theme)

    // 语言元信息（各语言 JSON 顶层；语言选择页需要全部语言的元信息）
    setBootLoaderText('正在加载语言数据…')
    try {
        await loadLanguages()
    } catch (err) {
        console.warn('[bootstrap] 语言元信息加载失败', err)
    }

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

    // 首帧渲染完成后再撤下遮罩（用 timeout 而不是 rAF：后台标签页里 rAF 不触发）
    setTimeout(hideBootLoader, 30)

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

    // Service Worker：生产注册，开发注销（见下）
    setupServiceWorker()
    attachVerticalPopover()
}

/**
 * SW 必须放在 assets/js 下而不是 assets/dev：
 * dev 目录已被 gitignore 且不发布，main.js 不能静态依赖它。
 */
function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return

    // 本地开发：SW 的 cache-first 会一直命中旧代码，改为注销并清空缓存
    if (isDevHost()) {
        disableServiceWorker().catch((err) => console.warn('[sw] 开发环境清理失败', err))
        return
    }

    if (location.protocol !== 'https:') return
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
            console.warn('[sw] 注册失败', err)
        })
    })
}

/** 注销 SW 并清空其缓存；若当前页面仍被旧 SW 控制，重载一次以拿到最新资源 */
async function disableServiceWorker() {
    const controlled = !!navigator.serviceWorker.controller
    const regs = await navigator.serviceWorker.getRegistrations()
    if (regs.length) {
        await Promise.all(regs.map((r) => r.unregister()))
        console.info('[sw] 开发环境：已注销 Service Worker')
    }
    if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if (controlled && !sessionStorage.getItem('ln-sw-reset')) {
        sessionStorage.setItem('ln-sw-reset', '1')
        location.reload()
    }
}

bootstrap().catch((err) => {
    console.error(err)
    setBootLoaderText('启动失败')
    renderFatal(String(err && err.message || err))
    hideBootLoader()
})
