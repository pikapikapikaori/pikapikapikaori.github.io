import { createBlogRail } from './blog-rail.js'
import { createPhotoStack } from './photo-animation.js'

export default {
    mount(root) {
        const App = window.App

        const progressBar = root.querySelector('.progress-bar')
        const topbar = root.querySelector('.topbar')
        const pins = []

        let railInstance = null
        let photoInstance = null

        const blogSection = root.querySelector('#blog')
        const photoSection = root.querySelector('#photo')

        const unsubscribeLang = App.i18n.onChange(function (newLang) {
            if (railInstance) railInstance.reload(newLang)
            if (photoInstance) photoInstance.reload()
            pickSlogan()
            requestAnimationFrame(measurePins)
        })

        const slogan = root.querySelector('[data-slogan]')

        function pickSlogan() {
            if (!slogan) return

            const list = App.i18n.list('common.slogans')

            if (!list || !list.length) return

            slogan.innerHTML = list[Math.floor(Math.random() * list.length)]
        }

        pickSlogan()

        function measurePins() {
            pins.forEach(function (pin) { pin.scheduleMeasure() })
        }

        if (blogSection) {
            railInstance = createBlogRail({
                section: blogSection,
                railBtns: root.querySelectorAll('.rail-btn'),
                pins: pins
            })
        }

        if (photoSection) {
            photoInstance = createPhotoStack({
                section: photoSection,
                pins: pins
            })
        }

        const revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('in')
                    revealObserver.unobserve(e.target)
                }
            })
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })

        root.querySelectorAll('.reveal').forEach(function (el) {
            revealObserver.observe(el)
        })

        function onScroll() {
            const h = document.documentElement.scrollHeight - window.innerHeight
            if (progressBar) {
                progressBar.style.transform =
                    'scaleX(' + (h > 0 ? window.scrollY / h : 0) + ')'
            }
            if (topbar) topbar.classList.toggle('solid', window.scrollY > 40)
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()

        const htmlEl = document.documentElement
        const MIN_MS = 150
        const elapsed = (window.performance && performance.now) ? performance.now() : 0
        const bootTimer = setTimeout(function () {
            htmlEl.classList.add('booted')
        }, Math.max(0, MIN_MS - elapsed))

        htmlEl.classList.remove('booted')

        return {
            unmount() {
                clearTimeout(bootTimer)
                window.removeEventListener('scroll', onScroll)
                revealObserver.disconnect()
                unsubscribeLang()
                if (railInstance) railInstance.destroy()
                if (photoInstance) photoInstance.destroy()
                pins.forEach(function (pin) { pin.destroy() })
                htmlEl.classList.remove('booted')
            }
        }
    }
}
