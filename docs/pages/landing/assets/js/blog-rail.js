(function () {
    'use strict'

    var App = window.App = window.App || {}
    var BlogRail = App.blogRail = {}
    var U = App.utils
    var Pin = App.pin
    var F = App.feed

    var REDUCE = U.prefersReducedMotion()

    function renderPost(p) {
        var esc = U.escapeHtml
        var img = p.cover
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

    BlogRail.load = function (rail) {
        var section = rail.closest('.shelf')
        var wrap = section.querySelector('.rail-wrap')
        var sticky = section.querySelector('.shelf-sticky')
        var bar = section.querySelector('.rail-progress > span')
        var btns = section.querySelectorAll('.rail-btn')

        var maxX = 0
        var pin = null

        /* ---------- 尺寸测量 ---------- */
        function sizeFn() {
            var last = rail.lastElementChild

            if (!last) {
                maxX = 0
            } else {
                var padRight = parseFloat(
                    getComputedStyle(rail).paddingRight
                ) || 0
                var railLeft = rail.getBoundingClientRect().left
                var lastRight = last.getBoundingClientRect().right
                maxX = Math.max(
                    0,
                    (lastRight - railLeft + padRight) - wrap.clientWidth
                )
            }

            var on = maxX > 1
            section.classList.toggle('pin-on', on)

            return {
                total: on ? maxX : 0,
                height: sticky.offsetHeight + (on ? maxX : 0)
            }
        }

        /* ---------- 应用到 DOM ---------- */
        function apply(p) {
            var x = p * maxX
            rail.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)'
            if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'
            section.classList.toggle('at-start', p <= 0.002)
            section.classList.toggle('at-end', p >= 0.998)
            section.dataset.p = p
        }

        /* ---------- 箭头 / 键盘焦点 ---------- */
        function attachControls() {
            function cardStep() {
                var card = rail.firstElementChild
                if (!card) return 300
                var gap = parseFloat(getComputedStyle(rail).columnGap) || 16
                return card.getBoundingClientRect().width + gap
            }

            btns.forEach(function (b) {
                b.addEventListener('click', function () {
                    window.scrollBy({
                        top: Number(b.dataset.dir) * cardStep(),
                        behavior: 'smooth'
                    })
                })
            })

            rail.addEventListener('focusin', function (e) {
                if (maxX <= 1) return
                var card = e.target.closest('.post-card')
                if (!card) return

                var pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0
                var left = card.offsetLeft - pad
                var right = left + card.offsetWidth
                var viewR = wrap.clientWidth

                var np = null
                if (left < 24) np = Math.max(0, (left - 24) / maxX)
                else if (right > viewR - 24) np = Math.min(1, (right + 24 - viewR) / maxX)

                if (np !== null &&
                    Math.abs(np - (parseFloat(section.dataset.p) || 0)) > 0.01) {
                    window.scrollTo({
                        top: section.offsetTop + np * maxX,
                        behavior: REDUCE ? 'auto' : 'smooth'
                    })
                }
            })

            if (window.ResizeObserver) {
                new ResizeObserver(function () {
                    if (pin) pin.scheduleMeasure()
                }).observe(wrap)
            }
        }

        /* ---------- 内部：加载并渲染 ---------- */
        function doLoad(lang) {
            return F.loadPosts(lang).then(function (posts) {
                rail.innerHTML = posts.map(renderPost).join('')

                if (pin) {
                    pin.scheduleMeasure()
                } else {
                    pin = Pin.make(section, apply, sizeFn)
                    attachControls()
                }
            })
        }

        /* 首次加载 */
        doLoad(App.i18n.get())

        return {
            reload: function (lang) {
                return doLoad(lang)
            }
        }
    }
})()
