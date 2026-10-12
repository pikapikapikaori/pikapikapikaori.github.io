/* ========================================================
   scroll-pin.js —— 通用"滚动驱动"封装

   把一个 <section> 撑高，让它的内部 sticky 容器在滚动时
   钉在视口上；section 的滚动进度（0–1）通过 applyFn 反馈。

   因为语义完全建立在"页面纵向滚动"上，鼠标滚轮、触控板、
   触摸、键盘 PageDown、锚点跳转都自动生效，无需任何拦截。
   ======================================================== */
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
     * @param {function(number)} applyFn  p ∈ [0,1]，把状态画出来
     * @param {function():{total:number,height:number}} sizeFn
     *        total  = 走完全程需要多少像素纵向滚动
     *        height = section 应被撑到多高
     */
    Pin.make = function (section, applyFn, sizeFn) {

        var total = 0
        var target = 0
        var current = 0
        var last = -1
        var running = false
        var rafId = 0
        var firstMeasure = true

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
                current += diff * CFG.motion.follow
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
