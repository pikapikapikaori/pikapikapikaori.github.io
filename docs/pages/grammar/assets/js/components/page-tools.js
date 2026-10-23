import { h } from '../utils/dom.js'

/**
 * 语法页右下角的浮动工具：回到顶部 + 显示转写
 *
 * - 回到顶：页面滚过一屏后出现（语法页很长）
 * - 显示转写：只有提供 `toRoman` 的语言可用（满文 / 天城文），否则禁用；
 *   状态按语言记在 localStorage（`ln.roman.<lang>`），默认关闭
 *
 * @param {object} options
 *   lang       语言 code（用于记忆开关状态）
 *   toRoman    (text) => string | null  文字 → 转写；为 null 时开关禁用
 *   onChange   (on: boolean) => void
 * @returns {{ el: HTMLElement, destroy: () => void }}
 */
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

export function createPageTools({ lang, toRoman = null, onChange = null, anchorEl = null } = {}) {
    const key = `ln.roman.${lang}`
    let romanOn = false
    try { romanOn = localStorage.getItem(key) === '1' } catch { /* ignore */ }

    // 页面的滚动容器可能是 window，也可能是某个 overflow 容器，挂载时先找出来
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

    // 没有转写的语言：整个按钮都不渲染
    const el = h('div', { class: 'page-tools' }, toRoman ? romanBtn : null, topBtn)

    return {
        el,
        isOn: () => romanOn,
        destroy() {
            scroller.removeEventListener('scroll', onScroll)
            document.removeEventListener('scroll', onScroll, { capture: true })
            el.remove()
        }
    }
}
