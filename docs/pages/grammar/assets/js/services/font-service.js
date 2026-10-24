/**
 * 字体服务
 *
 * 三种模式：
 *   default 使用 assets/resources/fonts 下的内置字体（fonts.css 中的 @font-face）
 *   system  使用系统字体栈（system-ui）
 *   local   使用用户选择的本地字体文件（会话级 objectURL）
 *
 * 持久化：
 *   localStorage 保存 fontMode 与 fontFamily（字体名）
 *   objectURL 不持久化；每次会话需要重新选择本地文件
 */

import { LS_KEYS } from '../config/config.js'

const LS_FONT_MODE = LS_KEYS.font
const LS_FONT_FAMILY = LS_KEYS.fontFamily
const LS_FONT_SIZE = LS_KEYS.fontSize

const STYLE_ID = 'ln-user-font'

const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'

let currentObjectUrl = null

export function getStoredFontMode() {
    try { return localStorage.getItem(LS_FONT_MODE) || 'default' }
    catch { return 'default' }
}

export function getStoredFontFamily() {
    try { return localStorage.getItem(LS_FONT_FAMILY) || '' }
    catch { return '' }
}

/** 字号档位：只改 --fs-base，其余字号都是相对它的 rem */
export const FONT_SIZES = [
    { value: '14', label: '小' },
    { value: '16', label: '标准' },
    { value: '18', label: '大' },
    { value: '20', label: '特大' }
]

export function getStoredFontSize() {
    try { return localStorage.getItem(LS_FONT_SIZE) || '16' }
    catch { return '16' }
}

export function applyFontSize(size) {
    const px = FONT_SIZES.some((f) => f.value === String(size)) ? String(size) : '16'
    document.documentElement.style.setProperty('--fs-base', `${px}px`)
    try { localStorage.setItem(LS_FONT_SIZE, px) }
    catch { /* ignore */ }
}

/**
 * 应用字体设置
 * @param {object} opts
 *   mode: 'default' | 'system' | 'local'
 *   family: 字体名（local 时必填）
 */
export function applyFont({ mode = 'default', family = '' } = {}) {
    const html = document.documentElement

    if (mode === 'system') {
        html.dataset.fontMode = 'system'
        html.style.setProperty('--ff-ui', SYSTEM_STACK)
        removeStyle()
        persist(mode, '')
        return
    }

    if (mode === 'local' && family) {
        html.dataset.fontMode = 'local'
        const stack = `"${family}", ${SYSTEM_STACK}`
        html.style.setProperty('--ff-ui', stack)
        persist(mode, family)
        return
    }

    // default
    html.dataset.fontMode = 'default'
    html.style.removeProperty('--ff-ui')
    removeStyle()
    persist('default', '')
}

function persist(mode, family) {
    try {
        localStorage.setItem(LS_FONT_MODE, mode)
        if (family) localStorage.setItem(LS_FONT_FAMILY, family)
        else localStorage.removeItem(LS_FONT_FAMILY)
    } catch { /* ignore */ }
}

/**
 * 从本地文件加载字体并应用
 * @param {File} file
 */
export async function applyLocalFontFile(file) {
    if (!file) throw new Error('未选择字体文件')
    const name = deriveFontName(file.name)
    const url = URL.createObjectURL(file)

    const css = `@font-face {
    font-family: "${name}";
    src: url("${url}") format("${formatFromExt(file.name)}");
    font-display: swap;
  }`

    let style = document.getElementById(STYLE_ID)
    if (!style) {
        style = document.createElement('style')
        style.id = STYLE_ID
        document.head.appendChild(style)
    }
    style.textContent = css

    if (currentObjectUrl) {
        try { URL.revokeObjectURL(currentObjectUrl) } catch { /* ignore */ }
    }
    currentObjectUrl = url

    // 等字体加载完成再应用，避免闪烁
    try {
        if (document.fonts && document.fonts.load) {
            await document.fonts.load(`16px "${name}"`)
        }
    } catch { /* ignore */ }

    applyFont({ mode: 'local', family: name })
    return { name, url }
}

function deriveFontName(filename) {
    const base = String(filename).replace(/\.[^.]+$/, '')
    return `UserLocal-${base.replace(/[^\w\-]+/g, '_').slice(0, 40)}`
}

function formatFromExt(filename) {
    const ext = String(filename).split('.').pop().toLowerCase()
    switch (ext) {
        case 'woff2': return 'woff2'
        case 'woff':  return 'woff'
        case 'ttf':   return 'truetype'
        case 'otf':   return 'opentype'
        default:      return 'truetype'
    }
}

function removeStyle() {
    const style = document.getElementById(STYLE_ID)
    if (style) style.remove()
    if (currentObjectUrl) {
        try { URL.revokeObjectURL(currentObjectUrl) } catch { /* ignore */ }
        currentObjectUrl = null
    }
}

/** 初始化：恢复上次的字体设置（local 模式下仅恢复 family，字体文件需用户重选） */
export function initFont() {
    const mode = getStoredFontMode()
    const family = getStoredFontFamily()
    if (mode === 'local' && family) {
    // 无文件无法还原真实字体，先按名称写入，用户重新选择文件后覆盖
        const html = document.documentElement
        html.dataset.fontMode = 'local'
        const stack = `"${family}", ${SYSTEM_STACK}`
        html.style.setProperty('--ff-ui', stack)
        return
    }
    applyFont({ mode, family })
}

export const FONT_MODES = [
    { value: 'default', label: '内置字体' },
    { value: 'system',  label: '系统字体' },
    { value: 'local',   label: '本地字体' }
]
