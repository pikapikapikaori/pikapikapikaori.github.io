/**
 * 原文预览浮层（竖排 / RTL 文字的 popover）
 * 事件委托：整个文档里任何带 lang 属性、且该语言登记在 SCRIPT_POPUP_LANGS 里、
 * 且文本真的包含该语言字符的元素，在 hover（延迟）或 click 时，
 * 在鼠标位置附近弹出一个只包含**原文**（<bdi> 里的内容）的浮层。
 * 竖写语言用竖排样式，其余语言用放大的横排原文。
 */

import { h } from '../utils/dom.js'
import { getLanguage } from '../data/languages.js'
import { SCRIPT_POPUP_LANGS } from '../config/config.js'

const HOVER_DELAY = 200
const HIDE_DELAY = 120
const EDGE_MARGIN = 12

let popoverEl = null
let currentSourceEl = null
let hoverTimer = null
let hideTimer = null
let attached = false

/* ---------------- 判定 ---------------- */

function isPopupLang(el) {
    if (!el || !el.getAttribute) return false
    const lang = el.getAttribute('lang')
    if (!lang) return false
    return Object.prototype.hasOwnProperty.call(SCRIPT_POPUP_LANGS, lang)
}

/**
 * 元素的「可读文本」：输入框 / 文本框取 value；
 * 普通元素优先取里面 <bdi> 的内容（只显示原文，不带中文说明），没有才退回 textContent。
 */
function textOf(el) {
    if (!el) return ''
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return el.value || ''
    const bdis = el.querySelectorAll ? el.querySelectorAll('bdi') : []
    if (bdis.length) return [...bdis].map((x) => x.textContent).join(' ').trim()
    return el.textContent || ''
}

function hasVerticalScript(el, lang) {
    const text = textOf(el)
    if (!text) return false
    const re = SCRIPT_POPUP_LANGS[lang]
    if (!re) return true // 未登记脚本范围的语言，默认放行
    return re.test(text)
}

function findVerticalEl(node) {
    let cur = node
    while (cur && cur !== document && cur.nodeType === 1) {
        if (cur.hasAttribute('lang')) {
            const lang = cur.getAttribute('lang')
            if (isPopupLang(cur) && hasVerticalScript(cur, lang)) return cur
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
    const text = textOf(sourceEl).trim()
    if (!text) return

    const el = ensurePopover()
    el.textContent = text
    const lang = sourceEl.getAttribute('lang') || ''
    const meta = getLanguage(lang)
    el.setAttribute('lang', lang)
    el.setAttribute('dir', meta && meta.rtl ? 'rtl' : 'auto')
    // 竖写语言用竖排样式，其余语言用放大的横排原文
    el.classList.toggle('vertical-popover--horizontal', !(meta && meta.vertical))
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
    // 输入框 / 自绘输入框里点击要留给光标定位，不能拦截
    const tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.target instanceof Element && e.target.closest('[contenteditable]')) return

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

/** 输入框内容变了：正在显示的浮层已经过期，先收起 */
function onInput(e) {
    if (currentSourceEl && currentSourceEl === e.target) hide()
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
    document.addEventListener('input', onInput, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
}
