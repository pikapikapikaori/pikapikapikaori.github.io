(function () {
    'use strict'

    const App = window.App = window.App || {}

    const THEMES = {
        light: 'light',
        dark: 'dark'
    }
    const PAGE_COLORS = {
        light: '#F2EDE4',
        dark: '#101214'
    }
    const MEDIA_DARK = '(prefers-color-scheme: dark)'

    function systemTheme() {
        const dark = window.matchMedia && window.matchMedia(MEDIA_DARK).matches

        return dark ? THEMES.dark : THEMES.light
    }

    const storage = App.storage
    let theme = storage
        ? storage.getEnum(storage.NAMES.theme, [THEMES.light, THEMES.dark], null)
        : null

    const followsSystem = !theme

    if (!theme) theme = systemTheme()

    document.documentElement.dataset.theme = theme

    const meta = document.querySelector('meta[name="theme-color"]')

    if (meta) meta.setAttribute('content', PAGE_COLORS[theme])

    if (followsSystem && window.matchMedia) {
        const darkQuery = window.matchMedia(MEDIA_DARK)
        const onDarkQueryChange = function (event) {
            const saved = storage
                ? storage.getEnum(storage.NAMES.theme, [THEMES.light, THEMES.dark], null)
                : null

            if (saved) return

            const nextTheme = event.matches ? THEMES.dark : THEMES.light
            document.documentElement.dataset.theme = nextTheme
            if (meta) meta.setAttribute('content', PAGE_COLORS[nextTheme])
        }

        if (typeof darkQuery.addEventListener === 'function') {
            darkQuery.addEventListener('change', onDarkQueryChange)
        } else {
            darkQuery.addListener(onDarkQueryChange)
        }
    }

    const SCRIPT_SRC = (document.currentScript || document.scripts[document.scripts.length - 1]).src
    const SW_URL = new URL('../../../sw.js', SCRIPT_SRC).href

    function whenIdle(fn) {
        if (window.requestIdleCallback) window.requestIdleCallback(fn)
        else setTimeout(fn, 0)
    }

    function sendStart() {
        navigator.serviceWorker.ready.then(function (reg) {
            const worker = reg.active || navigator.serviceWorker.controller
            if (worker) worker.postMessage({ type: 'START' })
        }).catch(function () {})
    }

    function onReady() {
        navigator.serviceWorker.register(SW_URL).then(function () {
            whenIdle(sendStart)
        }).catch(function (err) {
            console.warn('[homepage] Service Worker 注册失败：', err.message)
        })
    }

    if ('serviceWorker' in navigator) {
        if (document.readyState === 'loading') {
            window.addEventListener('load', onReady, { once: true })
        } else {
            onReady()
        }

        window.addEventListener('pagehide', function () {
            const worker = navigator.serviceWorker.controller
            if (worker) worker.postMessage({ type: 'PAUSE' })
        })
    }
})()
