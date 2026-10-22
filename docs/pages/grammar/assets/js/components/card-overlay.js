import { h } from '../utils/dom.js'
import { applyBdi } from '../utils/bdi.js'
import { posLabel, allSources, stemDisplay, primaryStem, otherStems } from '../models/word.js'
import { fieldDefsOfTemplate, fieldValues, genderOfColumn } from '../models/grammar.js'
import { isRtl } from '../utils/text-normalize.js'
import { getLanguage } from '../data/languages.js'
import { createSourceTabs } from './source-tabs.js'
import { createTabGroup } from './tabs.js'
import { createParadigmTable } from './paradigm-table.js'

let overlayEl = null
let escHandler = null

/**
 * 打开放大版卡片
 *
 * @param {object} word
 * @param {object} opts
 *   language, paradigmTpl, onGrammarRef, resolveDerivative, onDerivativeClick, onClose
 */
export function openCardOverlay(word, opts = {}) {
    closeCardOverlay()

    const language = opts.language || word.language
    const paradigmTpl = opts.paradigmTpl || null
    const partLabels = opts.partLabels || null
    const onGrammarRef = opts.onGrammarRef || null
    const resolveDerivative = opts.resolveDerivative || null
    const resolvePosRef = opts.resolvePosRef || null
    const posGrammarRef = typeof resolvePosRef === 'function' ? resolvePosRef(word.pos) : null
    const onDerivativeClick = opts.onDerivativeClick || null
    const onClose = opts.onClose || null

    const rtl = isRtl(language)
    const sources = allSources(word)
    // 「手动」就是默认来源：有外部来源时就多一个 tab，别让含义没处可切
    if (!sources.includes('manual')) sources.unshift('manual')
    // 默认落在「有含义」的那个来源上，免得一打开是对着空 tab
    const sourceWithMeanings = sources.find((s) => (word.meanings || []).some((m) => (m.source || 'manual') === s))
    let activeSource = sourceWithMeanings || sources[0] || 'manual'
    /** 多张变格 / 变位表时当前选中的那张 */
    let activeTable = null

    const backdrop = h('div', {
        class: 'card-overlay-backdrop',
        onclick: close
    })

    const head = h('div', { class: 'card-overlay__head' })
    const body = h('div', { class: 'card-overlay-body' })

    const closeBtn = h('button', {
        class: 'card-overlay-close',
        type: 'button',
        'aria-label': '关闭',
        title: '关闭',
        onclick: close
    }, '✕')

    const panel = h('div', {
        class: 'card-overlay-panel',
        role: 'dialog',
        'aria-modal': 'true'
    }, closeBtn, head, body)

    overlayEl = h('div', { class: 'card-overlay' }, backdrop, panel)
    applyBdi(overlayEl)
    document.body.appendChild(overlayEl)

    /**
     * 包装 onGrammarRef：跳转前先关闭 overlay
     */
    function wrappedGrammarRef(ref) {
        close()
        if (typeof onGrammarRef === 'function') onGrammarRef(ref)
    }

    /**
     * 包装 onDerivativeClick：跳转前先关闭 overlay，避免弹窗留在页面上
     */
    function wrappedDerivativeClick(target) {
        close()
        if (typeof onDerivativeClick === 'function') onDerivativeClick(target)
    }

    escHandler = (e) => {
        if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', escHandler)

    /** 名词只显示所选性别的列（其它列整列不渲染） */
    function hiddenGenderColumns(tpl) {
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

    renderBody()

    function renderBody() {
        body.replaceChildren()

        /* ---------- 顶部：lemma + badges ---------- */
        const langMeta = getLanguage(word.language)
        const canPosRef = typeof onGrammarRef === 'function' && !!posGrammarRef
            && langMeta?.grammar !== false
        const badges = h('div', { class: 'card-overlay__badges' },
            h(canPosRef ? 'button' : 'span', {
                class: 'badge' + (canPosRef ? ' badge--accent badge--clickable' : ''),
                type: canPosRef ? 'button' : null,
                title: canPosRef ? '查看该词性的语法' : null,
                onclick: canPosRef
                    ? (e) => { e.stopPropagation(); wrappedGrammarRef(posGrammarRef) }
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
                    ? (e) => { e.stopPropagation(); wrappedGrammarRef(it.grammarRef) }
                    : null
            }, it.label))
        }
        for (const t of word.tags || []) {
            badges.appendChild(h('span', { class: 'badge' }, t))
        }

        head.replaceChildren(
            h('div', {
                class: 'card-overlay__lemma' + (rtl ? ' word-card__lemma--rtl' : ''),
                lang: language
            }, word.lemma),
            badges
        )

        /* ---------- 主要部分（在含义之前） ---------- */
        const baseStem = primaryStem(word)
        if (baseStem) {
            const extra = otherStems(word)
            body.appendChild(ovSection('主要部分',
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

        /* ---------- 含义（来源 tab 收在这一段里） ---------- */
        const meanings = pick(word.meanings)
        const showTabs = sources.length > 1
        if (meanings.length || showTabs) {
            body.appendChild(ovSection('含义',
                showTabs
                    ? createSourceTabs(sources, activeSource, (s) => {
                        activeSource = s
                        renderBody()
                    })
                    : null,
                meanings.length
                    ? h('ul', { class: 'word-card__meanings' },
                        ...meanings.map((m) => h('li', {
                            class: 'word-card__meaning',
                            lang: m.lang === 'en' ? 'en' : undefined
                        }, h('bdi', {}, m.text)))
                    )
                    : h('div', { class: 'field__hint' }, '该来源没有含义')
            ))
        }

        /* ---------- paradigm 表格 ---------- */
        if (paradigmTpl && word.paradigm && typeof word.paradigm === 'object') {
            const panels = []
            const candidates = (paradigmTpl.tables || []).filter((t) => word.paradigm[t.key])
            for (const tableTpl of candidates) {
                const tableData = word.paradigm[tableTpl.key]
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang: language,
                    mode: 'view',
                    onGrammarRef: wrappedGrammarRef,
                    // 只有一张表时保留表自己的标题；多张时用 tab 名
                    showTitle: candidates.length <= 1,
                    hideColumns: hiddenGenderColumns(paradigmTpl)
                })
                if (tbl) panels.push({ key: tableTpl.key, label: tableTpl.title || tableTpl.key, node: tbl })
            }
            if (panels.length) {
                if (!panels.some((p) => p.key === activeTable)) activeTable = panels[0].key
                body.appendChild(ovSection(null, createTabGroup({
                    items: panels,
                    active: activeTable,
                    onChange: (key) => { activeTable = key },
                    className: 'tab-bar--tables'
                }).el))
            }
        }

        /* ---------- 补充形式 ---------- */
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
            body.appendChild(ovSection('补充形式', container))
        }

        /* ---------- 固定搭配 ---------- */
        const cols = pick(word.collocations)
        if (cols.length) {
            body.appendChild(ovSection('固定搭配',
                h('div', {},
                    ...cols.map((c) => h('div', { class: 'word-card__collocation' },
                        h('span', { lang: language }, c.text || ''),
                        c.gloss ? h('span', { class: 'word-card__gloss' }, ` — ${c.gloss}`) : null
                    ))
                )
            ))
        }

        /* ---------- 例句 ---------- */
        const exs = pick(word.examples)
        if (exs.length) {
            body.appendChild(ovSection('例句',
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

        /* ---------- 派生词 ---------- */
        if (word.derivatives && word.derivatives.length) {
            body.appendChild(ovSection('派生词',
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
                                    wrappedDerivativeClick(target)
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

        /* ---------- 备注 ---------- */
        if (word.notes) {
            body.appendChild(ovSection('备注', h('div', {}, word.notes)))
        }
    }

    function pick(items) {
        if (!Array.isArray(items)) return []
        return items.filter((it) => (it.source || 'manual') === activeSource)
    }

    function close() {
        if (escHandler) {
            document.removeEventListener('keydown', escHandler)
            escHandler = null
        }
        if (overlayEl && overlayEl.parentNode) {
            overlayEl.parentNode.removeChild(overlayEl)
        }
        overlayEl = null
        if (typeof onClose === 'function') onClose()
    }

    return close
}

export function closeCardOverlay() {
    if (escHandler) {
        document.removeEventListener('keydown', escHandler)
        escHandler = null
    }
    if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl)
    }
    overlayEl = null
}

function ovSection(title, ...children) {
    return h('div', { class: 'word-card__section' },
        title ? h('div', { class: 'word-card__section-title' }, title) : null,
        ...children
    )
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
