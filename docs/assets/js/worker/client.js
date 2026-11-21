export function connect (options) {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return

    const swUrl = options.swUrl
    const project = options.project
    const tag = options.tag
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
                ready.postMessage(project ? { type: 'START', project: project } : { type: 'START' })
            })
        })
    }

    function onReady () {
        navigator.serviceWorker.register(swUrl).then(function (reg) {
            registration = reg
            start()
        }).catch(function (error) {
            if (tag) console.warn('[' + tag + '] Service Worker 注册失败：', error.message)
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
        const worker = navigator.serviceWorker.controller
        if (worker) worker.postMessage({ type: 'PAUSE', reason: 'hidden' })
    })
}
