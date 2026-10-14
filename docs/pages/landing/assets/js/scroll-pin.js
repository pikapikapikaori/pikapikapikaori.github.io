(function () {
    'use strict'

    var App = window.App = window.App || {}
    var Pin = App.pin = {}
    var U = App.utils
    var CFG = App.config

    var REDUCE = U.prefersReducedMotion()
    var registry = []

    /**
   * @param {HTMLElement} section 需要被撑高的 <section>
   * @param {function(number)} applyFn   p ∈ [0,1]，把状态画出来
   * @param {function():{total:number,height:number}} sizeFn
   *        total  = 走完全程需要多少像素纵向滚动
   *        height = section 应被撑到多高
   * @param {function(number):number} [followFn]
   *        可选。给定当前目标进度（0–1）返回这一帧的 follow 系数。
   *        不传则使用 CFG.motion.follow。
   *        用于让不同阶段拥有不同的阻尼手感。
   */
    Pin.make = function (section, applyFn, sizeFn, followFn) {

        var total = 0
        var target = 0
        var current = 0
        var last = -1
        var running = false
        var rafId = 0
        var firstMeasure = true

        var baseFollow = CFG.motion.follow
        var getFollow = (typeof followFn === 'function')
            ? followFn
            : function () { return baseFollow }

        /* ---------- 测量 ---------- */
        function doMeasure() {
            var r = sizeFn()
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

        /* ---------- 目标进度 ---------- */
        function readTarget() {
            if (total <= 1) { target = 0; return }
            var top = section.getBoundingClientRect().top
            target = U.clamp01(-top / total)
        }

        /* ---------- 每帧循环 ---------- */
        function loop() {
            if (!running) return
            rafId = requestAnimationFrame(loop)

            readTarget()
            var diff = target - current

            if (REDUCE || Math.abs(diff) < 0.0002) {
                current = target
            } else {
                /* 每帧重新询问当前应使用的阻尼系数 */
                var follow = getFollow(target)
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

        /* 只在进入视口附近时跑循环 */
        new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) start(); else stop()
            })
        }, { rootMargin: CFG.motion.rootMargin }).observe(section)

        /* ---------- 尺寸变化 ---------- */
        var scheduleMeasure = U.debounceRaf(doMeasure)
        window.addEventListener('resize', scheduleMeasure)
        window.addEventListener('orientationchange', scheduleMeasure)
        window.addEventListener('load', scheduleMeasure)
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleMeasure)
        }

        var api = {
            measure: doMeasure,
            scheduleMeasure: scheduleMeasure
        }
        registry.push(api)

        doMeasure()
        return api
    }

    Pin.remeasureAll = function () {
        registry.forEach(function (p) { p.scheduleMeasure() })
    }
})()
