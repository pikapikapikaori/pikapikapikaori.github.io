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
 *     { "key": "gender", "label": "语法性", "multi": true, "declensionColumns": true,
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
            declensionColumns: f.declensionColumns === true,
            options: f.options.map((o) => ({ value: String(o.value), label: o.label || String(o.value) })),
        })
    }
    if (out.length) return out

    // 兼容旧数据：只有名词按变格列名推导语法性（与旧行为一致）；
    // 其它词性要显示字段请在 `fields` 里显式声明
    if (pos && pos !== 'noun') return []
    const cols = new Set()
    for (const table of tpl.tables || []) {
        for (const col of table.columns || []) cols.add(String(col.key))
    }
    const genders = ['m', 'f', 'n'].filter((g) => [...cols].some((k) => k.endsWith('_' + g)))
    if (!genders.length) return []
    const labels = { m: '阳性', f: '阴性', n: '中性' }
    return [{
        key: 'gender', label: '语法性', hint: '', multi: true, declensionColumns: true,
        options: genders.map((g) => ({ value: g, label: labels[g] || g })),
    }]
}

/** 该词性的「用于筛选变格列」的字段（通常是语法性），没有则返回 null */
export function getDeclensionField(doc, pos) {
    return getFieldDefs(doc, pos).find((f) => f.declensionColumns) || null
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
    for (const table of tpl?.tables || []) {
        for (const col of table.columns || []) cols.add(String(col.key))
    }
    const out = []
    for (const g of ['m', 'f', 'n']) {
        if ([...cols].some((k) => k.endsWith('_' + g))) out.push(g)
    }
    return out
}

/** 列的语法性（`sg_m` → 'm'），无性别维度时返回 '' */
export function genderOfColumn(colKey) {
    const m = /_([mfn])$/.exec(String(colKey || ''))
    return m ? m[1] : ''
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
 * @returns {{ id: string, label: string, kind: 'decl'|'conj' }[]}
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
                label: section.title || section.id,
                short: shortLabel(section.title || section.id),
                kind: section.inflect
            })
        }
        for (const item of section.items || []) {
            if (!item || !item.id || !item.inflect) continue
            out.push({
                id: item.id,
                label: `${section.title || section.id} · ${item.title || item.id}`,
                short: item.title || item.id,
                kind: item.inflect
            })
        }
    }

    // 短名撞车时退回完整标题（如古希腊语四个「第二变位法」）
    const seen = new Map()
    for (const a of out) seen.set(a.short, (seen.get(a.short) || 0) + 1)
    for (const a of out) if (seen.get(a.short) > 1) a.short = a.label

    return out
}

/** 取语法锚点上的 derive 规格（item 优先，其次 section）；没有则返回 null */
export function getDeriveSpec(doc, id) {
    const hit = findAnchor(doc, id)
    if (!hit) return null
    const spec = (hit.item && hit.item.derive) || (hit.section && hit.section.derive)
    return spec && typeof spec === 'object' ? spec : null
}

/** 取语法锚点上声明的主要部分：返回 [{ key, label, hint, example }]，没有则空数组 */
export function getDeriveParts(doc, id) {
    const spec = getDeriveSpec(doc, id)
    return Array.isArray(spec?.parts) ? spec.parts.filter((p) => p && p.key) : []
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
