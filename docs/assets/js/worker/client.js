export function connect (options) {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return

    const swUrl = options.swUrl
    const project = options.project
    const visitId = window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
    let registration = null
    let started = false
    let ticket = 0

    function whenIdle (fn) {
        if (window.requestIdleCallback) window.requestIdleCallback(fn)
        else setTimeout(fn, 0)
    }

    /* 主站内嵌时页面同时受根与子项目两个作用域控制，ready 取最深作用域，会发错对象。 */
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

    function start () {
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
                ready.postMessage(project ? { type: 'START', project: project, visitId: visitId } : { type: 'START', visitId: visitId })
            })
        })
    }

    function onReady () {
        navigator.serviceWorker.register(swUrl).then(function (reg) {
            registration = reg
            start()
        }).catch(function () {
        })
    }

    if (document.readyState === 'loading') {
        window.addEventListener('load', onReady, { once: true })
    } else {
        onReady()
    }

    window.addEventListener('pageshow', function (event) {
        if (event.persisted) start()
    })

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') start()
    })

    window.addEventListener('pagehide', function () {
        ticket++
        started = false
        const worker = target()
        if (worker) worker.postMessage({ type: 'PAUSE', reason: 'hidden', visitId: visitId })
    })
}
