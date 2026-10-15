(function () {
    'use strict'

    var App = window.App

    function boot() {

        /* 1. i18n 最先跑，让所有 [data-i18n] 立刻有内容 */
        App.i18n.init()

        /* 2. 主题尽早初始化，避免暗色模式下闪白 */
        App.theme.init()

        /* 3. 站点信息：品牌名与邮箱来自 config */
        var brandLink = document.getElementById('brandLink')
        if (brandLink) brandLink.textContent = App.config.siteName

        var emailLink = document.getElementById('emailLink')
        if (emailLink) emailLink.href = 'mailto:' + App.config.email

        /* 4. 内容加载 */
        var blogRail = document.getElementById('blogRail')
        var blogInstance = null
        if (blogRail) blogInstance = App.blogRail.load(blogRail)

        var photoStack = document.getElementById('photoStack')
        if (photoStack) App.photoStack.load(photoStack)

        /* 5. 语言切换：重载博客 rail + 重测所有 pin */
        App.i18n.onChange(function (newLang) {
            scrollToTopInstant()

            if (blogInstance) blogInstance.reload(newLang)
            requestAnimationFrame(App.pin.remeasureAll)
        })

        /* 6. Reveal 动画 */
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

        /* 7. 顶部页面进度条 + 顶栏描边 */
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

        /* 8. 时钟 */
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

        /* 9. 版权年份 */
        var startYear = App.config.startYear || 2026
        var nowYear = new Date().getFullYear()
        var yearsText = nowYear > startYear
            ? startYear + '-' + nowYear
            : String(startYear)

        var yearsEl = document.getElementById('copyrightYears')
        if (yearsEl) yearsEl.textContent = yearsText

        /* 10. 揭开首屏遮罩 */
        revealBoot()
    }

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

    /*
     * 立即回到页面顶部，绕过 html { scroll-behavior: smooth }。
     */
    function scrollToTopInstant() {
        var html = document.documentElement
        html.style.scrollBehavior = 'auto'
        window.scrollTo(0, 0)
        requestAnimationFrame(function () {
            html.style.scrollBehavior = ''
        })
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot)
    } else {
        boot()
    }
})()
