import { resolveDeriveSpec } from './paradigm-generate.js'

/**
 * 语法数据结构（只读）
 *
 * 顶层：
 *   version, language, name
 *   paradigms: { [pos]: { tables: [...] } }   ← 新增
 *   sections: [ { id, title, items: [...] } ]
 *
 * paradigm 表结构：
 *   {
 *     key: 'main',
 *     title: '变位',
 *     columns: [{ key, label }],
 *     rows: [{ key, label, grammarRef?, principal? }]
 *   }
 */

export function isGrammarDoc(obj) {
    return obj
    && typeof obj === 'object'
    && Number.isInteger(obj.version)
    && typeof obj.language === 'string'
    && Array.isArray(obj.sections)
}

/** 展开为扁平索引：id → { item, section } */
export function indexGrammar(doc) {
    const byId = new Map()
    if (!isGrammarDoc(doc)) return byId
    for (const section of doc.sections) {
        if (!section || typeof section !== 'object') continue
        for (const item of section.items || []) {
            if (!item || typeof item.id !== 'string') continue
            byId.set(item.id, { item, section })
        }
    }
    return byId
}

/** 收集全部锚点 id（section + item），用于校验引用 */
export function collectIds(doc) {
    const ids = new Set()
    if (!isGrammarDoc(doc)) return ids
    for (const section of doc.sections || []) {
        if (section && typeof section.id === 'string') ids.add(section.id)
        for (const item of section?.items || []) {
            if (item && typeof item.id === 'string') ids.add(item.id)
        }
    }
    return ids
}

export function findAnchor(doc, id) {
    if (!isGrammarDoc(doc) || !id) return null
    for (const section of doc.sections) {
        if (section.id === id) return { section, item: null }
        for (const item of section.items || []) {
            if (item.id === id) return { section, item }
        }
    }
    return null
}

/* ---------------- paradigm ---------------- */

/**
 * 解析 paradigms[pos]，支持通用 extends（可链式）
 * - 本层写了 tables 就用本层的
 * - 否则继承 extends 指向的词性的 tables
 * - 环（a→b→a）直接返回 null
 */
function resolveTemplate(paradigms, pos, seen) {
    if (!pos || seen.has(pos)) return null
    const tpl = paradigms[pos]
    if (!tpl || typeof tpl !== 'object') return null
    if (Array.isArray(tpl.tables)) return tpl

    const parent = typeof tpl.extends === 'string' ? tpl.extends.trim() : ''
    if (!parent) return null

    seen.add(pos)
    const inherited = resolveTemplate(paradigms, parent, seen)
    if (!inherited) return null
    return { ...tpl, tables: inherited.tables, extends: parent }
}

/** 取某语言某词性的表格模板；返回 { tables: [...] } 或 null */
export function getParadigmTemplate(doc, pos) {
    if (!isGrammarDoc(doc)) return null
    const p = doc.paradigms
    if (!p || typeof p !== 'object') return null
    return resolveTemplate(p, pos, new Set())
}

/**
 * 该词性可用的语法性：从模板列 key（`{数}_{性}`）里推导
 * 例如 la noun → ['m','f','n']，fr noun → ['m','f']
 */
/**
 * 该词性声明的额外属性字段（如日语的「自他」）。
 * `paradigms[pos].attributes = [{ key, label, hint?, multi?, options: [{ value, label }] }]`
 */
export function getAttributeFields(doc, pos) {
    const tpl = getParadigmTemplate(doc, pos)
    if (!tpl || !Array.isArray(tpl.attributes)) return []
    return tpl.attributes.filter((f) => f && f.key && Array.isArray(f.options) && f.options.length)
}

/**
 * 该词性在生词表单里要显示的「属性字段」。
 *
 * 数据里用 `paradigms[pos].fields` 声明（每个字段：是否用、显示什么、有哪些选项）：
 *
 *   "fields": [
 *     { "key": "gender", "label": "语法性", "multi": true, "declensionCells": true,
 *       "options": [{ "value": "m", "label": "阳性" }, …] },
 *     { "key": "transitivity", "label": "自他",
 *       "options": [{ "value": "trans", "label": "他动词" }, …] }
 *   ]
 *
 * 没有声明时退回旧行为：如果变格列名带 `_m` / `_f` / `_n` 后缀，就推导出一个「语法性」字段。
 * 这样已有语言（la / grc / sa / he / de / fr）不用改数据，日语只要显式声明「自他」。
 */
/**
 * 该语言在该词性下要用的界面用词（来自 `data/grammar/<code>.json` 的 `terms`）。
 * 语言级的值可以被 `terms.byPos[pos]` 覆盖；没有声明的键返回空字符串
 * （不在代码里留默认文案，文案由每个语言自己写）。
 */
const TERM_KEYS = [
    'inflectionType', 'inflectionTypePlaceholder', 'inflectionTypeHint',
    'special', 'indeclinable', 'paradigmTitle', 'anchorHint', 'extraForms',
    'extraPartsHint',
]

export function termsOf(doc, pos) {
    const base = (doc && typeof doc.terms === 'object' && doc.terms) || {}
    const over = (pos && base.byPos && typeof base.byPos === 'object' ? base.byPos[pos] : null) || {}
    const pick = (key) => {
        const v = over[key] !== undefined ? over[key] : base[key]
        return typeof v === 'string' ? v : ''
    }
    const out = {}
    for (const key of TERM_KEYS) out[key] = pick(key)
    const stems = over.stems || base.stems || {}
    out.stems = {
        label: typeof stems.label === 'string' ? stems.label : '',
        placeholder: typeof stems.placeholder === 'string' ? stems.placeholder : '',
        hint: typeof stems.hint === 'string' ? stems.hint : '',
    }
    return out
}

/** `'{pos}变格表格'` 这类模板里的 `{pos}` 用词性名替换 */
export function fillTerms(text, posLabel) {
    return String(text || '').replace(/\{pos\}/g, String(posLabel ?? ''))
}

export function getFieldDefs(doc, pos) {
    return fieldDefsOfTemplate(getParadigmTemplate(doc, pos), pos)
}

/** 只看模板的版本（词卡 / 放大卡只有模板，没有整份文档） */
export function fieldDefsOfTemplate(tpl, pos) {
    if (!tpl) return []
    const declared = Array.isArray(tpl.fields) ? tpl.fields : []
    const out = []
    for (const f of declared) {
        if (!f || !f.key || !Array.isArray(f.options) || !f.options.length) continue
        out.push({
            key: String(f.key),
            label: f.label || f.key,
            hint: f.hint || '',
            multi: f.multi === true,
            // 必选字段：不提供「（未选择）」，没值时默认第一项（如日语动词的自他）
            required: f.required === true,
            // 该字段用来过滤变化表的格子（性写在列或行上都行）
            declensionCells: f.declensionCells === true || f.declensionColumns === true,
            options: f.options.map((o) => ({ value: String(o.value), label: o.label || String(o.value) })),
        })
    }
    if (out.length) return out

    // 兼容旧数据：只有名词按变化表的列名 / 行名推导语法性（与旧行为一致）；
    // 其它词性要显示字段请在 `fields` 里显式声明
    if (pos && pos !== 'noun') return []
    const cols = new Set()
    const rows = new Set()
    for (const table of tpl.tables || []) {
        for (const col of table.columns || []) cols.add(String(col.key))
        for (const row of table.rows || []) rows.add(String(row.key))
    }
    let genders = ['m', 'f', 'n'].filter((g) => [...cols].some((k) => k.endsWith('_' + g)))
    if (!genders.length) genders = ['m', 'f', 'n'].filter((g) => rows.has(g))
    if (!genders.length) return []
    const labels = { m: '阳性', f: '阴性', n: '中性' }
    return [{
        key: 'gender', label: '语法性', hint: '', multi: true, declensionCells: true,
        options: genders.map((g) => ({ value: g, label: labels[g] || g })),
    }]
}

/** 该词性的「用于筛选变化表格子」的字段（通常是语法性），没有则返回 null */
export function getDeclensionField(doc, pos) {
    return getFieldDefs(doc, pos).find((f) => f.declensionCells) || null
}

/** 词条里某个字段的取值（统一成数组） */
export function fieldValues(word, key) {
    const raw = word && word.attributes ? word.attributes[key] : null
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
    return []
}

export function getGenderOptions(doc, pos = 'noun') {
    const tpl = getParadigmTemplate(doc, pos)
    const cols = new Set()
    const rows = new Set()
    for (const table of tpl?.tables || []) {
        for (const col of table.columns || []) cols.add(String(col.key))
        for (const row of table.rows || []) rows.add(String(row.key))
    }
    const out = []
    for (const g of ['m', 'f', 'n']) {
        if ([...cols].some((k) => k.endsWith('_' + g)) || rows.has(g)) out.push(g)
    }
    return out
}

/** 列的语法性（`sg_m` → 'm'），无性别维度时返回 '' */
export function genderOfColumn(colKey) {
    const m = /_([mfn])$/.exec(String(colKey || ''))
    return m ? m[1] : ''
}

/** 行的语法性（行 key 直接是 `m` / `f` / `n`），无性别维度时返回 '' */
export function genderOfRow(rowKey) {
    const key = String(rowKey || '')
    return key === 'm' || key === 'f' || key === 'n' ? key : ''
}

/** 该 pos 是否位于某 section 之下（section id 为 `{lang}-{pos}` 或以 `{lang}-{pos}-` 开头） */
function sectionBelongsTo(sectionId, lang, pos) {
    const base = `${lang}-${pos}`
    return sectionId === base || String(sectionId).startsWith(base + '-')
}

/** 徽章用的短名：保留末尾括号里的关键信息（例词），去掉括号后的举例尾巴 */
function shortLabel(title) {
    const text = String(title || '').trim()
    const m = /^(.*?)[（(]([^（）()]*)[）)](?:[　\s].*)?$/.exec(text)
    if (m) return `${m[1].trim()}（${m[2].trim()}）`
    return text.split('　')[0].trim() || text
}

/**
 * 收集可作「变格 / 变位类型」的锚点：只取带 inflect 标记的 section / item
 *
 * 条目的锚点名**不带章节前缀**（直接是条目标题，如「III-ה 词根」）；只有同一个词性里
 * 出现重名条目时才退回「章节 · 条目」，避免两个选项长得一模一样。
 * @returns {{ id: string, label: string, short: string, kind: 'decl'|'conj' }[]}
 */
export function collectInflectAnchors(doc, lang, pos) {
    const out = []
    if (!isGrammarDoc(doc) || !pos) return out

    for (const section of doc.sections) {
        if (!section || !section.id) continue
        if (!sectionBelongsTo(section.id, lang, pos)) continue

        if (section.inflect) {
            out.push({
                id: section.id,
                label: section.anchorLabel || section.title || section.id,
                short: shortLabel(section.title || section.id),
                kind: section.inflect
            })
        }
        for (const item of section.items || []) {
            if (!item || !item.id || !item.inflect) continue
            out.push({
                id: item.id,
                // anchorLabel：下拉里的名字可以和语法页的条目标题不同（法语/德语代词按类别归并）
                label: item.anchorLabel || item.title || item.id,
                short: item.anchorLabel || item.title || item.id,
                kind: item.inflect,
                // 重名时的退路（内部用，不对外）
                fullLabel: `${section.title || section.id} · ${item.title || item.id}`
            })
        }
    }

    // 条目锚点重名：两边都退回带章节前缀的完整标题（如古希腊语四个「第二变位法」）
    const seen = new Map()
    for (const a of out) seen.set(a.label, (seen.get(a.label) || 0) + 1)
    for (const a of out) {
        if (seen.get(a.label) > 1 && a.fullLabel) {
            a.label = a.fullLabel
            a.short = a.fullLabel
        }
        delete a.fullLabel
    }

    return out
}

/**
 * 取语法锚点上的 derive 规格（item 优先，其次 section）。
 *
 * 锚点自己没写 `derive` 时可以写 `deriveRef` 指向另一个锚点 id，复用那份规格
 * （满语三个元音和谐章节共用 `mnc-verb`、希伯来语名词类别共用 `he-noun`）。
 * 实现放在 paradigm-generate.js（它要自检 dangling ref，不能反过来 import 这里）。
 */
export function getDeriveSpec(doc, id) {
    return resolveDeriveSpec(doc, id)
}

/** 取语法锚点上声明的词干：返回 [{ key, label, hint, example }]，没有则空数组 */
export function getDeriveParts(doc, id) {
    const spec = getDeriveSpec(doc, id)
    return Array.isArray(spec?.parts) ? spec.parts.filter((p) => p && p.key) : []
}

/**
 * 「词干」这一栏的标题：锚点的 derive.parts 给 base 写了 label 时用它
 * （如梵语的名词是「弱词干」、动词是「词根」），否则退回该词性的 terms.stems.label。
 */
export function stemLabelOf(doc, ref, pos) {
    const spec = ref ? getDeriveSpec(doc, ref) : null
    const parts = Array.isArray(spec?.parts) ? spec.parts : []
    const base = parts.find((part) => part && part.key === 'base')
    if (base && typeof base.label === 'string' && base.label.trim()) return base.label.trim()
    const label = termsOf(doc, pos).stems.label
    return label || '词干'
}

/** 表格 id → 表模板 */
export function indexParadigmTables(tpl) {
    const map = new Map()
    if (!tpl || !Array.isArray(tpl.tables)) return map
    for (const t of tpl.tables) {
        if (t && typeof t.key === 'string') map.set(t.key, t)
    }
    return map
}

/** 行 id → 行模板（合并所有表） */
export function indexParadigmRows(tpl) {
    const map = new Map()
    if (!tpl || !Array.isArray(tpl.tables)) return map
    for (const t of tpl.tables) {
        for (const r of t.rows || []) {
            if (r && typeof r.key === 'string') map.set(r.key, r)
        }
    }
    return map
}
