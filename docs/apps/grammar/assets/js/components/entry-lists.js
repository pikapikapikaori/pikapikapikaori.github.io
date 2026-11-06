/** 词卡里的固定搭配与例句列表，列表页与词卡详情共用。 */

import { h } from '../utils/dom.js'
import { bdiFragment, bdiNode } from '../utils/bdi.js'
import { sourceLabel } from '../models/word.js'

/** 某个来源下的含义（顺序即列表里显示的序号） */
export function meaningsOfSource(meanings, source) {
    return (meanings || []).filter((m) => (m.source || 'manual') === (source || 'manual'))
}

/** 例句引用的含义：序号只在本来源内有效；回查不到时只给文本，指不到宁可不编号 */
export function meaningRefLabel(ref, meanings, activeSource = 'manual') {
    const text = String(ref?.text || '').trim()
    if (!text) return ''
    const source = ref.source || 'manual'
    // 空白含义不占号：与表单里的行号、例句下拉里的编号是同一套
    let order = 0
    for (const m of meaningsOfSource(meanings, source)) {
        const current = String(m.text || '').trim()
        if (!current) continue
        order += 1
        if (current !== text) continue
        const label = `${order}. ${current}`
        return source === (activeSource || 'manual') ? label : `${sourceLabel(source)} ${label}`
    }
    // 回查不到（含义被删 / 改名）时只给文本，宁可没有编号也不指错
    return text
}

/** 固定搭配：有序列表，每条 `搭配 — 含义` */
export function collocationList(items, language) {
    return h('ol', { class: 'word-card__list' },
        ...(items || []).map((c) => h('li', { class: 'word-card__collocation' },
            bdiNode(c.text || '', language),
            c.gloss ? h('span', { class: 'word-card__gloss' }, ` — ${c.gloss}`) : null
        ))
    )
}

/** 例句：有序列表；译文行尾跟「序号 + 含义」，超长省略、全文在 title 里 */
export function exampleList(items, language, { meanings = [], activeSource = 'manual' } = {}) {
    return h('ol', { class: 'word-card__list' },
        ...(items || []).map((e) => {
            const ref = meaningRefLabel(e.meaning, meanings, activeSource)
            return h('li', { class: 'word-card__example' },
                h('div', { class: 'word-card__example-text' }, bdiFragment(e.text || '', language)),
                e.translation || ref
                    ? h('div', { class: 'word-card__example-meta' },
                        e.translation
                            ? h('span', { class: 'word-card__example-tr' }, e.translation)
                            : null,
                        ref
                            ? h('span', { class: 'word-card__example-meaning', title: ref }, ref)
                            : null
                    )
                    : null,
                e.citation
                    ? h('div', { class: 'word-card__citation' }, '— ', bdiNode(e.citation, language))
                    : null
            )
        })
    )
}
