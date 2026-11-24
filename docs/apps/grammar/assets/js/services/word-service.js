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
    pos: '',
    masteryMin: null,
    masteryMax: null,
    tags: [],
    source: ''
}

export const SEARCH_SCOPE = [
    { value: 'all',   label: '全部' },
    { value: 'forms', label: '词形' },
    { value: 'head',  label: '原形' }
]

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

function searchVariants(query) {
    const out = new Set()
    const push = (text) => {
        const nq = normalizeSearch(text)
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
    const queries = searchVariants(s)
    if (!queries.length) return words
    const matches = searchMatcher(queries, normalizeSearch)
    return words.filter((w) => matches(w, scope))
}

function normalizeExact(s) {
    return foldBreve(s).normalize('NFC').toLowerCase().replace(/\u03C2/g, '\u03C3')
}

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

function applyExactFirst(words, q, scope = 'all') {
    const s = String(q || '').trim()
    if (!s) return words
    if (normalizeExact(s) === normalizeSearch(s)) return words
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
        paradigm: fixMap(payload.paradigm || {}),
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
