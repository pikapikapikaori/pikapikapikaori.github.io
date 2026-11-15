import {
    addClass,
    createElement,
    getData,
    on,
    query,
    queryAll,
    setData,
    tags,
} from '../utils/dom.js'

let controller = null

function petalSelector(className) {
    return String(className)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(name => `.${name}`)
        .join('')
}

export function Sakura(selector, options = {}) {
    let _this = this

    if (typeof selector === 'undefined') {
        throw new Error('No selector present. Define an element.')
    }

    this.el = query(selector)

    let defaults = {
        className: 'sakura',
        fallSpeed: 1,
        maxSize: 14,
        minSize: 10,
        delay: 1000,
        autoStart: true,
        colors: [{
            gradientColorStart: 'rgba(255, 183, 197, 0.9)',
            gradientColorEnd: 'rgba(255, 197, 208, 0.9)',
            gradientColorDegree: 120,
        },],
    }

    let extend = function extend(originalObj, newObj) {
        Object.keys(originalObj).forEach(function (key) {
            if (newObj && Object.prototype.hasOwnProperty.call(newObj, key)) {
                let origin = originalObj

                origin[key] = newObj[key]
            }
        })

        return originalObj
    }

    this.settings = extend(defaults, options)

    this.running = false
    this.petalFrame = null
    this.petalTimeout = null
    this.cleanupTimeout = null

    this.el.style.overflowX = 'hidden'

    function randomArrayElem(arr) {
        return arr[Math.floor(Math.random() * arr.length)]
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    let prefixes = ['webkit', 'moz', 'MS', 'o', '',]

    function PrefixedEvent(element, type, callback) {
        for (let p = 0; p < prefixes.length; p += 1) {
            let animType = type

            if (!prefixes[p]) {
                animType = type.toLowerCase()
            }

            on(element, prefixes[p] + animType, callback, false)
        }
    }

    function elementInViewport(el) {
        let rect = el.getBoundingClientRect()

        return rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    }

    // The animation names and the petal class name must match docs/assets/css/components/sakuraRain.css.
    this.createPetal = function () {
        _this.petalFrame = null

        if (!_this.running) return

        let animationNames = {
            blowAnimations: ['blow-soft-left', 'blow-medium-left', 'blow-soft-right', 'blow-medium-right',],
            swayAnimations: ['sway-0', 'sway-1', 'sway-2', 'sway-3', 'sway-4', 'sway-5', 'sway-6', 'sway-7', 'sway-8',],
        }

        let blowAnimation = randomArrayElem(animationNames.blowAnimations)
        let swayAnimation = randomArrayElem(animationNames.swayAnimations)

        let fallTime = (document.documentElement.clientHeight * 0.007 + Math.round(Math.random() * 5)) * _this.settings.fallSpeed

        let animationsArr = ['fall '.concat(fallTime, 's linear 0s 1'), ''.concat(blowAnimation, ' ').concat((fallTime > 30 ? fallTime : 30) - 20 + randomInt(0, 20), 's linear 0s infinite'), ''.concat(swayAnimation, ' ').concat(randomInt(2, 4), 's linear 0s infinite'),]
        let animations = animationsArr.join(', ')

        let petal = createElement(tags.div)

        addClass(petal, _this.settings.className)

        let height = randomInt(_this.settings.minSize, _this.settings.maxSize)
        let width = height - Math.floor(randomInt(0, _this.settings.minSize) / 3)
        let color = randomArrayElem(_this.settings.colors)

        petal.style.background = 'linear-gradient('.concat(color.gradientColorDegree, 'deg, ').concat(color.gradientColorStart, ', ').concat(color.gradientColorEnd, ')')
        petal.style.animation = animations
        petal.style.borderRadius = ''.concat(randomInt(_this.settings.maxSize, _this.settings.maxSize + Math.floor(Math.random() * 10)), 'px ').concat(randomInt(1, Math.floor(width / 4)), 'px')
        petal.style.height = ''.concat(height, 'px')
        petal.style.left = ''.concat(Math.random() * document.documentElement.clientWidth - 100, 'px')
        petal.style.marginTop = ''.concat(-(Math.floor(Math.random() * 20) + 15), 'px')
        petal.style.width = ''.concat(width, 'px')

        PrefixedEvent(petal, 'AnimationEnd', function () {
            petal.remove()
        })

        PrefixedEvent(petal, 'AnimationIteration', function () {
            if (!elementInViewport(petal)) {
                petal.remove()
            }
        })

        _this.el.appendChild(petal)

        if (!_this.running) return

        // Keep the pending timer so stop and destroy can cancel the next petal.
        _this.petalTimeout = window.setTimeout(function () {
            _this.petalTimeout = null

            if (!_this.running) return

            _this.petalFrame = window.requestAnimationFrame(_this.createPetal)
            setData(_this.el, 'sakuraAnimId', _this.petalFrame)
        }, _this.settings.delay)
    }

    if (this.settings.autoStart) this.start()
}

Sakura.prototype.start = function () {
    if (this.running) return

    if (this.cleanupTimeout !== null) {
        window.clearTimeout(this.cleanupTimeout)
        this.cleanupTimeout = null
    }

    this.running = true
    this.petalFrame = window.requestAnimationFrame(this.createPetal)
    setData(this.el, 'sakuraAnimId', this.petalFrame)
}

Sakura.prototype.stop = function () {
    let _this2 = this

    let graceful = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false

    this.running = false

    if (this.petalTimeout !== null) {
        window.clearTimeout(this.petalTimeout)
        this.petalTimeout = null
    }

    if (this.petalFrame !== null) {
        window.cancelAnimationFrame(this.petalFrame)
        this.petalFrame = null
    }

    let animId = getData(this.el, 'sakuraAnimId')

    if (animId) window.cancelAnimationFrame(animId)

    setData(this.el, 'sakuraAnimId', '')

    if (this.cleanupTimeout !== null) {
        window.clearTimeout(this.cleanupTimeout)
        this.cleanupTimeout = null
    }

    // Graceful mode only stops new petals; the existing ones finish their animation.
    if (!graceful) {
        this.cleanupTimeout = window.setTimeout(function () {
            _this2.cleanupTimeout = null

            queryAll(petalSelector(_this2.settings.className)).forEach(petal => petal.remove())
        }, this.settings.delay + 50)
    }
}

Sakura.prototype.isRunning = function () {
    return this.running
}

Sakura.prototype.toggle = function (force) {
    const next = typeof force === 'boolean' ? force : !this.isRunning()

    if (next) this.start()
    else this.stop()

    return this.isRunning()
}

Sakura.prototype.destroy = function () {
    this.running = false

    if (this.petalTimeout !== null) {
        window.clearTimeout(this.petalTimeout)
        this.petalTimeout = null
    }

    if (this.petalFrame !== null) {
        window.cancelAnimationFrame(this.petalFrame)
        this.petalFrame = null
    }

    if (this.cleanupTimeout !== null) {
        window.clearTimeout(this.cleanupTimeout)
        this.cleanupTimeout = null
    }

    let animId = getData(this.el, 'sakuraAnimId')

    if (animId) window.cancelAnimationFrame(animId)

    setData(this.el, 'sakuraAnimId', '')

    queryAll(petalSelector(this.settings.className), this.el).forEach(petal => petal.remove())
}

export function createSakura(options = {}) {
    if (controller) return controller

    const settings = Object.assign({ autoStart: false }, options)

    const sakura = new Sakura('body', settings)

    controller = {
        start() {
            return sakura.start()
        },
        stop(graceful = true) {
            return sakura.stop(graceful)
        },
        isRunning() {
            return sakura.isRunning()
        },
        toggle(force) {
            const next = typeof force === 'boolean' ? force : !sakura.isRunning()

            if (next) sakura.start()
            else sakura.stop(true)

            return sakura.isRunning()
        },
        destroy() {
            sakura.destroy()
            controller = null
        }
    }

    return controller
}
