/** Word 模型：词条的识别方式、去重合并、序列化 */

import { POS_LIST, WORD_SOURCE_OPTIONS } from '../config/config.js'
import { wordId } from '../utils/id.js'
import { nowIso } from '../utils/date.js'
import { toStringArray } from '../utils/text-normalize.js'

/** 词条的「属性字段」取值：只保留有值的内容；多选（如语法性、助动词）存数组 */
export function normalizeAttributes(input) {
    const out = {}
    if (!input || typeof input !== 'object') return out
    for (const [key, value] of Object.entries(input)) {
        if (!key) continue
        if (Array.isArray(value)) {
            const list = value.map((x) => String(x ?? '').trim()).filter(Boolean)
            if (list.length) out[key] = [...new Set(list)]
            continue
        }
        const v = String(value ?? '').trim()
        if (v) out[key] = v
    }
    return out
}

export function posLabel(pos) {
    const hit = POS_LIST.find((p) => p.value === pos)
    return hit ? hit.label : pos || ''
}

export function createWord(partial) {
    const t = nowIso()
    return {
        id: wordId(),
        userId: partial.userId,
        language: partial.language,
        lemma: String(partial.lemma ?? '').trim(),
        pos: partial.pos || 'other',

        inflectionType: partial.inflectionType || { label: '', grammarRef: null },
        attributes: normalizeAttributes(partial.attributes),
        paradigm: normalizeParadigm(partial.paradigm),
        stems: normalizeStems(partial.stems),

        inflections: normalizeSourceList(partial.inflections, 'inflections'),
        meanings: normalizeSourceList(partial.meanings, 'meanings'),
        collocations: normalizeSourceList(partial.collocations, 'collocations'),
        examples: normalizeSourceList(partial.examples, 'examples'),

        derivatives: toStringArray(partial.derivatives),

        encounterCount: Number.isFinite(partial.encounterCount) ? partial.encounterCount : 1,
        mastery: Number.isFinite(partial.mastery) ? partial.mastery : 0,
        correctCount: Number.isFinite(partial.correctCount) ? partial.correctCount : 0,
        wrongCount: Number.isFinite(partial.wrongCount) ? partial.wrongCount : 0,
        lastReviewedAt: partial.lastReviewedAt || null,
        nextReviewAt: partial.nextReviewAt || null,

        tags: toStringArray(partial.tags),
        notes: partial.notes || '',

        addedAt: partial.addedAt || t,
        updatedAt: t
    }
}

function normalizeSourceList(list, kind) {
    if (!Array.isArray(list)) return []
    const out = []
    for (const item of list) {
        if (!item) continue
        if (typeof item === 'string') {
            const text = item.trim()
            if (text) out.push(defaultEntry(kind, text))
            continue
        }
        const entry = { ...item }
        // 补充形式属于词条本身，不区分来源
        if (kind === 'inflections') delete entry.source
        else entry.source = entry.source || 'manual'
        if (typeof entry.text === 'string') entry.text = entry.text.trim()
        if (typeof entry.form === 'string') entry.form = entry.form.trim()
        if (kind === 'inflections' && entry.group != null) {
            entry.group = String(entry.group).trim()
        }
        if (entry.text || entry.form) out.push(entry)
    }
    return out
}

function defaultEntry(kind, text) {
    switch (kind) {
        case 'meanings':     return { text, lang: 'zh', source: 'manual' }
        case 'inflections':  return { label: '', form: text }
        case 'collocations': return { text, gloss: '', source: 'manual' }
        case 'examples':     return { text, translation: '', citation: '', source: 'manual' }
        default:             return { text, source: 'manual' }
    }
}

/**
 * 规范化 paradigm：{ [tableKey]: { [rowKey]: { [colKey]: string } } }
 * 空字符串、null、undefined 一律剔除
 */
export function normalizeParadigm(p) {
    if (!p || typeof p !== 'object') return {}
    const out = {}
    for (const [tkey, table] of Object.entries(p)) {
        if (!table || typeof table !== 'object') continue
        const rows = {}
        let hasAny = false
        for (const [rkey, cells] of Object.entries(table)) {
            if (!cells || typeof cells !== 'object') continue
            const clean = {}
            for (const [ckey, v] of Object.entries(cells)) {
                const s = String(v ?? '').trim()
                if (s) { clean[ckey] = s; hasAny = true }
            }
            if (Object.keys(clean).length) rows[rkey] = clean
        }
        if (hasAny) out[tkey] = rows
    }
    return out
}

/**
 * 规范化词干。词干是不变的部分，词形变化一律在其后追加词尾（la am → amō、amāre，grc λόγ → λόγος）；
 * 末尾的连字符只是显示约定，不写入数据
 */
export function normalizeStem(value) {
    return String(value ?? '').trim().replace(/[-\u2010-\u2015\uff0d]+$/, '').trim()
}

/** 词干的显示形式：统一补上末尾连字符 */
export function stemDisplay(stem) {
    const s = normalizeStem(stem)
    return s ? s + '-' : ''
}

/** 规范化词干 { key: 词干 } */
export function normalizeStems(value) {
    const out = {}
    if (!value || typeof value !== 'object') return out
    for (const [key, raw] of Object.entries(value)) {
        const k = String(key || '').trim()
        const s = normalizeStem(raw)
        if (k && s) out[k] = s
    }
    return out
}

/** 基准词干（表单里的「词干」） */
export function primaryStem(word) {
    return normalizeStem(word?.stems?.base ?? '')
}

/** 除 base 之外的其它词干：[[key, 词干], ...] */
export function otherStems(word) {
    const stems = word?.stems
    if (!stems || typeof stems !== 'object') return []
    return Object.entries(stems)
        .filter(([key, value]) => key !== 'base' && normalizeStem(value))
        .map(([key, value]) => [key, normalizeStem(value)])
}

/** 合并词干：已有的值不被覆盖，只在缺失时填充 */
export function mergeStems(existing, incoming) {
    const merged = normalizeStems(existing)
    for (const [key, value] of Object.entries(normalizeStems(incoming))) {
        if (!merged[key]) merged[key] = value
    }
    return merged
}

/** 判断 paradigm 是否为空 */
export function isParadigmEmpty(p) {
    if (!p || typeof p !== 'object') return true
    for (const table of Object.values(p)) {
        if (table && typeof table === 'object' && Object.keys(table).length) return false
    }
    return true
}

/** 收集词条中所有 source 标识，按 manual 优先排序 */
export function allSources(word) {
    const set = new Set()
    for (const k of ['meanings', 'collocations', 'examples']) {
        for (const it of word[k] || []) set.add(it.source || 'manual')
    }
    if (set.size === 0) set.add('manual')
    const order = WORD_SOURCE_OPTIONS.map((o) => o.value)
    const rank = (v) => {
        const i = order.indexOf(v)
        return i === -1 ? order.length : i
    }
    return Array.from(set).sort((a, b) => {
        const d = rank(a) - rank(b)
        return d !== 0 ? d : a.localeCompare(b)
    })
}

export function sourceLabel(source) {
    if (!source) return '未知'
    const hit = WORD_SOURCE_OPTIONS.find((o) => o.value === source)
    if (hit) return hit.label
    if (source.startsWith('url:')) return source.slice(4)
    return source
}

/** 表格按格子合并：新词条写了的格子覆盖旧值，没写的保留。 */
export function mergeParadigm(existing, incoming) {
    const A = normalizeParadigm(existing)
    const B = normalizeParadigm(incoming)
    if (isParadigmEmpty(A)) return B
    if (isParadigmEmpty(B)) return A

    const out = {}
    for (const tkey of new Set([...Object.keys(A), ...Object.keys(B)])) {
        const ta = A[tkey] || {}
        const tb = B[tkey] || {}
        const rows = {}
        for (const rkey of new Set([...Object.keys(ta), ...Object.keys(tb)])) {
            const cells = { ...(ta[rkey] || {}), ...(tb[rkey] || {}) }
            for (const [ck, v] of Object.entries(cells)) {
                if (!String(v ?? '').trim()) delete cells[ck]
            }
            if (Object.keys(cells).length) rows[rkey] = cells
        }
        if (Object.keys(rows).length) out[tkey] = rows
    }
    return out
}

/**
 * 词条内容合并：表格按格子、词干按已有值优先、列表去重追加、备注只补空位。
 *
 * `preferIncoming`：属性字段冲突时用新值。默认保留已有值。
 * `replaceInflectionType`：新词条写了类型就覆盖已有的。默认只在原来为空时写入。
 */
export function mergeWordContent(existing, incoming, {
    preferIncoming = false,
    replaceInflectionType = false
} = {}) {
    const merged = { ...existing }

    const type = incoming.inflectionType
    const oldType = existing.inflectionType || {}
    const has = (t) => !!(t && ((t.label && t.label.trim()) || t.grammarRef))
    if (has(type) && (replaceInflectionType || !has(oldType))) merged.inflectionType = { ...type }

    merged.paradigm = mergeParadigm(existing.paradigm, incoming.paradigm)

    // 词干：已有值优先保留，为空时采用新来源的值
    merged.stems = mergeStems(existing.stems, incoming.stems)

    merged.attributes = normalizeAttributes(preferIncoming
        ? { ...(existing.attributes || {}), ...(incoming.attributes || {}) }
        : { ...(incoming.attributes || {}), ...(existing.attributes || {}) })

    for (const key of ['inflections', 'meanings', 'collocations', 'examples']) {
        merged[key] = appendUnique(existing[key], incoming[key])
    }
    for (const key of ['derivatives', 'tags']) {
        merged[key] = uniqArray([...(existing[key] || []), ...(incoming[key] || [])])
    }

    const notes = existing.notes || incoming.notes
    if (notes) merged.notes = notes

    return merged
}

/** 追加条目，按 `entryKey` 去重 */
export function appendUnique(base = [], extra = []) {
    const out = [...(base || [])]
    for (const item of extra || []) {
        if (!item) continue
        const key = entryKey(item)
        if (!out.some((x) => entryKey(x) === key)) out.push({ ...item })
    }
    return out
}

/** 条目去重用的身份：这些字段都相同就算同一条 */
export function entryKey(e) {
    return [
        e.text ?? '', e.form ?? '', e.label ?? '', e.group ?? '',
        e.translation ?? '', e.citation ?? '', e.source ?? ''
    ].join('\u0001')
}

export function uniqArray(arr) {
    const seen = new Set()
    const out = []
    for (const x of arr) {
        const s = String(x ?? '').trim()
        if (!s || seen.has(s)) continue
        seen.add(s)
        out.push(s)
    }
    return out
}
