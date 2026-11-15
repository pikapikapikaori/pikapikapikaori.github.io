(function () {
    'use strict'

    var App = window.App = window.App || {}

    var THEMES = {
        light: 'light',
        dark: 'dark'
    }
    var PAGE_COLORS = {
        light: '#F2EDE4',
        dark: '#101214'
    }
    var MEDIA_DARK = '(prefers-color-scheme: dark)'

    function systemTheme() {
        var dark = window.matchMedia && window.matchMedia(MEDIA_DARK).matches

        return dark ? THEMES.dark : THEMES.light
    }

    var storage = App.storage
    var theme = storage
        ? storage.getEnum(storage.NAMES.theme, [THEMES.light, THEMES.dark], null)
        : null

    if (!theme) theme = systemTheme()

    document.documentElement.dataset.theme = theme

    var meta = document.querySelector('meta[name="theme-color"]')

    if (meta) meta.setAttribute('content', PAGE_COLORS[theme])
})()
