import {
    addClass,
    byId,
    createElement,
    eventNames,
    hasClass,
    on,
    removeClass,
    tags,
} from '../utils/dom.js'

const canvasId = 'canvas'

const hitAreaId = 'live2d-hit-area'

const hiddenClass = 'canvas-hide'

const cookieName = 'live2d'

const cookieMaxAge = 24 * 60 * 60

let controller = null

export function createLive2d(models = []) {
    if (controller) return controller

    controller = createController(models)

    return controller
}

function createController(models) {
    const cleanups = []

    let app = null
    let canvas = null
    let config = null
    let hitArea = null
    let areaRect = {}
    let model = null
    let motionIndex = []
    let onScreen = false
    let suppressTap = false
    let visibilityObserver = null
    let startPromise = null
    let ready = null
    let resolveReady = null

    function resetReady() {
        ready = new Promise(resolve => {
            resolveReady = resolve
        })
    }

    resetReady()

    function settleReady(value) {
        if (!resolveReady) return

        const resolve = resolveReady

        resolveReady = null
        resolve(value)
    }

    function teardown() {
        cleanups.forEach(cleanup => cleanup())
        cleanups.length = 0

        if (visibilityObserver) {
            visibilityObserver.disconnect()
            visibilityObserver = null
        }

        if (hitArea) {
            hitArea.remove()
            hitArea = null
        }

        if (app) {
            app.destroy(false, { children: true })
            app = null
        }

        if (canvas) {
            canvas.remove()
            canvas = null
        }

        model = null
        config = null
        motionIndex = []
        areaRect = {}
        onScreen = false
        suppressTap = false
    }

    function listen(target, type, handler, options) {
        cleanups.push(on(target, type, handler, options))
    }

    function setRunning(running) {
        const tickers = [app && app.ticker, window.PIXI && PIXI.Ticker && PIXI.Ticker.shared]

        tickers.forEach(function (ticker) {
            if (!ticker) return

            if (running) {
                if (!ticker.started) ticker.start()
            }
            else if (ticker.started) {
                ticker.stop()
            }
        })

        if (model) model.autoUpdate = running
    }

    // Rendering stops while the canvas is hidden or off screen; one frame is kept so the canvas is not blank.
    function syncVisibility() {
        const hidden = !canvas || hasClass(canvas, hiddenClass)
        const running = !hidden && onScreen && !document.hidden

        setRunning(running)

        if (!running && app && app.render) app.render()
    }

    function watchVisibility() {
        listen(document, 'visibilitychange', syncVisibility)

        if ('IntersectionObserver' in window) {
            visibilityObserver = new IntersectionObserver(function (entries) {
                onScreen = entries.some(entry => entry.isIntersecting)
                syncVisibility()
            }, { threshold: 0 })
            visibilityObserver.observe(canvas)
        }
        else {
            onScreen = true
        }

        onScreen = canvas.getBoundingClientRect().bottom > 0
        syncVisibility()
    }

    function createCanvas() {
        canvas = createElement(tags.canvas, { attrs: { id: canvasId } })
        document.body.appendChild(canvas)

        canvas.style.position = 'fixed'
        canvas.style.zIndex = 99999
        canvas.style.pointerEvents = 'none'

        if (config.left) canvas.style.left = config.left
        if (config.right) canvas.style.right = config.right
        if (config.top) canvas.style.top = config.top
        else if (config.bottom) canvas.style.bottom = config.bottom
        else canvas.style.bottom = 0
        if (config.opacity) canvas.style.opacity = config.opacity

        if (config.background) {
            canvas.style.background = 'url(' + config.background + ')'
            canvas.style.backgroundSize = 'cover'
        }
    }

    function syncHitArea() {
        if (!hitArea) return

        const rect = canvas.getBoundingClientRect()
        const box = config.hitArea
        const detached =
            getComputedStyle(canvas).display === 'none' ||
            hasClass(canvas, hiddenClass) ||
            rect.width === 0 ||
            rect.right <= 0 || rect.left >= innerWidth ||
            rect.bottom <= 0 || rect.top >= innerHeight

        const next = detached
            ? { display: 'none' }
            : {
                display: 'block',
                left: rect.left + box.x + 'px',
                top: rect.top + box.y + 'px',
                width: box.w + 'px',
                height: box.h + 'px',
            }
        const prev = areaRect

        if (Object.keys(next).every(key => prev[key] === next[key])) return

        areaRect = next
        Object.assign(hitArea.style, next)
    }

    function enableDrag(area) {
        const dragThreshold = 4

        let dragging = false
        let moved = false
        let startX = 0
        let startY = 0
        let originLeft = 0
        let originTop = 0

        area.style.cursor = 'grab'

        listen(area, eventNames.pointerdown, (event) => {
            if (event.button !== 0) return

            const rect = canvas.getBoundingClientRect()

            canvas.style.left = rect.left + 'px'
            canvas.style.top = rect.top + 'px'
            canvas.style.right = 'auto'
            canvas.style.bottom = 'auto'

            dragging = true
            moved = false
            startX = event.clientX
            startY = event.clientY
            originLeft = rect.left
            originTop = rect.top

            try {
                area.setPointerCapture(event.pointerId)
            }
            catch {
            }

            area.style.cursor = 'grabbing'
            event.preventDefault()
        })

        listen(area, 'pointermove', (event) => {
            if (!dragging) return

            const dx = event.clientX - startX
            const dy = event.clientY - startY

            if (!moved && Math.abs(dx) + Math.abs(dy) > dragThreshold) moved = true

            const rect = canvas.getBoundingClientRect()
            const left = Math.min(Math.max(originLeft + dx, 0), Math.max(innerWidth - rect.width, 0))
            const top = Math.min(Math.max(originTop + dy, 0), Math.max(innerHeight - rect.height, 0))

            canvas.style.left = left + 'px'
            canvas.style.top = top + 'px'
            syncHitArea()
        })

        function stopDrag(event) {
            if (!dragging) return

            dragging = false
            area.style.cursor = 'grab'

            if (area.hasPointerCapture(event.pointerId)) area.releasePointerCapture(event.pointerId)

            suppressTap = moved
        }

        listen(area, eventNames.pointerup, stopDrag)
        listen(area, eventNames.pointercancel, stopDrag)
    }

    function createHitArea() {
        if (!config.hitArea) return

        const area = createElement(tags.div, { attrs: { id: hitAreaId } })

        Object.assign(area.style, {
            position: 'fixed',
            zIndex: 50,
            pointerEvents: 'auto',
            background: 'transparent',
            touchAction: 'none',
            cursor: config.cursor || 'default',
        })
        document.body.appendChild(area)

        hitArea = area
        syncHitArea()

        listen(window, eventNames.resize, syncHitArea)

        const mutationObserver = new MutationObserver(() => syncHitArea())

        mutationObserver.observe(canvas, { attributes: true, attributeFilter: ['class'] })
        cleanups.push(() => mutationObserver.disconnect())

        app.ticker.add(() => syncHitArea())

        if (config.draggable === true) enableDrag(area)

        listen(area, eventNames.click, (event) => {
            if (suppressTap) {
                suppressTap = false
                return
            }

            const rect = canvas.getBoundingClientRect()

            tap(event.clientX - rect.left, event.clientY - rect.top)
        })
    }

    function initMotionIndex() {
        let index = []

        const definitions = model.internalModel.motionManager.definitions['']

        if (definitions) {
            definitions.forEach((value, position) => {
                const file = model.internalModel.motionManager.getMotionFile(value)

                if (file.match('touch_head') != null) index[0] = position
                else if (file.match('touch_special') != null) index[1] = position
                else if (file.match('touch_body') != null) index[2] = position
            })
        }

        return index
    }

    function addListener() {
        if (config.hitArea) return

        listen(document, eventNames.click, (event) => {
            const rect = app.view.getBoundingClientRect()

            tap(event.clientX - rect.left, event.clientY - rect.top)
        })
    }

    function tap(offsetX, offsetY) {
        const rect = app.view.getBoundingClientRect()

        if (
            0 < offsetX &&
            offsetX < rect.width &&
            0 < offsetY &&
            offsetY < rect.height
        ) {
            let po = model.toModelPosition(new PIXI.Point(offsetX, offsetY)),
                hitAreas,
                ifRandom

            if (Object.keys(model.internalModel.hitAreas).length == 0) {
                hitAreas = hitTest(po.x, po.y)

                if (hitAreas.includes('TouchHead')) {
                    model.internalModel.motionManager.startMotion('', motionIndex[0])
                }
                else if (hitAreas.includes('TouchSpecial')) {
                    model.internalModel.motionManager.startMotion('', motionIndex[1])
                }
                else if (hitAreas.includes('TouchBody')) {
                    model.internalModel.motionManager.startMotion('', motionIndex[2])
                }
                else ifRandom = true
            }
            else {
                hitAreas = model.internalModel.hitTest(po.x, po.y)

                if (hitAreas.includes('head') || hitAreas.includes('Head')) {
                    model.expression()
                    model.motion('Tap')
                }
                else if (hitAreas.includes('body') || hitAreas.includes('Body')) {
                    model.motion('tap_body')
                    model.motion('Tap')
                }
                else ifRandom = true
            }

            if (ifRandom === true) {
                let keys = Object.keys(model.internalModel.motionManager.motionGroups)

                model.internalModel.motionManager.startRandomMotion(
                    keys[Math.floor(Math.random() * keys.length)]
                )
            }
        }
    }

    function hitTest(poX, poY) {
        const hitAreas = [];

        ['TouchHead', 'TouchSpecial', 'TouchBody',].forEach((id) => {
            const bounds = model.internalModel.getDrawableBounds(id)
            const inside =
                bounds.x < poX &&
                poX < bounds.x + bounds.width &&
                bounds.y < poY &&
                poY < bounds.y + bounds.height

            if (inside) hitAreas.push(id)
        })

        return hitAreas
    }

    function getLive2dIndex() {
        function setCookie(value) {
            const d = new Date()

            d.setTime(d.getTime() + cookieMaxAge * 1000)
            document.cookie = cookieName + '=' + value + ';expires=' + d.toUTCString() + ';path=/'
        }

        function getCookie() {
            const name = cookieName + '='
            const parts = document.cookie.split(';')

            for (let i = 0; i < parts.length; i++) {
                let part = parts[i]

                while (part.charAt(0) == ' ') part = part.substring(1)

                if (part.indexOf(name) == 0) return part.substring(name.length, part.length)
            }

            return ''
        }

        const cookie = getCookie()
        const index =
            cookie != '' && cookie >= 0 && cookie < models.length
                ? cookie
                : Math.floor(Math.random() * models.length)

        if (cookie != index) setCookie(index)

        return index
    }

    async function load() {
        config = models[getLive2dIndex()]

        if (!config) return false

        createCanvas()

        // PIXI is provided by the classic Cubism scripts in docs/index.html.
        const live2d = PIXI.live2d

        app = new PIXI.Application({
            view: byId(canvasId),
            width: config.width || 800,
            height: config.height || 600,
            transparent: true,
            antialias: true,
            autoStart: true,
        })

        model = await live2d.Live2DModel.from(config.role)
        app.stage.addChild(model)
        model.position.set(
            canvas.style.width * 0.5 + (config.offsetX || 0),
            canvas.style.height * 0.5 + (config.offsetY || 0)
        )
        model.scale.set(config.scale || 0.1)

        motionIndex = initMotionIndex()

        addListener()
        createHitArea()
        watchVisibility()

        return true
    }

    function start() {
        if (startPromise) return startPromise

        // A partial attempt leaves no canvas behind, so a later start can retry.
        if (canvas && !model) teardown()

        if (canvas && model) {
            removeClass(canvas, hiddenClass)
            syncVisibility()

            return Promise.resolve(true)
        }

        // A failed attempt leaves a settled ready promise; recreate it for the retry.
        if (!resolveReady) resetReady()

        startPromise = load()
            .catch(() => {
                teardown()

                return false
            })
            .then((started) => {
                startPromise = null
                settleReady(started)

                return started
            })

        return startPromise
    }

    function stop() {
        if (!canvas) return

        addClass(canvas, hiddenClass)
        syncVisibility()
    }

    function isRunning() {
        return Boolean(canvas && model && !hasClass(canvas, hiddenClass))
    }

    function toggle(force) {
        const next = typeof force === 'boolean' ? force : !isRunning()

        if (!next) {
            stop()

            return Promise.resolve(false)
        }

        return start()
    }

    function setVisible(next) {
        if (next) start()
        else stop()
    }

    function destroy() {
        teardown()
        settleReady(false)
        controller = null
    }

    return {
        start,
        stop,
        setVisible,
        toggle,
        isRunning,
        destroy,
        get ready() {
            return ready
        },
    }
}
