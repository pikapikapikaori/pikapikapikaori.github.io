/* ========================================================
 * 阶段 A（0 → flyIn）：每张照片从不同方位飞入，落在中心叠成
 * 一摞略微错位的卡片。
 * 阶段 B（flyIn → zoom）：整叠放大；除第一张外依次往下退位。
 * 阶段 C（zoom → 1）：剩下几张依次从下方升起，覆盖到顶。
 * 阶段 C 通过 magnetize 吸附到 N 个静止点，形成"滑一次切一张"
 * 的手感，并额外使用更低的 follow 系数让运动更有阻尼感。

 * 位移单位说明：
 * - config 里 entries.x/y、stackOffset.x/y 都是"卡片高度的百分比"
 * - 卡片高度 = CSS 变量 --h，横竖图共用同一高度
 * - 这里在 apply 时乘以 baseH（卡片高度 px），得到实际位移
 * - 这样横图（宽 654px）和竖图（宽 276px）飞出距离视觉一致
   ======================================================== */
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
            'style="--g:' + ph.g + ';z-index:' + i + '">' +
            img +
            '<figcaption>' + esc(ph.caption) + '</figcaption>' +
            '</figure>'
    }

    PhotoStack.init = function (stack) {
        var section = stack.closest('.shelf')
        var sticky = section.querySelector('.shelf-sticky')
        var cards = [].slice.call(stack.querySelectorAll('.photo-card'))
        var bar = section.querySelector('.rail-progress > span')
        var N = cards.length
        if (!N) return

        var P = CFG.photo
        var mid = (N - 1) / 2
        var seg = N > 1 ? 1 / (N - 1) : 1

        /* 位移基准（px），在 sizeFn 里刷新 */
        var baseH = 300

        /* 每张卡片的入场起点 */
        var entries = cards.map(function (_, i) {
            return P.entries[i % P.entries.length]
        })

        /* 堆叠时每张相对中心的偏移 */
        var stackPos = cards.map(function (_, i) {
            return {
                x: (i - mid) * P.stackOffset.x,
                y: (i - mid) * P.stackOffset.y,
                r: (i - mid) * P.stackOffset.r
            }
        })

        /* 
         * ---------- 按阶段区分阻尼 ----------
         * 阶段 B 之前用全局 follow，进入阶段 C 之后用更低的 follow，
         * 中间用一个混合区间平滑过渡，避免边界处的"顿感"。
         */
        var GLOBAL_FOLLOW = CFG.motion.follow
        var PHASE_C_FOLLOW = P.followPhaseC
        var BLEND_RANGE = P.followBlendRange
        var ZOOM_END = P.phases.zoom

        function followFor(targetP) {
            if (targetP <= ZOOM_END) return GLOBAL_FOLLOW
            var blend = U.clamp01((targetP - ZOOM_END) / Math.max(0.0001, BLEND_RANGE))
            return U.lerp(GLOBAL_FOLLOW, PHASE_C_FOLLOW, blend)
        }

        function sizeFn() {
            /* 刷新位移基准：所有卡片高度一致，取第一张 */
            baseH = cards[0].offsetHeight || 300

            var vh = sticky.offsetHeight || window.innerHeight
            var total = vh * P.totalScreens
            return { total: total, height: vh + total }
        }

        function apply(p) {
            var endA = P.phases.flyIn
            var endB = P.phases.zoom

            var tA = U.clamp01(p / endA)
            var tB = U.clamp01((p - endA) / Math.max(0.0001, endB - endA))
            var tCraw = U.clamp01((p - endB) / Math.max(0.0001, 1 - endB))

            /* 阶段 C 磁吸：连续进度 → 吸附到 N 个静止点 */
            var tC = U.magnetize(tCraw, N, P.magnetFlat)

            /* 阶段 B：整体放大 */
            var stageScale = 1 + (P.stackScaleMax - 1) * U.easeInOutCubic(tB)
            stack.style.transform = 'scale(' + stageScale.toFixed(4) + ')'

            for (var i = 0; i < N; i++) {
                var card = cards[i]
                var entry = entries[i]
                var sp = stackPos[i]

                /* x, y 都是"卡片高度百分比"，r 是角度，s 是缩放 */
                var x, y, r, s

                if (i === 0) {
                    /* 第一张一开始就在中心，不参与飞入 */
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

                /* 百分比 → px（以卡片高度为基准） */
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

        /* 首帧前隐藏，避免初始位置跳变被看到 */
        stack.classList.remove('ready')

        /* 传第四个参数：按目标进度返回 follow */
        var pin = Pin.make(section, apply, sizeFn, followFor)

        /* makePin 里已 apply(0)，卡片位置已定，可以显示 */
        stack.classList.add('ready')

        if (window.ResizeObserver) {
            new ResizeObserver(function () { pin.scheduleMeasure() }).observe(sticky)
        }

        return pin
    }

    PhotoStack.load = function (stack) {
        stack.innerHTML = CFG.photos.map(renderPhoto).join('')
        PhotoStack.init(stack)
    }
})()
