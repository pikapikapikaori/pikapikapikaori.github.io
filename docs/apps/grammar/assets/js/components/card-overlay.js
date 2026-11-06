import { h } from '../utils/dom.js'
import { annotateBdi, bdiFragment, bdiNode, stripBdi } from '../utils/bdi.js'
import { posLabel, allSources, stemDisplay, primaryStem, otherStems } from '../models/word.js'
import { fieldDefsOfTemplate, fieldValues, genderOfColumn, genderOfRow, termsOf } from '../models/grammar.js'
import { getLanguage } from '../data/languages.js'
import { BREVE_LANGS } from '../config/config.js'
import { createSourceTabs } from './source-tabs.js'
import { createTabGroup } from './tabs.js'
import { createParadigmTable } from './paradigm-table.js'
import { collocationList, exampleList } from './entry-lists.js'
import { annotateDualText } from '../utils/dual-text.js'
import { annotateBreves } from '../utils/breve.js'
import { isRomanOn, isBreveOn, onToggles } from '../utils/view-toggles.js'
import { getScriptProfile } from '../services/grammar-service.js'

let overlayEl = null
let escHandler = null
/** 订阅「转写 / 短音符」全局开关；卡片关闭时退订 */
let offToggles = null

/** 卡片关掉后，把右下角工具列与订阅一起恢复 */
function detachOverlay() {
    if (offToggles) {
        offToggles()
        offToggles = null
    }
    document.documentElement.classList.remove('card-overlay-open')
}

/** 打开放大版卡片；opts 里的 language / paradigmTpl / onGrammarRef / resolveDerivative / onDerivativeClick / onClose 可选 */
export function openCardOverlay(word, opts = {}) {
    // 已经有一张卡片在屏幕上 = 这是「跳到派生词」式的原地替换：不重播入场动画，
    // 否则整个弹窗会再淡入 + 放大一次，看起来像页面闪了一下
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
    // 跳到派生词时先不关：等新卡片直接替换旧卡片，中间不出现空白
    const stayOpenOnDerivative = opts.stayOpenOnDerivative === true
    const onClose = opts.onClose || null

    // 「显示转写」和语法页 / 词列表共用同一个开关：localStorage 记状态，html 上的 class 控显示
    const scriptProfile = opts.scriptProfile || getScriptProfile(language)
    const toRoman = typeof scriptProfile?.toRoman === 'function'
        ? (text) => scriptProfile.toRoman(text)
        : null
    const scriptRange = toRoman && scriptProfile?.scriptRange instanceof RegExp
        ? scriptProfile.scriptRange
        : null
    // 转写 / 短音符由右下角工具列统一切换，词卡只订阅它的结果
    const showBreve = BREVE_LANGS.includes(language)

    const sources = allSources(word)
    // 「手动」就是默认来源：有外部来源时就多一个 tab，别让含义没处可切
    if (!sources.includes('manual')) sources.unshift('manual')
    // 默认落在「有含义」的那个来源上，免得一打开是对着空 tab
    const sourceWithMeanings = sources.find((s) => (word.meanings || []).some((m) => (m.source || 'manual') === s))
    let activeSource = sourceWithMeanings || sources[0] || 'manual'
    /** 多张形态变形表时当前选中的那张 */
    let activeTable = null
    /** 「固定搭配」「例句」各自的来源 tab（与「含义」互不影响） */
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
    // 卡片盖住了整页：右下角工具列里的「回到顶部」这时没有意义（它滚的是背后的页面）
    document.documentElement.classList.add('card-overlay-open')
    offToggles = onToggles(() => {
        annotateRoman()
        annotateBreveText()
    })

    /** 跳转前先关闭 overlay，避免弹窗留在旧页面上 */
    function wrappedGrammarRef(ref) {
        close()
        if (typeof onGrammarRef === 'function') onGrammarRef(ref)
    }

    /** 跳转前关闭 overlay（stayOpenOnDerivative 时交给调用方用新卡片替换） */
    function wrappedDerivativeClick(target) {
        if (!stayOpenOnDerivative) close()
        if (typeof onDerivativeClick === 'function') onDerivativeClick(target)
    }

    escHandler = (e) => {
        if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', escHandler)

    /** 名词只显示所选性别的格子（性在列上就整列不渲染，在行上就整行不渲染） */
    function hiddenGenderCells(tpl) {
        const empty = { columns: [], rows: [] }
        const field = fieldDefsOfTemplate(tpl, word.pos).find((f) => f.declensionCells)
        if (!field) return empty
        const picked = fieldValues(word, field.key)
        if (!picked.length) return empty
        const hidden = { columns: [], rows: [] }
        for (const table of tpl?.tables || []) {
            for (const col of table.columns || []) {
                const g = genderOfColumn(col.key)
                if (g && !picked.includes(g)) hidden.columns.push(col.key)
            }
            for (const row of table.rows || []) {
                const g = genderOfRow(row.key)
                if (g && !picked.includes(g)) hidden.rows.push(row.key)
            }
        }
        return hidden
    }

    renderBody()

    function renderBody() {
        body.replaceChildren()

        const langMeta = getLanguage(word.language)
        // 分区标题跟随该语言的 terms
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
        // 属性（语法性 / 自他 / 助动词…）紧跟词性，排在变位类型与标签之前
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
                    ? createSourceTabs(sources, activeSource, (s) => {
                        activeSource = s
                        renderBody()
                    })
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
            const hiddenGender = hiddenGenderCells(paradigmTpl)
            for (const tableTpl of candidates) {
                const tableData = word.paradigm[tableTpl.key]
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang: language,
                    mode: 'view',
                    onGrammarRef: wrappedGrammarRef,
                    // 只有一张表时保留表自己的标题；多张时用 tab 名
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
                    ? createSourceTabs(sources, activeCollocationSource, (s) => {
                        activeCollocationSource = s
                        renderBody()
                    })
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
                    ? createSourceTabs(sources, activeExampleSource, (s) => {
                        activeExampleSource = s
                        renderBody()
                    })
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
                                class: 'badge badge--accent word-card__derivative',
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

    /** 把短音符包起来：默认隐藏，按钮切换显示 */
    function annotateBreveText() {
        if (!showBreve) return
        if (!isBreveOn()) return
        annotateBreves(head, { selector: '.card-overlay__lemma' })
        annotateBreves(body, {
            selector: 'td, th, .word-card__stem, .word-card__stem-part, .word-card__example-text,'
                + ' .word-card__derivative, .word-card__inflection-form'
        })
    }

    /** 在原文旁标出转写：标题、词干、变格表、例句、派生词 */
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

/** 该区块里第一个「有内容」的来源，用来决定 tab 的初始落点 */
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
