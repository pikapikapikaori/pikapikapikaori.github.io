import { h, replace } from '../utils/dom.js'
import { THEME_ICONS } from './icons.js'
import { LS_KEYS, getEnum, setEnum } from '../store/local-storage.js'
import { THEMES } from '../config/config.js'

const KEY = LS_KEYS.theme
const CYCLE = THEMES.map((t) => t.value)
const LABELS = Object.fromEntries(THEMES.map((t) => [t.value, t.label]))

export function currentTheme() {
    return getEnum(KEY, CYCLE, 'auto')
}

export function applyTheme(theme) {
    const v = CYCLE.includes(theme) ? theme : 'auto'
    document.documentElement.setAttribute('data-theme', v)
    setEnum(KEY, CYCLE, v)
    return v
}

/** 主题切换按钮：按 auto → light → dark 循环，并写入 localStorage @param {object} opts onChange(theme) */
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
