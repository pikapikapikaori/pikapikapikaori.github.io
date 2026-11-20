import { themeStorageKey, themeModes } from './config.js'

const mq = window.matchMedia('(prefers-color-scheme: dark)')

function resolve(mode) {
    if (mode === 'dark') return 'dark'
    if (mode === 'light') return 'light'
    return mq.matches ? 'dark' : 'light'
}

export function applyTheme(mode) {
    if (!themeModes.includes(mode)) mode = 'auto'
    localStorage.setItem(themeStorageKey, mode)
    const real = resolve(mode)
    document.documentElement.dataset.theme = real
    document.documentElement.dataset.themeMode = mode
}

export function getTheme() {
    const saved = localStorage.getItem(themeStorageKey)
    return themeModes.includes(saved) ? saved : 'auto'
}
