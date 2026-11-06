/** 带灰字补全与键帽提示的输入框。 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'
import { createEditableInput } from './editable-input.js'

/**
 * `spaceKey` 为真时右缘挂「空格」键帽；有补全时灰字尾部挂「Tab」。
 * @returns {{ el, input, refresh }}
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
    spaceKey = false,
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

    const showSpaceKey = spaceKey && !disabled
    const el = h('span', { class: showSpaceKey ? 'ghost-input ghost-input--space' : 'ghost-input' }, hint, input,
        showSpaceKey ? h('span', { class: 'ghost-input__key', 'aria-hidden': 'true' }, '空格') : null)

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
                h('span', { class: 'ghost-input__rest' }, bdiText(target.slice(current.length), scriptLang)),
                h('span', { class: 'ghost-input__key ghost-input__key--tab', 'aria-hidden': 'true' }, 'Tab')
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
