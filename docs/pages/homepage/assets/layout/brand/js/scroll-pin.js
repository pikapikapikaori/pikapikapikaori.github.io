const U = window.App.utils

const FOLLOW = 0.16
const ROOT_MARGIN = '400px 0px'

export function createPin(section, applyFn, sizeFn, followFn) {
    let total = 0
    let target = 0
    let current = 0
    let last = -1
    let running = false
    let rafId = 0
    let firstMeasure = true
    let disposed = false

    const getFollow = (typeof followFn === 'function')
        ? followFn
        : function () { return FOLLOW }

    const io = new IntersectionObserver(function (entries) {
        if (disposed) return

        entries.forEach(function (e) {
            if (e.isIntersecting) start(); else stop()
        })
    }, { rootMargin: ROOT_MARGIN })

    function doMeasure() {
        if (disposed) return

        const r = sizeFn()
        total = r.total
        section.style.height = r.height > 0 ? r.height + 'px' : ''

        if (firstMeasure) {
            firstMeasure = false
            current = 0
            last = -1
            applyFn(0)
        } else {
            readTarget()
            current = target
            applyFn(current)
            last = current
        }
    }

    function readTarget() {
        if (disposed || total <= 1) { target = 0; return }
        const top = section.getBoundingClientRect().top
        target = U.clamp01(-top / total)
    }

    function loop() {
        if (disposed || !running) return
        rafId = requestAnimationFrame(loop)

        readTarget()
        const diff = target - current

        if (Math.abs(diff) < 0.0002) {
            current = target
        } else {
            const follow = getFollow(target)
            current += diff * follow
        }

        if (Math.abs(current - last) > 0.0001) {
            applyFn(current)
            last = current
        }
    }

    function start() {
        if (running) return
        running = true
        rafId = requestAnimationFrame(loop)
    }

    function stop() {
        running = false
        cancelAnimationFrame(rafId)
    }

    const onResize = U.debounceRaf(doMeasure)

    io.observe(section)

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    window.addEventListener('load', onResize)
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
            if (!disposed) doMeasure()
        })
    }

    const api = {
        measure: doMeasure,
        scheduleMeasure: onResize,
        destroy: function () {
            disposed = true
            io.disconnect()
            stop()
            onResize.cancel()
            window.removeEventListener('resize', onResize)
            window.removeEventListener('orientationchange', onResize)
            window.removeEventListener('load', onResize)
            section.style.height = ''
        }
    }

    doMeasure()
    return api
}
