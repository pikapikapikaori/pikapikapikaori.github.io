/*
 * 公用工具，与原 landing 页 utils.js 同源。
 * 布局脚本只经 window.App.utils 读取，不在布局目录内再写一份。
 */
(function () {
    'use strict'

    var App = window.App = window.App || {}
    var U = App.utils = {}

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

    /* 立即回到页顶，绕过布局的平滑滚动；语言切换与布局切换共用。 */
    U.scrollToTopInstant = function () {
        var html = document.documentElement
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

    /*
     * 把 0–1 的连续输入吸附到 n 个等距静止点。
     * flat 为每段两端的平台占比，0 等同不吸附。
     */
    U.magnetize = function (t, n, flat) {
        if (n <= 1) return t
        flat = flat == null ? 0.3 : flat

        var step = 1 / (n - 1)
        var x = t / step
        var i = Math.floor(x)
        var f = x - i

        var a = flat
        var b = 1 - flat
        var u = U.clamp01((f - a) / (b - a))
        var s = U.easeInOutCubic(u)

        return Math.min(1, (i + s) * step)
    }

    /* rAF 节流。返回的函数可直接调用，另带 cancel() 取消尚未执行的一次。 */
    U.debounceRaf = function (fn) {
        var raf = 0

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
