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

    const parts = location.pathname.replace(/index\.html$/, '').split('/').filter(Boolean)
    const embedded = parts.length > 1 &&
        (parts[parts.length - 2] === 'pages' || parts[parts.length - 2] === 'apps')

    if (!('serviceWorker' in navigator) || !window.isSecureContext) return

    /* 内嵌与独立部署使用不同的 worker，内嵌由主站根 worker 只取本前缀。 */
    if (embedded) {
        import('../../../../assets/js/worker/client.js').then(function (mod) {
            mod.connect({
                swUrl: '../../sw.js',
                project: parts.slice(-2).join('/') + '/',
                tag: 'bangumi-takeout'
            })
        }).catch(function (error) {
            console.warn('[sw] 共用模块加载失败：', error.message)
        })
        return
    }

    const swUrl = './sw.js'
    let registration = null
    let started = false
    let ticket = 0

    function target () {
        if (registration) {
            const worker = registration.active || registration.installing || registration.waiting
            if (worker) return worker
        }
        return navigator.serviceWorker.controller
    }

    function whenActivated (worker, fn) {
        if (worker.state === 'activated') {
            fn(worker)
            return
        }
        worker.addEventListener('statechange', function onState () {
            if (worker.state !== 'activated') return
            worker.removeEventListener('statechange', onState)
            fn(worker)
        })
    }

    function whenIdle (fn) {
        if (window.requestIdleCallback) window.requestIdleCallback(fn)
        else setTimeout(fn, 0)
    }

    function sendStart () {
        if (started) return
        started = true
        const current = ++ticket
        whenIdle(function () {
            if (current !== ticket) return
            const worker = target()
            if (!worker) {
                started = false
                return
            }
            whenActivated(worker, function (ready) {
                if (current !== ticket) return
                ready.postMessage({ type: 'START' })
            })
        })
    }

    function onReady () {
        navigator.serviceWorker.register(swUrl).then(function (reg) {
            registration = reg
            sendStart()
        }).catch(function () {})
    }

    if (document.readyState === 'loading') {
        window.addEventListener('load', onReady, { once: true })
    } else {
        onReady()
    }

    window.addEventListener('pageshow', function (event) {
        if (event.persisted) sendStart()
    })

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') sendStart()
    })

    window.addEventListener('pagehide', function () {
        ticket++
        started = false
        const worker = navigator.serviceWorker.controller
        if (worker) worker.postMessage({ type: 'PAUSE', reason: 'hidden' })
    })
})()
