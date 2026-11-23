import { h } from '../utils/dom.js'
import { annotateBdi, bdiFragment, bdiNode, stripBdi } from '../utils/bdi.js'
import { posLabel, allSources, sourceLabel, stemDisplay, primaryStem, otherStems } from '../models/word.js'
import { fieldDefsOfTemplate, fieldValues, hiddenGenderCells, termsOf } from '../models/grammar.js'
import { getLanguage } from '../data/languages.js'
import { BREVE_LANGS } from '../config/config.js'
import { createTabBar, createTabGroup } from './tabs.js'
import { createParadigmTable } from './paradigm-table.js'
import { collocationList, exampleList } from './entry-lists.js'
import { annotateDualText } from '../utils/dual-text.js'
import { annotateBreves } from '../utils/breve.js'
import { isRomanOn, isBreveOn, onToggles } from '../utils/view-toggles.js'
import { getScriptProfile } from '../services/grammar-service.js'

let overlayEl = null
let escHandler = null
let offToggles = null

function detachOverlay() {
    if (offToggles) {
        offToggles()
        offToggles = null
    }
    document.documentElement.classList.remove('card-overlay-open')
}

export function openCardOverlay(word, opts = {}) {
    const replacing = !!document.querySelector('.card-overlay')
    closeCardOverlay()

    const language = opts.language || word.language
    const paradigmTpl = opts.paradigmTpl || null
    const partLabels = opts.partLabels || null
    const stemLabel = opts.stemLabel || '词干'
    const onGrammarRef = opts.onGrammarRef || null
    const resolveDerivative = opts.resolveDerivative || null
    const resolvePosRef = opts.resolvePosRef || null
    const posGrammarRef = typeof resolvePosRef === 'function' ? resolvePosRef(word.pos) : null
    const onDerivativeClick = opts.onDerivativeClick || null
    const stayOpenOnDerivative = opts.stayOpenOnDerivative === true
    const onClose = opts.onClose || null

    const scriptProfile = opts.scriptProfile || getScriptProfile(language)
    const toRoman = typeof scriptProfile?.toRoman === 'function'
        ? (text) => scriptProfile.toRoman(text)
        : null
    const scriptRange = toRoman && scriptProfile?.scriptRange instanceof RegExp
        ? scriptProfile.scriptRange
        : null
    const showBreve = BREVE_LANGS.includes(language)

    const sources = allSources(word)
    if (!sources.includes('manual')) sources.unshift('manual')
    const sourceWithMeanings = sources.find((s) => (word.meanings || []).some((m) => (m.source || 'manual') === s))
    let activeSource = sourceWithMeanings || sources[0] || 'manual'
    let activeTable = null
    let activeCollocationSource = firstSourceWith(word.collocations) || activeSource
    let activeExampleSource = firstSourceWith(word.examples) || activeSource

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

    overlayEl = h('div', { class: 'card-overlay' + (replacing ? ' card-overlay--instant' : '') }, backdrop, panel)
    annotateBdi(overlayEl, language)
    document.body.appendChild(overlayEl)
    document.documentElement.classList.add('card-overlay-open')
    offToggles = onToggles(() => {
        annotateRoman()
        annotateBreveText()
    })

    function wrappedGrammarRef(ref) {
        close()
        if (typeof onGrammarRef === 'function') onGrammarRef(ref)
    }

    function wrappedDerivativeClick(target) {
        if (!stayOpenOnDerivative) close()
        if (typeof onDerivativeClick === 'function') onDerivativeClick(target)
    }

    escHandler = (e) => {
        if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', escHandler)

    renderBody()

    function renderBody() {
        body.replaceChildren()

        const langMeta = getLanguage(word.language)
        const terms = termsOf(langMeta, word.pos)
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
        for (const def of fieldDefsOfTemplate(paradigmTpl, word.pos)) {
            for (const value of fieldValues(word, def.key)) {
                const label = (def.options.find((o) => o.value === value) || {}).label || value
                badges.appendChild(h('span', { class: 'badge', title: def.label }, label))
            }
        }
        const it = word.inflectionType
        if (it && it.label && langMeta?.paradigm !== false) {
            const clickable = !!(it.grammarRef && onGrammarRef)
            badges.appendChild(h(clickable ? 'button' : 'span', {
                class: 'badge badge--accent' + (clickable ? ' badge--clickable' : ''),
                type: clickable ? 'button' : null,
                onclick: clickable
                    ? (e) => { e.stopPropagation(); wrappedGrammarRef(it.grammarRef) }
                    : null
            }, bdiFragment(it.label, language)))
        }
        for (const t of word.tags || []) {
            badges.appendChild(h('span', { class: 'badge' }, t))
        }

        head.replaceChildren(
            h('div', { class: 'card-overlay__lemma' }, bdiNode(word.lemma, language)),
            badges
        )

        const baseStem = primaryStem(word)
        if (baseStem) {
            const extra = otherStems(word)
            body.appendChild(ovSection(stemLabel,
                h('div', { class: 'word-card__stem' }, bdiNode(stemDisplay(baseStem), language)),
                extra.length
                    ? h('div', { class: 'word-card__stem-extra' },
                        ...extra.map(([key, value]) => h('span', { class: 'word-card__stem-part' },
                            partLabels?.[key]
                                ? h('span', { class: 'word-card__stem-part-label' }, stripBdi(partLabels[key]))
                                : null,
                            bdiNode(stemDisplay(value), language)
                        )))
                    : null
            ))
        }

        const meanings = pick(word.meanings, activeSource)
        const showTabs = sources.length > 1
        if (meanings.length || showTabs) {
            body.appendChild(ovSection(terms.meanings,
                showTabs
                    ? createTabBar({
                        items: sources.map((s) => ({ key: s, label: sourceLabel(s) })),
                        active: activeSource,
                        lang: word.language,
                        onChange: (s) => {
                            activeSource = s
                            renderBody()
                        }
                    }).el
                    : null,
                meanings.length
                    ? h('ol', { class: 'word-card__list' },
                        ...meanings.map((m) => h('li', {
                            class: 'word-card__meaning'
                        }, bdiNode(m.text, m.lang === 'en' ? 'en' : 'zh')))
                    )
                    : h('div', { class: 'field__hint' }, '该来源没有含义')
            ))
        }

        if (paradigmTpl && word.paradigm && typeof word.paradigm === 'object') {
            const panels = []
            const candidates = (paradigmTpl.tables || []).filter((t) => word.paradigm[t.key])
            const hiddenGender = hiddenGenderCells(paradigmTpl, word.pos, word)
            for (const tableTpl of candidates) {
                const tableData = word.paradigm[tableTpl.key]
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang: language,
                    mode: 'view',
                    showTitle: candidates.length <= 1,
                    hideColumns: hiddenGender.columns,
                    hideRows: hiddenGender.rows
                })
                if (tbl) panels.push({ key: tableTpl.key, label: tableTpl.title || tableTpl.key, node: tbl })
            }
            if (panels.length) {
                if (!panels.some((p) => p.key === activeTable)) activeTable = panels[0].key
                body.appendChild(ovSection(null, createTabGroup({
                    items: panels,
                    active: activeTable,
                    onChange: (key) => { activeTable = key },
                    className: 'tab-bar--tables',
                    lang: language
                }).el))
            }
        }

        const infs = Array.isArray(word.inflections) ? word.inflections : []
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
                        bdiNode(i.form || '', language, { class: 'word-card__inflection-form' })
                    ))
                ))
            }
            body.appendChild(ovSection(terms.extraForms, container))
        }

        const cols = pick(word.collocations, activeCollocationSource)
        if (cols.length || showTabs) {
            body.appendChild(ovSection(terms.collocations,
                showTabs
                    ? createTabBar({
                        items: sources.map((s) => ({ key: s, label: sourceLabel(s) })),
                        active: activeCollocationSource,
                        lang: word.language,
                        onChange: (s) => {
                            activeCollocationSource = s
                            renderBody()
                        }
                    }).el
                    : null,
                cols.length
                    ? collocationList(cols, language)
                    : h('div', { class: 'field__hint' }, '该来源没有固定搭配')
            ))
        }

        const exs = pick(word.examples, activeExampleSource)
        if (exs.length || showTabs) {
            body.appendChild(ovSection(terms.examples,
                showTabs
                    ? createTabBar({
                        items: sources.map((s) => ({ key: s, label: sourceLabel(s) })),
                        active: activeExampleSource,
                        lang: word.language,
                        onChange: (s) => {
                            activeExampleSource = s
                            renderBody()
                        }
                    }).el
                    : null,
                exs.length
                    ? exampleList(exs, language, {
                        meanings: word.meanings,
                        activeSource
                    })
                    : h('div', { class: 'field__hint' }, '该来源没有例句')
            ))
        }

        if (word.derivatives && word.derivatives.length) {
            body.appendChild(ovSection(terms.derivatives,
                h('div', { class: 'word-card__derivatives' },
                    ...word.derivatives.map((d) => {
                        const target = resolveDerivative ? resolveDerivative(d) : null
                        if (target && onDerivativeClick) {
                            return h('button', {
                                class: 'badge badge--accent badge--clickable word-card__derivative',
                                type: 'button',
                                onclick: (e) => {
                                    e.stopPropagation()
                                    wrappedDerivativeClick(target)
                                }
                            }, bdiNode(d, language))
                        }
                        return h('span', {
                            class: 'badge word-card__derivative'
                        }, bdiNode(d, language))
                    })
                )
            ))
        }

        if (word.notes) {
            const notes = h('div', {}, bdiFragment(word.notes, language))
            body.appendChild(ovSection(terms.notes, notes))
        }

        annotateRoman()
        annotateBreveText()
    }

    function annotateBreveText() {
        if (!showBreve) return
        if (!isBreveOn()) return
        annotateBreves(head, { selector: '.card-overlay__lemma' })
        annotateBreves(body, {
            selector: 'td, th, .word-card__stem, .word-card__stem-part, .word-card__example-text,'
                + ' .word-card__derivative, .word-card__inflection-form'
        })
    }

    function annotateRoman() {
        if (!toRoman || !scriptRange || !isRomanOn()) return
        annotateDualText(head, { range: scriptRange, toRoman, selector: '.card-overlay__lemma' })
        annotateDualText(body, { range: scriptRange, toRoman })
        annotateDualText(body, {
            range: scriptRange,
            toRoman,
            selector: '.word-card__stem, .word-card__stem-part, .word-card__example-text, .word-card__derivative'
        })
    }

    function pick(items, source = activeSource) {
        if (!Array.isArray(items)) return []
        return items.filter((it) => (it.source || 'manual') === source)
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
        detachOverlay()
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
    detachOverlay()
}

function firstSourceWith(items) {
    const list = Array.isArray(items) ? items : []
    for (const it of list) {
        if (Object.values(it || {}).some((v) => typeof v === 'string' && v.trim())) return it.source || 'manual'
    }
    return null
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
