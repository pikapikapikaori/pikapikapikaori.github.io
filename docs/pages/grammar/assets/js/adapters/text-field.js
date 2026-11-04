/**
 * 输入框适配器：把 <input> / <textarea> / 自绘 contenteditable（editable-input）统一成
 * 「读值 / 写值 / 取光标 / 设光标」四件事，输入助手只认这一层。
 *
 * contenteditable 的偏移量按逻辑字符算（与 editable-input 的 caretOffset 同一套算法），
 * 这样希腊语、希伯来语的组合符不会把光标算错。
 */

function caretOffsetOfEditable(el) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const range = sel.getRangeAt(0)
    if (range.endContainer !== el && !el.contains(range.endContainer)) return null
    const before = document.createRange()
    before.selectNodeContents(el)
    before.setEnd(range.endContainer, range.endOffset)
    return before.toString().length
}

function setCaretOfEditable(el, offset) {
    const range = document.createRange()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let remaining = Math.max(0, offset)
    const sel = window.getSelection()
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const len = node.nodeValue.length
        if (remaining <= len) {
            range.setStart(node, remaining)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
            return
        }
        remaining -= len
    }
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
}

/** 能接管就返回适配器，否则 null */
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
            ? (caretOffsetOfEditable(el) ?? (el.value ?? el.textContent ?? '').length)
            : (el.selectionStart ?? el.value.length)),
        setCaret: (pos) => {
            if (isEditable) {
                setCaretOfEditable(el, pos)
                return
            }
            try { el.setSelectionRange(pos, pos) } catch { /* 个别 input 类型不支持选区 */ }
        },
        focus: () => el.focus()
    }
}
