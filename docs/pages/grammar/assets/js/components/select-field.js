/**
 * 自绘下拉（收起态可以包 <bdi>）
 *
 * 原生 <select> 收起时是浏览器直接画选中项的文字，没法把原文包进 <bdi>
 * （希伯来文 / 满文的 anchor 名称里就带着原文），所以换成「按钮 + 自绘列表」：
 *
 *   - 收起态用 bdiText 渲染当前选中项；
 *   - 展开的列表复用 components/select-menu.js（键盘、aria 都在那边）；
 *   - 用法贴近 <select>：el.value / el.disabled / addEventListener('change')，
 *     选项整体替换用 el.setOptions()。
 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'
import { closeSelectMenu, isSelectMenuOpenFor, openSelectMenu } from './select-menu.js'

function normalizeOption(option) {
    if (option && typeof option === 'object') {
        return {
            value: String(option.value ?? ''),
            label: String(option.label ?? option.value ?? '')
        }
    }
    return { value: String(option ?? ''), label: String(option ?? '') }
}

/**
 * @param {object} options
 *   options     [{ value, label }]（或纯字符串数组）
 *   value       初始值
 *   lang        bdi 判定语言
 *   className   附加 class（默认 select；外观复用 .select）
 *   disabled    禁用
 *   onChange    (value) => void（同时会派发 change 事件）
 * @returns {HTMLButtonElement} 触发按钮；额外挂了 value / setOptions
 */
export function createSelect({
    options = [],
    value = '',
    lang = null,
    className = 'select',
    disabled = false,
    onChange = null
} = {}) {
    let items = options.map(normalizeOption)
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
        valueEl.replaceChildren(bdiText(hit ? hit.label : '', lang))
    }

    function open(step = 0) {
        if (el.disabled || !items.length) return
        const index = items.findIndex((item) => item.value === current)
        const base = index < 0 ? 0 : index
        openSelectMenu({
            anchor: el,
            owner: el,
            items,
            value: current,
            lang,
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
