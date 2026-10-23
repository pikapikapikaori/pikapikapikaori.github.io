/**
 * 带「提示层」的输入框（contenteditable）
 *
 * 原生 <input> 的 placeholder 不能带标记，原文（希伯来文 / 满文）没法包 <bdi>；
 * 这里在输入框上叠一层自己画的提示：
 *
 *   - 推导提示（ghost）：输入的是推导值的前缀时，把剩下的部分用灰字补在后面，
 *     不参与取值，只作显示（和原来的幽灵文字行为一致）；
 *   - placeholder：没有推导提示时显示，中文说明与原文混排也能正确隔离方向。
 *
 * 输入框本身是 components/editable-input.js 的 contenteditable，所以文字里的
 * 原文始终带 <bdi lang dir>。
 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'
import { createEditableInput } from './editable-input.js'

/**
 * @param {object} options
 *   value         初始值
 *   lang          字体语言（同时作为 bdi 判定语言）
 *   bdiLang       只改 bdi 判定语言（如「含义」：字体按 zh / en，但内容里可能有原文）
 *   dir           书写方向（默认 auto，内容里的方向交给 <bdi>）
 *   className     输入框 class（默认 input）
 *   placeholder   没有推导提示时显示的提示
 *   getGhost      () => string  当前的推导值（每次刷新时调用）
 *   dataset       输入框上的 data-* 属性（便于外部定位）
 *   onInput       (event) => void
 *   disabled      只读
 * @returns {{ el: HTMLElement, input: HTMLElement, refresh: () => void }}
 */
export function createGhostInput({
    value = '',
    lang = null,
    bdiLang = null,
    dir = null,
    className = 'input',
    placeholder = '',
    dataset = null,
    disabled = false,
    getGhost = null,
    onInput = null
} = {}) {
    const scriptLang = bdiLang || lang
    const hint = h('span', { class: 'ghost-input__hint', 'aria-hidden': 'true' })

    const input = createEditableInput({
        value,
        lang,
        bdiLang,
        dir,
        className,
        placeholder,
        dataset,
        disabled,
        onPlaceholderChange: () => refresh(),
        // 程序化赋值（按锚点自动回填类型说明、查询回填主要部分…）同样要刷新提示层
        onValueChange: () => refresh(),
        onInput: (e) => {
            refresh()
            if (typeof onInput === 'function') onInput(e)
        }
    })

    const el = h('span', { class: 'ghost-input' }, hint, input)

    /** 当前的推导值（每次刷新时调用） */
    function ghostTarget() {
        return typeof getGhost === 'function' ? String(getGhost() || '') : ''
    }

    // Tab 补全：当前输入是推导值的前缀时，按 Tab 直接补成完整值（否则保留正常的焦点切换）
    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return
        const target = ghostTarget()
        const current = input.value
        if (!target || target === current || !target.startsWith(current)) return
        e.preventDefault()
        input.value = target
        input.dispatchEvent(new Event('input'))
        const range = document.createRange()
        range.selectNodeContents(input)
        range.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(range)
        }
        refresh()
    })

    function refresh() {
        const target = ghostTarget()
        const current = input.value
        const showGhost = !!target && target !== current && target.startsWith(current)

        if (showGhost) {
            hint.hidden = false
            hint.replaceChildren(
                h('span', { class: 'ghost-input__typed' }, bdiText(current, scriptLang)),
                h('span', { class: 'ghost-input__rest' }, bdiText(target.slice(current.length), scriptLang))
            )
            return
        }

        const tip = input.placeholder
        if (!current && tip) {
            hint.hidden = false
            hint.replaceChildren(h('span', { class: 'ghost-input__rest' }, bdiText(tip, scriptLang)))
            return
        }

        hint.hidden = true
        hint.replaceChildren()
    }

    refresh()
    return { el, input, refresh }
}
