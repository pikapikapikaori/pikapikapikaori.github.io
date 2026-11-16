(function () {
    'use strict'

    const THEME_COLOR_KEY = 'pikapikapi:indexpage:color-background'
    const DEFAULT_THEME_COLOR = '#F8F6F1'

    function applyThemeColor(color) {
        const meta = document.querySelector('meta[name="theme-color"]')
        if (meta) meta.setAttribute('content', color)
    }

    let storedColor = null
    try {
        storedColor = window.localStorage.getItem(THEME_COLOR_KEY)
    } catch (error) {
        storedColor = null
    }

    applyThemeColor(storedColor || DEFAULT_THEME_COLOR)

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
        }).catch(function () {})
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
