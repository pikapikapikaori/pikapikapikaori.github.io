(function () {
    'use strict'

    const themeStorageKey = 'pikapikapi:indexpage:theme-mode'
    const themeLightColor = '#f7f3ea'
    const themeDarkColor = '#15130f'

    const scriptSrc = (document.currentScript || document.scripts[document.scripts.length - 1]).src
    const swUrl = new URL('../../../sw.js', scriptSrc).href

    let mode = 'auto'
    try {
        const stored = localStorage.getItem(themeStorageKey)
        if (stored === 'auto' || stored === 'light' || stored === 'dark') mode = stored
    } catch (error) {
        mode = 'auto'
    }
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = mode === 'dark' || (mode === 'auto' && systemDark) ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme-mode', mode)
    document.documentElement.setAttribute('data-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? themeDarkColor : themeLightColor)

    function whenIdle (fn) {
        if (window.requestIdleCallback) window.requestIdleCallback(fn)
        else setTimeout(fn, 0)
    }

    function sendStart () {
        navigator.serviceWorker.ready.then(function (reg) {
            const worker = reg.active || navigator.serviceWorker.controller
            if (worker) worker.postMessage({ type: 'START' })
        }).catch(function () {})
    }

    function onReady () {
        navigator.serviceWorker.register(swUrl).then(function () {
            whenIdle(sendStart)
        }).catch(function () {})
    }

    if ('serviceWorker' in navigator) {
        if (document.readyState === 'loading') {
            window.addEventListener('load', onReady, { once: true })
        } else {
            onReady()
        }

        /* 从往返缓存恢复时不重新执行脚本，需补发 START 让 worker 继续。 */
        window.addEventListener('pageshow', function (event) {
            if (!event.persisted) return
            whenIdle(sendStart)
        })

        window.addEventListener('pagehide', function () {
            const worker = navigator.serviceWorker.controller
            if (worker) worker.postMessage({ type: 'PAUSE' })
        })
    }
})()
