import { h, replace } from '../utils/dom.js'
import { THEME_ICONS } from './icons.js'
import { LS_KEYS, THEMES } from '../config/config.js'

const KEY = LS_KEYS.theme
const CYCLE = THEMES.map((t) => t.value)
const LABELS = Object.fromEntries(THEMES.map((t) => [t.value, t.label]))

export function currentTheme() {
    try {
        const t = localStorage.getItem(KEY)
        return CYCLE.includes(t) ? t : 'auto'
    } catch { return 'auto' }
}

export function applyTheme(theme) {
    const v = CYCLE.includes(theme) ? theme : 'auto'
    document.documentElement.setAttribute('data-theme', v)
    try { localStorage.setItem(KEY, v) } catch { /* ignore */ }
    return v
}

/**
 * 主题切换按钮
 * @param {object} opts
 *   onChange(theme)
 */
export function createThemeToggle({ onChange } = {}) {
    const btn = h('button', {
        class: 'btn btn--ghost btn--icon',
        type: 'button'
    })

    function refresh() {
        const t = currentTheme()
        replace(btn, THEME_ICONS[t]())
        btn.title = `主题：${LABELS[t]}（点击切换）`
        btn.setAttribute('aria-label', btn.title)
    }

    btn.addEventListener('click', () => {
        const cur = currentTheme()
        const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]
        applyTheme(next)
        refresh()
        if (typeof onChange === 'function') onChange(next)
    })

    refresh()
    return btn
}
