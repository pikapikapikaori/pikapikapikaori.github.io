
export const NO_SPACE = 'none'
export const EDGE_SPACE = 'edges'

export function cleanSpace(text, mode) {
    const src = String(text ?? '')
    if (mode === NO_SPACE) return src.replace(/\s+/g, '')
    if (mode === EDGE_SPACE) return src.replace(/^\s+|\s+$/g, '')
    return src
}

function cleanWhileTyping(text, mode) {
    const src = String(text ?? '')
    if (mode === NO_SPACE) return src.replace(/\s+/g, '')
    if (mode === EDGE_SPACE) return src.replace(/^\s+/, '')
    return src
}

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
