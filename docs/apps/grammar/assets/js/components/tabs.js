import { h } from '../utils/dom.js'
import { bdiFragment } from '../utils/bdi.js'

function centerActive(bar, active) {
    if (!bar || !active) return
    bar.scrollLeft = Math.max(0, active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2)
}

function neighborKey(list, key, step) {
    const index = list.findIndex((it) => it.key === key)
    if (index < 0) return null
    return list[index + step]?.key ?? null
}

export function createTabBar({ items, active = null, onChange = null, className = '', lang = null } = {}) {
    const list = (items || []).filter(Boolean)
    let current = list.some((it) => it.key === active) ? active : (list[0]?.key ?? null)

    const bar = h('div', {
        class: 'source-tabs tab-bar' + (className ? ' ' + className : ''),
        role: 'tablist'
    })

    function render() {
        bar.replaceChildren(...list.map((it) => h('button', {
            class: 'source-tab' + (it.key === current ? ' source-tab--active' : ''),
            type: 'button',
            role: 'tab',
            'aria-selected': String(it.key === current),
            tabindex: it.key === current ? '0' : '-1',
            onclick: () => setActive(it.key),
            onkeydown: (e) => onKeydown(e, it.key)
        },
        bdiFragment(it.label, lang)
        )))
        centerActive(bar, bar.querySelector('.source-tab--active'))
    }

    function onKeydown(e, key) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        const next = neighborKey(list, key, e.key === 'ArrowLeft' ? -1 : 1)
        if (next == null) return
        e.preventDefault()
        setActive(next)
        bar.querySelector('.source-tab--active')?.focus()
    }

    function setActive(key) {
        if (key === current) return
        current = key
        render()
        if (typeof onChange === 'function') onChange(key)
    }

    render()

    return {
        el: bar,
        setActive,
        getActive: () => current
    }
}

export function createTabGroup({ items, active = null, onChange = null, className = '', lang = null } = {}) {
    const list = (items || []).filter((it) => it && it.node)
    let current = list.some((it) => it.key === active) ? active : (list[0]?.key ?? null)

    const body = h('div', { class: 'tab-body' },
        ...list.map((it) => {
            it.node.hidden = it.key !== current
            return it.node
        })
    )

    const bar = createTabBar({
        items: list.map((it) => ({ key: it.key, label: it.label })),
        active: current,
        className,
        lang,
        onChange: (key) => setActive(key)
    })

    function setActive(key) {
        if (key === current) return
        current = key
        for (const it of list) it.node.hidden = it.key !== current
        bar.setActive(key)
        if (typeof onChange === 'function') onChange(key)
    }

    const el = h('div', { class: 'tab-group' }, list.length > 1 ? bar.el : null, body)

    return {
        el,
        setActive,
        getActive: () => current
    }
}
