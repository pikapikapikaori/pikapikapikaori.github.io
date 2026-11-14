export default {
    mount(root) {
        const App = window.App
        const canvas = root.querySelector('.star-canvas')
        const slogan = root.querySelector('.star-slogan')
        const ctx = canvas ? canvas.getContext('2d') : null

        if (!ctx) return { unmount() {} }

        const ANGLE_CAP = 90
        const ANGLE_RATIO = 90 / 640
        const COVERAGE_CAP = 0.055
        const MIN_GAP = 12
        const NEAR_RADIUS = 34
        const MAX_DPR = 2

        /* 暗 C：星点为主，短弧贴高处圆心。亮 B：暖金、浅粉、淡蓝三束光带。
           两案共用弧角上限、角隙与覆盖上限的计算。 */
        const SKY = {
            dark: {
                seed: 37,
                stars: 104,
                starField: .82,
                center: [.56, .12],
                sets: [{
                    count: 20,
                    radius: [.13, .56],
                    sweep: [.38, .82],
                    width: [.9, 1.5],
                    opacity: [.4, .76],
                    colors: ['#C7E6FF', '#FFFFFF', '#AFC8F2', '#EADFC8'],
                    facing: 95,
                    facingSpread: 150
                }]
            },
            light: {
                seed: 71,
                stars: 0,
                starField: .82,
                center: [.14, .94],
                sets: [{
                    count: 7,
                    radius: [.34, .98],
                    sweep: [.48, .8],
                    width: [2, 4.6],
                    opacity: [.22, .36],
                    colors: ['#FFF6E4', '#FFE8EC', '#E6F2FF'],
                    facing: 320,
                    facingSpread: 130
                }]
            }
        }

        /* 轨迹整体先画在离屏画布上，每帧只清除主画布再贴一次旋转后的图。
           主画布不再叠半透明黑幕，因此不会随帧数累积变暗。 */
        const cache = document.createElement('canvas')
        const cctx = cache.getContext('2d')
        const edgeMask = document.createElement('canvas')
        const mctx = edgeMask.getContext('2d')

        let stars = []
        let trails = []
        let raf = 0
        let width = 0
        let height = 0
        let dpr = 1
        let cacheSize = 0
        let cacheRadius = 0
        let pivotX = 0
        let pivotY = 0
        let angle = 0
        let lastTime = 0
        let running = false
        let disposed = false
        let visible = !document.hidden
        let resizeTimer = 0
        let sceneTheme = 'dark'
        let textSafe = null

        function mulberry32(seed) {
            let a = seed >>> 0

            return function () {
                a = (a + 0x6D2B79F5) >>> 0
                const t = Math.imul(a ^ (a >>> 15), 1 | a)
                const x = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
                return ((x ^ (x >>> 14)) >>> 0) / 4294967296
            }
        }

        function lerp(a, b, t) {
            return a + (b - a) * t
        }

        function normAngle(value) {
            return ((value % 360) + 360) % 360
        }

        function capFor(radius) {
            return Math.min(ANGLE_CAP, ANGLE_RATIO * radius)
        }

        function rgba(hex, alpha) {
            const n = parseInt(hex.slice(1), 16)
            const r = (n >> 16) & 255
            const g = (n >> 8) & 255
            const b = n & 255

            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha.toFixed(3) + ')'
        }

        function arcContains(start, sweep, value) {
            return normAngle(value - start) <= sweep
        }

        function arcGap(a0, s1, b0, s2) {
            const a1 = a0 + s1
            const b1 = b0 + s2

            if (arcContains(a0, s1, b0) || arcContains(a0, s1, b1) ||
                arcContains(b0, s2, a0) || arcContains(b0, s2, a1)) {
                return 0
            }

            function dist(x, y) {
                const d = Math.abs(normAngle(x) - normAngle(y))
                return Math.min(d, 360 - d)
            }

            return Math.min(dist(a0, b0), dist(a0, b1), dist(a1, b0), dist(a1, b1))
        }

        /* 文字区留净：星点在该区域内压暗，轨迹绕开该矩形。
           不铺整屏遮罩，只对文字实际占位做局部处理。 */
        function textSafeRect() {
            const selectors = ['.star-kicker', '.star-slogan', '.star-name', '.star-tagline']
            const rects = selectors.map(function (selector) {
                const el = root.querySelector(selector)

                return el ? el.getBoundingClientRect() : null
            }).filter(function (rect) {
                return rect && rect.width && rect.height
            })

            if (!rects.length) return null

            const pad = 10

            return {
                left: Math.min.apply(null, rects.map(function (r) { return r.left })) - pad,
                top: Math.min.apply(null, rects.map(function (r) { return r.top + window.scrollY })) - pad,
                right: Math.max.apply(null, rects.map(function (r) { return r.right })) + pad,
                bottom: Math.max.apply(null, rects.map(function (r) { return r.bottom + window.scrollY })) + pad
            }
        }

        function inTextSafe(x, y) {
            if (!textSafe) return false

            return x >= textSafe.left && x <= textSafe.right &&
                y >= textSafe.top && y <= textSafe.bottom
        }

        function makeStars(cfg) {
            const rng = mulberry32(cfg.seed * 7 + 3)
            const narrow = Math.min(width, height) < 620
            const count = Math.round((cfg.stars || 0) * (narrow ? .66 : 1))
            const list = []

            for (let i = 0; i < count; i++) {
                const x = rng() * width
                const y = rng() * height * cfg.starField
                let opacity = .16 + rng() * .6

                if (inTextSafe(x, y)) opacity *= .24

                list.push({
                    x: x,
                    y: y,
                    radius: .35 + rng() * .95,
                    opacity: opacity,
                    color: rng() > .82 ? '#F2E2BF' : '#DDEBFF',
                    twinklePhase: rng() * Math.PI * 2,
                    twinkleSpeed: .55 + rng() * .75
                })
            }

            return list
        }

        function makeTrails(cfg) {
            const narrow = Math.min(width, height) < 620
            const span = Math.hypot(width, height)
            const list = []

            cfg.sets.forEach(function (set, setIndex) {
                const rng = mulberry32(cfg.seed + setIndex * 137 + (narrow ? 19 : 0))
                const count = Math.max(3, Math.round(set.count * (narrow ? .76 : 1)))
                const rMin = set.radius[0] * span
                const rMax = set.radius[1] * span
                const cx = cfg.center[0] * width
                const cy = cfg.center[1] * height

                for (let i = 0; i < count; i++) {
                    let radius = rMin + (rMax - rMin) * ((i + rng() * .76) / count)

                    radius = Math.max(48, radius)

                    const cap = capFor(radius)
                    let sweep = cap * lerp(set.sweep[0], set.sweep[1], rng())

                    sweep = Math.max(6, Math.min(cap * .985, sweep))

                    let start = null

                    for (let attempt = 0; attempt < 80 && start === null; attempt++) {
                        const candidate = set.facing - sweep / 2 +
                            (rng() - .5) * set.facingSpread

                        const clear = list.every(function (other) {
                            if (Math.abs(other.radius - radius) > NEAR_RADIUS) return true
                            return arcGap(candidate, sweep, other.startDeg, other.sweepDeg) >= MIN_GAP
                        })

                        if (clear) start = candidate
                    }

                    /* 放不进可见角度就放弃这条，宁可少一条也不让近半径弧连成整圆。 */
                    if (start === null) continue

                    const radiusT = (radius - rMin) / Math.max(1, rMax - rMin)
                    const radiusScale = .58 + .42 * (1 - Math.min(1, radiusT))
                    const headWidth = Math.max(.55,
                        lerp(set.width[0], set.width[1], rng()) * radiusScale * (narrow ? .94 : 1))
                    const tailWidth = Math.max(.3, headWidth * (.14 + rng() * .16))
                    const opacity = lerp(set.opacity[0], set.opacity[1], rng())
                    const color = set.colors[Math.floor(rng() * set.colors.length)]

                    list.push({
                        cx: cx,
                        cy: cy,
                        radius: radius,
                        startDeg: normAngle(start),
                        sweepDeg: sweep,
                        maxSweepDeg: cap,
                        widthHead: headWidth,
                        widthTail: tailWidth,
                        opacity: opacity,
                        color: color
                    })
                }
            })

            return list.sort(function (a, b) { return b.radius - a.radius })
        }

        function measure() {
            let trailArea = 0
            let minGap = null
            let nearPairs = 0

            trails.forEach(function (trail) {
                const averageWidth = (trail.widthHead + trail.widthTail) / 2
                trailArea += trail.sweepDeg * Math.PI / 180 * trail.radius * averageWidth
            })

            const starArea = stars.reduce(function (sum, star) {
                return sum + Math.PI * Math.pow(star.radius + .6, 2)
            }, 0)

            for (let i = 0; i < trails.length; i++) {
                for (let j = i + 1; j < trails.length; j++) {
                    if (Math.abs(trails[i].radius - trails[j].radius) > NEAR_RADIUS) continue

                    nearPairs++

                    const gap = arcGap(
                        trails[i].startDeg, trails[i].sweepDeg,
                        trails[j].startDeg, trails[j].sweepDeg
                    )

                    minGap = minGap === null ? gap : Math.min(minGap, gap)
                }
            }

            const maxSweep = trails.reduce(function (max, trail) {
                return Math.max(max, trail.sweepDeg)
            }, 0)

            const capViolations = trails.filter(function (trail) {
                return trail.sweepDeg > trail.maxSweepDeg + .001
            }).length

            const gapViolations = trails.filter(function (trail, index) {
                return trails.some(function (other, otherIndex) {
                    if (otherIndex === index) return false
                    if (Math.abs(other.radius - trail.radius) > NEAR_RADIUS) return false

                    return arcGap(trail.startDeg, trail.sweepDeg, other.startDeg, other.sweepDeg) < MIN_GAP - .001
                })
            }).length

            return {
                theme: sceneTheme,
                viewport: { width: width, height: height, dpr: dpr },
                caps: {
                    maxSweepDeg: ANGLE_CAP,
                    ratioDegPerPx: Math.round(ANGLE_RATIO * 10000) / 10000,
                    maxCoverageRatio: COVERAGE_CAP,
                    minAngularGapDeg: MIN_GAP
                },
                starCount: stars.length,
                trailCount: trails.length,
                maxSweepDeg: Math.round(maxSweep * 100) / 100,
                minAngularGapDeg: minGap === null ? null : Math.round(minGap * 100) / 100,
                nearRadiusPairs: nearPairs,
                capViolations: capViolations,
                gapViolations: gapViolations,
                coverage: {
                    geometric: Math.round((trailArea + starArea) / (width * height) * 1000000) / 1000000
                },
                trails: trails.map(function (trail, index) {
                    return {
                        id: index,
                        radius: Math.round(trail.radius * 100) / 100,
                        startDeg: Math.round(trail.startDeg * 100) / 100,
                        sweepDeg: Math.round(trail.sweepDeg * 100) / 100,
                        maxSweepDeg: Math.round(trail.maxSweepDeg * 100) / 100,
                        widthHead: Math.round(trail.widthHead * 100) / 100,
                        widthTail: Math.round(trail.widthTail * 100) / 100,
                        opacity: Math.round(trail.opacity * 1000) / 1000,
                        color: trail.color
                    }
                })
            }
        }

        function drawTrailCache() {
            const cacheDpr = Math.max(.5, Math.min(dpr, 4096 / Math.max(1, cacheSize)))

            cache.width = Math.max(1, Math.round(cacheSize * cacheDpr))
            cache.height = Math.max(1, Math.round(cacheSize * cacheDpr))

            cctx.setTransform(1, 0, 0, 1, 0, 0)
            cctx.clearRect(0, 0, cache.width, cache.height)
            cctx.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0)
            cctx.translate(cacheRadius, cacheRadius)

            trails.forEach(function (trail) {
                /* 半径超过视口最远角加宽度的弧，任何旋转角度都不会进入画面。 */
                if (trail.radius - trail.widthHead / 2 > cacheRadius) return

                const steps = Math.max(20, Math.min(90, Math.ceil(trail.sweepDeg / 1.2)))

                for (let i = 0; i < steps; i++) {
                    const t0 = i / steps
                    const t1 = (i + 1) / steps
                    const a0 = (trail.startDeg + trail.sweepDeg * t0) * Math.PI / 180
                    const a1 = (trail.startDeg + trail.sweepDeg * t1) * Math.PI / 180
                    const w0 = lerp(trail.widthHead, trail.widthTail, t0) / 2
                    const w1 = lerp(trail.widthHead, trail.widthTail, t1) / 2
                    /* 亮度沿弧衰减，尾端更淡。 */
                    const alpha = trail.opacity * (1 - .84 * (t0 + t1) / 2)
                    const r = trail.radius

                    cctx.beginPath()
                    cctx.moveTo(Math.cos(a0) * (r + w0), Math.sin(a0) * (r + w0))
                    cctx.lineTo(Math.cos(a1) * (r + w1), Math.sin(a1) * (r + w1))
                    cctx.lineTo(Math.cos(a1) * Math.max(.4, r - w1), Math.sin(a1) * Math.max(.4, r - w1))
                    cctx.lineTo(Math.cos(a0) * Math.max(.4, r - w0), Math.sin(a0) * Math.max(.4, r - w0))
                    cctx.closePath()
                    cctx.fillStyle = rgba(trail.color, alpha)
                    cctx.fill()
                }
            })

            cctx.setTransform(1, 0, 0, 1, 0, 0)
        }

        function drawStars(time) {
            stars.forEach(function (star) {
                const twinkle = .58 + .42 * Math.sin(time * star.twinkleSpeed + star.twinklePhase)

                ctx.beginPath()
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
                ctx.fillStyle = rgba(star.color, star.opacity * twinkle)
                ctx.fill()
            })
        }

        /* 四周与底部用 alpha 渐变收口，不叠加色块。 */
        function buildEdgeMask() {
            const top = Math.max(32, Math.round(height * .06))
            const side = Math.max(40, Math.round(width * .05))
            const bottom = Math.min(160, Math.max(72, Math.round(height * .1)))

            edgeMask.width = Math.max(1, Math.round(width * dpr))
            edgeMask.height = Math.max(1, Math.round(height * dpr))
            mctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            mctx.globalCompositeOperation = 'source-over'
            mctx.fillStyle = '#000'
            mctx.fillRect(0, 0, width, height)

            /* 只在四边擦除 alpha，中间保持实心，星轨本体不被遮住。 */
            mctx.globalCompositeOperation = 'destination-out'

            const bands = [
                { rect: [0, 0, width, top], from: [0, 0], to: [0, top] },
                { rect: [0, height - bottom, width, bottom], from: [0, height], to: [0, height - bottom] },
                { rect: [0, 0, side, height], from: [0, 0], to: [side, 0] },
                { rect: [width - side, 0, side, height], from: [width, 0], to: [width - side, 0] }
            ]

            bands.forEach(function (band) {
                const gradient = mctx.createLinearGradient(band.from[0], band.from[1], band.to[0], band.to[1])
                gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
                mctx.fillStyle = gradient
                mctx.fillRect(band.rect[0], band.rect[1], band.rect[2], band.rect[3])
            })

            /* 文字区留净：以椭圆径向渐变把该区域的星轨压到近零，
               不再用矩形裁切，避免出现直线切断。 */
            if (textSafe) {
                const halfW = Math.max(1, (textSafe.right - textSafe.left) / 2)
                const halfH = Math.max(1, (textSafe.bottom - textSafe.top) / 2)
                const rx = halfW + Math.max(48, Math.min(160, halfW * .45))
                const ry = halfH + Math.max(48, Math.min(160, halfH * .6))

                mctx.save()
                mctx.translate(textSafe.left + halfW, textSafe.top + halfH)
                mctx.scale(rx / ry, 1)

                const soft = mctx.createRadialGradient(0, 0, ry * .34, 0, 0, ry)

                soft.addColorStop(0, 'rgba(0, 0, 0, 1)')
                soft.addColorStop(.62, 'rgba(0, 0, 0, .82)')
                soft.addColorStop(1, 'rgba(0, 0, 0, 0)')
                mctx.fillStyle = soft
                mctx.fillRect(-ry, -ry, ry * 2, ry * 2)
                mctx.restore()
            }

            mctx.globalCompositeOperation = 'source-over'
        }

        function render(time) {
            if (!width || !height) return

            ctx.clearRect(0, 0, width, height)
            drawStars(time)

            if (!cacheSize) return

            ctx.save()
            ctx.translate(pivotX, pivotY)
            ctx.rotate(angle)
            ctx.drawImage(cache, -cacheRadius, -cacheRadius, cacheSize, cacheSize)
            ctx.restore()

            /* alpha 遮罩只减少边缘像素，星轨本体仍保持可见。
               文字区留净同样走遮罩的渐变，不做矩形硬裁。 */
            ctx.save()
            ctx.globalCompositeOperation = 'destination-in'
            ctx.drawImage(edgeMask, 0, 0, width, height)
            ctx.restore()
        }

        function frame(now) {
            if (!running || disposed) return

            const step = lastTime ? Math.min(50, now - lastTime) / 16.667 : 1

            lastTime = now
            render(now / 1000)
            /* 逆时针：屏幕 y 轴向下，角度递减即逆时针；每帧 0.0005 弧度沿用原转速（约 1.7°/s）。 */
            angle -= .0005 * step

            if (angle < 0) angle += Math.PI * 2

            raf = requestAnimationFrame(frame)
        }

        function stop() {
            running = false
            lastTime = 0
            cancelAnimationFrame(raf)
            raf = 0
        }

        function syncMotion() {
            stop()

            if (disposed) return

            /* 亮色只靠光带的 CSS 位移，画布保持静止，不再请求帧。 */
            if (sceneTheme !== 'dark') {
                render(performance.now() / 1000)
                return
            }

            if (!visible) {
                render(performance.now() / 1000)
                return
            }

            running = true
            raf = requestAnimationFrame(frame)
        }

        function rebuild() {
            if (disposed) return

            stop()

            width = window.innerWidth
            height = window.innerHeight
            dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
            canvas.width = Math.max(1, Math.round(width * dpr))
            canvas.height = Math.max(1, Math.round(height * dpr))
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

            sceneTheme = App.theme.effective() === 'dark' ? 'dark' : 'light'

            const cfg = SKY[sceneTheme]

            pivotX = cfg.center[0] * width
            pivotY = cfg.center[1] * height
            textSafe = textSafeRect()
            stars = makeStars(cfg)
            trails = makeTrails(cfg)

            const metrics = measure()

            /* 视口最远角之外的弧整条都不可见，缓存到该半径即可。 */
            cacheRadius = Math.hypot(
                Math.max(pivotX, width - pivotX),
                Math.max(pivotY, height - pivotY)
            ) + 12
            cacheSize = cacheRadius * 2

            drawTrailCache()
            buildEdgeMask()
            angle = 0
            render(performance.now() / 1000)

            canvas.__starTrailMetrics = metrics
            syncMotion()
        }

        function onResize() {
            clearTimeout(resizeTimer)
            resizeTimer = setTimeout(rebuild, 150)
        }

        function onVisibility() {
            visible = !document.hidden

            if (visible) {
                syncMotion()
            } else {
                stop()
            }
        }

        function pickSlogan() {
            const list = App.i18n.list('common.slogans')

            if (!list || !list.length) return

            slogan.innerHTML = list[Math.floor(Math.random() * list.length)]
        }

        const unsubscribeTheme = App.theme.onChange(rebuild)
        const unsubscribeI18n = App.i18n.onChange(function () {
            pickSlogan()
            rebuild()
        })

        window.addEventListener('resize', onResize)
        window.addEventListener('orientationchange', onResize)
        document.addEventListener('visibilitychange', onVisibility)

        /* 调试钩子：当前旋转角（弧度），供外部采样方向与转速。 */
        Object.defineProperty(canvas, '__starTrailAngle', {
            configurable: true,
            get: function () { return angle }
        })

        pickSlogan()
        rebuild()

        return {
            unmount() {
                disposed = true
                stop()
                clearTimeout(resizeTimer)
                resizeTimer = 0

                unsubscribeTheme()
                unsubscribeI18n()
                window.removeEventListener('resize', onResize)
                window.removeEventListener('orientationchange', onResize)
                document.removeEventListener('visibilitychange', onVisibility)

                cache.width = 0
                cache.height = 0
                edgeMask.width = 0
                edgeMask.height = 0
                canvas.width = 0
                canvas.height = 0
                stars.length = 0
                trails.length = 0
                delete canvas.__starTrailMetrics
                delete canvas.__starTrailAngle
            }
        }
    }
}
