import { createPin } from './scroll-pin.js'

const App = window.App
const U = App.utils
const Photos = App.photos

const P = {
    totalScreens: 6.875,

    phases: {
        flyIn: 0.24,
        zoom: 0.40
    },

    stackScaleMax: 1.7,

    entries: [
        { x: -180, y: -90, r: -26, s: 0.60 },
        { x: 170, y: -130, r: 22, s: 0.68 },
        { x: -195, y: 115, r: 16, s: 0.64 },
        { x: 185, y: 100, r: -20, s: 0.66 },
        { x: 12, y: -200, r: 12, s: 0.58 },
        { x: -150, y: -160, r: -18, s: 0.62 },
        { x: 155, y: 150, r: 14, s: 0.66 },
        { x: -165, y: 165, r: -14, s: 0.62 }
    ],

    entryStagger: 0.09,
    exitStagger: 0.10,
    stackOffset: { x: 3.2, y: 2.6, r: 2.2 },
    exitY: 108,
    magnetFlat: 0.30,
    followPhaseC: 0.09,
    followBlendRange: 0.06
}

const GLOBAL_FOLLOW = 0.16
const PHASE_C_FOLLOW = P.followPhaseC
const BLEND_RANGE = P.followBlendRange
const ZOOM_END = P.phases.zoom

function renderPhoto(ph, i) {
    const esc = U.escapeHtml
    const ratio = ph.ratio || '16/9'
    const caption = App.i18n.t('photo.caption.' + ph.id) || ''
    const img = ph.src
        ? '<img src="' + esc(ph.src) + '" alt="' + esc(caption) + '" ' +
        'loading="lazy" decoding="async" onerror="this.remove()">'
        : ''
    return '<figure class="photo-card" ' +
        'style="z-index:' + i + ';aspect-ratio:' + esc(ratio) + '">' +
        img +
        '<figcaption>' + esc(caption) + '</figcaption>' +
        '</figure>'
}

function followFor(targetP) {
    if (targetP <= ZOOM_END) return GLOBAL_FOLLOW
    const blend = U.clamp01((targetP - ZOOM_END) / Math.max(0.0001, BLEND_RANGE))
    return U.lerp(GLOBAL_FOLLOW, PHASE_C_FOLLOW, blend)
}

/* section 需含 .photo-stack；pins 收集该段注册的 pin 以便离开时释放。 */
export function createPhotoStack(options) {
    const section = options.section
    const pins = options.pins

    const sticky = section.querySelector('.shelf-sticky')
    const stack = section.querySelector('.photo-stack')
    const bar = section.querySelector('.rail-progress > span')

    let pin = null
    let resizeObserver = null

    /* 每次重新渲染时重建的派生数据 */
    let cards = []
    let N = 0
    let mid = 0
    let seg = 1
    let entries = []
    let stackPos = []
    let baseH = 300

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

    function sizeFn() {
        baseH = cards.length ? (cards[0].offsetHeight || 300) : 300

        const vh = sticky.offsetHeight || window.innerHeight
        const total = vh * P.totalScreens
        return { total: total, height: vh + total }
    }

    function apply(p) {
        const endA = P.phases.flyIn
        const endB = P.phases.zoom

        const tA = U.clamp01(p / endA)
        const tB = U.clamp01((p - endA) / Math.max(0.0001, endB - endA))
        const tCraw = U.clamp01((p - endB) / Math.max(0.0001, 1 - endB))

        const tC = U.magnetize(tCraw, N, P.magnetFlat)

        /* 阶段 B：整体放大 */
        const stageScale = 1 + (P.stackScaleMax - 1) * U.easeInOutCubic(tB)
        stack.style.transform = 'scale(' + stageScale.toFixed(4) + ')'

        for (let i = 0; i < N; i++) {
            const card = cards[i]
            const entry = entries[i]
            const sp = stackPos[i]

            let x, y, r, s

            if (i === 0) {
                x = sp.x; y = sp.y; r = sp.r; s = 1
            } else {
                const staggerA = (i - 1) * P.entryStagger
                const ltA = U.clamp01((tA - staggerA) / Math.max(0.001, 1 - staggerA))
                const eA = U.easeOutCubic(ltA)
                x = U.lerp(entry.x, sp.x, eA)
                y = U.lerp(entry.y, sp.y, eA)
                r = U.lerp(entry.r, sp.r, eA)
                s = U.lerp(entry.s, 1, eA)
            }

            if (i > 0) {
                const staggerB = (i - 1) * P.exitStagger
                const ltB = U.clamp01((tB - staggerB) / Math.max(0.001, 1 - staggerB))
                y = U.lerp(y, P.exitY, U.easeInOutCubic(ltB))
            }

            if (i > 0 && tC > 0) {
                const start = (i - 1) * seg
                const ltC = U.clamp01((tC - start) / seg)
                y = U.lerp(P.exitY, 0, U.easeInOutCubic(ltC))
            }

            const dx = x / 100 * baseH
            const dy = y / 100 * baseH

            card.style.transform =
                'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) ' +
                'rotate(' + r.toFixed(3) + 'deg) ' +
                'scale(' + s.toFixed(4) + ')'
        }

        if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'
    }

    function doRender() {
        /* 隐藏，避免重建过程中的位置跳变被看到 */
        stack.classList.remove('ready')

        const photos = Photos.list()
        stack.innerHTML = photos.map(renderPhoto).join('')
        Photos.preload()

        rebuildDerived()

        if (pin) {
            pin.measure()
        } else {
            pin = createPin(section, apply, sizeFn, followFor)
            if (pins) pins.push(pin)

            if (window.ResizeObserver) {
                resizeObserver = new ResizeObserver(function () {
                    pin.scheduleMeasure()
                })
                resizeObserver.observe(sticky)
            }
        }

        /* 卡片位置已就位，显示 */
        stack.classList.add('ready')
    }

    doRender()

    return {
        reload: function () {
            doRender()
        },
        destroy: function () {
            if (resizeObserver) resizeObserver.disconnect()
            if (pin) pin.destroy()
            stack.innerHTML = ''
            stack.style.transform = ''
            section.style.height = ''
            section.classList.remove('pin-on', 'at-start', 'at-end')
        }
    }
}
