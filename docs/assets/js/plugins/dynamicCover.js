let dynamicCoverOptions = {
    backgrounds: [
        './assets/resources/img/cover/cover-1.jpg',
        './assets/resources/img/cover/cover-2.jpg',
        './assets/resources/img/cover/cover-3.jpg',
    ]
}

function plugin(hook, vm) {
    const backgrounds = dynamicCoverOptions.backgrounds

    const numberOfImages = backgrounds.length
    const fadeMultiplier = 3
    const intervalMultiplier = 8

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
    let coverCleanup = null

    hook.doneEach(function () {
        if (coverCleanup) {
            coverCleanup()
            coverCleanup = null
        }
        if (coverTimer !== null) {
            clearInterval(coverTimer)
            coverTimer = null
        }

        const cover = document.getElementsByClassName('cover')[0]
        if (!cover) return

        const baseMs = getDurationMs('--global-transition-duration-slow', 1000)
        const fadeDurationMs = fadeMultiplier * baseMs
        const intervalMs = intervalMultiplier * baseMs

        cover.classList.add('dynamic-cover')

        const mask = cover.getElementsByClassName('mask')[0]
        if (mask) mask.style.opacity = .6

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

        const advance = function () {
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
        }

        // 只在封面可见且页面在前台时轮播
        let onScreen = false

        const startTimer = function () {
            if (coverTimer !== null) return
            coverTimer = setInterval(advance, intervalMs)
        }

        const stopTimer = function () {
            if (coverTimer === null) return
            clearInterval(coverTimer)
            coverTimer = null
        }

        const sync = function () {
            if (onScreen && !document.hidden) startTimer()
            else stopTimer()
        }

        const onVisibilityChange = function () {
            sync()
        }

        document.addEventListener('visibilitychange', onVisibilityChange)

        let observer = null
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(function (entries) {
                onScreen = entries.some(entry => entry.isIntersecting)
                sync()
            }, { threshold: 0 })
            observer.observe(cover)
        }
        else {
            onScreen = true
        }

        onScreen = cover.getBoundingClientRect().bottom > 0
        sync()

        coverCleanup = function () {
            stopTimer()
            document.removeEventListener('visibilitychange', onVisibilityChange)
            if (observer) observer.disconnect()
        }
    })
}

window.$docsify['dynamicCover'] = Object.assign(
    dynamicCoverOptions,
    window.$docsify['dynamicCover']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
