(function () {
    'use strict'

    const COLOR_LIGHT = '#f6f7f9'
    const COLOR_DARK = '#131418'

    function applyThemeColor() {
        const meta = document.querySelector('meta[name="theme-color"]')
        if (!meta) return
        const dark = document.documentElement.dataset.theme === 'dark'
        meta.setAttribute('content', dark ? COLOR_DARK : COLOR_LIGHT)
    }

    const MEDIA_DARK = '(prefers-color-scheme: dark)'

    let mode = 'auto'
    try {
        mode = localStorage.getItem('bangumi-takeout:theme') || 'auto'
    } catch (e) { /* localStorage 不可用时保持默认 auto */ }
    if (mode !== 'auto' && mode !== 'light' && mode !== 'dark') mode = 'auto'

    const darkQuery = matchMedia(MEDIA_DARK)
    const real = mode === 'dark' ? 'dark'
        : mode === 'light' ? 'light'
            : (darkQuery.matches ? 'dark' : 'light')
    document.documentElement.dataset.theme = real
    document.documentElement.dataset.themeMode = mode

    function onDarkQueryChange(event) {
        if (document.documentElement.dataset.themeMode !== 'auto') return
        document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'
    }

    if (typeof darkQuery.addEventListener === 'function') {
        darkQuery.addEventListener('change', onDarkQueryChange)
    } else {
        darkQuery.addListener(onDarkQueryChange)
    }

    applyThemeColor()

    const observer = new MutationObserver(applyThemeColor)
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })

    const SCRIPT_SRC = (document.currentScript || document.scripts[document.scripts.length - 1]).src
    const SW_URL = new URL('../../../sw.js', SCRIPT_SRC).href
    const SW_SCOPE = new URL('../../../', SCRIPT_SRC).href

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
        navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).then(function () {
            whenIdle(sendStart)
        }).catch(function (err) {
            console.warn('[bangumi-takeout] Service Worker 注册失败：', err.message)
        })
    }

    if ('serviceWorker' in navigator && window.isSecureContext) {
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
