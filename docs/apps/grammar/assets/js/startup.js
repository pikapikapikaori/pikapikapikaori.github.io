(function () {
    'use strict'

    const colorLight = '#fafaf7'
    const colorDark = '#0f1115'
    const mediaDark = '(prefers-color-scheme: dark)'

    function applyThemeColor() {
        const meta = document.querySelector('meta[name="theme-color"]')
        if (!meta) return
        const mode = document.documentElement.getAttribute('data-theme')
        const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia(mediaDark).matches)
        meta.setAttribute('content', dark ? colorDark : colorLight)
    }

    try {
        let theme = localStorage.getItem('grammar:theme') || 'auto'
        if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') theme = 'auto'
        document.documentElement.setAttribute('data-theme', theme)
    } catch (e) {   }

    applyThemeColor()

    const darkQuery = window.matchMedia(mediaDark)
    if (typeof darkQuery.addEventListener === 'function') {
        darkQuery.addEventListener('change', applyThemeColor)
    } else {
        darkQuery.addListener(applyThemeColor)
    }

    const observer = new MutationObserver(applyThemeColor)
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })

    const parts = location.pathname.replace(/index\.html$/, '').split('/').filter(Boolean)
    const embedded = parts.length > 1 &&
        (parts[parts.length - 2] === 'pages' || parts[parts.length - 2] === 'apps')

    if (!('serviceWorker' in navigator) || !window.isSecureContext) return

    if (embedded) {
        import('../../../../assets/js/worker/client.js').then(function (mod) {
            mod.connect({
                swUrl: '../../sw.js',
                project: parts.slice(-2).join('/') + '/'
            })
        }).catch(function (error) {
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
