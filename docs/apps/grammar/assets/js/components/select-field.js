
import { h } from '../utils/dom.js'
import { bdiFragment, stripBdi } from '../utils/bdi.js'
import { closeSelectMenu, isSelectMenuOpenFor, openSelectMenu } from './select-menu.js'

function normalizeOption(option) {
    if (option && typeof option === 'object') {
        return {
            value: String(option.value ?? ''),
            label: String(option.label ?? option.value ?? ''),
            group: option.group ? String(option.group) : null,
            title: option.title ? String(option.title) : null,
            display: option.display ? String(option.display) : null
        }
    }
    return { value: String(option ?? ''), label: String(option ?? ''), group: null, title: null, display: null }
}

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
        valueEl.replaceChildren(bdiFragment(label, lang))
        if (nowrap && label) el.title = stripBdi(label)
        else el.removeAttribute('title')
    }

    function open(step = 0) {
        if (el.disabled) return
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
