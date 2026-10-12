/* ========================================================
   theme.js —— 明暗主题
   ======================================================== */
(function () {
    'use strict'

    var App = window.App = window.App || {}
    var T = App.theme = {}

    var KEY = 'pikapikapi:theme'

    function readSaved() {
        try { return localStorage.getItem(KEY) } catch (e) { return null }
    }
    function writeSaved(v) {
        try { localStorage.setItem(KEY, v) } catch (e) { /* ignore */ }
    }
    function systemPref() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark' : 'light'
    }

    function syncMeta(theme) {
        var m = document.getElementById('themeColorMeta')
        if (m) m.setAttribute('content', theme === 'dark' ? '#141210' : '#f7f3ea')
    }

    function apply(theme) {
        document.documentElement.dataset.theme = theme
        syncMeta(theme)
    }

    T.init = function () {
        apply(readSaved() || systemPref())

        var btn = document.getElementById('themeBtn')
        if (btn) {
            btn.addEventListener('click', function () {
                var next = document.documentElement.dataset.theme === 'dark'
                    ? 'light' : 'dark'
                apply(next)
                writeSaved(next)
            })
        }
    }
})()
