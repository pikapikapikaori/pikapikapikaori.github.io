/**
 * 带「推导提示」的输入框
 *
 * 输入框为空或用户输入的是推导值的前缀时，在文字后面叠一层灰色剩余部分
 * （幽灵文字，类似补全提示）；用户输入的字符与推导值不符时立即消失。
 * 提示不参与取值，只是显示。
 */

import { h } from '../utils/dom.js'
import { bdiText, hasScript, needsBdi } from '../utils/bdi.js'

/**
 * @param {object} options
 *   value         初始值
 *   lang          字体语言
 *   dir           书写方向（bdi 语言用 auto / rtl）
 *   className     输入框 class（默认 input）
 *   placeholder   没有推导提示时显示的原生 placeholder
 *   getGhost      () => string  当前的推导值（每次刷新时调用）
 *   dataset       输入框上的 data-* 属性（便于外部定位）
 *   onInput       (event) => void
 * @returns {{ el: HTMLElement, input: HTMLInputElement, refresh: () => void }}
 */
export function createGhostInput({
    value = '',
    lang = null,
    dir = null,
    className = 'input',
    placeholder = '',
    dataset = null,
    getGhost = null,
    onInput = null
} = {}) {
    const hint = h('span', { class: 'ghost-input__hint', 'aria-hidden': 'true' })

    const input = h('input', {
        class: className,
        type: 'text',
        lang: lang || undefined,
        dir: dir || 'auto',
        placeholder,
        value,
        dataset,
        oninput: (e) => {
            refresh()
            if (typeof onInput === 'function') onInput(e)
        }
    })

    const el = h('span', { class: 'ghost-input' }, hint, input)

    /** 语言文字（希伯来文 / 满文）的 placeholder 只能自己画，原生 placeholder 带不了标记 */
    const placeholderNeedsHint = needsBdi(lang) && hasScript(placeholder, lang)

    function refresh() {
        const target = typeof getGhost === 'function' ? String(getGhost() || '') : ''
        const current = input.value
        const showGhost = !!target && target !== current && target.startsWith(current)

        if (showGhost) {
            hint.hidden = false
            input.placeholder = ''
            hint.replaceChildren(
                h('span', { class: 'ghost-input__typed' }, bdiText(current, lang)),
                h('span', { class: 'ghost-input__rest' }, bdiText(target.slice(current.length), lang))
            )
            return
        }

        // 没有推导提示时：中文说明的 placeholder 用原生，含原文的 placeholder 自己画
        if (placeholderNeedsHint && !current) {
            hint.hidden = false
            input.placeholder = ''
            hint.replaceChildren(h('span', { class: 'ghost-input__rest' }, bdiText(placeholder, lang)))
            return
        }
        hint.hidden = true
        hint.replaceChildren()
        input.placeholder = placeholder
    }

    refresh()
    return { el, input, refresh }
}
