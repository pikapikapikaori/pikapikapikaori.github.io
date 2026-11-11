import { h } from '../utils/dom.js'
import { bdiFragment } from '../utils/bdi.js'

/** 把标签栏横向滚到当前项居中；不用 scrollIntoView，免得连带滚动页面 */
function centerActive(bar, active) {
    if (!bar || !active) return
    bar.scrollLeft = Math.max(0, active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2)
}

/** 同一组里前一个 / 后一个标签，到头返回 null，不循环 */
function neighborKey(list, key, step) {
    const index = list.findIndex((it) => it.key === key)
    if (index < 0) return null
    return list[index + step]?.key ?? null
}

/** 纯标签栏，不管理面板。 */
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

    /** 方向键在标签之间移动，到头就停 */
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

/** 胶囊标签页：面板先建好后只切 hidden，切换时输入内容与焦点都不丢。 */
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
