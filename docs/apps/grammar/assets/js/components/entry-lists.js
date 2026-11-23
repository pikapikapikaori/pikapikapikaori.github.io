
import { h } from '../utils/dom.js'
import { bdiFragment, bdiNode } from '../utils/bdi.js'
import { sourceLabel } from '../models/word.js'

export function meaningsOfSource(meanings, source) {
    return (meanings || []).filter((m) => (m.source || 'manual') === (source || 'manual'))
}

export function meaningRefLabel(ref, meanings, activeSource = 'manual') {
    const text = String(ref?.text || '').trim()
    if (!text) return ''
    const source = ref.source || 'manual'
    let order = 0
    for (const m of meaningsOfSource(meanings, source)) {
        const current = String(m.text || '').trim()
        if (!current) continue
        order += 1
        if (current !== text) continue
        const label = `${order}. ${current}`
        return source === (activeSource || 'manual') ? label : `${sourceLabel(source)} ${label}`
    }
    return text
}

export function collocationList(items, language) {
    return h('ol', { class: 'word-card__list' },
        ...(items || []).map((c) => h('li', { class: 'word-card__collocation' },
            bdiNode(c.text || '', language),
            c.gloss ? h('span', { class: 'word-card__gloss' }, ` — ${c.gloss}`) : null
        ))
    )
}

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
