(function () {
    'use strict'

    var App = window.App = window.App || {}
    var PhotoStack = App.photoStack = {}
    var U = App.utils
    var Pin = App.pin
    var CFG = App.config

    function renderPhoto(ph, i) {
        var esc = U.escapeHtml
        var ratio = ph.ratio || '16/9'
        var img = ph.src
            ? '<img src="' + esc(ph.src) + '" alt="' + esc(ph.caption) + '" ' +
            'loading="lazy" decoding="async" onerror="this.remove()">'
            : ''
        return '<figure class="photo-card" ' +
            'data-ratio="' + esc(ratio) + '" ' +
            'style="--g:' + ph.g + ';z-index:' + i  + ';aspect-ratio:' + esc(ratio) + '">' +
            img +
            '<figcaption>' + esc(ph.caption) + '</figcaption>' +
            '</figure>'
    }

    /* 按语言取照片，找不到回退到中文组 */
    function getPhotos(lang) {
        var map = CFG.photos || {}
        return map[lang] || map['zh-Hans'] || []
    }

    PhotoStack.load = function (stack) {
        var section = stack.closest('.shelf')
        var sticky = section.querySelector('.shelf-sticky')
        var bar = section.querySelector('.rail-progress > span')

        var P = CFG.photo
        var pin = null

        /* 每次重新渲染时重建的派生数据 */
        var cards = []
        var N = 0
        var mid = 0
        var seg = 1
        var entries = []
        var stackPos = []
        var baseH = 300

        function rebuildDerived() {
            cards = [].slice.call(stack.querySelectorAll('.photo-card'))
            N = cards.length
            mid = (N - 1) / 2
            seg = N > 1 ? 1 / (N - 1) : 1

            entries = cards.map(function (_, i) {
                return P.entries[i % P.entries.length]
            })

            stackPos = cards.map(function (_, i) {
                return {
                    x: (i - mid) * P.stackOffset.x,
                    y: (i - mid) * P.stackOffset.y,
                    r: (i - mid) * P.stackOffset.r
                }
            })
        }

        /* ---------- 按阶段区分阻尼 ---------- */
        var GLOBAL_FOLLOW = CFG.motion.follow
        var PHASE_C_FOLLOW = P.followPhaseC
        var BLEND_RANGE = P.followBlendRange
        var ZOOM_END = P.phases.zoom

        function followFor(targetP) {
            if (targetP <= ZOOM_END) return GLOBAL_FOLLOW
            var blend = U.clamp01((targetP - ZOOM_END) / Math.max(0.0001, BLEND_RANGE))
            return U.lerp(GLOBAL_FOLLOW, PHASE_C_FOLLOW, blend)
        }

        /* ---------- 尺寸 ---------- */
        function sizeFn() {
            baseH = cards.length ? (cards[0].offsetHeight || 300) : 300

            var vh = sticky.offsetHeight || window.innerHeight
            var total = vh * P.totalScreens
            return { total: total, height: vh + total }
        }

        /* ---------- 应用到 DOM ---------- */
        function apply(p) {
            var endA = P.phases.flyIn
            var endB = P.phases.zoom

            var tA = U.clamp01(p / endA)
            var tB = U.clamp01((p - endA) / Math.max(0.0001, endB - endA))
            var tCraw = U.clamp01((p - endB) / Math.max(0.0001, 1 - endB))

            var tC = U.magnetize(tCraw, N, P.magnetFlat)

            /* 阶段 B：整体放大 */
            var stageScale = 1 + (P.stackScaleMax - 1) * U.easeInOutCubic(tB)
            stack.style.transform = 'scale(' + stageScale.toFixed(4) + ')'

            for (var i = 0; i < N; i++) {
                var card = cards[i]
                var entry = entries[i]
                var sp = stackPos[i]

                var x, y, r, s

                if (i === 0) {
                    x = sp.x; y = sp.y; r = sp.r; s = 1
                } else {
                    /* --- A：飞入 --- */
                    var staggerA = (i - 1) * P.entryStagger
                    var ltA = U.clamp01((tA - staggerA) / Math.max(0.001, 1 - staggerA))
                    var eA = U.easeOutCubic(ltA)
                    x = U.lerp(entry.x, sp.x, eA)
                    y = U.lerp(entry.y, sp.y, eA)
                    r = U.lerp(entry.r, sp.r, eA)
                    s = U.lerp(entry.s, 1, eA)
                }

                /* --- B：i>0 依次往下退 --- */
                if (i > 0) {
                    var staggerB = (i - 1) * P.exitStagger
                    var ltB = U.clamp01((tB - staggerB) / Math.max(0.001, 1 - staggerB))
                    y = U.lerp(y, P.exitY, U.easeInOutCubic(ltB))
                }

                /* --- C：i>0 依次从下往上进入 --- */
                if (i > 0 && tC > 0) {
                    var start = (i - 1) * seg
                    var ltC = U.clamp01((tC - start) / seg)
                    y = U.lerp(P.exitY, 0, U.easeInOutCubic(ltC))
                }

                var dx = x / 100 * baseH
                var dy = y / 100 * baseH

                card.style.transform =
                    'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) ' +
                    'rotate(' + r.toFixed(3) + 'deg) ' +
                    'scale(' + s.toFixed(4) + ')'
            }

            if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'
            section.dataset.p = p
        }

        /* ---------- 渲染（首次和 reload 都走这里） ---------- */
        function doRender(lang) {
            /* 隐藏，避免重建过程中的位置跳变被看到 */
            stack.classList.remove('ready')

            var photos = getPhotos(lang)
            stack.innerHTML = photos.map(renderPhoto).join('')

            rebuildDerived()

            if (pin) {
                /* 已初始化过：重测尺寸 + 重算位置 */
                pin.measure()
            } else {
                /* 首次：建 pin */
                pin = Pin.make(section, apply, sizeFn, followFor)

                if (window.ResizeObserver) {
                    new ResizeObserver(function () {
                        pin.scheduleMeasure()
                    }).observe(sticky)
                }
            }

            /* 卡片位置已就位，显示 */
            stack.classList.add('ready')
        }

        /* 首次加载 */
        doRender(App.i18n.get())

        return {
            reload: function (lang) {
                doRender(lang)
            }
        }
    }
})()
