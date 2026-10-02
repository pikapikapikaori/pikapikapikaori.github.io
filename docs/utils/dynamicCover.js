function plugin(hook, vm) {
    const backgrounds = [
        '_media/coverBackgrounds/cover-1.jpg',
        '_media/coverBackgrounds/cover-2.jpg',
        '_media/coverBackgrounds/cover-3.jpg',
    ]

    const numberOfImages = backgrounds.length
    const fadeMultiplier = 3   // 淡入淡出 = 3 个基准单位
    const intervalMultiplier = 8   // 轮播间隔 = 8 个基准单位

    // 从 CSS 变量读取时长并解析成毫秒
    function getDurationMs(varName, fallbackMs) {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim()
        if (!raw) return fallbackMs
        const num = parseFloat(raw)
        if (Number.isNaN(num)) return fallbackMs
        if (raw.endsWith('ms')) return num
        if (raw.endsWith('s')) return num * 1000
        return fallbackMs
    }

    let coverTimer = null

    hook.doneEach(function () {
        // 清理上一次的定时器
        if (coverTimer !== null) {
            clearInterval(coverTimer)
            coverTimer = null
        }

        const cover = document.getElementsByClassName('cover')[0]
        if (!cover) return

        // 从 CSS 变量读取基准时长
        const baseMs = getDurationMs('--global-transition-duration-slow', 1000)
        const fadeDurationMs = fadeMultiplier * baseMs
        const intervalMs = intervalMultiplier * baseMs

        cover.classList.add('dynamic-cover')

        const mask = cover.getElementsByClassName('mask')[0]
        if (mask) mask.style.opacity = .6

        // 预加载图片
        const coverBackgrounds = backgrounds.map(src => {
            const img = new Image()
            img.src = src
            return img
        })

        cover.style.backgroundImage = 'none'

        if (getComputedStyle(cover).position === 'static') {
            cover.style.position = 'relative'
        }
        cover.style.isolation = 'isolate'

        cover.querySelectorAll('.cover-fade-layer').forEach(el => el.remove())

        const layerA = document.createElement('div')
        const layerB = document.createElement('div')

        for (const layer of [layerA, layerB]) {
            layer.className = 'cover-fade-layer'
            Object.assign(layer.style, {
                position: 'absolute',
                top: '0',
                right: '0',
                bottom: '0',
                left: '0',
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                opacity: '0',
                zIndex: '-1',
                pointerEvents: 'none',
            })
            cover.appendChild(layer)
        }

        layerA.style.backgroundImage = `url(${coverBackgrounds[0].src})`
        layerA.style.opacity = '1'

        requestAnimationFrame(() => {
            const fadeStyle = `opacity ${fadeDurationMs}ms ease-in-out`
            layerA.style.transition = fadeStyle
            layerB.style.transition = fadeStyle
        })

        let curImgId = 1
        let useA = false

        coverTimer = setInterval(function () {
            const next = coverBackgrounds[curImgId]

            if (useA) {
                layerA.style.backgroundImage = `url(${next.src})`
                layerA.style.opacity = '1'
                layerB.style.opacity = '0'
            } else {
                layerB.style.backgroundImage = `url(${next.src})`
                layerB.style.opacity = '1'
                layerA.style.opacity = '0'
            }

            useA = !useA
            curImgId = (curImgId + 1) % numberOfImages
        }, intervalMs)
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
