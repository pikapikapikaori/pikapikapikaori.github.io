import { LS_KEYS, getEnum, getString, setString, remove } from '../store/local-storage.js'

const LS_FONT_MODE = LS_KEYS.font
const LS_FONT_FAMILY = LS_KEYS.fontFamily
const LS_FONT_SIZE = LS_KEYS.fontSize

const FONT_MODE_VALUES = ['default', 'system', 'local']

const STYLE_ID = 'ln-user-font'

const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'

let currentObjectUrl = null

export function getStoredFontMode() {
    return getEnum(LS_FONT_MODE, FONT_MODE_VALUES, 'default')
}

export function getStoredFontFamily() {
    return getString(LS_FONT_FAMILY, '')
}

export const FONT_SIZES = [
    { value: '14', label: '小' },
    { value: '16', label: '标准' },
    { value: '18', label: '大' },
    { value: '20', label: '特大' }
]

const FONT_SIZE_VALUES = FONT_SIZES.map((f) => f.value)

export function getStoredFontSize() {
    return getEnum(LS_FONT_SIZE, FONT_SIZE_VALUES, '16')
}

export function applyFontSize(size) {
    const px = FONT_SIZES.some((f) => f.value === String(size)) ? String(size) : '16'
    document.documentElement.style.setProperty('--fs-base', `${px}px`)
    setString(LS_FONT_SIZE, px)
}

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

    html.dataset.fontMode = 'default'
    html.style.removeProperty('--ff-ui')
    removeStyle()
    persist('default', '')
}

function persist(mode, family) {
    setString(LS_FONT_MODE, mode)
    if (family) setString(LS_FONT_FAMILY, family)
    else remove(LS_FONT_FAMILY)
}

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
    const previousCss = style.textContent
    style.textContent = css

    const faces = await loadFace(name).catch(() => [])
    if (!faces.length || faces.some((face) => face.status === 'error')) {
        style.textContent = previousCss
        try { URL.revokeObjectURL(url) } catch {   }
        throw new Error('这个文件不是能用的字体')
    }

    if (currentObjectUrl) {
        try { URL.revokeObjectURL(currentObjectUrl) } catch {   }
    }
    currentObjectUrl = url

    applyFont({ mode: 'local', family: name })
    return { name, url }
}

function loadFace(name) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve([])
    return document.fonts.load(`16px "${name}"`)
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
        try { URL.revokeObjectURL(currentObjectUrl) } catch {   }
        currentObjectUrl = null
    }
}

export function initFont() {
    const mode = getStoredFontMode()
    const family = getStoredFontFamily()
    if (mode === 'local' && family) {
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
