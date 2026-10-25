/**
 * 自绘下拉：原生 <select> 收起态是浏览器画选中项的文字，没法包 <bdi>，这里换成「按钮 + 自绘列表」，
 * 展开的列表复用 select-menu.js。用法贴近 <select>：el.value / el.disabled / change 事件 / el.setOptions()。
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
 * @param {object} options options（[{ value, label }] 或字符串数组）/ value / lang / className / disabled / onChange(value)
 * @returns {HTMLButtonElement} 触发按钮，额外挂了 value / setOptions
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
