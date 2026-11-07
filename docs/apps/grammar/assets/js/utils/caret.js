/** contenteditable 里的光标读写：偏移按元素内的字符数算，bdi 里的文字按逻辑顺序计。 */

export function caretOffsetIn(el) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const range = sel.getRangeAt(0)
    if (range.endContainer !== el && !el.contains(range.endContainer)) return null
    const before = document.createRange()
    before.selectNodeContents(el)
    before.setEnd(range.endContainer, range.endOffset)
    return before.toString().length
}

export function moveCaretTo(el, offset) {
    const range = document.createRange()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let remaining = Math.max(0, offset)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const len = node.nodeValue.length
        if (remaining <= len) {
            range.setStart(node, remaining)
            range.collapse(true)
            applyRange(range)
            return
        }
        remaining -= len
    }
    range.selectNodeContents(el)
    range.collapse(false)
    applyRange(range)
}

export function applyRange(range) {
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(range)
}
