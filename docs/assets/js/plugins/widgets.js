import { lockNoTransition, unlockNoTransition, hexToHsl, hslToHex, makeButtonLike, isEnabled } from '../utils/common.js'
import { bindShortcuts } from '../utils/shortcut.js'
import { createStorage } from '../utils/storage.js'
import { mediaQueries, elementStatus, storagePrefix } from '../utils/constants.js'
import { arrow, nature, article, object, person } from '../utils/icons.js'
import {
    onListen,
    offListen,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    createEl,
    getEl,
    getAllEls,
    getElById,
    getElByClass,
    setCssVar,
    setStyleProperty,
    removeStyleProperty,
    setAttrs,
    getData,
    setData
} from '../utils/dom.js'
import { imageViewerOpenClass } from './viewFullImage.js'
import { createLive2d } from '../components/live2d.js'
import { createSakura } from '../components/sakura.js'

let widgetsOptions = {
    enable: false,
    useSwitchMode: true,
    top: 0,
    topOffset: 500,
    defaultTheme: '',
    storage: 'local',
    live2d: [
        {
            width: 300,
            height: 300,
            right: '50px',
            bottom: '0px',
            offsetX: -60,
            offsetY: 0,
            role: './assets/resources/live2d/rice_pro_en/runtime/rice_pro_t03.model3.json',
            background: '',
            opacity: 1,
            draggable: false,
            hitArea: { x: 190, y: 30, w: 110, h: 270 }
        }
    ],
    themes: [
        {
            name: 'default',
            css: './assets/css/theme/default'
        },
        {
            name: 'kraft',
            css: './assets/css/theme/kraft'
        },
        {
            name: 'kirby',
            css: './assets/css/theme/kirby'
        },
        {
            name: 'calligraphy',
            css: './assets/css/theme/calligraphy'
        }
    ]
}

const popupHiddenClass = 'page-right-popups-disappear'
const popupPanelClass = 'page-right-popups-div'
const modes = ['auto', 'light', 'dark']
const fontSizeLevels = [14, 16, 18, 20, 22]
const hslFixed = { s: 66, l: 78 }
const storageKey = storagePrefix + 'widgets'
const popupNames = ['theme', 'color', 'font']
const themeSheetWaitMs = 3000
const themeSheetPollMs = 16
const themeModuleTimeoutMs = 5000
const themeModuleRetryCount = 1
const themeMaxRevert = 1

export const widgetsContainerId = 'page-right-widgets-container'
export const widgetsRowClass = 'widgets-row'
export const widgetItemClass = 'page-right-tools-widgets-span'
export const widgetPopupClass = 'page-right-popups'
export const widgetHiddenClass = 'page-right-tools-widgets-span-disappear'
export const progressWidgetId = 'progress-span'

class Widget {
    constructor(options = {}) {
        this.id = options.id || ''
        this.className = options.className || ''
        this.icon = options.icon || ''
        this.occupiesSlot = options.occupiesSlot !== false
        this.collapsible = Boolean(options.collapsible)
        this.active = Boolean(options.active)
        this.element = null
        this.activateHandler = null
        this.unbindClick = null
    }

    mount(container) {
        if (!this.element) {
            const element = createEl('span', {
                className: widgetItemClass,
                attrs: { id: this.id },
                html: this.icon || undefined
            })

            addClass(element, this.className)
            if (this.active) addClass(element, elementStatus.isActive)

            this.unbindClick = onListen(element, 'click', event => {
                if (!this.activateHandler) return

                this.activateHandler(event)
            })

            makeButtonLike(element)
            this.element = element
        }

        container.appendChild(this.element)

        return this.element
    }

    setIndex(index) {
        if (!this.element) return

        setCssVar('--widgets-index', String(index), this.element)
    }

    setActive(value) {
        if (!this.element) return

        toggleClass(this.element, elementStatus.isActive, Boolean(value))
    }

    setHidden(value) {
        if (!this.element) return

        toggleClass(this.element, widgetHiddenClass, Boolean(value))
        this.element.inert = Boolean(value)
    }

    setDisabled(value) {
        if (!this.element) return

        toggleClass(this.element, elementStatus.isDisabled, Boolean(value))
        setAttrs(this.element, { 'aria-disabled': String(Boolean(value)) })
    }

    onActivate(handler) {
        this.activateHandler = handler
    }

    click() {
        if (this.element) this.element.click()
    }

    destroy() {
        if (this.unbindClick) {
            this.unbindClick()
            this.unbindClick = null
        }

        this.activateHandler = null

        if (!this.element) return

        this.element.remove()
        this.element = null
    }
}

class WidgetPopup {
    constructor(options = {}) {
        this.name = options.name || ''
        this.id = options.id || ''
        this.className = options.className || ''
        this.panelId = options.panelId || ''
        this.panelClassName = options.panelClassName || ''
        this.owner = options.owner || null
        this.render = options.render || null
        this.element = null
        this.panel = null
    }

    mount(container) {
        if (!this.element) {
            const element = createEl('span', { className: widgetPopupClass, attrs: { id: this.id } })
            addClass(element, this.className)

            const panel = createEl('div', { className: popupPanelClass, attrs: { id: this.panelId } })
            addClass(panel, this.panelClassName)

            if (this.render) this.render(panel, this)
            element.appendChild(panel)

            this.element = element
            this.panel = panel
        }

        const ownerElement = this.owner && this.owner.element

        if (ownerElement && ownerElement.parentNode === container) {
            container.insertBefore(this.element, ownerElement.nextSibling)
        }
        else {
            container.appendChild(this.element)
        }

        this.close()

        return this.element
    }

    setIndex(index) {
        if (!this.element) return

        setCssVar('--widgets-index', String(index), this.element)
    }

    open() {
        if (!this.element) return

        removeClass(this.element, popupHiddenClass)
        this.element.inert = false

        if (this.owner) this.owner.setActive(true)
    }

    close() {
        if (!this.element) return

        addClass(this.element, popupHiddenClass)
        this.element.inert = true

        if (this.owner) this.owner.setActive(false)
    }

    toggle(force) {
        const next = typeof force === 'boolean' ? force : !this.isOpen()

        if (next) this.open()
        else this.close()
    }

    isOpen() {
        return Boolean(this.element) && !hasClass(this.element, popupHiddenClass)
    }

    destroy() {
        if (!this.element) return

        this.element.remove()
        this.element = null
        this.panel = null
    }
}

class PopupManager {
    constructor() {
        this.popups = new Map()
        this.listeners = []
    }

    register(name, popup) {
        this.popups.set(name, popup)

        return popup
    }

    get(name) {
        return this.popups.get(name) || null
    }

    all() {
        return Array.from(this.popups.values())
    }

    mountAll(container) {
        this.popups.forEach(popup => popup.mount(container))
    }

    open(name) {
        this.popups.forEach((popup, key) => {
            if (key === name) popup.open()
            else popup.close()
        })
    }

    closeAll() {
        this.popups.forEach(popup => popup.close())
    }

    toggle(name) {
        const popup = this.get(name)
        if (!popup) return

        if (popup.isOpen()) this.closeAll()
        else this.open(name)
    }

    current() {
        let current = null

        this.popups.forEach(popup => {
            if (!current && popup.isOpen()) current = popup
        })

        return current
    }

    syncIndexes() {
        this.popups.forEach(popup => {
            if (!popup.owner || !popup.owner.element) return

            popup.setIndex(popup.owner.element.style.getPropertyValue('--widgets-index') || 0)
        })
    }

    bindFocusLeave(trigger, popup) {
        if (!trigger || !trigger.element || !popup || !popup.element) return

        const onFocusOut = event => {
            if (!event.relatedTarget) return
            if (trigger.element.contains(event.relatedTarget)) return
            if (popup.element.contains(event.relatedTarget)) return

            popup.close()
        }

        this.listeners.push(onListen(trigger.element, 'focusout', onFocusOut))
        this.listeners.push(onListen(popup.element, 'focusout', onFocusOut))
    }

    bindOutsideClick() {
        const onClick = event => {
            if (!this.current()) return
            if (!event.target || !event.target.closest) return
            if (event.target.closest('.' + widgetItemClass)) return
            if (event.target.closest('.' + widgetPopupClass)) return

            this.closeAll()
        }

        this.listeners.push(onListen(document, 'click', onClick))
    }

    bindEscape() {
        const onKeyDown = event => {
            if (event.key !== 'Escape' || event.isComposing) return

            const popup = this.current()
            if (!popup) return

            event.preventDefault()
            this.closeAll()

            if (popup.owner && popup.owner.element) popup.owner.element.focus()
        }

        this.listeners.push(onListen(document, 'keydown', onKeyDown))
    }

    destroy() {
        this.listeners.forEach(unbind => unbind())
        this.listeners = []
        this.popups.forEach(popup => popup.destroy())
        this.popups.clear()
    }
}

class WidgetRegistry {
    constructor() {
        this.items = []
    }

    register(widget) {
        this.items.push(widget)

        return widget
    }

    get(id) {
        return this.items.find(item => item.id === id) || null
    }

    all() {
        return this.items.slice()
    }

    slotItems() {
        return this.items.filter(item => item.occupiesSlot)
    }

    collapsibleItems() {
        return this.items.filter(item => item.collapsible)
    }

    slotCount() {
        return this.slotItems().length
    }

    mountAll(container) {
        this.items.forEach(item => item.mount(container))
    }

    updateIndexes() {
        this.items.forEach((item, index) => item.setIndex(index))
    }

    destroy() {
        this.items.forEach(item => item.destroy())
        this.items = []
    }
}

class ThemeController {
    constructor(options = {}) {
        this.storage = options.storage || null
        this.storageKey = options.storageKey || ''
        this.groups = options.groups || []
        this.modes = options.modes || ['auto', 'light', 'dark']
        this.fontSizeLevels = options.fontSizeLevels || [14, 16, 18, 20, 22]
        this.hslFixed = options.hslFixed || { s: 66, l: 78 }
        this.defaultTheme = options.defaultTheme || ''
        this.hooks = options.hooks || {}

        this.modeIndex = 0
        this.themeIndex = this.defaultThemeIndex()
        this.colorHue = null
        this.fontSize = 16
        this.sakura = true
        this.live2d = true
        this.themeColor = ''
        this.bgColor = ''
        this.lightFile = 'light'
        this.darkFile = 'dark'
        this.themeQueue = Promise.resolve()
        this.deferringUi = false
        this.isReverting = false
        this.revertCount = 0
    }

    defaultThemeIndex() {
        const index = this.groups.findIndex(group => group && group.name === this.defaultTheme)

        return index === -1 ? 0 : index
    }

    getThemeGroup() {
        return this.groups[this.themeIndex] || null
    }

    getRecord() {
        const group = this.groups[this.themeIndex]

        return {
            version: 1,
            mode: this.modes[this.modeIndex],
            theme: group ? group.name : '',
            colorHue: this.colorHue,
            fontSize: this.fontSize,
            sakura: this.sakura,
            live2d: this.live2d
        }
    }

    persist() {
        if (!this.storage) return

        this.storage.setJSON(this.storageKey, this.getRecord())
    }

    restore(record) {
        const data = record && typeof record === 'object' && record.version === 1 ? record : null

        const mode = data && this.modes.includes(data.mode) ? data.mode : 'auto'
        this.modeIndex = Math.max(0, this.modes.indexOf(mode))

        const themeIndex = data ? this.groups.findIndex(group => group && group.name === data.theme) : -1
        this.themeIndex = themeIndex === -1 ? this.defaultThemeIndex() : themeIndex

        const hue = data && Number.isInteger(data.colorHue) ? data.colorHue : null
        this.colorHue = hue !== null && hue >= 0 && hue <= 360 ? hue : null

        this.fontSize = data && this.fontSizeLevels.includes(data.fontSize) ? data.fontSize : 16
        this.sakura = data && typeof data.sakura === 'boolean' ? data.sakura : true
        this.live2d = data && typeof data.live2d === 'boolean' ? data.live2d : true

        return this.applyRestored()
    }

    applyRestored() {
        if (this.hooks.onMode) this.hooks.onMode(this.modeIndex)
        if (this.hooks.onFont) this.hooks.onFont(this.fontSize)
        if (this.hooks.onSakura) this.hooks.onSakura(this.sakura)
        if (this.hooks.onLive2d) this.hooks.onLive2d(this.live2d)

        return this.applyColorOnce()
    }

    applyColor() {
        if (this.hooks.beforeColor) this.hooks.beforeColor()

        return Promise.resolve()
            .then(() => {
                if (this.hooks.applyColor) return this.hooks.applyColor()

                return true
            })
            .then(applied => {
                if (this.deferringUi) return applied
                if (this.hooks.onColor) this.hooks.onColor(this.colorHue)

                return applied
            })
    }

    applyColorOnce() {
        return this.applyColor()
    }

    applyTheme() {
        lockNoTransition()

        return this.applyColorOnce()
            .then(cssApplied => {
                const cssOk = cssApplied !== false

                if (!this.hooks.renderTheme) return cssOk

                return Promise.resolve(this.hooks.renderTheme())
                    .then(rendered => cssOk && rendered !== false)
            })
            .finally(unlockNoTransition)
    }

    cycleMode() {
        return this.applyThemeTransaction(() => {
            this.modeIndex = (this.modeIndex + 1) % this.modes.length
            this.colorHue = null
        })
    }

    selectTheme(name) {
        const index = this.groups.findIndex(group => group && group.name === name)
        if (index === -1) return Promise.resolve(false)

        return this.applyThemeTransaction(() => {
            this.themeIndex = index
            this.colorHue = null
        })
    }

    applyThemeTransaction(commit) {
        const run = () => this.runThemeTransaction(commit)
        const pending = this.themeQueue.then(run, run)

        this.themeQueue = pending.then(() => undefined, () => undefined)

        return pending
    }

    async runThemeTransaction(commit) {
        const snapshot = {
            modeIndex: this.modeIndex,
            themeIndex: this.themeIndex,
            colorHue: this.colorHue
        }

        commit()

        this.deferringUi = true

        let applied = false

        try {
            applied = await this.applyTheme()
        } catch {
        } finally {
            this.deferringUi = false
        }

        if (applied) {
            this.revertCount = 0

            this.persist()
            this.flushUi()

            return true
        }

        return this.revertThemeTransaction(snapshot)
    }

    async revertThemeTransaction(snapshot) {
        if (this.isReverting || this.revertCount >= themeMaxRevert) {
            this.persist()
            this.flushUi()

            return false
        }

        this.isReverting = true
        this.revertCount += 1
        this.deferringUi = true

        this.modeIndex = snapshot.modeIndex
        this.themeIndex = snapshot.themeIndex
        this.colorHue = snapshot.colorHue

        let restored = false

        try {
            restored = await this.applyTheme()
        } catch {
            restored = false
        } finally {
            this.deferringUi = false
            this.isReverting = false
        }

        if (restored) this.revertCount = 0

        this.persist()
        this.flushUi()

        return false
    }

    flushUi() {
        if (this.hooks.onMode) this.hooks.onMode(this.modeIndex)
        if (this.hooks.onColor) this.hooks.onColor(this.colorHue)
    }

    setColorHue(hue) {
        const next = Number.isInteger(hue) && hue >= 0 && hue <= 360 ? hue : null
        this.colorHue = next

        if (this.hooks.applyHue) this.hooks.applyHue(next)
        if (this.hooks.onColor) this.hooks.onColor(next)

        this.persist()
    }

    setFontSize(px) {
        if (!this.fontSizeLevels.includes(px)) return

        this.fontSize = px

        if (this.hooks.onFont) this.hooks.onFont(px)

        this.persist()
    }

    setSakura(value) {
        this.sakura = Boolean(value)

        if (this.hooks.onSakura) this.hooks.onSakura(this.sakura)

        this.persist()
    }

    setLive2d(value) {
        this.live2d = Boolean(value)

        if (this.hooks.onLive2d) this.hooks.onLive2d(this.live2d)

        this.persist()
    }

    onSystemModeChange() {
        if (this.modeIndex !== 0) return Promise.resolve()

        return this.applyTheme()
    }
}

function plugin(hook, vm) {
    if (!widgetsOptions.enable) {
        return
    }

    if (!widgetsOptions.useSwitchMode) {
        return
    }

    setCssVar('--widgets-top', widgetsOptions.top + 'px')

    let widgetsContainer = null
    let themeController = null
    let live2dController = null
    let sakuraController = null
    let restorePromise = null
    let themeRendered = false
    let themeRenderQueued = false
    let themeRenderGeneration = 0
    let isWidgetsOpen = true
    let ticking = false

    const registry = new WidgetRegistry()
    const popupManager = new PopupManager()

    const storage = createStorage(widgetsOptions.storage)

    const modeIcons = {
        light: nature.sun,
        dark: nature.moon,
        auto: nature.sunOnSea
    }

    let resolveIsDark = function () {
        const mode = modes[themeController.modeIndex]
        if (mode === 'auto') {
            return window.matchMedia(mediaQueries.dark).matches
        }
        return mode === 'dark'
    }

    let isFiniteHue = function (hue) {
        return hue !== null && Number.isFinite(hue)
    }

    let syncColorPickerActiveBtn = function (hue) {
        let btns = getAllEls('.color-picker-preset-color-btn-div')

        if (!btns.length || !isFiniteHue(hue)) {
            btns.forEach(btn => removeClass(btn, elementStatus.isActive))
            return
        }

        let snapped = Math.round(Number(hue) / 5) * 5
        if (snapped >= 360) snapped -= 360

        let matched = btns.find(btn => Number(getData(btn, 'hue')) === snapped)
        btns.forEach(btn => toggleClass(btn, elementStatus.isActive, btn === matched))
    }

    let syncColorPicker = function (hue) {
        let colorPickerSlider = getElByClass('color-picker-slider')

        if (colorPickerSlider && isFiniteHue(hue)) colorPickerSlider.value = hue

        syncColorPickerActiveBtn(hue)
    }

    let syncThemePickerActiveBtn = function () {
        getAllEls('.theme-picker-preset-color-btn-div').forEach(btn => {
            toggleClass(btn, elementStatus.isActive, Number(getData(btn, 'themeIndex')) === themeController.themeIndex)
        })
    }

    let getThemeGroup = function () {
        return themeController.getThemeGroup()
    }

    let getSideAsset = function (group, isDark, ext) {
        if (!group || !isEnabled(group[ext])) return null

        return group[ext] + '/' + (isDark ? themeController.darkFile : themeController.lightFile) + '.' + ext
    }

    let activateWidget = function (id) {
        const widget = registry.get(id)

        if (!widget || !widget.element) return
        if (hasClass(widget.element, widgetHiddenClass)) return

        widget.click()
    }

    let pickPreset = function (index) {
        const popup = popupManager.current()

        if (!popup || !popup.element) return

        const buttons = getAllEls('.theme-picker-preset-color-btn-div, .color-picker-preset-color-btn-div, .font-picker-preset-size-btn-div', popup.element)

        if (!buttons[index]) return

        buttons[index].click()
    }

    let readThemeSheetColor = function (link, name) {
        if (!link || !link.sheet) return ''

        try {
            const rules = link.sheet.cssRules
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i]
                if (!rule.style || rule.selectorText !== ':root') continue
                const value = rule.style.getPropertyValue(name)
                if (value) return value.trim()
            }
        } catch {
        }

        return ''
    }

    let readAppliedThemeColors = function (link, readSheet) {
        const computed = getComputedStyle(document.documentElement)
        const themeColor = readSheet ? readThemeSheetColor(link, '--theme-color') : ''
        const sheetBgColor = readSheet ? readThemeSheetColor(link, '--bg-color') : ''

        return {
            themeColor: themeColor,
            bgColor: sheetBgColor || computed.getPropertyValue('--bg-color').trim()
        }
    }

    let syncThemeColorMeta = function (bgColor) {
        if (!isEnabled(bgColor)) return

        let meta = getEl('meta[name="theme-color"]')
        if (!meta) return

        meta.content = bgColor
    }

    function applyThemeColorCss(themeColor) {
        lockNoTransition()
        setCssVar('--theme-color', themeColor)
        unlockNoTransition()
    }

    function waitForStylesheet(link, cssPath) {
        if (!link || link.disabled || !cssPath) {
            return Promise.resolve(true)
        }

        const expected = new URL(cssPath, document.baseURI).href

        const isReady = function () {
            try {
                const sheet = link.sheet
                if (!sheet || !sheet.cssRules || sheet.cssRules.length === 0) return false
                return !sheet.href || sheet.href === expected
            } catch {
                return false
            }
        }

        if (isReady()) return Promise.resolve(true)

        return new Promise(function (resolve) {
            let isDone = false
            let timer = null
            let deadline = 0

            const finish = function (ok) {
                if (isDone) return
                isDone = true
                offListen(link, 'load', check)
                offListen(link, 'error', fail)
                if (timer) clearTimeout(timer)
                resolve(ok)
            }

            const check = function () {
                if (isDone) return
                if (isReady()) {
                    finish(true)
                    return
                }
                if (Date.now() >= deadline) {
                    finish(false)
                    return
                }
                timer = setTimeout(check, themeSheetPollMs)
            }

            const fail = function () {
                finish(false)
            }

            deadline = Date.now() + themeSheetWaitMs
            onListen(link, 'load', check)
            onListen(link, 'error', fail)
            check()
        })
    }

    let applyThemeColor = function () {
        const group = getThemeGroup()
        const isDark = resolveIsDark()
        const cssPath = getSideAsset(group, isDark, 'css')
        const colorTheme = getElById('theme-color')

        let waits = Promise.resolve()

        if (isEnabled(cssPath)) {
            colorTheme.disabled = false
            if (colorTheme.getAttribute('href') !== cssPath) {
                colorTheme.href = cssPath
            }
            waits = waitForStylesheet(colorTheme, cssPath)
        } else {
            colorTheme.disabled = true
            colorTheme.href = 'data:text/css,'
        }

        return waits.then(function (cssReady) {
            const cssOk = cssReady !== false

            const applied = readAppliedThemeColors(colorTheme, isEnabled(cssPath))
            themeController.themeColor = applied.themeColor
            themeController.bgColor = applied.bgColor

            const hue = themeController.colorHue
            const themeColor = hue === null ? applied.themeColor : hslToHex(hue, hslFixed.s, hslFixed.l)

            if (isEnabled(themeColor)) applyThemeColorCss(themeColor)

            syncThemeColorMeta(applied.bgColor)

            return cssOk
        })
    }

    const themeModuleCache = new Map()
    let themeJsCleanups = []
    let domTracking = null
    let themeRenderToken = 0
    let themeRetrySequence = 0

    // Import with a deadline; the late rejection of the original import is consumed to avoid unhandledrejection.
    function importThemeModule(url) {
        return new Promise(function (resolve, reject) {
            let settled = false
            let timer = null

            const settle = function (callback, value) {
                if (settled) return

                settled = true
                clearTimeout(timer)
                callback(value)
            }

            timer = setTimeout(function () {
                settle(reject, new Error('[widgets] 主题脚本加载超时：' + url))
            }, themeModuleTimeoutMs)

            import(url).then(
                module => settle(resolve, module),
                error => settle(reject, error)
            )
        })
    }

    function loadThemeModuleWithRetry(url) {
        const attempt = function (index) {
            // The first import has no query; every retry uses a fresh sequence so a failed module entry is not reused.
            let target = url

            if (index > 0) {
                themeRetrySequence += 1
                target = url + (url.includes('?') ? '&' : '?') + 'widgetsRetry=' + themeRetrySequence
            }

            return importThemeModule(target).then(
                function (module) {
                    themeModuleCache.set(url, Promise.resolve(module))

                    return module
                },
                function (error) {
                    themeModuleCache.delete(url)

                    if (index >= themeModuleRetryCount) throw error

                    return attempt(index + 1)
                }
            )
        }

        return attempt(0)
    }

    function loadThemeModule(path) {
        const url = new URL(path, document.baseURI).href

        if (!themeModuleCache.has(url)) {
            themeModuleCache.set(url, loadThemeModuleWithRetry(url))
        }

        return themeModuleCache.get(url)
    }

    function beginDomTracking() {
        const tracking = { records: [], observer: null, styleAfter: new Map(), stopped: false }

        tracking.observer = new MutationObserver(function (mutations) {
            tracking.records.push(...mutations)
        })

        tracking.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: true,
            characterDataOldValue: true
        })

        return tracking
    }

    function endDomTracking(tracking) {
        if (!tracking || tracking.stopped) return

        tracking.stopped = true

        // Mutation records arrive asynchronously; disconnect drops pending ones, so take them first.
        tracking.records.push(...tracking.observer.takeRecords())

        // Style values at render end decide which inline properties still belong to the theme script.
        tracking.records.forEach(function (record) {
            if (record.type === 'attributes' && record.attributeName === 'style') {
                tracking.styleAfter.set(record.target, record.target.getAttribute('style'))
            }
        })

        tracking.observer.disconnect()
    }

    // Only rolls back inline style properties that were not touched afterwards.
    function restoreStyleDelta(element, oldValue, afterValue) {
        if (!element.isConnected || !afterValue) return

        const oldStyle = createEl('div').style
        oldStyle.cssText = oldValue || ''
        const afterStyle = createEl('div').style
        afterStyle.cssText = afterValue

        Array.from(afterStyle).forEach(function (name) {
            const afterProp = afterStyle.getPropertyValue(name)

            if (element.style.getPropertyValue(name) !== afterProp) return

            const oldProp = oldStyle.getPropertyValue(name)
            if (oldProp) setStyleProperty(element, name, oldProp, oldStyle.getPropertyPriority(name))
            else removeStyleProperty(element, name)
        })

        Array.from(oldStyle).forEach(function (name) {
            if (afterStyle.getPropertyValue(name) || element.style.getPropertyValue(name)) return

            setStyleProperty(element, name, oldStyle.getPropertyValue(name), oldStyle.getPropertyPriority(name))
        })
    }

    function rollbackDomChanges(tracking) {
        if (!tracking) return

        endDomTracking(tracking)

        const firstStyleRecords = new Map()
        tracking.records.forEach(function (record) {
            if (record.type === 'attributes' && record.attributeName === 'style' && !firstStyleRecords.has(record.target)) {
                firstStyleRecords.set(record.target, record)
            }
        })

        const revertedStyles = new Set()

        for (let i = tracking.records.length - 1; i >= 0; i--) {
            const record = tracking.records[i]

            try {
                if (record.type === 'attributes') {
                    if (!record.target.isConnected) continue

                    if (record.attributeName === 'style') {
                        if (revertedStyles.has(record.target)) continue
                        revertedStyles.add(record.target)

                        restoreStyleDelta(
                            record.target,
                            firstStyleRecords.get(record.target).oldValue,
                            tracking.styleAfter.get(record.target)
                        )
                    } else if (record.oldValue === null) record.target.removeAttribute(record.attributeName)
                    else record.target.setAttribute(record.attributeName, record.oldValue)
                } else if (record.type === 'characterData') {
                    if (!record.target.isConnected) continue

                    record.target.data = record.oldValue
                } else {
                    record.addedNodes.forEach(function (node) {
                        if (node.isConnected) node.remove()
                    })

                    record.removedNodes.forEach(function (node) {
                        const parent = record.target
                        if (!parent.isConnected || node.isConnected) return

                        const next = record.nextSibling
                        const prev = record.previousSibling

                        if (next && next.parentNode === parent) parent.insertBefore(node, next)
                        else if (prev && prev.parentNode === parent) parent.insertBefore(node, prev.nextSibling)
                        else if (!next && !prev && !parent.childNodes.length) parent.appendChild(node)
                    })
                }
            } catch {
            }
        }
    }

    function themeCleanup() {
        themeRenderToken++

        themeJsCleanups.forEach(function (cleanup) {
            try {
                cleanup()
            } catch {
            }
        })
        themeJsCleanups = []

        rollbackDomChanges(domTracking)
        domTracking = null
    }

    async function renderTheme() {
        themeCleanup()

        const token = themeRenderToken
        const group = getThemeGroup()
        const isDark = resolveIsDark()
        const jsPath = getSideAsset(group, isDark, 'js')

        if (!isEnabled(jsPath)) return true

        let themeModule

        try {
            themeModule = await loadThemeModule(jsPath)
        } catch {

            return false
        }

        if (token !== themeRenderToken) return true

        if (typeof themeModule.renderTheme !== 'function') {

            return false
        }

        const tracking = beginDomTracking()
        domTracking = tracking

        try {
            await Promise.resolve(themeModule.renderTheme({
                isDark: isDark,
                name: group.name,
                onCleanup: function (cleanup) {
                    if (typeof cleanup === 'function') themeJsCleanups.push(cleanup)
                }
            }))
        } catch {

            return false
        } finally {
            endDomTracking(tracking)
        }

        return true
    }

    function renderThemeForUser() {
        themeRenderGeneration += 1
        themeRendered = true
        themeRenderQueued = false

        return renderTheme()
    }

    let syncFontPickerActiveBtn = function (px) {
        const index = fontSizeLevels.indexOf(px)

        getAllEls('.font-picker-preset-size-btn-div').forEach(btn => {
            toggleClass(btn, elementStatus.isActive, Number(getData(btn, 'sizeIndex')) === index)
        })
    }

    function applyFontSize(px) {
        setCssVar('--global-font-size', px + 'px')
        syncFontPickerActiveBtn(px)
    }

    function render() {
        ticking = false
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0
            ? Math.min(100, Math.max(0, (window.scrollY / max) * 100))
            : 0
        const text = Math.round(p)
        const progress = registry.get(progressWidgetId)

        if (!progress || !progress.element) return

        setCssVar('--p', p, progress.element)
        const n = getEl('.num', progress.element)
        if (n) n.textContent = text
    }

    let isScrollToTopVisible = function () {
        let offset = window.document.documentElement.scrollTop
        return offset >= widgetsOptions.topOffset
    }

    let initSwitchMode = function () {
        const widget = new Widget({ id: 'switch-mode-span', icon: nature.sunOnSea, collapsible: true })

        widget.onActivate(function () {
            themeController.cycleMode()
        })

        registry.register(widget)
    }

    let initSwitchTheme = function () {
        const widget = new Widget({ id: 'switch-theme-span', icon: object.shirt, collapsible: true })

        const popup = new WidgetPopup({
            name: 'theme',
            id: 'theme-picker-popup-span',
            className: 'theme-picker-popup-span',
            panelId: 'theme-picker-popup-div',
            panelClassName: 'theme-picker-popup-div',
            owner: widget,
            render: function (panel) {
                const presetListDiv = createEl('div', { className: 'theme-picker-preset-color-list-div' })

                widgetsOptions.themes.forEach(function (group, index) {
                    let btnDiv = createEl('div', { className: 'theme-picker-preset-color-btn-div' })
                    setData(btnDiv, 'theme', group.name)
                    setData(btnDiv, 'themeIndex', String(index))

                    btnDiv.innerHTML = `
                        <div class="theme-picker-pattern-layer"></div>
                        <div class="theme-picker-pattern-layer theme-picker-pattern-layer-dark"></div>
                        <div class="theme-picker-dot">
                            <div class="theme-picker-dot-layer theme-picker-dot-glow-left"></div>
                            <div class="theme-picker-dot-layer theme-picker-dot-glow-right"></div>
                            <div class="theme-picker-dot-layer theme-picker-dot-core-left"></div>
                            <div class="theme-picker-dot-layer theme-picker-dot-core-right"></div>
                        </div>
                    `

                    makeButtonLike(btnDiv)

                    onListen(btnDiv, 'click', function () {
                        themeController.selectTheme(group.name)
                    })

                    presetListDiv.appendChild(btnDiv)
                })

                panel.appendChild(presetListDiv)
            }
        })

        popupManager.register('theme', popup)

        widget.onActivate(function () {
            popupManager.toggle('theme')
        })

        registry.register(widget)
    }

    let initColorPicker = function () {
        const widget = new Widget({ id: 'color-picker-span', icon: object.palette, collapsible: true })

        const popup = new WidgetPopup({
            name: 'color',
            id: 'color-picker-popup-span',
            className: 'color-picker-popup-span',
            panelId: 'color-picker-popup-div',
            panelClassName: 'color-picker-popup-div',
            owner: widget,
            render: function (panel) {
                panel.innerHTML = '<div class="color-picker-preset-color-list-div"><div class="color-picker-preset-color-btn-div" data-hue="0"></div><div class="color-picker-preset-color-btn-div" data-hue="30"></div><div class="color-picker-preset-color-btn-div" data-hue="60"></div><div class="color-picker-preset-color-btn-div" data-hue="90"></div><div class="color-picker-preset-color-btn-div" data-hue="180"></div><div class="color-picker-preset-color-btn-div" data-hue="250"></div><div class="color-picker-preset-color-btn-div" data-hue="270"></div><div class="color-picker-preset-color-btn-div" data-hue="300"></div><div class="color-picker-preset-color-btn-div" data-hue="330"></div><div class="color-picker-preset-color-btn-div" data-hue="345"></div></div><input type="range" min="0" max="360" value="270" class="color-picker-slider" id="color-picker-slider" step="5">'

                let colorPickerSlider = getElByClass('color-picker-slider', panel)
                let isDraggingColorPicker = false

                let endColorPickerDrag = function () {
                    if (!isDraggingColorPicker) return

                    isDraggingColorPicker = false
                    unlockNoTransition()
                }

                onListen(colorPickerSlider, 'pointerdown', function () {
                    if (isDraggingColorPicker) return

                    isDraggingColorPicker = true
                    lockNoTransition()
                })
                onListen(window, 'pointerup', endColorPickerDrag)
                onListen(window, 'pointercancel', endColorPickerDrag)
                onListen(colorPickerSlider, 'change', endColorPickerDrag)

                onListen(colorPickerSlider, 'input', function () {
                    themeController.setColorHue(Number(colorPickerSlider.value))
                })

                getAllEls('.color-picker-preset-color-btn-div', panel).forEach(colorPickerPresetColorBtn => {
                    makeButtonLike(colorPickerPresetColorBtn)

                    onListen(colorPickerPresetColorBtn, 'click', function () {
                        themeController.setColorHue(Number(getData(colorPickerPresetColorBtn, 'hue')))
                    })
                })
            }
        })

        popupManager.register('color', popup)

        widget.onActivate(function () {
            popupManager.toggle('color')
        })

        registry.register(widget)
    }

    let initFontPicker = function () {
        const widget = new Widget({ id: 'font-picker-span', icon: article.font, collapsible: true })

        const popup = new WidgetPopup({
            name: 'font',
            id: 'font-picker-popup-span',
            className: 'font-picker-popup-span',
            panelId: 'font-picker-popup-div',
            panelClassName: 'font-picker-popup-div',
            owner: widget,
            render: function (panel) {
                const presetListDiv = createEl('div', { className: 'font-picker-preset-size-list-div' })

                fontSizeLevels.forEach(function (px, index) {
                    let btnDiv = createEl('div', { className: 'font-picker-preset-size-btn-div', text: 'A' })
                    setData(btnDiv, 'sizeIndex', index)

                    makeButtonLike(btnDiv)

                    onListen(btnDiv, 'click', function () {
                        themeController.setFontSize(px)
                    })

                    presetListDiv.appendChild(btnDiv)
                })

                panel.appendChild(presetListDiv)
            }
        })

        popupManager.register('font', popup)

        widget.onActivate(function () {
            popupManager.toggle('font')
        })

        registry.register(widget)
    }

    let initCommentScroll = function () {
        const widget = new Widget({ id: 'scroll-to-comment-span', icon: article.dialogue, collapsible: true })

        widget.onActivate(function () {
            const gitalk = getElById('comment-container')
            if (!gitalk) return

            gitalk.scrollIntoView({ behavior: 'smooth' })
        })

        registry.register(widget)
    }

    let initSakuraRain = function () {
        const widget = new Widget({ id: 'show-sakura-span', icon: nature.flower, collapsible: true })

        sakuraController = createSakura({ autoStart: false })

        widget.onActivate(function () {
            themeController.setSakura(!themeController.sakura)
        })

        registry.register(widget)
    }

    let initLive2d = function () {
        const widget = new Widget({ id: 'show-live2d-span', icon: person.girl, collapsible: true })

        live2dController = createLive2d(widgetsOptions.live2d || [])

        widget.onActivate(function () {
            themeController.setLive2d(!themeController.live2d)
        })

        registry.register(widget)
    }

    let initShowWidgets = function () {
        const widget = new Widget({ id: 'show-widgets-span', icon: object.pokeball, active: isWidgetsOpen })

        widget.onActivate(function () {
            isWidgetsOpen = !isWidgetsOpen
            widget.setActive(isWidgetsOpen)

            registry.collapsibleItems().forEach(item => item.setHidden(!isWidgetsOpen))

            if (!isWidgetsOpen) popupManager.closeAll()
        })

        registry.register(widget)
    }

    let initProgress = function () {
        const widget = new Widget({
            id: progressWidgetId,
            className: 'read-progress',
            icon: '<span class="num progress-num-hide">0</span>'
        })

        widget.onActivate(function () {
            const n = getEl('.num', widget.element)
            if (n) toggleClass(n, 'progress-num-hide')
        })

        registry.register(widget)

        function schedule() {
            if (ticking) return
            ticking = true
            requestAnimationFrame(render)
        }

        onListen(window, 'scroll', schedule, { passive: true })
        onListen(window, 'resize', schedule)
        if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body)
    }

    let initScrollToTop = function () {
        const widget = new Widget({ id: 'scroll-to-top-span', icon: arrow.doubleUpArrow, occupiesSlot: false })

        widget.onActivate(function (event) {
            event.stopPropagation()
            let step = window.scrollY / 15
            let scroll = function () {
                window.scrollTo(0, window.scrollY - step)
                if (window.scrollY > 0) {
                    setTimeout(scroll, 15)
                }
            }
            scroll()
        })

        registry.register(widget)

        let onScroll = function () {
            if (widget.element) toggleClass(widget.element, elementStatus.isVisible, isScrollToTopVisible())
        }
        onListen(window, 'scroll', onScroll)
    }

    hook.mounted(function () {
        widgetsContainer = createEl('div', { className: widgetsContainerId, attrs: { id: widgetsContainerId } })
        document.body.appendChild(widgetsContainer)

        initSwitchMode()
        initSwitchTheme()
        initColorPicker()
        initFontPicker()
        initCommentScroll()
        initSakuraRain()
        initLive2d()
        initShowWidgets()
        initProgress()
        initScrollToTop()

        registry.mountAll(widgetsContainer)
        popupManager.mountAll(widgetsContainer)
        registry.updateIndexes()
        popupManager.syncIndexes()

        setCssVar('--widgets-cnt', registry.slotCount())

        const scrollToTop = registry.get('scroll-to-top-span')
        if (scrollToTop && scrollToTop.element) {
            toggleClass(scrollToTop.element, elementStatus.isVisible, isScrollToTopVisible())
        }

        themeController = new ThemeController({
            storage: storage,
            storageKey: storageKey,
            groups: widgetsOptions.themes || [],
            defaultTheme: widgetsOptions.defaultTheme,
            modes: modes,
            fontSizeLevels: fontSizeLevels,
            hslFixed: hslFixed,
            hooks: {
                beforeColor: themeCleanup,
                applyColor: applyThemeColor,
                applyHue: function (hue) {
                    if (hue === null) {
                        if (isEnabled(themeController.themeColor)) applyThemeColorCss(themeController.themeColor)
                        return
                    }

                    applyThemeColorCss(hslToHex(hue, hslFixed.s, hslFixed.l))
                },
                onColor: function (hue) {
                    const themeColor = themeController.themeColor
                    const effective = hue === null ? (isEnabled(themeColor) ? hexToHsl(themeColor)[0] : null) : hue

                    syncColorPicker(effective)
                    syncThemePickerActiveBtn()
                },
                onMode: function (index) {
                    const widget = registry.get('switch-mode-span')

                    if (widget && widget.element) widget.element.innerHTML = modeIcons[modes[index]]
                },
                onFont: applyFontSize,
                onSakura: function (value) {
                    const widget = registry.get('show-sakura-span')

                    if (widget) widget.setActive(value)
                    if (!sakuraController) return

                    if (value) sakuraController.start()
                    else sakuraController.stop()
                },
                onLive2d: function (value) {
                    const widget = registry.get('show-live2d-span')

                    if (widget) widget.setActive(value)
                    if (live2dController) live2dController.setVisible(value)
                },
                renderTheme: renderThemeForUser
            }
        })

        popupNames.forEach(function (name) {
            const popup = popupManager.get(name)

            if (popup) popupManager.bindFocusLeave(popup.owner, popup)
        })
        popupManager.bindOutsideClick()
        popupManager.bindEscape()

        onListen(window.matchMedia(mediaQueries.dark), 'change', function () {
            themeController.onSystemModeChange()
        })

        restorePromise = themeController.restore(storage.getJSON(storageKey, null))

        render()

        let presetBindings = {}

        for (let number = 1; number <= 10; number++) {
            const index = number - 1
            const digit = number === 10 ? 0 : number
            const handler = function () {
                pickPreset(index)
            }

            presetBindings['Digit' + digit] = handler
            presetBindings['Numpad' + digit] = handler
        }

        bindShortcuts(Object.assign({
            KeyM: () => activateWidget('switch-mode-span'),
            KeyT: () => activateWidget('switch-theme-span'),
            KeyC: () => activateWidget('color-picker-span'),
            KeyF: () => activateWidget('font-picker-span'),
            KeyS: () => activateWidget('show-sakura-span'),
            KeyG: () => activateWidget('show-live2d-span'),
            KeyW: () => activateWidget('show-widgets-span'),
            KeyN: () => activateWidget(progressWidgetId),
            ArrowUp: () => activateWidget('scroll-to-top-span'),
            KeyL: () => activateWidget('scroll-to-comment-span')
        }, presetBindings), { when: () => !hasClass(document.body, imageViewerOpenClass) })
    })

    hook.doneEach(function () {
        if (!widgetsContainer || !themeController) return

        if (themeRendered) {
            renderTheme()
            return
        }

        if (themeRenderQueued) return

        themeRenderQueued = true

        const generation = themeRenderGeneration

        Promise.resolve(restorePromise)
            .catch(function () {
            })
            .then(function () {
                if (generation !== themeRenderGeneration) return

                themeRendered = true
                themeRenderQueued = false
                return renderTheme()
            })
    })
}

window.$docsify['widgets'] = Object.assign(
    widgetsOptions,
    window.$docsify['widgets']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
