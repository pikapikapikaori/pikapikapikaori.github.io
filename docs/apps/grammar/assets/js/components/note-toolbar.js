/** 笔记工具条：点一下加记号，再点一下去掉。按钮按下时不抢输入框的焦点。 */

import { h } from '../utils/dom.js'
import { openSelectMenu, closeSelectMenu, isSelectMenuOpenFor } from './select-menu.js'

const HEADING_OPTIONS = [
    { value: 'paragraph', label: '正文' },
    { value: 'h1', label: '标题一' },
    { value: 'h2', label: '标题二' },
    { value: 'h3', label: '标题三' },
    { value: 'h4', label: '标题四' }
]

/**
 * @param {object} opts
 * @param {(cmd: string) => void} opts.onCommand
 * @param {() => object} opts.getState
 * @param {HTMLElement} opts.stateEl 保存状态写在页面给的这一处
 */
export function createNoteToolbar({ onCommand, getState, stateEl = null } = {}) {
    const marks = {}
    const toggles = {}
    const saveEl = stateEl
    let saveTimer = 0

    const el = h('div', { class: 'note-toolbar', role: 'toolbar', 'aria-label': '格式' })

    const bold = markButton('bold', 'B', '加粗（Ctrl / ⌘ + B）', 'note-tool__glyph--b')
    const italic = markButton('italic', 'I', '斜体（Ctrl / ⌘ + I）', 'note-tool__glyph--i')
    const strike = markButton('strike', 'S', '删除线（Ctrl / ⌘ + Shift + X）', 'note-tool__glyph--s')
    const underline = markButton('underline', 'U', '下划线', 'note-tool__glyph--u')

    // 标题不用 createSelect：那个控件在挑中同一个值时不回报，
    // 而这里需要「再点一次同级标题就取消」
    let headingKind = 'paragraph'
    const headingLabel = h('span', { class: 'note-tool__label' })
    const heading = h('button', {
        class: 'select note-tool note-tool--select',
        type: 'button',
        title: '标题级别',
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        onpointerdown: (e) => e.preventDefault(),
        onclick: () => {
            if (isSelectMenuOpenFor(heading)) {
                closeSelectMenu()
                return
            }
            openSelectMenu({
                anchor: heading,
                owner: heading,
                items: HEADING_OPTIONS,
                value: headingKind,
                onPick: (value) => {
                    onCommand(value)
                    sync()
                }
            })
        }
    }, headingLabel)
    setHeadingLabel('paragraph')

    function setHeadingLabel(kind) {
        headingKind = kind
        const hit = HEADING_OPTIONS.find((option) => option.value === kind) || HEADING_OPTIONS[0]
        headingLabel.textContent = hit.label
    }

    const list = toggleButton('ul', '列表', '无序列表')
    const ordered = toggleButton('ol', '编号', '有序列表')
    const todo = toggleButton('todo', '待办', '待办事项')
    const quote = toggleButton('quote', '引用', '引用')

    el.append(
        bold, italic, strike, underline,
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        heading,
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        list, ordered, todo, quote,
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        textButton('hr', '分隔线', '插入分隔线'),
        textButton('link', '链接', '插入链接'),
        textButton('image', '图片', '插入图片'),
        textButton('details', '折叠', '插入可折叠的一段'),
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        textButton('outdent', '<', '减少一级缩进（Shift + Tab）', 'note-tool--indent'),
        textButton('indent', '>', '增加一级缩进（Tab）', 'note-tool--indent')
    )

    function markButton(cmd, label, title, glyphClass) {
        const btn = h('button', {
            class: 'note-tool note-tool--mark',
            type: 'button',
            title,
            'aria-label': title,
            'aria-pressed': 'false',
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => { onCommand(cmd); sync() }
        }, h('span', { class: `note-tool__glyph ${glyphClass}` }, label))
        marks[cmd] = btn
        return btn
    }

    function toggleButton(cmd, label, title) {
        const btn = h('button', {
            class: 'note-tool',
            type: 'button',
            title,
            'aria-label': title,
            'aria-pressed': 'false',
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => { onCommand(cmd); sync() }
        }, label)
        toggles[cmd] = btn
        return btn
    }

    function textButton(cmd, label, title, extraClass = null) {
        return h('button', {
            class: ['note-tool', extraClass].filter(Boolean).join(' '),
            type: 'button',
            title,
            'aria-label': title,
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => { onCommand(cmd); sync() }
        }, label)
    }

    function sync() {
        if (typeof getState !== 'function') return
        const state = getState() || {}
        press(marks.bold, state.bold)
        press(marks.italic, state.italic)
        press(marks.strike, state.strike)
        press(marks.underline, state.underline)
        press(toggles.ul, state.kind === 'ul')
        press(toggles.ol, state.kind === 'ol')
        press(toggles.todo, state.kind === 'todo')
        press(toggles.quote, state.kind === 'quote')
        const kind = state.kind && /^h[1-4]$/.test(state.kind) ? state.kind : 'paragraph'
        if (headingKind !== kind) setHeadingLabel(kind)
    }

    function press(btn, on) {
        if (!btn) return
        const next = on ? 'true' : 'false'
        if (btn.getAttribute('aria-pressed') !== next) btn.setAttribute('aria-pressed', next)
    }

    function setSaveState(kind) {
        if (!saveEl) return
        clearTimeout(saveTimer)
        saveEl.classList.toggle('is-failed', kind === 'failed')
        if (kind === 'saved' || kind === 'failed') {
            saveEl.textContent = kind === 'saved' ? '已保存' : '未保存'
            saveEl.classList.add('is-on')
            saveTimer = setTimeout(() => saveEl.classList.remove('is-on'), kind === 'saved' ? 1400 : 4000)
        } else {
            saveEl.textContent = ''
            saveEl.classList.remove('is-on')
        }
    }

    return { el, refresh: sync, setSaveState }
}
