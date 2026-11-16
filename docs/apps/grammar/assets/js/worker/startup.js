(function () {
    'use strict'

    const COLOR_LIGHT = '#fafaf7'
    const COLOR_DARK = '#0f1115'
    const MEDIA_DARK = '(prefers-color-scheme: dark)'

    function applyThemeColor() {
        const meta = document.querySelector('meta[name="theme-color"]')
        if (!meta) return
        const mode = document.documentElement.getAttribute('data-theme')
        const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia(MEDIA_DARK).matches)
        meta.setAttribute('content', dark ? COLOR_DARK : COLOR_LIGHT)
    }

    try {
        let theme = localStorage.getItem('grammar:theme') || 'auto'
        if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') theme = 'auto'
        document.documentElement.setAttribute('data-theme', theme)
    } catch (e) { /* localStorage 不可用时保持默认 auto */ }

    applyThemeColor()

    const darkQuery = window.matchMedia(MEDIA_DARK)
    if (typeof darkQuery.addEventListener === 'function') {
        darkQuery.addEventListener('change', applyThemeColor)
    } else {
        darkQuery.addListener(applyThemeColor)
    }

    const observer = new MutationObserver(applyThemeColor)
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })

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
            console.warn('[grammar] Service Worker 注册失败：', err.message)
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
