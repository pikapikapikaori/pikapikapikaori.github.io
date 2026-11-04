import { h } from '../utils/dom.js'
import { BREVE_LANGS } from '../config/config.js'

/** 从挂载点往上找真正在滚的容器；找不到就用 window */
function findScroller(start) {
    let el = start?.parentElement || null
    while (el && el !== document.body && el !== document.documentElement) {
        const style = getComputedStyle(el)
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el
        el = el.parentElement
    }
    return window
}

/**
 * 页面右下角的浮动工具：回到顶部 + 显示转写（无 toRoman 时不渲染）+ 显示短音符（只有拉丁语 / 古希腊语有）。
 * 两个开关的状态都按语言存 localStorage。
 * @param {object} options lang / toRoman（(text) => string | null）/ onChange(on) / onBreveChange(on) / anchorEl
 * @returns {{ el: HTMLElement, isOn: () => boolean, isBreveOn: () => boolean, destroy: () => void }}
 */
export function createPageTools({ lang, toRoman = null, onChange = null, onBreveChange = null, anchorEl = null } = {}) {
    const key = `ln.roman.${lang}`
    let romanOn = false
    try { romanOn = localStorage.getItem(key) === '1' } catch { /* ignore */ }

    const breveKey = `ln.breve.${lang}`
    let breveOn = false
    try { breveOn = localStorage.getItem(breveKey) === '1' } catch { /* ignore */ }

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
        class: 'page-tools__btn',
        type: 'button',
        title: '回到顶部',
        'aria-label': '回到顶部',
        hidden: true,
        onclick: () => {
            if (scroller !== window) { scroller.scrollTo({ top: 0, behavior: 'smooth' }); return }
            window.scrollTo({ top: 0, behavior: 'smooth' })
            // 有些浏览器把滚动记在 body 上
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
            try { localStorage.setItem(key, romanOn ? '1' : '0') } catch { /* ignore */ }
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
                try { localStorage.setItem(breveKey, breveOn ? '1' : '0') } catch { /* ignore */ }
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
    // 兜底：容器判定不准时，任何滚动都重新算一次
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
