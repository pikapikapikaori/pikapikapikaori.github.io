/** 内联 SVG 图标：不用 emoji / 特殊字符，避免不同平台字形不一致 */

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

/* ---------- 通用 ---------- */

export function expandIcon() {
    return icon(
        svg('path', { d: 'M9 4H4v5' }),
        svg('path', { d: 'M15 4h5v5' }),
        svg('path', { d: 'M20 15v5h-5' }),
        svg('path', { d: 'M4 15v5h5' })
    )
}

/* ---------- 主题 ---------- */

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

/* ---------- 通用 ---------- */

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
