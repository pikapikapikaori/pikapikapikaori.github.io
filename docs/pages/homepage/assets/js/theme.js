/*
 * 主题：亮、暗、跟随系统三态循环。
 * 顺序 light → dark → system，存储只在手动选亮或暗时写入，
 * 跟随系统时不写存储，系统偏好变化立即生效。
 * effective 返回当前实值亮或暗，mode 返回三态名。
 */
(function () {
    'use strict'

    var App = window.App = window.App || {}
    var T = App.theme = {}

    var KEY = 'pikapikapi:theme:homepage'
    var ORDER = ['light', 'dark', 'system']
    var listeners = []
    var mode = 'system'
    var systemMedia = null

    function isMode(value) {
        return ORDER.indexOf(value) !== -1
    }

    function readSaved() {
        try {
            var value = localStorage.getItem(KEY)
            return value === 'light' || value === 'dark' ? value : null
        } catch (e) {
            return null
        }
    }

    function writeSaved(value) {
        try { localStorage.setItem(KEY, value) } catch (e) { /* 忽略：隐私模式下不可写 */ }
    }

    function clearSaved() {
        try { localStorage.removeItem(KEY) } catch (e) { /* 忽略 */ }
    }

    function systemPref() {
        if (!systemMedia) {
            systemMedia = window.matchMedia('(prefers-color-scheme: dark)')
        }
        return systemMedia.matches ? 'dark' : 'light'
    }

    function effective() {
        return mode === 'system' ? systemPref() : mode
    }

    /* 系统在亮暗间切换时，跟随系统模式的页面立即跟着变。 */
    function onSystemChange() {
        if (mode !== 'system') return

        document.documentElement.dataset.theme = systemPref()

        listeners.slice().forEach(function (fn) {
            try { fn(effective()) } catch (e) { /* 忽略单个监听器的错误 */ }
        })
    }

    function apply(nextMode) {
        mode = isMode(nextMode) ? nextMode : 'system'
        document.documentElement.dataset.theme = effective()

        if (mode === 'system') {
            clearSaved()
        } else {
            writeSaved(mode)
        }

        listeners.slice().forEach(function (fn) {
            try { fn(effective()) } catch (e) { /* 忽略单个监听器的错误 */ }
        })
    }

    T.init = function () {
        apply(readSaved() || 'system')

        if (window.matchMedia) {
            systemMedia = window.matchMedia('(prefers-color-scheme: dark)')

            if (systemMedia.addEventListener) {
                systemMedia.addEventListener('change', onSystemChange)
            } else if (systemMedia.addListener) {
                systemMedia.addListener(onSystemChange)
            }
        }
    }

    /* 三态清单，控件菜单与循环从这里取。 */
    T.modes = function () { return ORDER.slice() }

    /* 三态模式名：light、dark、system。控件循环与 popup 用这个。 */
    T.mode = function () { return mode }

    /* 当前实值亮或暗，布局取色与活动判断用这个。 */
    T.effective = function () { return effective() }

    T.set = function (nextMode) {
        apply(nextMode)
    }

    /* 三态循环：light → dark → system → light。 */
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
