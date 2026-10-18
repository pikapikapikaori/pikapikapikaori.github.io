(function () {
    'use strict'

    var App = window.App = window.App || {}
    var U = App.utils = {}

    /* ---------- 字符串 ---------- */

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

    /* ---------- 数值 ---------- */

    U.clamp01 = function (v) {
        return v < 0 ? 0 : v > 1 ? 1 : v
    }

    U.lerp = function (a, b, t) {
        return a + (b - a) * t
    }

    /* ---------- 缓动 ---------- */

    U.easeOutCubic = function (t) {
        return 1 - Math.pow(1 - t, 3)
    }

    U.easeInOutCubic = function (t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    U.easeOutQuint = function (t) {
        return 1 - Math.pow(1 - t, 5)
    }

    /* ---------- 环境 ---------- */

    U.prefersReducedMotion = function () {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    /* 
     * ---------- 磁吸 ----------
     * 把 0–1 的连续输入吸附到 n 个等距静止点。
     * flat 为每个区间两端的"平台"占比：
     * 0     → 完全均匀（等同不磁吸）
     * 0.30  → 每段两端各 30% 进度内输出不变
     * 0.45  → 平台更长，切换更"咔哒"
     * 
     * 效果：滑到接近某个点时，输出停在格点上；
     * 必须滑过平台区才进入下一段的过渡。
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

    /* ---------- rAF 节流 ---------- */

    U.debounceRaf = function (fn) {
        var q = false
        return function () {
            if (q) return
            q = true
            requestAnimationFrame(function () {
                q = false
                fn()
            })
        }
    }
})()
