import { config } from './config.js'

export function setupTheme (buttons, meta) {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

    function storedMode () {
        try {
            const value = localStorage.getItem(config.themeStorageKey)
            return config.themeModes.indexOf(value) !== -1 ? value : 'auto'
        } catch {
            return 'auto'
        }
    }

    function applyTheme (mode, persist) {
        if (config.themeModes.indexOf(mode) === -1) mode = 'auto'
        const dark = mode === 'dark' || (mode === 'auto' && systemDark.matches)
        document.documentElement.setAttribute('data-theme-mode', mode)
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
        buttons.forEach(function (button) {
            button.setAttribute('aria-pressed', button.getAttribute('data-theme-mode') === mode ? 'true' : 'false')
        })
        if (meta) meta.setAttribute('content', dark ? config.themeDarkColor : config.themeLightColor)
        if (persist) {
            try {
                localStorage.setItem(config.themeStorageKey, mode)
            } catch {
            }
        }
    }

    applyTheme(storedMode(), false)
    buttons.forEach(function (button) {
        button.addEventListener('click', function () {
            applyTheme(button.getAttribute('data-theme-mode'), true)
        })
    })

    const onSystemChange = function () {
        const current = document.documentElement.getAttribute('data-theme-mode') || 'auto'
        if (current === 'auto') applyTheme('auto', false)
    }
    if (systemDark.addEventListener) systemDark.addEventListener('change', onSystemChange)
    else if (systemDark.addListener) systemDark.addListener(onSystemChange)
}
