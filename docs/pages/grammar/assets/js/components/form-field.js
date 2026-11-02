/**
 * 表单字段：标题 + 控件 + 提示。
 *
 * 故意不用 <label> 包控件：<label> 会把点击转发给内部第一个 labelable 后代，
 * 而这里的控件常是 contenteditable（不是 labelable）或自绘下拉按钮（是 labelable），
 * 于是点标题会落到按钮上——「词干」那行会直接生成表格、覆盖已填的变格变位。
 * 改成点标题只把焦点交给控件。
 */

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

/**
 * @param {string|HTMLElement} label 标题文本，或已经是元素（如「变格 / 变位类型」会随语言变）
 * @param {HTMLElement} control 控件
 * @param {object} [opts]
 * @param {HTMLElement[]} [opts.extras] 控件后面按顺序追加的节点（如状态行）
 * @param {string} [opts.className] 追加到 .field 上的类
 * @param {string} [opts.hint] 提示文本
 * @param {string|null} [opts.lang] 提示文本的语言（决定 bdi 方向）
 * @param {HTMLElement|null} [opts.target] 覆盖聚焦目标；控件是 .field__row 等容器时必须显式给
 */
export function fieldRow(label, control, {
    extras = [], className = '', hint = '', lang = null, target = null
} = {}) {
    const labelEl = label?.nodeType === 1 ? label : h('span', {}, label)
    labelEl.classList.add('field__label')
    if (!labelEl.id) labelEl.id = `field-label-${++labelSeq}`

    const focusable = target || focusTargetOf(control)
    if (focusable && typeof focusable.focus === 'function') {
        focusable.setAttribute('aria-labelledby', labelEl.id)
        labelEl.addEventListener('click', () => focusable.focus())
    }

    return h('div', { class: className ? `field ${className}` : 'field' },
        labelEl,
        control,
        extras,
        hint ? h('span', { class: 'field__hint' }, bdiText(hint, lang)) : null
    )
}
