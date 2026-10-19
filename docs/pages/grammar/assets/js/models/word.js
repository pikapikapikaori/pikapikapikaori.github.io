/**
 * Word 模型：唯一键、去重合并、序列化
 */

import { wordId } from '../utils/id.js'
import { nowIso } from '../utils/date.js'
import { toStringArray } from '../utils/text-normalize.js'

export const POS_LIST = [
    { value: 'noun',      label: '名词' },
    { value: 'verb',      label: '动词' },
    { value: 'adj',       label: '形容词' },
    { value: 'adv',       label: '副词' },
    { value: 'pron',      label: '代词' },
    { value: 'prep',      label: '介词 / 前置词' },
    { value: 'conj',      label: '连词' },
    { value: 'particle',  label: '助词 / 虚词' },
    { value: 'participle', label: '分词' },
    { value: 'num',       label: '数词' },
    { value: 'interj',    label: '感叹词' },
    { value: 'other',     label: '其它' }
]

/** 语法性；顺序即展示顺序 */
export const GENDERS = [
    { value: 'm', label: '阳性' },
    { value: 'f', label: '阴性' },
    { value: 'n', label: '中性' }
]

export function genderLabel(gender) {
    const hit = GENDERS.find((g) => g.value === gender)
    return hit ? hit.label : gender || ''
}

/** 只有名词有语法性，其它词性一律清空 */
export function normalizeGenders(value, pos) {
    if (pos !== 'noun') return []
    const list = Array.isArray(value) ? value : (value ? [value] : [])
    const set = new Set(list.map((v) => String(v).trim()))
    return GENDERS.map((g) => g.value).filter((g) => set.has(g))
}

export function posLabel(pos) {
    const hit = POS_LIST.find((p) => p.value === pos)
    return hit ? hit.label : pos || ''
}

export function uniqueKeyOf(word) {
    return [word.userId, word.language, word.lemma, word.pos]
}

export function sameKey(a, b) {
    return a.userId === b.userId
      && a.language === b.language
      && a.lemma === b.lemma
      && a.pos === b.pos
}

/** 生成空词条 */
export function createWord(partial) {
    const t = nowIso()
    return {
        id: wordId(),
        userId: partial.userId,
        language: partial.language,
        lemma: String(partial.lemma ?? '').trim(),
        pos: partial.pos || 'other',

        inflectionType: partial.inflectionType || { label: '', grammarRef: null },
        gender: normalizeGenders(partial.gender, partial.pos || 'other'),
        paradigm: normalizeParadigm(partial.paradigm),
        stems: normalizeStems(partial.stems ?? partial.stem),

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
        entry.source = entry.source || 'manual'
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
        case 'inflections':  return { label: '', form: text, source: 'manual' }
        case 'collocations': return { text, gloss: '', source: 'manual' }
        case 'examples':     return { text, translation: '', citation: '', source: 'manual' }
        default:             return { text, source: 'manual' }
    }
}

/**
 * 规范化 paradigm
 * 结构：{ [tableKey]: { [rowKey]: { [colKey]: string } } }
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
 * 规范化主要部分（词干）
 * 词干是不变的部分，词形变化一律在其后追加词尾：la am → amō / amāre，grc λόγ → λόγος
 * 末尾的连字符只是显示约定，不写入数据
 */
export function normalizeStem(value) {
    return String(value ?? '').trim().replace(/[-\u2010-\u2015\uff0d]+$/, '').trim()
}

/** 主要部分的显示形式：统一补上末尾连字符 */
export function stemDisplay(stem) {
    const s = normalizeStem(stem)
    return s ? s + '-' : ''
}

/**
 * 规范化主要部分：{ key: 词干 }
 * 兼容两种入参：新的对象形式，以及旧的单一 stem 字符串（落到 base）
 */
export function normalizeStems(value) {
    const out = {}
    if (typeof value === 'string') {
        const s = normalizeStem(value)
        if (s) out.base = s
        return out
    }
    if (!value || typeof value !== 'object') return out
    for (const [key, raw] of Object.entries(value)) {
        const k = String(key || '').trim()
        const s = normalizeStem(raw)
        if (k && s) out[k] = s
    }
    return out
}

/** 基准主要部分（表单里的「主要部分」） */
export function primaryStem(word) {
    return normalizeStem(word?.stems?.base ?? '')
}

/** 除 base 之外的其它主要部分：[[key, 词干], ...] */
export function otherStems(word) {
    const stems = word?.stems
    if (!stems || typeof stems !== 'object') return []
    return Object.entries(stems)
        .filter(([key, value]) => key !== 'base' && normalizeStem(value))
        .map(([key, value]) => [key, normalizeStem(value)])
}

/** 合并主要部分：已有的值不被覆盖，只在缺失时填充 */
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

/** 按 source 分组 */
export function groupBySource(list) {
    const map = new Map()
    for (const item of list || []) {
        const s = item.source || 'manual'
        if (!map.has(s)) map.set(s, [])
        map.get(s).push(item)
    }
    return map
}

/** 收集词条中所有 source 标识，按 manual 优先排序 */
export function allSources(word) {
    const set = new Set()
    for (const k of ['inflections', 'meanings', 'collocations', 'examples']) {
        for (const it of word[k] || []) set.add(it.source || 'manual')
    }
    if (set.size === 0) set.add('manual')
    return Array.from(set).sort((a, b) => {
        if (a === 'manual') return -1
        if (b === 'manual') return 1
        if (a === 'wiktionary') return -1
        if (b === 'wiktionary') return 1
        return a.localeCompare(b)
    })
}

export function sourceLabel(source) {
    if (!source) return '未知'
    if (source === 'manual') return '手动'
    if (source === 'wiktionary') return 'Wiktionary'
    if (source.startsWith('url:')) return source.slice(4)
    return source
}

export function resolveDerivative(lemma, words) {
    return words.find((w) => w.lemma === lemma) || null
}
