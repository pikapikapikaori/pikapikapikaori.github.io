(function () {
    'use strict'

    const App = window.App = window.App || {}

    const THEMES = {
        light: 'light',
        dark: 'dark'
    }
    const PAGE_COLORS = {
        light: '#F2EDE4',
        dark: '#101214'
    }
    const MEDIA_DARK = '(prefers-color-scheme: dark)'

    function systemTheme() {
        const dark = window.matchMedia && window.matchMedia(MEDIA_DARK).matches

        return dark ? THEMES.dark : THEMES.light
    }

    const storage = App.storage
    let theme = storage
        ? storage.getEnum(storage.NAMES.theme, [THEMES.light, THEMES.dark], null)
        : null

    if (!theme) theme = systemTheme()

    document.documentElement.dataset.theme = theme

    const meta = document.querySelector('meta[name="theme-color"]')

    if (meta) meta.setAttribute('content', PAGE_COLORS[theme])
})()
