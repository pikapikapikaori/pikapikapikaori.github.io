import { h } from '../utils/dom.js'
import { sourceLabel } from '../models/word.js'

/**
 * 来源切换标签
 * @param {string[]} sources
 * @param {string} active
 * @param {(source:string)=>void} onChange
 */
export function createSourceTabs(sources, active, onChange) {
    const wrap = h('div', {
        class: 'source-tabs',
        role: 'tablist',
        'data-no-flip': ''
    })

    for (const s of sources) {
        const isActive = s === active
        wrap.appendChild(h('button', {
            class: 'source-tab' + (isActive ? ' source-tab--active' : ''),
            type: 'button',
            role: 'tab',
            'aria-selected': isActive ? 'true' : 'false',
            dataset: { source: s },
            onclick: (e) => {
                e.stopPropagation()
                if (isActive) return
                if (typeof onChange === 'function') onChange(s)
            }
        },
        sourceLabel(s)
        ))
    }

    return wrap
}
