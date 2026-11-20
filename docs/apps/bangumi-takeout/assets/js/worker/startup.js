(function () {
    'use strict'

    const colorLight = '#f6f7f9'
    const colorDark = '#131418'

    function applyThemeColor() {
        const meta = document.querySelector('meta[name="theme-color"]')
        if (!meta) return
        const dark = document.documentElement.dataset.theme === 'dark'
        meta.setAttribute('content', dark ? colorDark : colorLight)
    }

    const mediaDark = '(prefers-color-scheme: dark)'

    let mode = 'auto'
    try {
        mode = localStorage.getItem('bangumi-takeout:theme') || 'auto'
    } catch { /* localStorage may be unavailable; keep the default */ }
    if (mode !== 'auto' && mode !== 'light' && mode !== 'dark') mode = 'auto'

    const darkQuery = matchMedia(mediaDark)
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

    const scriptSrc = (document.currentScript || document.scripts[document.scripts.length - 1]).src
    const swUrl = new URL('../../../sw.js', scriptSrc).href
    const swScope = new URL('../../../', scriptSrc).href

    function whenIdle(fn) {
        if (window.requestIdleCallback) window.requestIdleCallback(fn)
        else setTimeout(fn, 0)
    }

    function sendToWorker(message) {
        return navigator.serviceWorker.ready.then(function (reg) {
            const worker = reg.active || navigator.serviceWorker.controller
            if (!worker) throw new Error('no active worker')
            worker.postMessage(message)
        })
    }

    function sendStart() {
        // A failed post leaves the batch paused; the flag is cleared so the
        // next visibility event tries again.
        sendToWorker({ type: 'START' }).catch(function () { started = false })
    }

    // The first load reaches the service worker from both the registration and
    // the pageshow event. One START per load is enough; a second one starts the
    // same manifest scan again.
    let started = false

    function begin() {
        if (started) return
        started = true
        whenIdle(sendStart)
    }

    function sendPause() {
        started = false
        // pagehide gives no time for a new registration lookup: an already
        // controlled page posts at once.
        const worker = navigator.serviceWorker.controller
        if (worker) {
            worker.postMessage({ type: 'PAUSE', reason: 'hidden' })
            return
        }
        sendToWorker({ type: 'PAUSE', reason: 'hidden' }).catch(function () {})
    }

    function onVisibilityChange() {
        if (document.visibilityState === 'visible') begin()
    }

    function onReady() {
        navigator.serviceWorker.register(swUrl, { scope: swScope }).then(function () {
            begin()
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

        window.addEventListener('pageshow', begin)
        document.addEventListener('visibilitychange', onVisibilityChange)
        window.addEventListener('pagehide', sendPause)
    }
})()
