import { caretOffsetIn, moveCaretTo } from '../utils/caret.js'

export function adaptField(el) {
    if (!el || el.nodeType !== 1) return null
    if (el.disabled || el.readOnly) return null

    const tag = el.tagName
    const isInput = tag === 'INPUT'
    const isArea = tag === 'TEXTAREA'
    const isEditable = el.isContentEditable === true
    if (!isInput && !isArea && !isEditable) return null
    if (isInput && !['text', 'search', 'email', 'url', 'tel', ''].includes((el.type || '').toLowerCase())) return null

    return {
        el,
        multiline: isArea || isEditable,
        getValue: () => (isEditable ? (el.value ?? el.textContent ?? '') : el.value),
        setValue: (next) => {
            const text = String(next ?? '')
            if (isEditable) {
                el.value = text
                return
            }
            el.value = text
        },
        getCaret: () => (isEditable
            ? (caretOffsetIn(el) ?? (el.value ?? el.textContent ?? '').length)
            : (el.selectionStart ?? el.value.length)),
        setCaret: (pos) => {
            if (isEditable) {
                moveCaretTo(el, pos)
                return
            }
            try { el.setSelectionRange(pos, pos) } catch {   }
        },
        focus: () => el.focus()
    }
}
