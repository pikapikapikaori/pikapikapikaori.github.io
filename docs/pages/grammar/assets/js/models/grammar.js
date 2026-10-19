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
                short: String(section.title || section.id).split(/[　\s]/)[0],
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
    return out
}

/** 取语法锚点上的 derive 规格（item 优先，其次 section）；没有则返回 null */
export function getDeriveSpec(doc, id) {
    const hit = findAnchor(doc, id)
    if (!hit) return null
    const spec = (hit.item && hit.item.derive) || (hit.section && hit.section.derive)
    return spec && typeof spec === 'object' ? spec : null
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
