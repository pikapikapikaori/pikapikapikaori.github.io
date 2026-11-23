(function () {
    'use strict'

    const App = window.App = window.App || {}
    const U = App.utils = {}

    U.escapeHtml = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                '\'': '&#39;'
            }[c]
        })
    }

    U.clamp01 = function (v) {
        return v < 0 ? 0 : v > 1 ? 1 : v
    }

    U.scrollToTopInstant = function () {
        const html = document.documentElement
        html.style.scrollBehavior = 'auto'
        /* 读取布局属性强制一次样式重算，确保滚动执行时已应用 auto 而非 CSS 的 smooth。 */
        void html.offsetHeight
        window.scrollTo(0, 0)
        requestAnimationFrame(function () {
            html.style.scrollBehavior = ''
        })
    }

    U.lerp = function (a, b, t) {
        return a + (b - a) * t
    }

    U.easeOutCubic = function (t) {
        return 1 - Math.pow(1 - t, 3)
    }

    U.easeInOutCubic = function (t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    U.magnetize = function (t, n, flat) {
        if (n <= 1) return t
        flat = flat == null ? 0.3 : flat

        const step = 1 / (n - 1)
        const x = t / step
        const i = Math.floor(x)
        const f = x - i

        const a = flat
        const b = 1 - flat
        const u = U.clamp01((f - a) / (b - a))
        const s = U.easeInOutCubic(u)

        return Math.min(1, (i + s) * step)
    }

    U.debounceRaf = function (fn) {
        let raf = 0

        function run() {
            raf = 0
            fn()
        }

        function debounced() {
            if (raf) return
            raf = requestAnimationFrame(run)
        }

        debounced.cancel = function () {
            if (raf) cancelAnimationFrame(raf)
            raf = 0
        }

        return debounced
    }
})()
