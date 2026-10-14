(function () {
    'use strict'

    var App = window.App

    function boot() {

        /* 1. i18n 最先跑，让所有 [data-i18n] 立刻有内容 */
        App.i18n.init()
        App.i18n.onChange(function () {
            requestAnimationFrame(App.pin.remeasureAll)
        })

        /* 2. 主题尽早初始化，避免暗色模式下闪白 */
        App.theme.init()

        /* 站点信息：品牌名与邮箱来自 config，避免在 HTML 里重复 */
        var brandLink = document.getElementById('brandLink')
        if (brandLink) brandLink.textContent = App.config.siteName

        var emailLink = document.getElementById('emailLink')
        if (emailLink) emailLink.href = 'mailto:' + App.config.email

        var feedLink = document.getElementById('feedLink')
        if (feedLink) feedLink.href = App.config.feedUrl

        /* 3. 内容加载（异步，不阻塞遮罩揭开） */
        var blogRail = document.getElementById('blogRail')
        if (blogRail) App.blogRail.load(blogRail)

        var photoStack = document.getElementById('photoStack')
        if (photoStack) App.photoStack.load(photoStack)

        /* 4. Reveal 动画 */
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

        /* 5. 顶部页面进度条 + 顶栏描边 */
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

        /* 6. 时钟 */
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

        /* 7. 版权年份：startYear 到当前年；若相同则只显示一个 */
        var startYear = App.config.startYear || 2026
        var nowYear = new Date().getFullYear()
        var yearsText = nowYear > startYear
            ? startYear + '-' + nowYear
            : String(startYear)

        var yearsEl = document.getElementById('copyrightYears')
        if (yearsEl) yearsEl.textContent = yearsText

        /* 8. 揭开首屏遮罩 */
        revealBoot()
    }

    /*
     * 给 <html> 加 .booted，让 .boot 遮罩淡出。
     * 最少显示 MIN_MS，避免在极快设备上一闪而过反而更突兀。
     * 用 performance.now() 而不是重新计时：它从导航开始算起，
     * 所以如果加载本身已超过 MIN_MS，就不会再额外等待。
     */
    function revealBoot() {
        var MIN_MS = 150
        var elapsed = (window.performance && performance.now)
            ? performance.now()
            : 0
        var wait = Math.max(0, MIN_MS - elapsed)

        setTimeout(function () {
            document.documentElement.classList.add('booted')
        }, wait)
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot)
    } else {
        boot()
    }
})()
