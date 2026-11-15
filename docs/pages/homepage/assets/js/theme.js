(function () {
    'use strict'

    const App = window.App = window.App || {}
    const T = App.theme = {}

    const STORAGE = App.storage
    const THEME_NAME = STORAGE.NAMES.theme
    const MODES = {
        light: 'light',
        dark: 'dark',
        system: 'system'
    }
    const ORDER = [MODES.light, MODES.dark, MODES.system]
    const MEDIA_DARK = '(prefers-color-scheme: dark)'
    const listeners = []
    let mode = MODES.system
    let systemMedia = null

    function isMode(value) {
        return ORDER.indexOf(value) !== -1
    }

    function systemPref() {
        if (!systemMedia) {
            systemMedia = window.matchMedia(MEDIA_DARK)
        }
        return systemMedia.matches ? MODES.dark : MODES.light
    }

    function effective() {
        return mode === MODES.system ? systemPref() : mode
    }

    function notify() {
        listeners.slice().forEach(function (fn) {
            try { fn(effective()) } catch (e) {}
        })
    }

    function onSystemChange() {
        if (mode !== MODES.system) return

        document.documentElement.dataset.theme = systemPref()
        notify()
    }

    function apply(nextMode) {
        mode = isMode(nextMode) ? nextMode : MODES.system
        document.documentElement.dataset.theme = effective()

        if (mode === MODES.system) {
            STORAGE.remove(THEME_NAME)
        } else {
            STORAGE.set(THEME_NAME, mode)
        }

        notify()
    }

    T.init = function () {
        apply(STORAGE.getEnum(THEME_NAME, [MODES.light, MODES.dark], null) || MODES.system)

        if (window.matchMedia) {
            systemMedia = window.matchMedia(MEDIA_DARK)

            if (systemMedia.addEventListener) {
                systemMedia.addEventListener('change', onSystemChange)
            } else if (systemMedia.addListener) {
                systemMedia.addListener(onSystemChange)
            }
        }
    }

    T.modes = function () { return ORDER.slice() }

    T.mode = function () { return mode }

    T.effective = function () { return effective() }

    T.set = function (nextMode) {
        apply(nextMode)
    }

    T.cycle = function () {
        const i = ORDER.indexOf(mode)
        apply(ORDER[(i + 1) % ORDER.length])
    }

    T.onChange = function (fn) {
        listeners.push(fn)

        return function () {
            const i = listeners.indexOf(fn)
            if (i !== -1) listeners.splice(i, 1)
        }
    }
})()
