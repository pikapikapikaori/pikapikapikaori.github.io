/**
 * 词卡里的「固定搭配」「例句」列表：列表页卡片正面与详情弹窗共用一份实现，
 * 序号与含义引用的算法只在这里写一次，两处才不会走样。
 * 原文一律交给外层 applyBdi 处理，这里只标 lang。
 */

import { h } from '../utils/dom.js'
import { sourceLabel } from '../models/word.js'

/** 某个来源下的含义（顺序即列表里显示的序号） */
export function meaningsOfSource(meanings, source) {
    return (meanings || []).filter((m) => (m.source || 'manual') === (source || 'manual'))
}

/**
 * 例句引用的含义：按「来源内序号 + 文本」显示。
 * 回查不到（含义被删 / 改名）时只给文本，宁可没有编号也不指错。
 * 引用的含义不在当前来源 tab 里时补一个来源名，序号才找得到。
 */
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

/** 固定搭配：有序列表，每条 `搭配 — 释义` */
export function collocationList(items, language) {
    return h('ol', { class: 'word-card__list' },
        ...(items || []).map((c) => h('li', { class: 'word-card__collocation' },
            h('span', { lang: language }, c.text || ''),
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
                h('div', { class: 'word-card__example-text', lang: language }, e.text || ''),
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
                    ? h('div', { class: 'word-card__citation' }, `— ${e.citation}`)
                    : null
            )
        })
    )
}
