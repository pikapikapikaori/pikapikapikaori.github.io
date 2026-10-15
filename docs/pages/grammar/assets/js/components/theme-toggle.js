import { h } from '../utils/dom.js'

const KEY = 'ln.theme'
const CYCLE = ['auto', 'light', 'dark']
const ICONS = { auto: '◐', light: '☀', dark: '☾' }
const LABELS = { auto: '跟随系统', light: '浅色', dark: '深色' }

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
        btn.textContent = ICONS[t] || '◐'
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
