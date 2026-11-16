(function () {
    'use strict'

    try {
        let theme = localStorage.getItem('grammar:theme') || 'auto'
        if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') theme = 'auto'
        document.documentElement.setAttribute('data-theme', theme)
    } catch (e) { /* localStorage 不可用时保持默认 auto */ }

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
