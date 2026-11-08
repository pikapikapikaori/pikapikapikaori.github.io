/** 笔记编辑：一行一块。回车成块，离开即排版，行可拖动换位。 */

import { h, replace } from '../utils/dom.js'
import { uid } from '../utils/id.js'
import {
    renderNoteLine, renderNoteTable, renderNoteQuote,
    isPipeLine, isTableSeparator, isQuoteLine, lineInfo, leadingIndent,
    indentLevel, INDENT_WIDTH
} from '../utils/note-markdown.js'

const SAVE_DELAY = 600
const PLACEHOLDER = '写一行…'
const DRAG_DELAY = 180
const DRAG_STEP = 6
const DOUBLE_TAP = 500

const WRAPS = {
    bold: ['**', '**'],
    italic: ['*', '*'],
    strike: ['~~', '~~'],
    underline: ['<u>', '</u>']
}

/** 列表、引用、标题的行首记号 */
const PREFIX = {
    heading: /^\s*(#{1,6})\s+/,
    check: /^\s*[-*+]\s+\[[ xX]\]\s+/,
    bullet: /^\s*[-*+]\s+/,
    number: /^\s*\d{1,3}[.)]\s+/,
    quote: /^\s*>\s?/
}

const ONLY_PREFIX = /^\s*(?:[-*+]\s+\[[ xX]\]|[-*+]\s+|\d{1,3}[.)]\s+|>\s?)\s*$/
const RULE_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const DETAILS_TPL = '<details><summary>标题</summary>内容</details>'

const BULLETS = ['•', '◦', '▪']

/**
 * @param {object} opts
 * @param {string[]} opts.lines 已保存的行
 * @param {string} opts.lang 语言代码，交给字体栈与 <bdi>
 * @param {(lines: string[]) => void} [opts.onSave]
 * @param {(state: object) => void} [opts.onStateChange]
 */
export function createNoteEditor({ lines, lang, onSave = null, onStateChange = null } = {}) {
    let items = toBlocks(lines)
    let editingId = null
    let lastCaret = { id: null, start: 0, end: 0 }
    let saveTimer = 0
    let destroyed = false
    let drag = null
    let lastTap = { id: null, time: 0 }

    const el = h('div', { class: 'note-list', role: 'group', 'aria-label': '笔记' })

    function getBlock(id) {
        return items.find((block) => block.id === id) || null
    }

    /* ---------------- 渲染 ---------------- */

    function render({ caret = null, end = null } = {}) {
        const markers = listMarkers()
        const frag = document.createDocumentFragment()

        for (const group of layoutGroups()) {
            if (group.kind === 'table') frag.appendChild(tableRow(group))
            else if (group.kind === 'quote') frag.appendChild(quoteGroup(group))
            else frag.appendChild(lineRow(group.blocks[0], markers.get(group.blocks[0].id)))
        }
        replace(el, frag)

        for (const area of el.querySelectorAll('.note-row__input')) grow(area)

        if (editingId) {
            const ta = findInput(editingId)
            if (ta) {
                ta.focus()
                const start = caret == null ? ta.value.length : clamp(caret, 0, ta.value.length)
                const stop = end == null ? start : clamp(end, start, ta.value.length)
                ta.setSelectionRange(start, stop)
                rememberCaret(ta)
            }
        }
        emitState()
    }

    /** 相邻的竖线行是一张表，相邻的引用行是一段引用；其余各自成行 */
    function layoutGroups() {
        const out = []
        let i = 0
        while (i < items.length) {
            const block = items[i]

            if (isPipeLine(block.source)) {
                let j = i
                while (j < items.length && isPipeLine(items[j].source)) j += 1
                const run = items.slice(i, j)
                const isTable = run.length >= 3 && isTableSeparator(run[1].source)
                const editing = run.some((row) => row.id === editingId)
                if (isTable && !editing) {
                    out.push({ kind: 'table', blocks: run })
                } else {
                    // 改表格时整块拆成原文行：同组还没轮到的那几行照原样显示竖线
                    for (const row of run) {
                        out.push({ kind: 'line', blocks: [{ ...row, raw: isTable }] })
                    }
                }
                i = j
                continue
            }

            if (isQuoteLine(block.source)) {
                let j = i
                while (j < items.length && isQuoteLine(items[j].source)) j += 1
                out.push({ kind: 'quote', blocks: items.slice(i, j) })
                i = j
                continue
            }

            out.push({ kind: 'line', blocks: [block] })
            i += 1
        }
        return out
    }

    /** 有序列表的序号按层级算：一级 1. 二级 1) 三级 i */
    function listMarkers() {
        const map = new Map()
        const counters = []
        for (const block of items) {
            const info = lineInfo(block.source)
            if (info.kind === 'none') {
                counters.length = 0
                continue
            }
            const level = info.level
            counters.length = level + 1
            if (info.kind === 'ul') {
                map.set(block.id, { label: BULLETS[Math.min(level, BULLETS.length - 1)] })
            } else if (info.kind === 'ol') {
                // 只有有序项推进编号：同一段里的无序项不该把 1. 顶成 2.
                counters[level] = (counters[level] || 0) + 1
                map.set(block.id, { label: orderedLabel(level, counters[level]) })
            }
        }
        return map
    }

    function lineRow(block, marker) {
        const isEditing = block.id === editingId
        const row = h('div', {
            class: 'note-row' + (isEditing ? ' is-editing' : ''),
            dataset: { id: block.id }
        })
        row.appendChild(grip([block.id]))
        row.appendChild(isEditing ? inputFor(block) : viewFor(block, marker))
        return row
    }

    function tableRow(group) {
        const row = h('div', {
            class: 'note-row note-row--table',
            dataset: { run: group.blocks[0].id }
        })
        row.appendChild(grip(group.blocks.map((block) => block.id)))
        row.appendChild(viewBox(renderNoteTable(group.blocks, { lang }), group.blocks[0].id, ''))
        return row
    }

    /**
     * 一段引用：左边一条贯通整段的竖线。
     * 不编辑时行尾的 `\` 会把下一行接成同一段；编辑时逐行显示，竖线仍不断开。
     */
    function quoteGroup(group) {
        const ids = group.blocks.map((block) => block.id)
        const wrap = h('div', { class: 'note-row-group note-quote-group', dataset: { run: ids[0] } })
        const editing = group.blocks.some((block) => block.id === editingId)

        if (editing) {
            for (const block of group.blocks) {
                const isEditing = block.id === editingId
                const row = h('div', {
                    class: 'note-row' + (isEditing ? ' is-editing' : ''),
                    dataset: { id: block.id }
                })
                row.appendChild(grip(ids))
                row.appendChild(isEditing
                    ? inputFor(block)
                    : viewBox(renderNoteLine(quoteBody(block.source), { lang }), block.id, block.source))
                wrap.appendChild(row)
            }
            return wrap
        }

        const owners = quoteOwners(group.blocks)
        const paragraphs = renderNoteQuote(group.blocks.map((block) => block.source))
        paragraphs.forEach((text, i) => {
            const row = h('div', { class: 'note-row', dataset: { id: owners[i] || ids[0] } })
            row.appendChild(grip(ids))
            row.appendChild(viewBox(renderNoteLine(text, { lang }), owners[i] || ids[0], text))
            wrap.appendChild(row)
        })
        return wrap
    }

    function viewFor(block, marker) {
        if (block.raw) {
            return viewBox(
                h('div', { class: 'note-line note-raw', text: block.source || '| |' }),
                block.id,
                block.source
            )
        }
        const node = renderNoteLine(block.source, {
            lang,
            marker,
            placeholder: !block.source.trim() && items.length === 1 ? PLACEHOLDER : ''
        })
        return viewBox(node, block.id, block.source)
    }

    /** 排版后的行也能用键盘到达：回车进入编辑 */
    function viewBox(node, id, source) {
        const view = h('div', { class: 'note-row__view', tabindex: '0' }, node)
        view.addEventListener('keydown', (e) => {
            if (e.target !== view) return
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            const at = String(source ?? '').length
            startEditing(id, { start: at, end: at })
        })
        return view
    }

    function inputFor(block) {
        return h('textarea', {
            class: 'note-row__input',
            rows: '1',
            spellcheck: 'false',
            autocapitalize: 'off',
            autocomplete: 'off',
            lang,
            dir: 'auto',
            placeholder: PLACEHOLDER,
            value: block.source,
            dataset: { id: block.id, imeRaw: 'true' }
        })
    }

    function grip(ids) {
        const handle = h('button', {
            class: 'note-grip',
            type: 'button',
            tabindex: '-1',
            'aria-hidden': 'true',
            title: '拖动换行（也可以按 Alt + 上下方向键）'
        }, '⠿')
        handle.addEventListener('pointerdown', (e) => startDrag(e, ids))
        return handle
    }

    /* ---------------- 编辑与会话状态 ---------------- */

    function findInput(id) {
        return Array.from(el.querySelectorAll('.note-row__input'))
            .find((area) => area.dataset.id === id) || null
    }

    function activeInput() {
        const active = document.activeElement
        if (!active || !active.classList || !active.classList.contains('note-row__input')) return null
        return el.contains(active) ? active : null
    }

    function startEditing(id, range) {
        if (!getBlock(id)) return
        if (editingId === id) {
            const ta = activeInput() || findInput(id)
            if (ta) {
                ta.focus()
                if (range) ta.setSelectionRange(range.start, range.end)
            }
            return
        }
        editingId = id
        render(range ? { caret: range.start, end: range.end } : {})
    }

    /** 没有输入框聚焦时（刚离开某行），恢复到上次的位置再执行命令 */
    function ensureInput() {
        const active = activeInput()
        if (active) return active
        const target = lastCaret.id && getBlock(lastCaret.id) ? lastCaret.id : items[items.length - 1].id
        editingId = target
        const block = getBlock(target)
        const start = clamp(lastCaret.start, 0, block.source.length)
        const stop = clamp(lastCaret.end, start, block.source.length)
        render({ caret: start, end: stop })
        return findInput(target)
    }

    function rememberCaret(ta) {
        lastCaret = { id: ta.dataset.id, start: ta.selectionStart, end: ta.selectionEnd }
    }

    function commit(ta, value, start, stop) {
        const block = getBlock(ta.dataset.id)
        if (!block) return
        ta.value = value
        block.source = value
        grow(ta)
        ta.setSelectionRange(start, stop)
        rememberCaret(ta)
        emitState()
        scheduleSave()
    }

    function emitState() {
        if (typeof onStateChange === 'function') onStateChange(readState())
    }

    /* ---------------- 存盘 ---------------- */

    function scheduleSave() {
        clearTimeout(saveTimer)
        saveTimer = setTimeout(flushSave, SAVE_DELAY)
    }

    function flushSave() {
        clearTimeout(saveTimer)
        saveTimer = 0
        if (typeof onSave === 'function') onSave(items.map((block) => block.source))
    }

    /* ---------------- 键盘 ---------------- */

    function splitBlock(ta) {
        const block = getBlock(ta.dataset.id)
        if (!block) return
        const value = ta.value
        const start = ta.selectionStart
        const stop = ta.selectionEnd

        // 只写了记号的行：回车后退出这一层
        if (start === value.length && ONLY_PREFIX.test(value)) {
            const indent = leadingIndent(value)
            const bare = indent + value.slice(indent.length)
                .replace(/^(?:[-*+]|\d{1,3}[.)]|>)\s*(?:\[[ xX]\]\s*)?/, '')
            commit(ta, bare, bare.length, bare.length)
            return
        }

        const left = value.slice(0, start)
        const right = value.slice(stop)
        block.source = left
        const next = { id: uid('n'), source: prefixFor(left) + right }
        items.splice(items.indexOf(block) + 1, 0, next)
        editingId = next.id
        flushSave()
        render({ caret: next.source.length - right.length })
    }

    function backspaceAtStart(ta) {
        const block = getBlock(ta.dataset.id)
        if (!block) return
        const index = items.indexOf(block)

        if (!block.source) {
            if (items.length === 1) return
            const target = items[index - 1] || items[index + 1]
            items.splice(index, 1)
            editingId = target.id
            flushSave()
            render({ caret: target.source.length })
            return
        }

        if (index === 0) return
        const prev = items[index - 1]
        const caret = prev.source.length

        // 同类合并不留两个记号；引用并到普通行时去掉 `>`
        const info = lineInfo(block.source)
        const prevInfo = lineInfo(prev.source)
        let body = block.source
        if (info.kind !== 'none' && info.kind === prevInfo.kind) {
            body = stripIndent(stripPrefix(block.source))
        } else if (info.kind === 'quote') {
            body = quoteBody(block.source)
        }

        prev.source += body
        items.splice(index, 1)
        editingId = prev.id
        flushSave()
        render({ caret })
    }

    /** 方向键到行首行尾还没动：跨到上一行或下一行 */
    function arrowBeyondRow(ta, key) {
        const before = ta.selectionStart
        const dir = key === 'ArrowUp' ? -1 : 1
        requestAnimationFrame(() => {
            if (destroyed || document.activeElement !== ta) return
            if (ta.selectionStart !== before) return
            const index = items.findIndex((block) => block.id === ta.dataset.id)
            const next = items[index + dir]
            if (!next) return
            startEditing(next.id, dir < 0
                ? { start: next.source.length, end: next.source.length }
                : { start: 0, end: 0 })
        })
    }

    function moveBlock(id, dir) {
        const active = activeInput()
        const caret = active && active.dataset.id === id ? active.selectionStart : lastCaret.start
        const index = items.findIndex((block) => block.id === id)
        const to = index + dir
        if (index < 0 || to < 0 || to >= items.length) return
        const [block] = items.splice(index, 1)
        items.splice(to, 0, block)
        editingId = block.id
        flushSave()
        render({ caret })
    }

    /* ---------------- 工具条命令 ---------------- */

    function applyCommand(cmd) {
        const ta = ensureInput()
        if (!ta) return

        if (WRAPS[cmd]) {
            const [open, close] = WRAPS[cmd]
            toggleWrap(ta, open, close)
            return
        }
        if (cmd === 'indent') return indentLine(ta, 1)
        if (cmd === 'outdent') return indentLine(ta, -1)
        if (cmd === 'link') return insertLink(ta)
        if (cmd === 'image') return insertImage(ta)
        if (cmd === 'hr') return insertRule(ta)
        if (cmd === 'details') return insertDetails(ta)
        return setLineKind(ta, cmd)
    }

    /** 整行进退一级缩进，光标跟着移动 */
    function indentLine(ta, dir) {
        const value = ta.value
        const indent = leadingIndent(value)
        const current = indentLevel(value)
        const target = Math.max(0, current + dir)
        if (target === current) return

        const body = value.slice(indent.length)
        const next = ' '.repeat(target * INDENT_WIDTH) + body
        const delta = next.length - value.length
        commit(
            ta,
            next,
            clamp(ta.selectionStart + delta, 0, next.length),
            clamp(ta.selectionEnd + delta, 0, next.length)
        )
    }

    function toggleWrap(ta, open, close) {
        const value = ta.value
        const start = ta.selectionStart
        const stop = ta.selectionEnd
        const selected = value.slice(start, stop)

        if (selected.length >= open.length + close.length
            && selected.startsWith(open) && selected.endsWith(close)) {
            const inner = selected.slice(open.length, selected.length - close.length)
            commit(ta, value.slice(0, start) + inner + value.slice(stop), start, start + inner.length)
            return
        }

        if (start >= open.length
            && value.slice(start - open.length, start) === open
            && value.slice(stop, stop + close.length) === close) {
            const from = start - open.length
            const to = stop + close.length
            commit(ta, value.slice(0, from) + selected + value.slice(to), from, from + selected.length)
            return
        }

        if (start === stop) {
            const span = spanAround(value, start, open, close)
            if (span) {
                commit(
                    ta,
                    value.slice(0, span.start) + value.slice(span.innerStart, span.innerEnd) + value.slice(span.end),
                    span.innerStart,
                    span.innerEnd
                )
                return
            }
        }

        const wrapped = open + selected + close
        commit(
            ta,
            value.slice(0, start) + wrapped + value.slice(stop),
            start + open.length,
            start + open.length + selected.length
        )
    }

    function setLineKind(ta, kind) {
        const value = ta.value
        const current = lineKindOf(value)
        const indent = leadingIndent(value)
        const bare = stripPrefix(value)
        const body = bare.slice(indent.length)
        const length = ta.selectionEnd - ta.selectionStart
        let prefix

        if (kind === 'paragraph') prefix = ''
        else if (/^h[1-6]$/.test(kind)) prefix = current === kind ? '' : `${'#'.repeat(Number(kind.slice(1)))} `
        else if (kind === 'ul') prefix = current === 'ul' ? '' : '- '
        else if (kind === 'ol') prefix = current === 'ol' ? '' : '1. '
        else if (kind === 'todo') prefix = current === 'todo' ? '' : '- [ ] '
        else if (kind === 'quote') prefix = current === 'quote' ? '' : '> '
        else return

        const next = indent + prefix + body
        const caret = clamp(ta.selectionStart + (next.length - value.length), 0, next.length)
        commit(ta, next, caret, clamp(caret + length, 0, next.length))
    }

    function insertLink(ta) {
        const value = ta.value
        const start = ta.selectionStart
        const stop = ta.selectionEnd
        const picked = value.slice(start, stop)
        const label = picked || '文字'
        const text = `[${label}](链接地址)`
        const next = value.slice(0, start) + text + value.slice(stop)
        if (picked) {
            const urlAt = start + label.length + 3
            commit(ta, next, urlAt, urlAt + 4)
        } else {
            commit(ta, next, start + 1, start + 1 + label.length)
        }
    }

    function insertImage(ta) {
        const value = ta.value
        const start = ta.selectionStart
        const stop = ta.selectionEnd
        const picked = value.slice(start, stop)
        const label = picked || '图片'
        const text = `![${label}](图片地址)`
        const next = value.slice(0, start) + text + value.slice(stop)
        if (picked) {
            const urlAt = start + label.length + 4
            commit(ta, next, urlAt, urlAt + 4)
        } else {
            commit(ta, next, start + 2, start + 2 + label.length)
        }
    }

    /** 在光标所在行之后新起一行，并把光标放进去 */
    function insertLineAfter(ta, source, caret, end = caret) {
        const block = getBlock(ta.dataset.id)
        if (!block) return
        const next = { id: uid('n'), source }
        items.splice(items.indexOf(block) + 1, 0, next)
        editingId = next.id
        flushSave()
        render(caret == null ? {} : { caret, end })
    }

    /** 分隔线独占一行：空行就地变成线，有内容就在下面新起一块 */
    function insertRule(ta) {
        if (RULE_LINE.test(ta.value)) {
            commit(ta, '', 0, 0)
            return
        }
        if (!ta.value.trim()) {
            commit(ta, '---', 3, 3)
            return
        }
        insertLineAfter(ta, '---', 3)
    }

    function insertDetails(ta) {
        const at = DETAILS_TPL.indexOf('标题')
        if (!ta.value.trim()) {
            commit(ta, DETAILS_TPL, at, at + 2)
            return
        }
        // 光标选中「标题」两个字，直接输入就是替换
        insertLineAfter(ta, DETAILS_TPL, at, at + 2)
    }

    function readState() {
        const ta = activeInput()
        const id = ta ? ta.dataset.id : (lastCaret.id || '')
        const block = getBlock(id) || items[items.length - 1]
        const source = ta ? ta.value : (block ? block.source : '')
        const start = ta ? ta.selectionStart : lastCaret.start
        const stop = ta ? ta.selectionEnd : lastCaret.end
        return {
            kind: lineKindOf(source),
            bold: hasWrap(source, start, stop, '**', '**'),
            italic: hasWrap(source, start, stop, '*', '*'),
            strike: hasWrap(source, start, stop, '~~', '~~'),
            underline: hasWrap(source, start, stop, '<u>', '</u>')
        }
    }

    /* ---------------- 拖动 ---------------- */

    function startDrag(e, ids) {
        if (e.button !== 0 && e.pointerType !== 'touch') return
        e.preventDefault()
        drag = {
            ids,
            startY: e.clientY,
            active: false,
            timer: 0,
            target: null,
            indicator: null,
            scrollDir: 0,
            raf: 0
        }
        if (e.pointerType === 'touch') drag.timer = setTimeout(beginDrag, DRAG_DELAY)
        window.addEventListener('pointermove', onDragMove)
        window.addEventListener('pointerup', onDragEnd)
        window.addEventListener('pointercancel', onDragEnd)
    }

    function beginDrag() {
        if (!drag || drag.active) return
        drag.active = true
        if (drag.timer) { clearTimeout(drag.timer); drag.timer = 0 }
        document.body.classList.add('note-dragging')
        editingId = null
        render()
        markDragSources()
        drag.indicator = h('div', { class: 'note-drop' })
    }

    function markDragSources() {
        const moved = new Set(drag.ids)
        for (const row of el.querySelectorAll('.note-row')) {
            const key = row.dataset.id || row.dataset.run
            row.classList.toggle('is-drag-source', moved.has(key))
        }
    }

    function onDragMove(e) {
        if (!drag) return
        if (!drag.active) {
            if (Math.abs(e.clientY - drag.startY) < DRAG_STEP) return
            beginDrag()
        }
        if (!drag.active) return
        placeIndicator(e.clientY)
        autoScroll(e.clientY)
    }

    function placeIndicator(y) {
        const moved = new Set(drag.ids)
        const rows = Array.from(el.querySelectorAll('.note-row'))
            .filter((row) => !moved.has(row.dataset.id || row.dataset.run))
        let target = null
        for (const row of rows) {
            const rect = row.getBoundingClientRect()
            if (y < rect.top + rect.height / 2) { target = row; break }
        }
        drag.target = target
        if (target) el.insertBefore(drag.indicator, target)
        else el.appendChild(drag.indicator)
    }

    function autoScroll(y) {
        const margin = 70
        let dir = 0
        if (y < margin) dir = -1
        else if (y > window.innerHeight - margin) dir = 1
        if (dir === drag.scrollDir) return
        drag.scrollDir = dir
        if (drag.raf) cancelAnimationFrame(drag.raf)
        drag.raf = 0
        if (!dir) return
        const step = () => {
            if (!drag || !drag.active || !drag.scrollDir) return
            window.scrollBy(0, drag.scrollDir * 12)
            drag.raf = requestAnimationFrame(step)
        }
        drag.raf = requestAnimationFrame(step)
    }

    function onDragEnd() {
        window.removeEventListener('pointermove', onDragMove)
        window.removeEventListener('pointerup', onDragEnd)
        window.removeEventListener('pointercancel', onDragEnd)
        if (!drag) return
        if (drag.timer) clearTimeout(drag.timer)
        if (drag.raf) cancelAnimationFrame(drag.raf)

        const moved = new Set(drag.ids)
        const targetKey = drag.target ? (drag.target.dataset.id || drag.target.dataset.run) : null
        const active = drag.active
        drag = null

        if (!active) return

        document.body.classList.remove('note-dragging')
        const blocks = items.filter((block) => moved.has(block.id))
        items = items.filter((block) => !moved.has(block.id))
        let index = items.length
        if (targetKey) {
            const at = items.findIndex((block) => block.id === targetKey)
            if (at >= 0) index = at
        }
        items.splice(index, 0, ...blocks)
        if (!items.length) items = toBlocks([])
        flushSave()
        render()
    }

    /* ---------------- 事件 ---------------- */

    el.addEventListener('click', (e) => {
        const check = e.target.closest('.note-check')
        if (!check) return
        e.preventDefault()
        toggleTodo(check)
    })

    /** 单击只管眼前这个控件：复选框、折叠三角、链接。改一行要双击 */
    el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.shiftKey) return
        const target = e.target instanceof Element ? e.target : e.target.parentElement
        if (!target) return
        if (target.closest('.note-check')) return
        if (target.closest('.note-grip')) return
        if (target.closest('a')) return
        if (target.classList.contains('note-row__input')) return

        const row = target.closest('[data-id]')
        if (!row || !row.dataset.id) return
        const id = row.dataset.id
        const now = Date.now()

        if (lastTap.id === id && now - lastTap.time < DOUBLE_TAP) {
            lastTap = { id: null, time: 0 }
            const block = getBlock(id)
            if (!block) return
            e.preventDefault()
            const at = block.source.length
            startEditing(id, { start: at, end: at })
            return
        }
        lastTap = { id, time: now }
    })

    el.addEventListener('input', (e) => {
        const ta = e.target
        if (!ta.classList || !ta.classList.contains('note-row__input')) return
        const block = getBlock(ta.dataset.id)
        if (!block) return
        block.source = ta.value
        grow(ta)
        rememberCaret(ta)
        scheduleSave()
        emitState()
    })

    el.addEventListener('select', (e) => {
        if (e.target.classList && e.target.classList.contains('note-row__input')) rememberCaret(e.target)
    })

    el.addEventListener('keyup', (e) => {
        if (e.target.classList && e.target.classList.contains('note-row__input')) rememberCaret(e.target)
    })

    el.addEventListener('keydown', (e) => {
        const ta = e.target
        if (!ta.classList || !ta.classList.contains('note-row__input')) return
        if (e.isComposing || e.keyCode === 229) return

        if (e.key === 'Escape') {
            e.preventDefault()
            ta.blur()
            return
        }

        if (e.key === 'Tab') {
            const level = indentLevel(ta.value)
            // 第一级上再按 Shift+Tab：让焦点照常走出输入框
            if (!e.shiftKey || level > 0) {
                e.preventDefault()
                indentLine(ta, e.shiftKey ? -1 : 1)
            }
            return
        }

        if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            splitBlock(ta)
            return
        }

        if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0) {
            e.preventDefault()
            backspaceAtStart(ta)
            return
        }

        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault()
            moveBlock(ta.dataset.id, e.key === 'ArrowUp' ? -1 : 1)
            return
        }

        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
            arrowBeyondRow(ta, e.key)
            return
        }

        if ((e.metaKey || e.ctrlKey) && !e.altKey) {
            const key = e.key.toLowerCase()
            if (key === 'b') { e.preventDefault(); applyCommand('bold'); return }
            if (key === 'i') { e.preventDefault(); applyCommand('italic'); return }
            if (e.shiftKey && key === 'x') { e.preventDefault(); applyCommand('strike'); return }
        }
    })

    el.addEventListener('focusout', (e) => {
        const ta = e.target
        if (!ta.classList || !ta.classList.contains('note-row__input')) return
        rememberCaret(ta)
        setTimeout(() => {
            if (destroyed) return
            // 焦点还在另一个输入框里：那是换行编辑，不算离开
            if (activeInput()) return
            const active = document.activeElement
            if (active && active.closest && active.closest('.note-toolbar')) return
            if (!editingId) return
            editingId = null
            flushSave()
            render()
        }, 0)
    })

    el.addEventListener('paste', (e) => {
        const ta = e.target
        if (!ta.classList || !ta.classList.contains('note-row__input')) return
        const text = e.clipboardData ? e.clipboardData.getData('text/plain') : ''
        if (!text || !/[\r\n]/.test(text)) return
        e.preventDefault()
        pasteLines(ta, text)
    })

    function pasteLines(ta, text) {
        const block = getBlock(ta.dataset.id)
        if (!block) return
        const parts = text.replace(/\r\n?/g, '\n').split('\n')
        const value = ta.value
        const start = ta.selectionStart
        const stop = ta.selectionEnd

        block.source = value.slice(0, start) + parts[0]
        const tail = parts.slice(1)
        const added = tail.map((line, i) => ({
            id: uid('n'),
            source: i === tail.length - 1 ? line + value.slice(stop) : line
        }))
        items.splice(items.indexOf(block) + 1, 0, ...added)

        const last = added[added.length - 1]
        editingId = last.id
        flushSave()
        render({
            caret: last.source.length - value.slice(stop).length,
            end: last.source.length - value.slice(stop).length
        })
    }

    function toggleTodo(button) {
        const row = button.closest('[data-id]')
        const block = row && getBlock(row.dataset.id)
        if (!block) return
        block.source = block.source.replace(/\[([ xX])\]/, (all, mark) => (mark === ' ' ? '[x]' : '[ ]'))
        flushSave()
        render()
    }

    function onSelectionChange() {
        if (!activeInput()) return
        emitState()
    }

    document.addEventListener('selectionchange', onSelectionChange)

    render()

    return {
        el,
        flushSave,
        applyCommand,
        /** 空笔记进来就直接写：元素插进页面之后才能聚焦 */
        focusFirst() {
            startEditing(items[0].id, { start: 0, end: 0 })
        },
        getState: readState,
        destroy() {
            destroyed = true
            clearTimeout(saveTimer)
            if (drag && drag.timer) clearTimeout(drag.timer)
            if (drag && drag.raf) cancelAnimationFrame(drag.raf)
            document.removeEventListener('selectionchange', onSelectionChange)
            window.removeEventListener('pointermove', onDragMove)
            window.removeEventListener('pointerup', onDragEnd)
            window.removeEventListener('pointercancel', onDragEnd)
            document.body.classList.remove('note-dragging')
        }
    }
}

function toBlocks(lines) {
    const list = Array.isArray(lines) ? lines : []
    const blocks = list.map((source) => ({ id: uid('n'), source: String(source ?? '') }))
    if (!blocks.length) blocks.push({ id: uid('n'), source: '' })
    return blocks
}

function grow(ta) {
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0))
}

function orderedLabel(level, n) {
    if (level === 0) return `${n}.`
    if (level === 1) return `${n})`
    return 'i'.repeat(n)
}

function lineKindOf(source) {
    if (PREFIX.heading.test(source)) {
        const level = PREFIX.heading.exec(source)[1].length
        return `h${Math.min(6, level)}`
    }
    if (PREFIX.quote.test(source)) return 'quote'
    if (PREFIX.check.test(source)) return 'todo'
    if (PREFIX.bullet.test(source)) return 'ul'
    if (PREFIX.number.test(source)) return 'ol'
    return 'paragraph'
}

/** 去掉行首记号，保留缩进 */
function stripPrefix(source) {
    const indent = leadingIndent(source)
    const body = String(source ?? '').slice(indent.length)
    return indent + body
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s?/, '')
        .replace(/^[-*+]\s+\[[ xX]\]\s*/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d{1,3}[.)]\s+/, '')
}

function stripIndent(source) {
    return String(source ?? '').slice(leadingIndent(source).length)
}

/** 引用行的正文：去掉 `>`，行尾的续行记号也去掉 */
function quoteBody(source) {
    return String(source ?? '')
        .replace(/^[ \t]*>\s?/, '')
        .replace(/\\\s*$/, '')
}

/** 合并后的每个段落以哪一行的 id 为准 */
function quoteOwners(blocks) {
    const owners = []
    let open = false
    for (const block of blocks) {
        const body = String(block.source ?? '').replace(/^[ \t]*>\s?/, '')
        if (!open || !owners.length) owners.push(block.id)
        open = /\\\s*$/.test(body)
    }
    return owners
}

/** 回车后新的一行沿用上一行的记号，序号加一 */
function prefixFor(left) {
    let m = /^(\s*)([-*+])\s+\[[ xX]\]\s+/.exec(left)
    if (m) return `${m[1]}${m[2]} [ ] `
    m = /^(\s*)([-*+])\s+/.exec(left)
    if (m) return `${m[1]}${m[2]} `
    m = /^(\s*)(\d{1,3})[.)]\s+/.exec(left)
    if (m) return `${m[1]}${parseInt(m[2], 10) + 1}. `
    m = /^(\s*)>\s?/.exec(left)
    if (m) return `${m[1]}> `
    return ''
}

/** 记号把光标包在里面时，取这一层的范围 */
function spanAround(source, pos, open, close) {
    if (!source) return null
    const from = Math.max(0, source.lastIndexOf(open, pos))
    if (from < 0) return null
    const innerStart = from + open.length
    if (pos < innerStart) return null
    const to = source.indexOf(close, pos)
    if (to < 0) return null
    if (source.slice(innerStart, to).includes(open)) return null
    return { start: from, innerStart, innerEnd: to, end: to + close.length }
}

function hasWrap(source, start, stop, open, close) {
    if (open === '*') return hasItalic(source, start, stop)

    const selected = source.slice(start, stop)
    if (selected.length >= open.length + close.length
        && selected.startsWith(open) && selected.endsWith(close)) return true
    if (start >= open.length
        && source.slice(start - open.length, start) === open
        && source.slice(stop, stop + close.length) === close) return true
    if (start !== stop) return false
    return !!spanAround(source, start, open, close)
}

/** 单个星号：粗体的两个星号不算斜体 */
function hasItalic(source, start, stop) {
    const selected = source.slice(start, stop)
    if (selected.length > 2 && selected.startsWith('*') && selected.endsWith('*')
        && !selected.startsWith('**')) return true
    if (start > 0 && source[start - 1] === '*' && source[start - 2] !== '*'
        && source[stop] === '*' && source[stop + 1] !== '*') return true
    if (start !== stop) return false
    const span = spanAround(source, start, '*', '*')
    if (!span) return false
    return source[span.start - 1] !== '*' && source[span.end] !== '*'
}
