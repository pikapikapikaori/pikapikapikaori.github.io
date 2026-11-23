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

function isPopupLang(el) {
    if (!el || !el.getAttribute) return false
    const lang = el.getAttribute('lang')
    if (!lang) return false
    return Object.prototype.hasOwnProperty.call(SCRIPT_POPUP_LANGS, lang)
}

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
    if (!re) return true
    return re.test(text)
}

function findVerticalEl(node) {
    if (node && node.closest && node.closest('.ime')) return null
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

function clearTimers() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function ensurePopover() {
    if (popoverEl) return popoverEl

    popoverEl = h('div', {
        class: 'vertical-popover',
        role: 'tooltip',
        'aria-hidden': 'false'
    })

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

function show(sourceEl, x, y) {
    const text = textOf(sourceEl).trim()
    if (!text) return

    const el = ensurePopover()
    el.textContent = text
    const lang = sourceEl.getAttribute('lang') || ''
    const meta = getLanguage(lang)
    el.setAttribute('lang', lang)
    el.setAttribute('dir', meta && meta.rtl ? 'rtl' : 'auto')
    el.classList.toggle('vertical-popover--horizontal', !(meta && meta.vertical))
    currentSourceEl = sourceEl

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

function onMouseOver(e) {
    if (e.target.closest && e.target.closest('.ime')) {
        hide()
        return
    }

    if (popoverEl && popoverEl.contains(e.target)) {
        cancelHide()
        return
    }

    const el = findVerticalEl(e.target)
    if (!el) return

    cancelHide()

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

function onInput(e) {
    if (currentSourceEl && currentSourceEl === e.target) hide()
}

function onScroll() { hide() }
function onResize() { hide() }

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
