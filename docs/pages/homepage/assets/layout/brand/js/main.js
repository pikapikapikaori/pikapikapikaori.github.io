/* 品牌长页布局脚本：博客 rail、摄影堆叠、滚动进度与入场，
 * 数据走公共 App 接口，动画模块在本布局目录内，文案由公用 i18n 填充。
 */

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
            if (photoInstance) photoInstance.reload(newLang)
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

        /* 入场遮罩：遮罩元素由 HTML 自带的 boot 类常驻，挂载后延时加根级 booted 类使其淡出。 */
        const htmlEl = document.documentElement
        const MIN_MS = 150
        const elapsed = (window.performance && performance.now) ? performance.now() : 0
        const bootTimer = setTimeout(function () {
            htmlEl.classList.add('booted')
        }, Math.max(0, MIN_MS - elapsed))

        /* 先移除旧 booted 类，重新挂载同一布局时才不会一开始就是已淡出状态。 */
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
                /* 卸载时去掉根级类，避免切到其他布局后遮罩仍然生效。 */
                htmlEl.classList.remove('booted')
            }
        }
    }
}
