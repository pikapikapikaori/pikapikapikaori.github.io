/**
 * 带提示层的 contenteditable 输入框：输入是推导值前缀时用灰字补齐剩余部分，否则显示 placeholder。
 * 提示层与输入框分两层，原文始终带 <bdi lang dir>。
 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'
import { createEditableInput } from './editable-input.js'

/**
 * @param {object} options value / lang / bdiLang（只改 bdi 判定语言）/ dir / className / placeholder / dataset / disabled / getGhost（每次刷新时调用）/ onInput
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
        // 程序化赋值（按锚点自动回填类型说明、查询回填词干…）同样要刷新提示层
        onValueChange: () => refresh(),
        onInput: (e) => {
            refresh()
            if (typeof onInput === 'function') onInput(e)
        }
    })

    const el = h('span', { class: 'ghost-input' }, hint, input)

    /** 当前的推导值 */
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
