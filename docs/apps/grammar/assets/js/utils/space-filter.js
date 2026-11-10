/** 表单里的空白：词条类字段不收任何空白，正文类字段只收两端。 */

export const NO_SPACE = 'none'
export const EDGE_SPACE = 'edges'

/** 收掉两端；`none` 连词中的一起收掉 */
export function cleanSpace(text, mode) {
    const src = String(text ?? '')
    if (mode === NO_SPACE) return src.replace(/\s+/g, '')
    if (mode === EDGE_SPACE) return src.replace(/^\s+|\s+$/g, '')
    return src
}

/** 输入过程中只收开头：词中的空格要留着，否则「两个词」之间的空格刚敲出来就被删掉 */
function cleanWhileTyping(text, mode) {
    const src = String(text ?? '')
    if (mode === NO_SPACE) return src.replace(/\s+/g, '')
    if (mode === EDGE_SPACE) return src.replace(/^\s+/, '')
    return src
}

/**
 * 过滤一段正在输入的文字。删掉的字符如果落在插入点之前，插入点跟着回退，
 * 否则光标会跳到末尾。
 */
export function filterTyping(text, mode, caret = null) {
    const src = String(text ?? '')
    const out = cleanWhileTyping(src, mode)
    if (out === src || caret == null) return { text: out, caret }
    return { text: out, caret: cleanWhileTyping(src.slice(0, caret), mode).length }
}

function modeOf(el) {
    return el instanceof HTMLElement && el.dataset ? el.dataset.space : null
}

function isNativeField(el) {
    return el instanceof HTMLElement
        && !el.isContentEditable
        && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
}

/** 原生输入框：输入时收，失焦与粘贴后把两端收干净。自绘输入框在 editable-input 里处理。 */
export function watchSpaceFields(root) {
    root.addEventListener('input', (e) => {
        const el = e.target
        if (!isNativeField(el)) return
        const mode = modeOf(el)
        if (!mode || e.isComposing) return
        const before = el.value
        const { text, caret } = filterTyping(before, mode, el.selectionStart)
        if (text === before) return
        el.value = text
        if (caret != null) el.setSelectionRange(caret, caret)
    })

    root.addEventListener('focusout', (e) => {
        const el = e.target
        if (!isNativeField(el)) return
        const mode = modeOf(el)
        if (!mode) return
        const next = cleanSpace(el.value, mode)
        if (next !== el.value) el.value = next
    })

    root.addEventListener('paste', (e) => {
        const el = e.target
        if (!isNativeField(el)) return
        const mode = modeOf(el)
        if (!mode) return
        const text = e.clipboardData ? e.clipboardData.getData('text/plain') : ''
        if (!text) return
        // 单行输入框里的换行折成空格；两端等浏览器插完再一并收掉
        if (el.tagName === 'INPUT' && /[\r\n]/.test(text)) {
            e.preventDefault()
            el.setRangeText(text.replace(/[\r\n]+/g, ' '), el.selectionStart, el.selectionEnd, 'end')
            el.dispatchEvent(new Event('input', { bubbles: true }))
            return
        }
        setTimeout(() => {
            const next = cleanSpace(el.value, mode)
            if (next !== el.value) el.value = next
        }, 0)
    })
}
