/** 自绘的单行 contenteditable 输入框，支持 bdi 包裹与占位文字。 */

import { h } from '../utils/dom.js'
import { bdiNode, hasScript } from '../utils/bdi.js'
import { applyRange, caretOffsetIn, moveCaretTo } from '../utils/caret.js'

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
    // 字体语言（lang）与 bdi 判定用的语言可以不同：如「含义」输入框字体是中文，但里面可能贴原文
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

    /** 内容 → 纯文本（单行：换行折成空格） */
    function readText() {
        return (el.textContent || '').replace(/[\r\n]+/g, ' ')
    }

    /** bdi 上该带哪个语言：只有真含这门语言的文字时才标（纯转写不标） */
    function paintLang(text) {
        return hasScript(text, scriptLang) ? scriptLang : null
    }

    /** 当前 DOM 是否已经是「整段一个 bdi」的形状 */
    function isPainted(text) {
        if (!text) return el.childNodes.length === 0
        const only = Array.from(el.childNodes).filter((node) =>
            node.nodeType !== Node.TEXT_NODE || node.nodeValue)
        if (only.length !== 1) return false
        const node = only[0]
        return node.nodeName === 'BDI' && (node.textContent || '') === text
    }

    /** 整段一个 bdi：字体栈自己会回落，不必逐字符切段 */
    function paint(text) {
        if (!text) {
            el.replaceChildren()
            return
        }
        el.replaceChildren(bdiNode(text, paintLang(text)))
    }

    let lastText = null

    /** 把内容重新包好 bdi，并尽量把光标留在原处 */
    function sync() {
        const text = readText()
        if (text === lastText && isPainted(text)) return
        const offset = caretOffsetIn(el)
        paint(text)
        lastText = text
        if (offset != null) moveCaretTo(el, offset)
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

    /** 在光标处插入纯文本（粘贴用，避免把剪贴板里的 HTML 带进来） */
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
    el.addEventListener('paste', (e) => {
        const text = e.clipboardData ? e.clipboardData.getData('text/plain') : ''
        if (!text) return
        e.preventDefault()
        insertText(text.replace(/[\r\n]+/g, ' '))
        sync()
        emitInput()
    })
    el.addEventListener('keydown', (e) => {
        if (e.shiftKey) return
        if (e.key !== 'Enter' && e.key !== 'NumpadEnter') return
        // 和原生 <input> 一致：回车提交所在表单，而不是换行
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
    // 初始 placeholder 不通知：此时调用方还没拿到返回的元素
    placeholderText = String(placeholder ?? '')
    el.disabled = disabled
    return el
}
