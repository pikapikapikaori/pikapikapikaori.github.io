import { h } from '../utils/dom.js'

/**
 * 胶囊标签页（和来源 tab 同一套样式）
 *
 * 所有面板先建好，切换只切 `hidden`——表单里切换时输入内容与焦点都不会丢。
 *
 * @param {object} opts
 *   items    [{ key, label, node }]
 *   active   初始选中的 key（缺省第一个）
 *   onChange (key) => void
 *   className 追加到标签栏的 class
 * @returns {{ el, setActive, getActive }}
 */
export function createTabGroup({ items, active = null, onChange = null, className = '' } = {}) {
    const list = (items || []).filter((it) => it && it.node)
    let current = list.some((it) => it.key === active) ? active : (list[0]?.key ?? null)

    const bar = h('div', {
        class: 'source-tabs tab-bar' + (className ? ' ' + className : ''),
        role: 'tablist'
    })

    const body = h('div', { class: 'tab-body' },
        ...list.map((it) => {
            it.node.hidden = it.key !== current
            return it.node
        })
    )

    function render() {
        bar.replaceChildren(...list.map((it) => h('button', {
            class: 'source-tab' + (it.key === current ? ' source-tab--active' : ''),
            type: 'button',
            role: 'tab',
            'aria-selected': String(it.key === current),
            onclick: () => setActive(it.key)
        },
        h('span', { class: 'source-tab__dot' }),
        it.label
        )))
    }

    function setActive(key) {
        if (key === current) return
        current = key
        for (const it of list) it.node.hidden = it.key !== current
        render()
        if (typeof onChange === 'function') onChange(key)
    }

    render()
    const el = h('div', { class: 'tab-group' }, list.length > 1 ? bar : null, body)

    return {
        el,
        setActive,
        getActive: () => current
    }
}
