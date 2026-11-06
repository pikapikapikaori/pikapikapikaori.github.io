/** 表单字段：标题 + 控件 + 提示。 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'

/** 文档内自增，保证 aria-labelledby 的 id 唯一 */
let labelSeq = 0

/** 点标题时该聚焦谁：ghost-input 取里面的 contenteditable，其余用元素本身 */
export function focusTargetOf(control) {
    if (!control) return null
    if (control.nodeType !== 1) return focusTargetOf(control.input || control.el)
    if (control.classList.contains('ghost-input')) {
        return control.querySelector('.input--editable') || control
    }
    return control
}

export function fieldRow(label, control, {
    extras = [], className = '', hint = '', lang = null, target = null
} = {}) {
    const labelEl = label?.nodeType === 1 ? label : h('span', {}, label)
    labelEl.classList.add('field__label')
    if (!labelEl.id) labelEl.id = `field-label-${++labelSeq}`

    const focusable = target || focusTargetOf(control)
    if (focusable && typeof focusable.focus === 'function') {
        focusable.setAttribute('aria-labelledby', labelEl.id)
        // 不用 <label> 包控件：它会把点击转发给内部第一个按钮，点「词干」的标题就会直接生成表格
        labelEl.addEventListener('click', () => focusable.focus())
    }

    return h('div', { class: className ? `field ${className}` : 'field' },
        labelEl,
        control,
        extras,
        hint ? h('span', { class: 'field__hint' }, bdiText(hint, lang)) : null
    )
}
