/** 自绘下拉：按钮 + 列表，用法贴近 <select>。 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'
import { closeSelectMenu, isSelectMenuOpenFor, openSelectMenu } from './select-menu.js'

function normalizeOption(option) {
    if (option && typeof option === 'object') {
        return {
            value: String(option.value ?? ''),
            label: String(option.label ?? option.value ?? ''),
            // group / title 只用于展开的列表：group 出分组小标题，title 给省略后的全文
            group: option.group ? String(option.group) : null,
            title: option.title ? String(option.title) : null,
            // 收起态可以换一种写法（如补上来源名），展开的列表仍用 label
            display: option.display ? String(option.display) : null
        }
    }
    return { value: String(option ?? ''), label: String(option ?? ''), group: null, title: null, display: null }
}

/**
 * @returns {HTMLButtonElement} 触发按钮，额外挂了 value / setOptions
 */
export function createSelect({
    options = [],
    value = '',
    lang = null,
    className = 'select',
    disabled = false,
    nowrap = false,
    onChange = null
} = {}) {
    const dynamic = typeof options === 'function'
    const readOptions = () => (dynamic ? options() : options).map(normalizeOption)
    let items = readOptions()
    let current = items.some((item) => item.value === value) ? String(value) : (items[0]?.value ?? '')

    const valueEl = h('span', { class: 'select__value' })
    const el = h('button', {
        type: 'button',
        class: [...new Set(['select', 'select--custom',
            ...String(className || '').split(/\s+/).filter(Boolean)])].join(' '),
        role: 'combobox',
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        disabled
    }, valueEl)

    function renderValue() {
        const hit = items.find((item) => item.value === current)
        const label = hit ? (hit.display || hit.label) : ''
        valueEl.replaceChildren(bdiText(label, lang))
        // 收起态会省略长文本，鼠标停上去给全文（只在单行模式下加，免得其它下拉到处冒提示）
        if (nowrap && label) el.title = label
        else el.removeAttribute('title')
    }

    function open(step = 0) {
        if (el.disabled) return
        // 选项可能随表单其它部分变化（如新增了含义），函数式选项在展开时重算；
        // 静态数组与 setOptions 给的就是当前快照，重读反而会把 setOptions 的结果清掉
        if (dynamic) items = readOptions()
        if (!items.length) return
        if (!items.some((item) => item.value === current)) current = items[0].value
        renderValue()
        const index = items.findIndex((item) => item.value === current)
        const base = index < 0 ? 0 : index
        openSelectMenu({
            anchor: el,
            owner: el,
            items,
            value: current,
            lang,
            nowrap,
            activeIndex: Math.min(items.length - 1, Math.max(0, base + step)),
            onPick: (next) => {
                if (next === current) return
                current = next
                renderValue()
                if (typeof onChange === 'function') onChange(current)
                el.dispatchEvent(new Event('change', { bubbles: true }))
            }
        })
    }

    el.addEventListener('click', () => {
        if (el.disabled) return
        if (isSelectMenuOpenFor(el)) {
            closeSelectMenu()
            return
        }
        open()
    })

    el.addEventListener('keydown', (e) => {
        if (el.disabled || isSelectMenuOpenFor(el)) return
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            open(e.key === 'ArrowDown' ? 1 : -1)
        }
    })

    Object.defineProperty(el, 'value', {
        get: () => current,
        set: (next) => {
            const text = String(next ?? '')
            if (text === current) return
            current = text
            renderValue()
        }
    })

    /** 整体替换选项；不给 nextValue 时尽量保留当前值 */
    el.setOptions = (next, nextValue) => {
        items = (next || []).map(normalizeOption)
        if (nextValue !== undefined) {
            current = String(nextValue ?? '')
        } else if (!items.some((item) => item.value === current)) {
            current = items[0]?.value ?? ''
        }
        renderValue()
    }

    renderValue()
    return el
}
