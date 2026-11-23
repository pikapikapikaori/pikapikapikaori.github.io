
import { h } from '../utils/dom.js'
import { bdiFragment } from '../utils/bdi.js'

let labelSeq = 0

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
    const labelEl = label?.nodeType === 1
        ? label
        : h('span', {}, bdiFragment(label, lang))
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
        hint ? h('span', { class: 'field__hint' }, bdiFragment(hint, lang)) : null
    )
}
