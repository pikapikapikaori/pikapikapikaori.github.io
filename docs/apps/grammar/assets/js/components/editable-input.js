import { h } from '../utils/dom.js'
import { bdiNode, hasScript } from '../utils/bdi.js'
import { applyRange, caretOffsetIn, moveCaretTo } from '../utils/caret.js'
import { cleanSpace, filterTyping } from '../utils/space-filter.js'

export function createEditableInput({
    value = '',
    lang = null,
    bdiLang = null,
    dir = null,
    className = 'input',
    placeholder = '',
    dataset = null,
    disabled = false,
    onInput = null,
    onValueChange = null,
    onPlaceholderChange = null
} = {}) {
    const scriptLang = bdiLang || lang

    const classes = [...new Set(['input', 'input--editable',
        ...String(className || '').split(/\s+/).filter(Boolean)])]

    const el = h('div', {
        class: classes.join(' '),
        contenteditable: 'true',
        role: 'textbox',
        'aria-multiline': 'false',
        tabindex: '0',
        spellcheck: 'false',
        autocapitalize: 'off',
        autocomplete: 'off',
        lang: lang || undefined,
        dir: dir || 'auto',
        dataset
    })

    function readText() {
        return (el.textContent || '').replace(/[\r\n]+/g, ' ')
    }

    function paintLang(text) {
        return hasScript(text, scriptLang) ? scriptLang : null
    }

    function isPainted(text) {
        if (!text) return el.childNodes.length === 0
        const only = Array.from(el.childNodes).filter((node) =>
            node.nodeType !== Node.TEXT_NODE || node.nodeValue)
        if (only.length !== 1) return false
        const node = only[0]
        return node.nodeName === 'BDI' && (node.textContent || '') === text
    }

    function paint(text) {
        if (!text) {
            el.replaceChildren()
            return
        }
        el.replaceChildren(bdiNode(text, paintLang(text)))
    }

    let lastText = null

    function sync() {
        const caret = caretOffsetIn(el)
        const mode = el.dataset ? el.dataset.space : null
        const raw = readText()
        const { text, caret: nextCaret } = mode ? filterTyping(raw, mode, caret) : { text: raw, caret }
        if (text === lastText && isPainted(text)) return
        paint(text)
        lastText = text
        if (nextCaret != null) moveCaretTo(el, nextCaret)
    }

    function emitInput() {
        if (typeof onInput === 'function') onInput({ target: el, type: 'input' })
    }

    function submitForm() {
        const form = el.closest('form')
        if (!form) return
        if (typeof form.requestSubmit === 'function') form.requestSubmit()
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    }

    function insertText(text) {
        const sel = window.getSelection()
        const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null
        if (!range || (range.commonAncestorContainer !== el && !el.contains(range.commonAncestorContainer))) {
            el.appendChild(document.createTextNode(text))
            return
        }
        range.deleteContents()
        const node = document.createTextNode(text)
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)
        applyRange(range)
    }

    let composing = false
    el.addEventListener('compositionstart', () => { composing = true })
    el.addEventListener('compositionend', () => {
        composing = false
        sync()
        emitInput()
    })
    el.addEventListener('input', (e) => {
        if (!composing && !e.isComposing) sync()
        emitInput()
    })
    el.addEventListener('focusout', () => {
        const mode = el.dataset ? el.dataset.space : null
        if (!mode) return
        const text = cleanSpace(readText(), mode)
        if (text === readText()) return
        paint(text)
        lastText = text
        emitInput()
    })
    el.addEventListener('paste', (e) => {
        const text = e.clipboardData ? e.clipboardData.getData('text/plain') : ''
        if (!text) return
        e.preventDefault()
        insertText(text.replace(/[\r\n]+/g, ' '))
        sync()
        emitInput()
        const mode = el.dataset ? el.dataset.space : null
        if (!mode) return
        const clean = cleanSpace(readText(), mode)
        if (clean === readText()) return
        paint(clean)
        lastText = clean
        moveCaretTo(el, clean.length)
        emitInput()
    })
    el.addEventListener('keydown', (e) => {
        if (e.shiftKey) return
        if (e.key !== 'Enter' && e.key !== 'NumpadEnter') return
        e.preventDefault()
        submitForm()
    })
    el.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
            e.preventDefault()
            submitForm()
        }
    })

    Object.defineProperty(el, 'value', {
        get: () => readText(),
        set: (next) => {
            const text = String(next ?? '')
            if (readText() === text) return
            paint(text)
            lastText = text
            if (typeof onValueChange === 'function') onValueChange()
        }
    })

    let placeholderText = ''
    Object.defineProperty(el, 'placeholder', {
        get: () => placeholderText,
        set: (next) => {
            const text = String(next ?? '')
            if (text === placeholderText) return
            placeholderText = text
            if (typeof onPlaceholderChange === 'function') onPlaceholderChange()
        }
    })

    let disabledState = false
    Object.defineProperty(el, 'disabled', {
        get: () => disabledState,
        set: (next) => {
            disabledState = !!next
            el.setAttribute('contenteditable', disabledState ? 'false' : 'true')
            el.setAttribute('tabindex', disabledState ? '-1' : '0')
            if (disabledState) el.setAttribute('aria-disabled', 'true')
            else el.removeAttribute('aria-disabled')
        }
    })

    paint(String(value ?? ''))
    lastText = readText()
    placeholderText = String(placeholder ?? '')
    el.disabled = disabled
    return el
}
