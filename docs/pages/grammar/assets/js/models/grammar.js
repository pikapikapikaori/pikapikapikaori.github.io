import { resolveDeriveSpec } from './paradigm-generate.js'
import { POS_LIST } from '../config/config.js'

/** 语法数据结构（只读）：顶层 version / language / paradigms / sections，section 下挂 items */

const POS_VALUES = new Set(POS_LIST.map((p) => p.value))

/**
 * 结构校验：类型、必需字段、id 唯一性、跨字段引用。纯同步，不跑 derive。
 *
 * 加载时用它拦下坏文件（有 errors 就不加载）；设置页的「校验语法 JSON」也用它，
 * 与 `verifyGrammarDoc()`（derive 试算）一起构成两段式自检。
 *
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateGrammarDoc(lang, doc) {
    const errors = []
    const warnings = []
    const err = (m) => errors.push(m)
    const warn = (m) => warnings.push(m)

    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        return { errors: ['顶层不是 JSON 对象'], warnings }
    }

    if (!Number.isInteger(doc.version)) err('`version` 必须是整数')
    if (typeof doc.language !== 'string' || !doc.language) err('缺少 `language`')
    else if (doc.language !== lang) err(`\`language\` 是 "${doc.language}"，与文件名 "${lang}" 不一致`)
    if (typeof doc.name !== 'string' || !doc.name) err('缺少 `name`')
    if (!Array.isArray(doc.sections)) err('`sections` 必须是数组')

    if (doc.pos === undefined) {
        warn('没有声明 `pos`，将回落到全部词性')
    } else if (!Array.isArray(doc.pos)) {
        err('`pos` 必须是数组')
    } else {
        const unknown = doc.pos.filter((p) => !POS_VALUES.has(p))
        if (unknown.length) err(`\`pos\` 含未知词性：${unknown.join(', ')}`)
    }

    const groupIds = new Set()
    if (doc.groups !== undefined) {
        if (!Array.isArray(doc.groups)) err('`groups` 必须是数组')
        else {
            for (const g of doc.groups) {
                if (!g || typeof g.id !== 'string' || !g.id) err('`groups[]` 有条目缺少 `id`')
                else if (groupIds.has(g.id)) err(`\`groups\` 的 id 重复：${g.id}`)
                else groupIds.add(g.id)
            }
        }
    }

    const ids = new Set()
    const takeId = (id, where) => {
        if (typeof id !== 'string' || !id) {
            err(`${where} 缺少 \`id\``)
            return
        }
        if (ids.has(id)) err(`锚点 id 重复：${id}`)
        else ids.add(id)
        if (!id.startsWith(`${lang}-`)) warn(`${where} 的 id "${id}" 没有 "${lang}-" 前缀`)
    }

    for (const section of Array.isArray(doc.sections) ? doc.sections : []) {
        if (!section || typeof section !== 'object') {
            err('`sections[]` 有条目不是对象')
            continue
        }
        takeId(section.id, `section "${section.title || '?'}"`)
        if (section.group && !groupIds.has(section.group)) {
            err(`section "${section.id}" 的 \`group\` 指向不存在的分组：${section.group}`)
        }
        if (section.items !== undefined && !Array.isArray(section.items)) {
            err(`section "${section.id}" 的 \`items\` 必须是数组`)
            continue
        }
        if (!section.items || !section.items.length) warn(`section "${section.id}" 没有条目`)
        for (const item of section.items || []) {
            if (!item || typeof item !== 'object') {
                err(`section "${section.id}" 的 \`items[]\` 有条目不是对象`)
                continue
            }
            takeId(item.id, `item "${item.title || '?'}"`)
            if (item.tables !== undefined && !Array.isArray(item.tables)) {
                err(`item "${item.id}" 的 \`tables\` 必须是数组`)
            }
            if (item.derive !== undefined && (typeof item.derive !== 'object' || item.derive === null)) {
                err(`item "${item.id}" 的 \`derive\` 必须是对象`)
            }
            if (!item.tables?.length && !item.notes && !item.derive) {
                warn(`item "${item.id}" 既没有表格、备注，也没有 derive`)
            }
        }
    }

    if (doc.paradigms !== undefined) {
        if (!doc.paradigms || typeof doc.paradigms !== 'object' || Array.isArray(doc.paradigms)) {
            err('`paradigms` 必须是对象')
        } else {
            const posKeys = new Set(Object.keys(doc.paradigms))
            for (const [pos, def] of Object.entries(doc.paradigms)) {
                if (!POS_VALUES.has(pos)) err(`\`paradigms\` 的词性 ${pos} 不在 POS_LIST 里`)
                if (!def || typeof def !== 'object') {
                    err(`\`paradigms.${pos}\` 必须是对象`)
                    continue
                }
                if (def.extends !== undefined) {
                    if (typeof def.extends !== 'string' || !def.extends) {
                        err(`\`paradigms.${pos}.extends\` 必须是非空字符串`)
                    } else if (!posKeys.has(def.extends)) {
                        err(`\`paradigms.${pos}.extends\` 指向不存在的词性：${def.extends}`)
                    }
                }
                if (def.tables === undefined) {
                    if (def.extends === undefined) err(`\`paradigms.${pos}\` 既没有 \`tables\` 也没有 \`extends\``)
                    continue
                }
                if (!Array.isArray(def.tables)) {
                    err(`\`paradigms.${pos}.tables\` 必须是数组`)
                    continue
                }
                const keys = new Set()
                for (const table of def.tables) {
                    if (!table || typeof table !== 'object') {
                        err(`\`paradigms.${pos}.tables[]\` 有条目不是对象`)
                        continue
                    }
                    if (typeof table.key !== 'string' || !table.key) {
                        err(`\`paradigms.${pos}.tables[]\` 缺 \`key\``)
                        continue
                    }
                    if (keys.has(table.key)) err(`\`paradigms.${pos}\` 的表 key 重复：${table.key}`)
                    else keys.add(table.key)
                    if (!Array.isArray(table.columns) || !table.columns.length) {
                        err(`表 ${pos}.${table.key} 缺 \`columns\``)
                    }
                    if (!Array.isArray(table.rows) || !table.rows.length) {
                        err(`表 ${pos}.${table.key} 缺 \`rows\``)
                    }
                }
            }
            // extends 链成环：整体忽略继承，模板会退化成空
            for (const pos of posKeys) {
                const seen = new Set([pos])
                let cur = doc.paradigms[pos]?.extends
                while (typeof cur === 'string') {
                    if (seen.has(cur)) {
                        warn(`\`paradigms.${pos}.extends\` 形成环（${[...seen, cur].join(' → ')}），继承会被忽略`)
                        break
                    }
                    seen.add(cur)
                    cur = doc.paradigms[cur]?.extends
                }
            }
        }
    }

    const hasParadigms = !!doc.paradigms && typeof doc.paradigms === 'object'
        && Object.keys(doc.paradigms).length > 0
    if (doc.paradigm === false && hasParadigms) {
        warn('`paradigm: false` 却写了 `paradigms`，模板不会被用到')
    }
    if (doc.paradigm !== false && !hasParadigms) {
        warn('没有 `paradigms`，该语言的变格 / 变位表无法生成')
    }
    if (doc.grammar === false && Array.isArray(doc.sections) && doc.sections.length) {
        warn('`grammar: false` 但 `sections` 不为空，语法页不会显示这些内容')
    }

    return { errors, warnings }
}

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
 * 解析 paradigms[pos]，支持链式 extends：本层写了 tables 就用本层的，否则继承 extends 指向的词性。
 * 出现环（a→b→a）返回 null。
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
 * `paradigms[pos].attributes` 声明的额外属性字段（如日语的「自他」）：
 * `[{ key, label, hint?, multi?, options: [{ value, label }] }]`
 */
export function getAttributeFields(doc, pos) {
    const tpl = getParadigmTemplate(doc, pos)
    if (!tpl || !Array.isArray(tpl.attributes)) return []
    return tpl.attributes.filter((f) => f && f.key && Array.isArray(f.options) && f.options.length)
}

/**
 * 该语言在该词性下的界面用词：`terms` 可被 `terms.byPos[pos]` 覆盖；
 * 未声明的键返回空串（代码里不留默认文案，文案由语言数据自己写）。
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

/**
 * 生词表单要显示的属性字段：数据用 `paradigms[pos].fields` 声明（key / label / options / required / declensionCells）；
 * 没声明时只有名词退回「列名或行名带 m/f/n → 语法性」的推导。
 */
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
 * 可作「变格 / 变位类型」的锚点：只取带 inflect 标记的 section / item。
 * 锚点名默认不带章节前缀，只有同一词性内重名时才退回「章节 · 条目」（避免两个选项一模一样）。
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
 * 取语法锚点上的 derive 规格（item 优先，其次 section）；锚点没写 `derive` 时可以写
 * `deriveRef` 指向另一个锚点复用那份规格（满语元音和谐、希伯来语名词类别）。
 * 实现在 paradigm-generate.js：它要自检 dangling ref，不能反过来 import 这里。
 */
export function getDeriveSpec(doc, id) {
    return resolveDeriveSpec(doc, id)
}

/** 取语法锚点上声明的词干：返回 [{ key, label, hint, example }]，没有则空数组 */
export function getDeriveParts(doc, id) {
    const spec = getDeriveSpec(doc, id)
    return Array.isArray(spec?.parts) ? spec.parts.filter((p) => p && p.key) : []
}

/** 「词干」栏的标题：`derive.parts` 给 base 写了 label 就用它（梵语名词「弱词干」、动词「词根」），否则用该词性的 terms.stems.label */
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
