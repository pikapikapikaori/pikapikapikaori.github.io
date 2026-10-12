/* ========================================================
   main.js —— 启动入口
   ======================================================== */
(function () {
    'use strict'

    var App = window.App

    function boot() {
        /* 主题先初始化，避免暗色模式下一闪 */
        App.theme.init()

        /* 博客 rail */
        var blogRail = document.getElementById('blogRail')
        if (blogRail) App.blogRail.load(blogRail)

        /* 摄影 stack */
        var photoStack = document.getElementById('photoStack')
        if (photoStack) App.photoStack.load(photoStack)

        /* i18n 放最后初始化，因为它会改变字体，可能影响测量 */
        App.i18n.init()
        App.i18n.onChange(function () {
            requestAnimationFrame(App.pin.remeasureAll)
        })

        /* Reveal 动画 */
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('in')
                    io.unobserve(e.target)
                }
            })
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
        document.querySelectorAll('.reveal').forEach(function (el) {
            io.observe(el)
        })

        /* 顶部页面进度条 + 顶栏描边 */
        var bar = document.getElementById('progressBar')
        var topbar = document.getElementById('topbar')
        function onScroll() {
            var h = document.documentElement.scrollHeight - window.innerHeight
            if (bar) {
                bar.style.transform = 'scaleX(' + (h > 0 ? window.scrollY / h : 0) + ')'
            }
            if (topbar) topbar.classList.toggle('solid', window.scrollY > 40)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()

        /* 时钟 */
        var clock = document.getElementById('clock')
        function tick() {
            if (!clock) return
            var d = new Date()
            clock.textContent =
                String(d.getHours()).padStart(2, '0') + ':' +
                String(d.getMinutes()).padStart(2, '0')
        }
        tick()
        setInterval(tick, 15000)

        /* 年份 */
        var year = document.getElementById('year')
        if (year) year.textContent = new Date().getFullYear()
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot)
    } else {
        boot()
    }
})()
