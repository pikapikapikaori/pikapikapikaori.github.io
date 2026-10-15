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

/** 取某语言某词性的表格模板；返回 { tables: [...] } 或 null */
export function getParadigmTemplate(doc, pos) {
    if (!isGrammarDoc(doc)) return null
    const p = doc.paradigms
    if (!p || typeof p !== 'object') return null
    const tpl = p[pos]
    if (!tpl || !Array.isArray(tpl.tables)) return null
    return tpl
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

/**
 * 从词条数据与表格模板派生 principal parts
 * 仅对 verb 生效；取 principal === true 的行，抽出主格值
 * @returns Array<{ label, form }>
 */
export function derivePrincipalParts(word, tpl) {
    if (!word || !word.paradigm || !tpl) return []
    const out = []
    for (const table of tpl.tables || []) {
        if (table.key !== 'main') continue // 只从主表派生
        const data = word.paradigm[table.key]
        if (!data) continue
        for (const row of table.rows || []) {
            if (!row || !row.principal) continue
            const cells = data[row.key]
            if (!cells) continue

            // 主格：优先 1sg，若 1pl 存在且不同则追加一行
            const sg = cells['1sg']
            const pl = cells['1pl']
            if (sg) out.push({ label: row.label, form: sg })
            if (pl && pl !== sg) out.push({ label: row.label + '（复）', form: pl })
        }
    }
    return out
}
