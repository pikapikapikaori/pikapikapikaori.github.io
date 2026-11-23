(function () {
    'use strict'

    const themeStorageKey = 'pikapikapi:indexpage:theme-mode'
    const themeLightColor = '#f7f3ea'
    const themeDarkColor = '#15130f'

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
