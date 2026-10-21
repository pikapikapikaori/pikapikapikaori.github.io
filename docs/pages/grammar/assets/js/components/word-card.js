import { h } from '../utils/dom.js'
import { posLabel, allSources, stemDisplay, primaryStem, otherStems } from '../models/word.js'
import { fieldDefsOfTemplate, fieldValues, genderOfColumn } from '../models/grammar.js'
import { isRtl } from '../utils/text-normalize.js'
import { getLanguage } from '../data/languages.js'
import { createSourceTabs } from './source-tabs.js'
import { createParadigmTable } from './paradigm-table.js'
import { openCardOverlay } from './card-overlay.js'

export function createWordCard(word, options = {}) {
    const {
        language = word.language,
        startFlipped = false,
        showSourceTabs = true,
        resolveDerivative = null,
        onDerivativeClick = null,
        onEdit = null,
        onDelete = null,
        onGrammarRef = null,
        resolvePosRef = null,
        compact = false,
        paradigmTpl = null,
        partLabels = null
    } = options

    const rtl = isRtl(language)
    const posGrammarRef = typeof resolvePosRef === 'function' ? resolvePosRef(word.pos) : null
    const sources = allSources(word)
    // 「手动」就是默认来源：有外部来源时就多一个 tab，别让含义没处可切
    if (!sources.includes('manual')) sources.unshift('manual')
    // 默认落在「有含义」的那个来源上，免得一打开是对着空 tab
    const sourceWithMeanings = sources.find((s) => (word.meanings || []).some((m) => (m.source || 'manual') === s))
    let activeSource = sourceWithMeanings || sources[0] || 'manual'

    const inner = h('div', { class: 'word-card__inner' })
    const front = buildFront()
    const back = h('div', { class: 'word-card__face word-card__face--back' })
    inner.append(front, back)

    const el = h('div', {
        class: 'word-card' + (startFlipped ? ' word-card--flipped' : '')
            + (compact ? ' word-card--compact' : ''),
        dataset: { wordId: word.id },
        tabindex: '0',
        role: 'button',
        'aria-label': `词卡：${word.lemma}`,
        'aria-pressed': startFlipped ? 'true' : 'false'
    }, inner)

    function setFlipped(v) {
        el.classList.toggle('word-card--flipped', !!v)
        el.setAttribute('aria-pressed', String(!!v))
    }
    function flip() { setFlipped(!el.classList.contains('word-card--flipped')) }

    el.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, [data-no-flip]')) return
        flip()
    })
    el.addEventListener('keydown', (e) => {
        if (e.target !== el) return
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            flip()
        }
    })

    el.flip = flip
    el.setFlipped = setFlipped
    el.isFlipped = () => el.classList.contains('word-card--flipped')
    el.word = word

    /* ---------- 正面 ---------- */

    function buildFront() {
        const face = h('div', { class: 'word-card__face word-card__face--front' })

        // 顶部：左编辑/删除，右 ×N
        const top = h('div', { class: 'word-card__top' })

        if (!compact && (onEdit || onDelete)) {
            const actions = h('div', { class: 'word-card__actions', 'data-no-flip': '' })
            if (onEdit) {
                actions.appendChild(h('button', {
                    class: 'btn btn--ghost btn--sm',
                    type: 'button',
                    onclick: (e) => { e.stopPropagation(); onEdit(word) }
                }, '编辑'))
            }
            if (onDelete) {
                actions.appendChild(h('button', {
                    class: 'btn btn--ghost btn--sm',
                    type: 'button',
                    onclick: (e) => { e.stopPropagation(); onDelete(word) }
                }, '删除'))
            }
            top.appendChild(actions)
        } else {
            top.appendChild(h('div', {}))
        }

        top.appendChild(h('div', { class: 'word-card__count num' },
            `×${word.encounterCount || 0}`
        ))

        face.appendChild(top)

        // 中间：lemma + meta
        const center = h('div', { class: 'word-card__center' },
            h('div', {
                class: 'word-card__lemma' + (rtl ? ' word-card__lemma--rtl' : ''),
                lang: language
            }, word.lemma)
        )

        const meta = h('div', { class: 'word-card__meta' },
            h('span', { class: 'num' }, `掌握度 ${word.mastery ?? 0}/5`)
        )
        if (word.addedAt) {
            meta.appendChild(h('span', { class: 'num' },
                new Date(word.addedAt).toLocaleDateString('zh-CN')
            ))
        }
        center.appendChild(meta)
        face.appendChild(center)

        // 底部：提示
        face.appendChild(h('div', { class: 'word-card__bottom' },
            h('div', { class: 'word-card__hint' }, '点击翻面')
        ))

        return face
    }

    /* ---------- 背面 ---------- */

    function pick(items) {
        if (!Array.isArray(items)) return []
        return items.filter((it) => (it.source || 'manual') === activeSource)
    }

    /** 名词只显示所选性别的列（其它列整列不渲染） */
    function hideColumnsFor(tpl) {
        const field = fieldDefsOfTemplate(tpl, word.pos).find((f) => f.declensionColumns)
        if (!field) return []
        const picked = fieldValues(word, field.key)
        if (!picked.length) return []
        const hidden = []
        for (const table of tpl?.tables || []) {
            for (const col of table.columns || []) {
                const g = genderOfColumn(col.key)
                if (g && !picked.includes(g)) hidden.push(col.key)
            }
        }
        return hidden
    }

    function renderBack() {
        const content = h('div', { class: 'word-card__back-body' })

        // 右上角徽章
        const langMeta = getLanguage(word.language)
        const canPosRef = typeof onGrammarRef === 'function' && !!posGrammarRef
            && langMeta?.grammar !== false
        const badges = h('div', { class: 'word-card__badges' },
            h(canPosRef ? 'button' : 'span', {
                class: 'badge' + (canPosRef ? ' badge--accent badge--clickable' : ''),
                type: canPosRef ? 'button' : null,
                title: canPosRef ? '查看该词性的语法' : null,
                onclick: canPosRef
                    ? (e) => { e.stopPropagation(); onGrammarRef(posGrammarRef) }
                    : null
            }, posLabel(word.pos))
        )
        const it = word.inflectionType
        if (it && it.label && langMeta?.paradigm !== false) {
            const clickable = !!(it.grammarRef && onGrammarRef)
            badges.appendChild(h(clickable ? 'button' : 'span', {
                class: 'badge badge--accent' + (clickable ? ' badge--clickable' : ''),
                type: clickable ? 'button' : null,
                onclick: clickable
                    ? (e) => { e.stopPropagation(); onGrammarRef(it.grammarRef) }
                    : null
            }, it.label))
        }
        for (const t of word.tags || []) {
            badges.appendChild(h('span', { class: 'badge' }, t))
        }
        const head = h('div', {
            class: 'word-card__back-head',
            'data-no-flip': ''
        },
        badges,
        h('button', {
            class: 'word-card__zoom-btn',
            type: 'button',
            title: '放大显示',
            'aria-label': '放大显示',
            onclick: (e) => {
                e.stopPropagation()
                openCardOverlay(word, {
                    language,
                    paradigmTpl,
                    onGrammarRef,
                    resolvePosRef,
                    resolveDerivative,
                    onDerivativeClick
                })
            }
        }, '⛶')
        )

        // source tabs
        if (showSourceTabs && sources.length > 1) {
            content.appendChild(createSourceTabs(sources, activeSource, (s) => {
                activeSource = s
                renderBack()
            }))
        }

        // 主要部分（在含义之前）
        const baseStem = primaryStem(word)
        if (baseStem) {
            const extra = otherStems(word)
            content.appendChild(section('主要部分',
                h('div', { class: 'word-card__stem', lang: language }, stemDisplay(baseStem)),
                extra.length
                    ? h('div', { class: 'word-card__stem-extra', lang: language },
                        ...extra.map(([key, value]) => h('span', { class: 'word-card__stem-part' },
                            partLabels?.[key] ? h('span', { class: 'word-card__stem-part-label' }, partLabels[key]) : null,
                            stemDisplay(value)
                        )))
                    : null
            ))
        }

        // 含义（最先）
        const meanings = pick(word.meanings)
        if (meanings.length) {
            content.appendChild(section('含义',
                h('ul', { class: 'word-card__meanings' },
                    ...meanings.map((m) => h('li', {
                        class: 'word-card__meaning',
                        lang: m.lang === 'en' ? 'en' : undefined
                    }, h('bdi', {}, m.text)))
                )
            ))
        }

        // paradigm 表格
        if (paradigmTpl && word.paradigm && typeof word.paradigm === 'object') {
            for (const tableTpl of paradigmTpl.tables || []) {
                const tableData = word.paradigm[tableTpl.key]
                if (!tableData) continue
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang: language,
                    mode: 'view',
                    onGrammarRef,
                    hideColumns: hideColumnsFor(paradigmTpl)
                })
                if (tbl) content.appendChild(tbl)
            }
        }

        // 补充形式
        const infs = pick(word.inflections)
        if (infs.length) {
            const groups = groupInflections(infs)
            const container = h('div', {})
            for (const [gname, list] of groups) {
                if (gname) {
                    container.appendChild(
                        h('div', { class: 'word-card__inflection-group-title' }, gname)
                    )
                }
                container.appendChild(h('div', { class: 'word-card__inflections' },
                    ...list.map((i) => h('div', { class: 'word-card__inflection' },
                        i.label
                            ? h('span', { class: 'word-card__inflection-label' }, i.label + '：')
                            : null,
                        h('span', {
                            class: 'word-card__inflection-form',
                            lang: language
                        }, i.form || '')
                    ))
                ))
            }
            content.appendChild(section('补充形式', container))
        }

        // 固定搭配
        const cols = pick(word.collocations)
        if (cols.length) {
            content.appendChild(section('固定搭配',
                h('div', {},
                    ...cols.map((c) => h('div', { class: 'word-card__collocation' },
                        h('span', { lang: language }, c.text || ''),
                        c.gloss ? h('span', { class: 'word-card__gloss' }, ` — ${c.gloss}`) : null
                    ))
                )
            ))
        }

        // 例句
        const exs = pick(word.examples)
        if (exs.length) {
            content.appendChild(section('例句',
                h('div', {},
                    ...exs.map((e) => h('div', { class: 'word-card__example' },
                        h('div', { class: 'word-card__example-text', lang: language }, e.text || ''),
                        e.translation
                            ? h('div', { class: 'word-card__example-tr' }, e.translation)
                            : null,
                        e.citation
                            ? h('div', { class: 'word-card__citation' }, `— ${e.citation}`)
                            : null
                    ))
                )
            ))
        }

        // 派生词
        if (word.derivatives && word.derivatives.length) {
            content.appendChild(section('派生词',
                h('div', { class: 'word-card__derivatives' },
                    ...word.derivatives.map((d) => {
                        const target = resolveDerivative ? resolveDerivative(d) : null
                        if (target && onDerivativeClick) {
                            return h('button', {
                                class: 'badge badge--accent word-card__derivative',
                                type: 'button',
                                lang: language,
                                onclick: (e) => {
                                    e.stopPropagation()
                                    onDerivativeClick(target)
                                }
                            }, d)
                        }
                        return h('span', {
                            class: 'badge word-card__derivative',
                            lang: language
                        }, d)
                    })
                )
            ))
        }

        // 备注
        if (word.notes) {
            content.appendChild(section('备注', h('div', {}, word.notes)))
        }

        back.replaceChildren(head, content,
            h('div', { class: 'word-card__hint' }, '点击返回'))
    }

    renderBack()
    return el
}

function groupInflections(list) {
    const map = new Map()
    for (const it of list) {
        const g = (it.group || '').trim() || ''
        if (!map.has(g)) map.set(g, [])
        map.get(g).push(it)
    }
    const entries = Array.from(map.entries())
    entries.sort((a, b) => {
        if (a[0] === '') return 1
        if (b[0] === '') return -1
        return 0
    })
    return entries
}

function section(title, ...children) {
    return h('div', { class: 'word-card__section' },
        h('div', { class: 'word-card__section-title' }, title),
        ...children
    )
}
