/**
 * contenteditable 单行输入框
 *
 * 原生 <input> 只能放纯文本，没法把原文包进 <bdi>（希伯来文 RTL、满文竖写放在中文界面里
 * 需要独立的方向，否则会带偏周围的标点与排版）。这里用 contenteditable 自绘一个：
 *
 *   - 外观对齐 `.input`（class 仍是 input，样式复用）；
 *   - `el.value` 读写纯文本，`oninput` 里的 `e.target.value` 照旧可用；
 *   - 每次输入后把内容按 Unicode 范围重新包 <bdi lang dir>（拆分规则见 utils/bdi.js），
 *     并用「字符偏移」恢复光标，所以不会跳字；
 *   - 输入法组合期间不重建 DOM，组合结束后再统一重建；
 *   - `el.placeholder` 只是记账，真正的提示由 ghost-input.js 叠一层画出来
 *     （中文说明在 <bdi> 外，原文部分在 <bdi> 里）。
 *
 * 用法：
 *   const el = createEditableInput({ value, lang })
 *   el.value          // 读 / 写纯文本（写入会触发 onValueChange，外层据此刷新提示层）
 *   el.placeholder    // 读 / 写提示文字（触发 onPlaceholderChange）
 */

import { h } from '../utils/dom.js'
import { bdiText, splitScriptRuns } from '../utils/bdi.js'

/** 光标在元素内的字符偏移（bdi 里的文字按逻辑顺序计） */
function caretOffset(el) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const range = sel.getRangeAt(0)
    if (range.endContainer !== el && !el.contains(range.endContainer)) return null
    const before = document.createRange()
    before.selectNodeContents(el)
    before.setEnd(range.endContainer, range.endOffset)
    return before.toString().length
}

function applyRange(range) {
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(range)
}

/** 把光标放到第 offset 个字符处 */
function setCaret(el, offset) {
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

    /** 当前 DOM 是否已经是「该文字都包在 bdi 里」的形状 */
    function isPainted(text) {
        const runs = splitScriptRuns(text, scriptLang)
        const expected = runs.filter((run) => run.text)
        const nodes = Array.from(el.childNodes).filter((node) =>
            node.nodeType !== Node.TEXT_NODE || node.nodeValue)
        if (nodes.length !== expected.length) return false
        return expected.every((run, i) => {
            const node = nodes[i]
            return (node.nodeName === 'BDI') === run.script && (node.textContent || '') === run.text
        })
    }

    function paint(text) {
        el.replaceChildren(bdiText(text, scriptLang))
    }

    let lastText = null

    /** 把内容重新包好 bdi，并尽量把光标留在原处 */
    function sync() {
        const text = readText()
        if (text === lastText && isPainted(text)) return
        const offset = caretOffset(el)
        paint(text)
        lastText = text
        if (offset != null) setCaret(el, offset)
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
            // 程序化赋值（如按语法锚点自动回填）也要让外层更新提示层
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
