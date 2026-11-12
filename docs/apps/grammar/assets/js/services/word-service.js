/** 生词业务逻辑：列表、筛选、排序、分页、统计 */

import {
    listByLanguage, addOrMerge, updateWord, getWord
} from '../store/word-store.js'
import { allSources } from '../models/word.js'
import { normalizeSearch } from '../utils/text-normalize.js'
import { foldBreve } from '../utils/breve.js'
import { getScriptProfile, loadGrammarMeta, loadParadigmProfile } from './grammar-service.js'
import { SCRIPT_SEARCH_LANGS } from '../config/config.js'

export const SORT_FIELDS = [
    { value: 'addedAt',        label: '添加日期' },
    { value: 'encounterCount', label: '记录次数' },
    { value: 'mastery',        label: '掌握度' },
    { value: 'lemma',          label: '字母序' },
    { value: 'updatedAt',      label: '修改日期' }
]

export const FILTER_EMPTY = {
    pos: '',           // '' 表示全部
    masteryMin: null,
    masteryMax: null,
    tags: [],
    source: ''         // '' 表示全部
}

/** 搜索范围：all = 词形 + 含义、例句、固定搭配；forms = 词形；head = 基本形态 + 词干 */
export const SEARCH_SCOPE = [
    { value: 'all',   label: '全部' },
    { value: 'forms', label: '词形' },
    { value: 'head',  label: '原形' }
]

/** 主入口：查询当前语言的词条，带筛选、排序、分页 */
export async function queryWords(userId, language, options = {}) {
    const {
        q = '',
        scope = 'all',
        filter = FILTER_EMPTY,
        sortField = 'addedAt',
        sortOrder = 'desc',
        page = 1,
        pageSize = 30
    } = options

    let all = await listByLanguage(userId, language)
    all = applySearch(all, q, scope)
    all = applyFilter(all, filter)
    all = applySort(all, sortField, sortOrder)
    // 有查询且带附加符号时，「写法完全一致」的排前面
    all = applyExactFirst(all, q, scope)

    const total = all.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const cur = Math.min(Math.max(1, page), totalPages)
    const start = (cur - 1) * pageSize
    const items = all.slice(start, start + pageSize)

    return {
        items,
        total,
        page: cur,
        pageSize,
        totalPages,
        allIds: all.map((w) => w.id)
    }
}

/**
 * 查询串的规范化变体：天城体语言（梵语）同时按 IAST 与原文检索，所以「kāmaḥ」与「कामः」都能搜到同一条
 */
function searchVariants(query) {
    const out = new Set()
    const push = (text) => {
        const nq = normalizeSearch(text)
        if (nq) out.add(nq)
    }
    push(query)
    // 有文字档案的语言（梵语）：转写与原文两种写法都能搜到
    for (const lang of SCRIPT_SEARCH_LANGS) {
        const profile = getScriptProfile(lang)
        if (!profile) continue
        if (typeof profile.toScript === 'function') push(profile.toScript(query))
        if (typeof profile.toRoman === 'function') push(profile.toRoman(query))
    }
    return [...out]
}

/**
 * 判定器：给一组（已规范化的）查询串，返回按范围判断词条是否命中的函数。
 * 折叠检索与「写法完全一致」的检索共用这里的字段覆盖范围。
 */
function searchMatcher(queries, normalize) {
    const anyHit = (text) => {
        const norm = normalize(text)
        return !!norm && queries.some((nq) => norm.includes(nq))
    }

    const hitLemma = (w) => anyHit(w.lemma)
    const hitStem = (w) => Object.values(w.stems || {})
        .some((stem) => !!stem && anyHit(stem))
    const hitGrid = (grid) => Object.values(grid || {}).some((rows) =>
        Object.values(rows || {}).some((cells) =>
            Object.values(cells || {}).some((v) => anyHit(v))))
    const hitParadigm = (w) => hitGrid(w.paradigm)
    const hitInflection = (w) => (w.inflections || []).some((it) =>
        anyHit(it.form || ''))

    const hitWordForm = (w) => hitLemma(w) || hitStem(w) || hitParadigm(w) || hitInflection(w)
    const hitHead = (w) => hitLemma(w) || hitStem(w)

    const hitMeaning = (w) => (w.meanings || []).some((m) => anyHit(m.text || ''))
    const hitExample = (w) => (w.examples || []).some((ex) =>
        anyHit(ex.text || '') || anyHit(ex.translation || ''))
    const hitCollocation = (w) => (w.collocations || []).some((c) =>
        anyHit(c.text || '') || anyHit(c.gloss || ''))

    return (w, scope) => {
        switch (scope) {
            case 'head':  return hitHead(w)
            case 'forms': return hitWordForm(w)
            case 'all':
            default:
                return hitWordForm(w) || hitMeaning(w)
            || hitExample(w) || hitCollocation(w)
        }
    }
}

function applySearch(words, q, scope = 'all') {
    const s = String(q || '').trim()
    if (!s) return words
    // 原文、转写两种写法都能搜到：查询串同时展开成 IAST 与天城体
    const queries = searchVariants(s)
    if (!queries.length) return words
    const matches = searchMatcher(queries, normalizeSearch)
    return words.filter((w) => matches(w, scope))
}

/**
 * 「写法完全一致」用的规范化：保留附加符号（长音符、重音…），只忽略短音符 ——
 * 短音符是保存时自动补的，不该影响精度判定。另外统一大小写与词尾 ς。
 */
function normalizeExact(s) {
    return foldBreve(s).normalize('NFC').toLowerCase().replace(/\u03C2/g, '\u03C3')
}

/** 与 searchVariants 相同，但保留附加符号（用于「写法完全一致」优先） */
function exactVariants(query) {
    const out = new Set()
    const push = (text) => {
        const nq = normalizeExact(text)
        if (nq) out.add(nq)
    }
    push(query)
    for (const lang of SCRIPT_SEARCH_LANGS) {
        const profile = getScriptProfile(lang)
        if (!profile) continue
        if (typeof profile.toScript === 'function') push(profile.toScript(query))
        if (typeof profile.toRoman === 'function') push(profile.toRoman(query))
    }
    return [...out]
}

/**
 * 查询串里带了附加符号时，把「写法完全一致」的词条提到前面（层内保持原有排序）。
 * 折叠后才命中的排在后面 —— 搜 mālum 时 mālum 先于 malum。
 */
function applyExactFirst(words, q, scope = 'all') {
    const s = String(q || '').trim()
    if (!s) return words
    if (normalizeExact(s) === normalizeSearch(s)) return words   // 查询串没有附加符号，不用分层
    const queries = exactVariants(s)
    if (!queries.length) return words
    const matches = searchMatcher(queries, normalizeExact)
    const first = []
    const rest = []
    for (const w of words) (matches(w, scope) ? first : rest).push(w)
    if (!first.length || !rest.length) return words
    return first.concat(rest)
}

function applyFilter(words, f) {
    if (!f) return words
    return words.filter((w) => {
        if (f.pos && w.pos !== f.pos) return false
        if (f.masteryMin != null && (w.mastery ?? 0) < f.masteryMin) return false
        if (f.masteryMax != null && (w.mastery ?? 0) > f.masteryMax) return false
        if (f.source) {
            const sources = allSources(w)
            if (!sources.includes(f.source)) return false
        }
        if (f.tags && f.tags.length) {
            const wt = new Set(w.tags || [])
            for (const t of f.tags) if (!wt.has(t)) return false
        }
        return true
    })
}

export function applySort(words, field, order) {
    const dir = order === 'asc' ? 1 : -1
    const arr = [...words]
    const cmp = (a, b) => {
        switch (field) {
            case 'encounterCount':
                return ((a.encounterCount || 0) - (b.encounterCount || 0)) * dir
            case 'mastery':
                return ((a.mastery || 0) - (b.mastery || 0)) * dir
            case 'lemma':
                return a.lemma.localeCompare(b.lemma, undefined, { sensitivity: 'variant' }) * dir
            case 'updatedAt':
                return String(a.updatedAt).localeCompare(String(b.updatedAt)) * dir
            case 'addedAt':
            default:
                return String(a.addedAt).localeCompare(String(b.addedAt)) * dir
        }
    }
    arr.sort(cmp)
    return arr
}

/**
 * 保存前的规范化：原文类字段交给语言自己的 `canonicalize`（`data/language/<code>/paradigm.js`）。
 * 目前只有拉丁语、古希腊语有（单元音默认补短音符），其它语言原样返回。
 */
async function canonicalizePayload(language, payload) {
    if (!payload) return payload
    const meta = await loadGrammarMeta(language)
    const profile = await loadParadigmProfile(language, meta)
    const fn = typeof profile?.canonicalize === 'function' ? profile.canonicalize : null
    if (!fn) return payload

    const fix = (value) => (typeof value === 'string' && value ? fn(value) : value)
    const fixMap = (obj) => {
        if (!obj || typeof obj !== 'object') return obj
        const out = {}
        for (const [key, value] of Object.entries(obj)) {
            out[key] = typeof value === 'string' ? fix(value) : fixMap(value)
        }
        return out
    }
    const fixList = (list, key) => (Array.isArray(list)
        ? list.map((item) => (item && typeof item === 'object' ? { ...item, [key]: fix(item[key]) } : item))
        : list)

    return {
        ...payload,
        lemma: fix(payload.lemma),
        stems: fixMap(payload.stems || {}),
        // 变格、变位表：{ 表: { 行: { 列: '词形' } } }
        paradigm: fixMap(payload.paradigm || {}),
        // 补充形式不带来源
        inflections: fixList(payload.inflections, 'form').map(({ source, ...rest }) => rest),
        collocations: fixList(payload.collocations, 'text'),
        examples: fixList(payload.examples, 'text'),
        derivatives: Array.isArray(payload.derivatives) ? payload.derivatives.map(fix) : payload.derivatives
    }
}

export async function submitWord(userId, language, payload) {
    if (!payload || !payload.lemma || !String(payload.lemma).trim()) {
        throw new Error('基本形态不能为空')
    }
    const normalized = await canonicalizePayload(language, payload)
    const result = await addOrMerge(userId, { ...normalized, language })
    return result
}

export async function editWord(id, patch) {
    const existing = await getWord(id)
    const normalized = existing
        ? await canonicalizePayload(existing.language, patch)
        : patch
    return updateWord(id, normalized)
}

export async function fetchWord(id) {
    return getWord(id)
}

/** 聚合所有语言统计（用于语言列表页） */
export async function languageStats(userId, language) {
    const all = await listByLanguage(userId, language)
    const total = all.length
    const encounters = all.reduce((s, w) => s + (w.encounterCount || 0), 0)
    const mastered = all.filter((w) => (w.mastery || 0) >= 4).length
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const todayAdded = all.filter((w) => String(w.addedAt || '').startsWith(todayStr)).length
    const needReview = all.filter((w) => !w.nextReviewAt || String(w.nextReviewAt) <= new Date().toISOString()).length

    return {
        total,
        encounters,
        mastered,
        todayAdded,
        needReview,
        lastAdded: total
            ? all.reduce((a, b) => (String(a.addedAt) > String(b.addedAt) ? a : b))
            : null
    }
}
