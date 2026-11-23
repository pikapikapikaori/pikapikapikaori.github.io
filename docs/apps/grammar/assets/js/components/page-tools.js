import { h } from '../utils/dom.js'
import { BREVE_LANGS } from '../config/config.js'
import { romanKey, breveKey, getBool, setBool } from '../store/local-storage.js'

function findScroller(start) {
    let el = start?.parentElement || null
    while (el && el !== document.body && el !== document.documentElement) {
        const style = getComputedStyle(el)
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el
        el = el.parentElement
    }
    return window
}

export function createPageTools({ lang, toRoman = null, onChange = null, onBreveChange = null, anchorEl = null } = {}) {
    const key = romanKey(lang)
    let romanOn = key ? getBool(key, false) : false

    const breveStorageKey = breveKey(lang)
    let breveOn = breveStorageKey ? getBool(breveStorageKey, false) : false

    const scroller = findScroller(anchorEl)

    function scrollTopNow() {
        if (scroller !== window) return scroller.scrollTop || 0
        return Math.max(
            window.scrollY || 0,
            document.documentElement?.scrollTop || 0,
            document.body?.scrollTop || 0
        )
    }

    const topBtn = h('button', {
        class: 'page-tools__btn page-tools__btn--top',
        type: 'button',
        title: '回到顶部',
        'aria-label': '回到顶部',
        hidden: true,
        onclick: () => {
            if (scroller !== window) { scroller.scrollTo({ top: 0, behavior: 'smooth' }); return }
            window.scrollTo({ top: 0, behavior: 'smooth' })
            if (document.body) document.body.scrollTop = 0
            if (document.documentElement) document.documentElement.scrollTop = 0
        }
    }, '↑')

    const romanBtn = h('button', {
        class: 'page-tools__btn',
        type: 'button',
        title: toRoman ? '显示转写' : '这门语言没有转写',
        'aria-pressed': romanOn ? 'true' : 'false',
        disabled: !toRoman,
        onclick: () => {
            if (!toRoman) return
            romanOn = !romanOn
            if (key) setBool(key, romanOn)
            sync()
            if (typeof onChange === 'function') onChange(romanOn)
        }
    }, '文')

    const breveBtn = BREVE_LANGS.includes(lang)
        ? h('button', {
            class: 'page-tools__btn' + (breveOn ? ' page-tools__btn--on' : ''),
            type: 'button',
            title: breveOn ? '隐藏短音符' : '显示短音符',
            'aria-pressed': breveOn ? 'true' : 'false',
            onclick: () => {
                breveOn = !breveOn
                if (breveStorageKey) setBool(breveStorageKey, breveOn)
                syncBreve()
                if (typeof onBreveChange === 'function') onBreveChange(breveOn)
            }
        }, '\u0102')
        : null

    function syncBreve() {
        if (!breveBtn) return
        breveBtn.setAttribute('aria-pressed', breveOn ? 'true' : 'false')
        breveBtn.classList.toggle('page-tools__btn--on', breveOn)
        breveBtn.title = breveOn ? '隐藏短音符' : '显示短音符'
    }

    function sync() {
        romanBtn.setAttribute('aria-pressed', romanOn ? 'true' : 'false')
        romanBtn.classList.toggle('page-tools__btn--on', romanOn)
        romanBtn.textContent = romanOn ? 'A' : '文'
    }
    sync()

    function onScroll() {
        const limit = (scroller === window ? window.innerHeight : scroller.clientHeight) * 0.8
        const show = scrollTopNow() > limit
        if (topBtn.hidden === !show) return
        topBtn.hidden = !show
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    onScroll()

    const el = h('div', { class: 'page-tools' }, breveBtn, toRoman ? romanBtn : null, topBtn)

    return {
        el,
        isOn: () => romanOn,
        isBreveOn: () => breveOn,
        destroy() {
            scroller.removeEventListener('scroll', onScroll)
            document.removeEventListener('scroll', onScroll, { capture: true })
            el.remove()
        }
    }
}
