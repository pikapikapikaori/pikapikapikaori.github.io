(function () {
    'use strict'

    try {
        const mode = localStorage.getItem('bangumi-takeout:theme') || 'auto'
        const real = mode === 'dark' ? 'dark'
            : mode === 'light' ? 'light'
                : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        document.documentElement.dataset.theme = real
        document.documentElement.dataset.themeMode = mode
    } catch (e) { /* localStorage 不可用时保持默认 auto */ }

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
