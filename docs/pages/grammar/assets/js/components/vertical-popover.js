/**
 * 竖排 popover
 * 事件委托：整个文档里任何带 lang 属性、且该语言 vertical: true、
 * 且文本真的包含该语言字符的元素，在 hover（延迟）或 click 时，
 * 在鼠标位置附近弹出一个只包含竖排原文的浮层。
 */

import { h } from '../utils/dom.js'
import { getLanguage } from '../data/languages.js'

const HOVER_DELAY = 200
const HIDE_DELAY = 120
const EDGE_MARGIN = 12

/**
 * 各竖排语言的 Unicode 脚本范围。
 * 只有文本里至少含有一个该范围内的字符，才触发 popover。
 * 这样行头、按钮、纯中文/拉丁内容都不会误触发。
 */
const VERTICAL_SCRIPT_RANGES = {
    // 传统蒙古文 / 满文 / 锡伯文，U+1800 – U+18AF
    mnc: /[\u1800-\u18AF]/
}

let popoverEl = null
let currentSourceEl = null
let hoverTimer = null
let hideTimer = null
let attached = false

/* ---------------- 判定 ---------------- */

function isVerticalEl(el) {
    if (!el || !el.getAttribute) return false
    const lang = el.getAttribute('lang')
    if (!lang) return false
    const meta = getLanguage(lang)
    return !!(meta && meta.vertical)
}

function hasVerticalScript(el, lang) {
    const text = el.textContent || ''
    if (!text) return false
    const re = VERTICAL_SCRIPT_RANGES[lang]
    if (!re) return true // 未登记脚本范围的语言，默认放行
    return re.test(text)
}

function findVerticalEl(node) {
    let cur = node
    while (cur && cur !== document && cur.nodeType === 1) {
        if (cur.hasAttribute('lang')) {
            const lang = cur.getAttribute('lang')
            if (isVerticalEl(cur) && hasVerticalScript(cur, lang)) return cur
        }
        cur = cur.parentNode
    }
    return null
}

/* ---------------- 定时器 ---------------- */

function clearTimers() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

/* ---------------- DOM ---------------- */

function ensurePopover() {
    if (popoverEl) return popoverEl

    popoverEl = h('div', {
        class: 'vertical-popover',
        role: 'tooltip',
        'aria-hidden': 'false'
    })

    // 内部交互不关闭
    popoverEl.addEventListener('mousedown', (e) => e.stopPropagation())
    popoverEl.addEventListener('mouseover', () => cancelHide())
    popoverEl.addEventListener('mouseout', (e) => {
        const to = e.relatedTarget
        if (to && popoverEl.contains(to)) return
        scheduleHide()
    })

    document.body.appendChild(popoverEl)
    return popoverEl
}

/* ---------------- 显示 / 隐藏 ---------------- */

function show(sourceEl, x, y) {
    const text = (sourceEl.textContent || '').trim()
    if (!text) return

    const el = ensurePopover()
    el.textContent = text
    el.setAttribute('lang', sourceEl.getAttribute('lang') || '')
    currentSourceEl = sourceEl

    // 字体跟随源元素，略放大一点便于看清
    const srcSize = parseFloat(getComputedStyle(sourceEl).fontSize) || 16
    el.style.fontSize = Math.max(16, srcSize * 1.15) + 'px'

    el.style.left = '0px'
    el.style.top = '0px'
    el.style.visibility = 'hidden'
    el.style.display = 'block'

    const pw = el.offsetWidth
    const ph = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x + 10
    let top = y + 10

    if (left + pw + EDGE_MARGIN > vw) left = x - pw - 10
    if (top + ph + EDGE_MARGIN > vh) top = y - ph - 10

    left = Math.max(EDGE_MARGIN, Math.min(left, vw - pw - EDGE_MARGIN))
    top = Math.max(EDGE_MARGIN, Math.min(top, vh - ph - EDGE_MARGIN))

    el.style.left = left + 'px'
    el.style.top = top + 'px'
    el.style.visibility = ''
}

function hide() {
    clearTimers()
    if (popoverEl) popoverEl.style.display = 'none'
    currentSourceEl = null
}

function scheduleHide(delay = HIDE_DELAY) {
    cancelHide()
    hideTimer = setTimeout(hide, delay)
}

export function hideVerticalPopover() {
    hide()
}

/* ---------------- 事件 ---------------- */

function onMouseOver(e) {
    // 鼠标进入 popover 内部：取消待隐藏
    if (popoverEl && popoverEl.contains(e.target)) {
        cancelHide()
        return
    }

    const el = findVerticalEl(e.target)
    if (!el) return

    // 无论后面是否重新计时，先取消待隐藏
    cancelHide()

    // 已经显示的就是这个元素：保持，不再重新计时
    if (el === currentSourceEl && popoverEl && popoverEl.style.display !== 'none') {
        return
    }

    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    hoverTimer = setTimeout(() => {
        hoverTimer = null
        show(el, e.clientX, e.clientY)
    }, HOVER_DELAY)
}

function onMouseOut(e) {
    const el = findVerticalEl(e.target)
    if (!el) return

    if (!el.isConnected) {
        hide()
        return
    }

    const to = e.relatedTarget
    if (to && (el.contains(to) || (popoverEl && popoverEl.contains(to)))) return

    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    scheduleHide()
}

function onClick(e) {
    if (popoverEl && popoverEl.contains(e.target)) return

    const el = findVerticalEl(e.target)
    if (el) {
        e.stopPropagation()
        e.preventDefault()
        clearTimers()
        show(el, e.clientX, e.clientY)
    } else {
        hide()
    }
}

function onKeyDown(e) {
    if (e.key === 'Escape') hide()
}

function onScroll() { hide() }
function onResize() { hide() }

/* ---------------- 注册 ---------------- */

export function attachVerticalPopover() {
    if (attached) return
    attached = true

    document.addEventListener('mouseover', onMouseOver, true)
    document.addEventListener('mouseout', onMouseOut, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
}
