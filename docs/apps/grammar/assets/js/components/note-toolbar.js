/** 笔记工具条：点一下加记号，再点一下去掉。按钮按下时不抢输入框的焦点。 */

import { h } from '../utils/dom.js'
import {
    indentIcon, outdentIcon, checkboxIcon, ruleIcon,
    linkIcon, imageIcon
} from './icons.js'

const HEADINGS = [
    { value: 'paragraph', label: 'T', title: '正文' },
    { value: 'h1', label: 'h1', title: '一级标题' },
    { value: 'h2', label: 'h2', title: '二级标题' },
    { value: 'h3', label: 'h3', title: '三级标题' },
    { value: 'h4', label: 'h4', title: '四级标题' }
]

/**
 * @param {object} opts
 * @param {(cmd: string) => void} opts.onCommand
 * @param {() => object} opts.getState
 * @param {HTMLElement} opts.stateEl 保存状态写在页面给的这一处
 */
export function createNoteToolbar({ onCommand, getState, stateEl = null } = {}) {
    const marks = {}
    const blocks = {}
    const headings = new Map()
    const saveEl = stateEl
    let saveTimer = 0

    const el = h('div', { class: 'note-toolbar', role: 'toolbar', 'aria-label': '格式' })

    marks.bold = glyphButton('bold', 'B', '加粗（⌘ + B）', 'note-tool__glyph--b')
    marks.italic = glyphButton('italic', 'I', '斜体（⌘ + I）', 'note-tool__glyph--i')
    marks.strike = glyphButton('strike', 'S', '删除线（⌘ + Shift + X）', 'note-tool__glyph--s')
    marks.underline = glyphButton('underline', 'U', '下划线', 'note-tool__glyph--u')

    const headingButtons = HEADINGS.map((item) => {
        const btn = h('button', {
            class: 'note-tool note-tool--letter',
            type: 'button',
            title: item.title,
            'aria-label': item.title,
            'aria-pressed': 'false',
            dataset: { kind: item.value },
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => { onCommand(item.value); sync() }
        }, item.label)
        headings.set(item.value, btn)
        return btn
    })

    blocks.ul = glyphButton('ul', '•', '无序列表（⌘ + Shift + 8）', 'note-tool__glyph--bullet')
    blocks.ol = glyphButton('ol', '1.', '有序列表（⌘ + Shift + 7）', 'note-tool__glyph--number')
    blocks.todo = iconButton('todo', checkboxIcon, '复选框（⌘ + Shift + 9）')
    blocks.quote = glyphButton('quote', '“', '引用（⌘ + Shift + .）', 'note-tool__glyph--quote')

    const outdent = iconButton('outdent', outdentIcon, '减少一级缩进（Shift + Tab）')
    const indent = iconButton('indent', indentIcon, '增加一级缩进（Tab）')

    el.append(
        ...Object.values(marks),
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        ...headingButtons,
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        blocks.ul, blocks.ol, blocks.todo, blocks.quote,
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        iconButton('hr', ruleIcon, '插入分隔线'),
        iconButton('link', linkIcon, '插入链接（⌘ + K）'),
        iconButton('image', imageIcon, '插入图片'),
        h('span', { class: 'note-toolbar__rule', 'aria-hidden': 'true' }),
        outdent, indent
    )

    function glyphButton(cmd, label, title, glyphClass) {
        const btn = h('button', {
            class: 'note-tool note-tool--mark',
            type: 'button',
            title,
            'aria-label': title,
            'aria-pressed': 'false',
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => { onCommand(cmd); sync() }
        }, h('span', { class: `note-tool__glyph ${glyphClass}` }, label))
        return btn
    }

    function iconButton(cmd, iconFn, title) {
        const btn = h('button', {
            class: 'note-tool note-tool--icon',
            type: 'button',
            title,
            'aria-label': title,
            'aria-pressed': 'false',
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => { onCommand(cmd); sync() }
        }, iconFn())
        return btn
    }

    function sync() {
        if (typeof getState !== 'function') return
        const state = getState() || {}
        press(marks.bold, state.bold)
        press(marks.italic, state.italic)
        press(marks.strike, state.strike)
        press(marks.underline, state.underline)
        press(blocks.ul, state.kind === 'ul')
        press(blocks.ol, state.kind === 'ol')
        press(blocks.todo, state.kind === 'todo')
        press(blocks.quote, state.kind === 'quote')
        for (const [kind, btn] of headings) press(btn, state.kind === kind)
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
