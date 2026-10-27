let live2d = PIXI.live2d
class Live2dLoader {
    constructor(models) {
        let config = models[this.getLive2dIndex(models)]
        if (!config.mobile && this.isMobile()) return
        this.load(config)
    }

    getLive2dIndex(models) {
        function setCookie(cname, cvalue, exseconds) {
            const d = new Date()
            d.setTime(d.getTime() + exseconds * 1000)
            let expires = 'expires=' + d.toUTCString()
            document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/'
        }

        function getCookie(cname) {
            let name = cname + '='
            let ca = document.cookie.split(';')
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i]
                while (c.charAt(0) == ' ') {
                    c = c.substring(1)
                }
                if (c.indexOf(name) == 0) {
                    return c.substring(name.length, c.length)
                }
            }
            return ''
        }

        let cookie = getCookie('live2d')
        let index =
            cookie != '' && cookie >= 0 && cookie < models.length
                ? cookie
                : Math.floor(Math.random() * models.length)
        if (cookie != index) setCookie('live2d', index, 24 * 60 * 60)
        return index
    }

    isMobile() {
        var WIN = window
        var LOC = WIN['location']
        var NA = WIN.navigator
        var UA = NA.userAgent.toLowerCase()

        function test(needle) {
            return needle.test(UA)
        }
        var IsAndroid = test(/android|htc/) || /linux/i.test(NA.platform + '')
        var IsIPhone = !IsAndroid && test(/ipod|iphone/)
        var IsWinPhone = test(/windows phone/)

        var device = {
            IsAndroid: IsAndroid,
            IsIPhone: IsIPhone,
            IsWinPhone: IsWinPhone,
        }
        var documentElement = WIN.document.documentElement
        for (var i in device) {
            if (device[i]) {
                documentElement.className += ' ' + i.replace('Is', '').toLowerCase()
            }
        }
        return device.IsAndroid || device.IsIPhone || device.IsWinPhone
    }

    async load(config) {
        let canvas = document.createElement('canvas')
        canvas.id = 'canvas'
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

        this.app = new PIXI.Application({
            view: document.getElementById('canvas'),
            width: config.width || 800,
            height: config.height || 600,
            transparent: true,
            antialias: true, // 抗锯齿
            autoStart: true,
        })
        this.model = await live2d.Live2DModel.from(config.role)
        this.app.stage.addChild(this.model)
        this.model.position.set(
            canvas.style.width * 0.5 + (config.offsetX || 0),
            canvas.style.height * 0.5 + (config.offsetY || 0)
        )
        this.model.scale.set(config.scale || 0.1)
        this.config = config
        this.motionIndex = this.initMotionIndex()
        this.addListener(config, canvas, this.motionIndex)
        this.createHitArea(config, canvas)
    }

    createHitArea(config, canvas) {
        if (!config.hitArea) return
        const area = document.createElement('div')
        area.id = 'live2d-hit-area'
        area.setAttribute('aria-hidden', 'true')
        Object.assign(area.style, {
            position: 'fixed',
            zIndex: 50,
            pointerEvents: 'auto',
            background: 'transparent',
            touchAction: 'none',
            cursor: config.cursor || 'default',
        })
        document.body.appendChild(area)
        this.hitArea = area
        this.syncHitArea()
        addEventListener('resize', () => this.syncHitArea())
        new MutationObserver(() => this.syncHitArea())
            .observe(canvas, { attributes: true, attributeFilter: ['class'] })
        this.app.ticker.add(() => this.syncHitArea())
        if (config.draggable === true) this.enableDrag(area, canvas)
        area.addEventListener('click', (event) => {
            if (this._suppressTap) {
                this._suppressTap = false
                return
            }
            const rect = canvas.getBoundingClientRect()
            this.tap(event.clientX - rect.left, event.clientY - rect.top, this.motionIndex)
        })
    }

    enableDrag(area, canvas) {
        const LIMIT = 4
        let dragging = false
        let moved = false
        let startX = 0
        let startY = 0
        let originLeft = 0
        let originTop = 0

        area.style.cursor = 'grab'

        area.addEventListener('pointerdown', (event) => {
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
            } catch (e) {
            }
            area.style.cursor = 'grabbing'
            event.preventDefault()
        })

        area.addEventListener('pointermove', (event) => {
            if (!dragging) return
            const dx = event.clientX - startX
            const dy = event.clientY - startY
            if (!moved && Math.abs(dx) + Math.abs(dy) > LIMIT) moved = true
            const rect = canvas.getBoundingClientRect()
            const left = Math.min(Math.max(originLeft + dx, 0), Math.max(innerWidth - rect.width, 0))
            const top = Math.min(Math.max(originTop + dy, 0), Math.max(innerHeight - rect.height, 0))
            canvas.style.left = left + 'px'
            canvas.style.top = top + 'px'
            this.syncHitArea()
        })

        const stop = (event) => {
            if (!dragging) return
            dragging = false
            area.style.cursor = 'grab'
            if (area.hasPointerCapture(event.pointerId)) area.releasePointerCapture(event.pointerId)
            this._suppressTap = moved
        }

        area.addEventListener('pointerup', stop)
        area.addEventListener('pointercancel', stop)
    }

    syncHitArea() {
        const area = this.hitArea
        if (!area) return
        const canvas = this.app.view
        const rect = canvas.getBoundingClientRect()
        const box = this.config.hitArea
        const detached =
            getComputedStyle(canvas).display === 'none' ||
            canvas.classList.contains('canvas-hide') ||
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
        const prev = this._areaRect || {}
        if (Object.keys(next).every((k) => prev[k] === next[k])) return
        this._areaRect = next
        Object.assign(area.style, next)
    }

    initMotionIndex() {
        let motionIndex = [],
            definitions = this.model.internalModel.motionManager.definitions['']
        if (definitions)
            definitions.forEach((value, index) => {
                let file = this.model.internalModel.motionManager.getMotionFile(value)
                if (file.match('touch_head') != null) motionIndex[0] = index
                else if (file.match('touch_special') != null) motionIndex[1] = index
                else if (file.match('touch_body') != null) motionIndex[2] = index
            })
        return motionIndex
    }

    addListener(config, canvas, motionIndex) {
        if (config.hitArea) return
        document.addEventListener('click', (event) => {
            const rect = this.app.view.getBoundingClientRect()
            this.tap(event.clientX - rect.left, event.clientY - rect.top, motionIndex)
        })
    }

    tap(offsetX, offsetY, motionIndex) {
        const rect = this.app.view.getBoundingClientRect()
        if (
            0 < offsetX &&
            offsetX < rect.width &&
            0 < offsetY &&
            offsetY < rect.height
        ) {
            let po = this.model.toModelPosition(new PIXI.Point(offsetX, offsetY)),
                hitAreas,
                ifRandom

            if (Object.keys(this.model.internalModel.hitAreas).length == 0) {
                hitAreas = this.hitTest(po.x, po.y)
                if (hitAreas.includes('TouchHead')) {
                    this.model.internalModel.motionManager.startMotion(
                        '',
                        motionIndex[0]
                    )
                } else if (hitAreas.includes('TouchSpecial')) {
                    this.model.internalModel.motionManager.startMotion(
                        '',
                        motionIndex[1]
                    )
                } else if (hitAreas.includes('TouchBody')) {
                    this.model.internalModel.motionManager.startMotion(
                        '',
                        motionIndex[2]
                    )
                } else ifRandom = true
            } else {
                hitAreas = this.model.internalModel.hitTest(po.x, po.y)
                if (hitAreas.includes('head') || hitAreas.includes('Head')) {
                    this.model.expression()
                    this.model.motion('Tap')
                } else if (hitAreas.includes('body') || hitAreas.includes('Body')) {
                    this.model.motion('tap_body')
                    this.model.motion('Tap')
                } else ifRandom = true
            }

            if (ifRandom === true) {
                let keys = Object.keys(
                    this.model.internalModel.motionManager.motionGroups
                )
                this.model.internalModel.motionManager.startRandomMotion(
                    keys[Math.floor(Math.random() * keys.length)]
                )
            }
        }
    }

    hitTest(poX, poY) {
        let hitAreas = [];
        ['TouchHead', 'TouchSpecial', 'TouchBody',].forEach((id) => {
            let bounds = this.model.internalModel.getDrawableBounds(id)
            let b =
                bounds.x < poX &&
                poX < bounds.x + bounds.width &&
                bounds.y < poY &&
                poY < bounds.y + bounds.height
            if (b) {
                hitAreas.push(id)
            }
        })
        return hitAreas
    }
}
