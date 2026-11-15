(function () {
    'use strict'

    var App = window.App = window.App || {}
    var T = App.theme = {}

    var STORAGE = App.storage
    var THEME_NAME = STORAGE.NAMES.theme
    var MODES = {
        light: 'light',
        dark: 'dark',
        system: 'system'
    }
    var ORDER = [MODES.light, MODES.dark, MODES.system]
    var MEDIA_DARK = '(prefers-color-scheme: dark)'
    var listeners = []
    var mode = MODES.system
    var systemMedia = null

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
        var i = ORDER.indexOf(mode)
        apply(ORDER[(i + 1) % ORDER.length])
    }

    T.onChange = function (fn) {
        listeners.push(fn)

        return function () {
            var i = listeners.indexOf(fn)
            if (i !== -1) listeners.splice(i, 1)
        }
    }
})()
