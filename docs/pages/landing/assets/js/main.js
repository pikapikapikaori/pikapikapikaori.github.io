(function () {
    'use strict'

    var App = window.App

    function boot() {

        App.i18n.init()

        App.theme.init()

        var brandLink = document.getElementById('brandLink')
        if (brandLink) brandLink.textContent = App.config.siteName

        var emailLink = document.getElementById('emailLink')
        if (emailLink) emailLink.href = 'mailto:' + App.config.email

        var blogRail = document.getElementById('blogRail')
        var blogInstance = null
        if (blogRail) blogInstance = App.blogRail.load(blogRail)

        var photoStack = document.getElementById('photoStack')
        var photoInstance = null
        if (photoStack) photoInstance = App.photoStack.load(photoStack)

        App.i18n.onChange(function (newLang) {
            scrollToTopInstant()

            if (blogInstance)  blogInstance.reload(newLang)
            if (photoInstance) photoInstance.reload(newLang)

            requestAnimationFrame(App.pin.remeasureAll)
        })

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

        var startYear = App.config.startYear || 2026
        var nowYear = new Date().getFullYear()
        var yearsText = nowYear > startYear
            ? startYear + '-' + nowYear
            : String(startYear)

        var yearsEl = document.getElementById('copyrightYears')
        if (yearsEl) yearsEl.textContent = yearsText

        revealBoot()
    }

    /* 立即回到页面顶部，绕过 html { scroll-behavior: smooth } */
    function scrollToTopInstant() {
        var html = document.documentElement
        html.style.scrollBehavior = 'auto'
        window.scrollTo(0, 0)
        requestAnimationFrame(function () {
            html.style.scrollBehavior = ''
        })
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot)
    } else {
        boot()
    }
})()
