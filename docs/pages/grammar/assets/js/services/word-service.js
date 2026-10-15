/**
 * 生词业务逻辑：列表、筛选、排序、分页、统计
 */

import {
    listByLanguage, addOrMerge, updateWord, deleteWord,
    deleteAllInLanguage, recordReview, getWord
} from '../store/word-store.js'
import { posLabel, allSources } from '../models/word.js'
import { normalizeSearch } from '../utils/text-normalize.js'

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

/** 主入口：查询当前语言的词条，带筛选、排序、分页 */
export async function queryWords(userId, language, options = {}) {
    const {
        q = '',
        filter = FILTER_EMPTY,
        sortField = 'addedAt',
        sortOrder = 'desc',
        page = 1,
        pageSize = 30
    } = options

    let all = await listByLanguage(userId, language)
    all = applySearch(all, q)
    all = applyFilter(all, filter)
    all = applySort(all, sortField, sortOrder)

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

function applySearch(words, q) {
    const s = String(q || '').trim()
    if (!s) return words
    const nq = normalizeSearch(s)
    if (!nq) return words
    const hit = (w) => {
        if (normalizeSearch(w.lemma).includes(nq)) return true
        if ((w.meanings || []).some((m) => normalizeSearch(m.text || '').includes(nq))) return true
        return false
    }
    return words.filter(hit)
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

/** 添加或合并 */
export async function submitWord(userId, language, payload) {
    if (!payload || !payload.lemma || !String(payload.lemma).trim()) {
        throw new Error('基本形态不能为空')
    }
    const result = await addOrMerge(userId, { ...payload, language })
    return result
}

export async function editWord(id, patch) {
    return updateWord(id, patch)
}

export async function removeWord(id) {
    return deleteWord(id)
}

export async function clearLanguage(userId, language) {
    return deleteAllInLanguage(userId, language)
}

export async function submitReview(id, correct) {
    return recordReview(id, { correct })
}

export async function fetchWord(id) {
    return getWord(id)
}

/** 语言统计 */
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

/** 聚合所有语言统计（用于语言选择页） */
export async function allLanguageStats(userId, languages, byLang) {
    const out = {}
    for (const lang of languages) {
        if (byLang && byLang[lang.code]) {
            out[lang.code] = byLang[lang.code]
            continue
        }
        out[lang.code] = await languageStats(userId, lang.code)
    }
    return out
}

export { posLabel }
