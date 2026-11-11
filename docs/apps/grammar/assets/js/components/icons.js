import { svg } from '../utils/dom.js'

function icon(...children) {
    return svg('svg', {
        viewBox: '0 0 24 24',
        width: '18',
        height: '18',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true'
    }, ...children)
}

export function themeAutoIcon() {
    return icon(
        svg('circle', { cx: '12', cy: '12', r: '9' }),
        svg('path', { d: 'M12 3a9 9 0 0 1 0 18z', fill: 'currentColor', stroke: 'none' })
    )
}

export function themeLightIcon() {
    return icon(
        svg('circle', { cx: '12', cy: '12', r: '4' }),
        svg('path', {
            d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41'
                + 'M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'
        })
    )
}

export function themeDarkIcon() {
    return icon(
        svg('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z' })
    )
}

export const THEME_ICONS = {
    auto: themeAutoIcon,
    light: themeLightIcon,
    dark: themeDarkIcon
}

export function settingsIcon() {
    return icon(
        svg('path', {
            d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0'
                + 'l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51'
                + 'a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08'
                + 'a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18'
                + 'a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39'
                + 'a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09'
                + 'a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25'
                + 'a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'
        }),
        svg('circle', { cx: '12', cy: '12', r: '3' })
    )
}

/* ---------- 笔记工具条 ---------- */

/** 工具条图标：15px、1.5px 描边，与按钮同一套线条重量 */
function noteIcon(...children) {
    return svg('svg', {
        viewBox: '0 0 24 24',
        width: '15',
        height: '15',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true'
    }, ...children)
}

export function indentIcon() {
    return noteIcon(
        svg('path', { d: 'M4 5h16M10 12h10M10 19h10' }),
        svg('path', { d: 'M4 9.5 7.5 12 4 14.5z', fill: 'currentColor', stroke: 'none' })
    )
}

export function outdentIcon() {
    return noteIcon(
        svg('path', { d: 'M4 5h16M10 12h10M10 19h10' }),
        svg('path', { d: 'M7.5 9.5 4 12l3.5 2.5z', fill: 'currentColor', stroke: 'none' })
    )
}

export function checkboxIcon() {
    return noteIcon(svg('rect', {
        x: '4.5', y: '4.5', width: '15', height: '15', rx: '3'
    }))
}

export function ruleIcon() {
    return noteIcon(svg('path', { d: 'M4 12h16' }))
}

export function linkIcon() {
    return noteIcon(
        svg('path', { d: 'M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5' }),
        svg('path', { d: 'M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5' })
    )
}

export function imageIcon() {
    return noteIcon(
        svg('rect', { x: '3.5', y: '4.5', width: '17', height: '15', rx: '2.5' }),
        svg('circle', { cx: '9', cy: '9.5', r: '1.5' }),
        svg('path', { d: 'm4.5 17 4.5-4.5 3 3 3-3 4.5 4.5' })
    )
}

/** 拖动把手：两列三点 */
export function gripIcon() {
    const dots = []
    for (const x of [9.5, 14.5]) {
        for (const y of [6, 12, 18]) {
            dots.push(svg('circle', { cx: String(x), cy: String(y), r: '1.2', fill: 'currentColor', stroke: 'none' }))
        }
    }
    return noteIcon(...dots)
}

/** 复选框里的对勾 */
export function checkMarkIcon() {
    return noteIcon(svg('path', { d: 'm5 12.5 4.5 4.5L19 7.5' }))
}
