(function () {
    'use strict'

    const App = window.App = window.App || {}

    const themes = {
        light: 'light',
        dark: 'dark'
    }
    const pageColors = {
        light: '#F2EDE4',
        dark: '#101214'
    }
    const mediaDark = '(prefers-color-scheme: dark)'

    function systemTheme() {
        const dark = window.matchMedia && window.matchMedia(mediaDark).matches

        return dark ? themes.dark : themes.light
    }

    const storage = App.storage
    let theme = storage
        ? storage.getEnum(storage.NAMES.theme, [themes.light, themes.dark], null)
        : null

    const followsSystem = !theme

    if (!theme) theme = systemTheme()

    document.documentElement.dataset.theme = theme

    const meta = document.querySelector('meta[name="theme-color"]')

    if (meta) meta.setAttribute('content', pageColors[theme])

    if (followsSystem && window.matchMedia) {
        const darkQuery = window.matchMedia(mediaDark)
        const onDarkQueryChange = function (event) {
            const saved = storage
                ? storage.getEnum(storage.NAMES.theme, [themes.light, themes.dark], null)
                : null

            if (saved) return

            const nextTheme = event.matches ? themes.dark : themes.light
            document.documentElement.dataset.theme = nextTheme
            if (meta) meta.setAttribute('content', pageColors[nextTheme])
        }

        if (typeof darkQuery.addEventListener === 'function') {
            darkQuery.addEventListener('change', onDarkQueryChange)
        } else {
            darkQuery.addListener(onDarkQueryChange)
        }
    }

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
        }).catch(function () {
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
