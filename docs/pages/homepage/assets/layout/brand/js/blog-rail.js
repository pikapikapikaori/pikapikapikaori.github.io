/*
 * 博客横向 rail。动画属品牌长页，文章解析仍走公共 App.feed；
 * 样式类沿用品牌布局的 .post-card 一族。
 */

import { createPin } from './scroll-pin.js'

const App = window.App
const U = App.utils
const F = App.feed

const FOLLOW = 0.16
const FOLLOW_END = 0.95
const RAMP_START = 0.62

function followFor(p) {
    const t = U.clamp01((p - RAMP_START) / Math.max(0.0001, 1 - RAMP_START))
    return U.lerp(FOLLOW, FOLLOW_END, t)
}

function renderPost(p) {
    const esc = U.escapeHtml
    const img = p.cover
        ? '<img src="' + esc(p.cover) + '" alt="" loading="lazy" ' +
        'decoding="async" referrerpolicy="no-referrer" ' +
        'onerror="this.remove()">'
        : ''

    return '<article class="post-card">' +
        '<a href="' + esc(p.link) + '">' +
        '<div class="post-cover">' + img + '</div>' +
        '<div class="post-body">' +
        (p.date ? '<time>' + esc(p.date) + '</time>' : '') +
        '<h3>' + esc(p.title) + '</h3>' +
        '<p>' + esc(p.excerpt) + (p.excerpt ? '…' : '') + '</p>' +
        '</div>' +
        '</a>' +
        '</article>'
}

/* section 需含 .rail、.rail-wrap 与 .shelf-sticky；卡片封面为装饰图，alt 留空。 */
export function createBlogRail(options) {
    const section = options.section
    const railBtns = options.railBtns || []
    const pins = options.pins

    const rail = section.querySelector('.rail')
    const wrap = section.querySelector('.rail-wrap')
    const sticky = section.querySelector('.shelf-sticky')
    const bar = section.querySelector('.rail-progress > span')

    let maxX = 0
    let pin = null
    let resizeObserver = null
    let loadSeq = 0
    let disposed = false

    function sizeFn() {
        const last = rail.lastElementChild

        if (!last) {
            maxX = 0
        } else {
            const padRight = parseFloat(
                getComputedStyle(rail).paddingRight
            ) || 0
            const railLeft = rail.getBoundingClientRect().left
            const lastRight = last.getBoundingClientRect().right
            maxX = Math.max(
                0,
                (lastRight - railLeft + padRight) - wrap.clientWidth
            )
        }

        const on = maxX > 1
        section.classList.toggle('pin-on', on)

        return {
            total: on ? maxX : 0,
            height: sticky.offsetHeight + (on ? maxX : 0)
        }
    }

    function apply(p) {
        const x = p * maxX
        rail.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)'
        if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'
        section.classList.toggle('at-start', p <= 0.002)
        section.classList.toggle('at-end', p >= 0.998)
        section.dataset.p = p
    }

    function cardStep() {
        const card = rail.firstElementChild
        if (!card) return 300
        const gap = parseFloat(getComputedStyle(rail).columnGap) || 16
        return card.getBoundingClientRect().width + gap
    }

    function attachControls() {
        [].slice.call(railBtns).forEach(function (b) {
            b.addEventListener('click', function () {
                window.scrollBy({
                    top: Number(b.dataset.dir) * cardStep(),
                    behavior: 'smooth'
                })
            })
        })

        rail.addEventListener('focusin', onFocusin)

        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(function () {
                if (pin) pin.scheduleMeasure()
            })
            resizeObserver.observe(wrap)
        }
    }

    function onFocusin(e) {
        if (maxX <= 1) return
        const card = e.target.closest('.post-card')
        if (!card) return

        const pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0
        const left = card.offsetLeft - pad
        const right = left + card.offsetWidth
        const viewR = wrap.clientWidth

        let np = null
        if (left < 24) np = Math.max(0, (left - 24) / maxX)
        else if (right > viewR - 24) np = Math.min(1, (right + 24 - viewR) / maxX)

        if (np !== null &&
            Math.abs(np - (parseFloat(section.dataset.p) || 0)) > 0.01) {
            window.scrollTo({
                top: section.offsetTop + np * maxX,
                behavior: 'smooth'
            })
        }
    }

    function doLoad(lang) {
        const ticket = ++loadSeq

        return F.loadPosts(lang).then(function (posts) {
            /* 语言快速切换时旧请求可能后到，丢弃过期结果。 */
            if (disposed || ticket !== loadSeq) return

            rail.innerHTML = posts.map(renderPost).join('')

            if (pin) {
                pin.scheduleMeasure()
            } else {
                pin = createPin(section, apply, sizeFn, followFor)
                attachControls()
                if (pins) pins.push(pin)
            }
        })
    }

    doLoad(App.i18n.get())

    return {
        reload: function (lang) {
            return doLoad(lang)
        },
        destroy: function () {
            disposed = true
            loadSeq++
            if (resizeObserver) resizeObserver.disconnect()
            if (pin) pin.destroy()
            rail.innerHTML = ''
            rail.style.transform = ''
            section.style.height = ''
            section.classList.remove('pin-on', 'at-start', 'at-end')
        }
    }
}
