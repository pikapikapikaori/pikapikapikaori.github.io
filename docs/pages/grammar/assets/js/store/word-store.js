import {
    STORE_WORDS,
    put, get, remove, getAllByIndex, getOneByIndex, removeByIndex
} from './db.js'
import {
    createWord, normalizeParadigm, normalizeStems, normalizeGenders, isParadigmEmpty, mergeStems
} from '../models/word.js'
import { nowIso, nextReviewFrom, clampMastery } from '../utils/date.js'

export async function listByLanguage(userId, language) {
    const all = await getAllByIndex(STORE_WORDS, 'userId_language', [userId, language])
    return all || []
}

export async function listAll(userId) {
    return (await getAllByIndex(STORE_WORDS, 'userId', userId)) || []
}

export async function getWord(id) {
    if (!id) return null
    return get(STORE_WORDS, id)
}

export async function findByKey(userId, language, lemma, pos) {
    return getOneByIndex(
        STORE_WORDS, 'uniq_user_lang_lemma_pos',
        [userId, language, lemma, pos]
    )
}

export async function addOrMerge(userId, payload) {
    const language = payload.language
    const lemma = String(payload.lemma ?? '').trim()
    const pos = payload.pos || 'other'

    const existing = await findByKey(userId, language, lemma, pos)

    if (!existing) {
        const word = createWord({
            ...payload,
            userId, language, lemma, pos,
            encounterCount: 1
        })
        await put(STORE_WORDS, word)
        return { word, created: true }
    }

    const merged = mergeWord(existing, payload)
    await put(STORE_WORDS, merged)
    return { word: merged, created: false }
}

function mergeWord(existing, incoming) {
    const merged = { ...existing }

    if (incoming.inflectionType) {
        const inc = incoming.inflectionType
        const hasInc = (inc.label && inc.label.trim()) || inc.grammarRef
        if (hasInc) merged.inflectionType = { ...inc }
    }

    merged.paradigm = mergeParadigm(existing.paradigm, incoming.paradigm)

    // 主要部分（词干）：已有值优先保留，为空时采用新来源的值
    merged.stems = mergeStems(existing.stems, incoming.stems)

    // 语法性：并集
    merged.gender = normalizeGenders(
        [...(existing.gender || []), ...(incoming.gender || [])], merged.pos)

    merged.inflections = appendUnique(existing.inflections, incoming.inflections)
    merged.meanings    = appendUnique(existing.meanings, incoming.meanings)
    merged.collocations= appendUnique(existing.collocations, incoming.collocations)
    merged.examples    = appendUnique(existing.examples, incoming.examples)

    merged.derivatives = uniqArray([...(existing.derivatives || []), ...(incoming.derivatives || [])])
    merged.tags        = uniqArray([...(existing.tags || []), ...(incoming.tags || [])])

    if (incoming.notes && !existing.notes) merged.notes = incoming.notes

    merged.encounterCount = (existing.encounterCount || 0) + 1
    merged.updatedAt = nowIso()
    return merged
}

/** 表格合并：格子级别，非空值优先保留 incoming */
export function mergeParadigm(a, b) {
    const A = normalizeParadigm(a)
    const B = normalizeParadigm(b)
    if (isParadigmEmpty(A)) return B
    if (isParadigmEmpty(B)) return A

    const out = {}
    const tableKeys = new Set([...Object.keys(A), ...Object.keys(B)])
    for (const tkey of tableKeys) {
        const ta = A[tkey] || {}
        const tb = B[tkey] || {}
        const rows = {}
        const rowKeys = new Set([...Object.keys(ta), ...Object.keys(tb)])
        for (const rkey of rowKeys) {
            const ca = ta[rkey] || {}
            const cb = tb[rkey] || {}
            const merged = { ...ca }
            for (const [ck, v] of Object.entries(cb)) {
                const s = String(v ?? '').trim()
                if (s) merged[ck] = s
            }
            if (Object.keys(merged).length) rows[rkey] = merged
        }
        if (Object.keys(rows).length) out[tkey] = rows
    }
    return out
}

function appendUnique(base = [], extra = []) {
    const out = [...base]
    for (const item of extra || []) {
        if (!item) continue
        const dup = out.some((x) => entryEquals(x, item))
        if (!dup) out.push({ ...item })
    }
    return out
}

function entryEquals(a, b) {
    if (!a || !b) return false
    return entryKey(a) === entryKey(b)
}

function entryKey(e) {
    return [
        e.text ?? '',
        e.form ?? '',
        e.label ?? '',
        e.group ?? '',
        e.translation ?? '',
        e.citation ?? '',
        e.source ?? ''
    ].join('\u0001')
}

function uniqArray(arr) {
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

export async function saveWord(word) {
    const next = { ...word, updatedAt: nowIso() }
    await put(STORE_WORDS, next)
    return next
}

export async function updateWord(id, patch) {
    const cur = await getWord(id)
    if (!cur) return null
    const next = { ...cur, ...patch, updatedAt: nowIso() }
    next.id = cur.id
    next.userId = cur.userId
    if (patch.paradigm !== undefined) {
        next.paradigm = normalizeParadigm(patch.paradigm)
    }
    await put(STORE_WORDS, next)
    return next
}

export async function deleteWord(id) {
    if (!id) return
    await remove(STORE_WORDS, id)
}

export async function deleteAllInLanguage(userId, language) {
    await removeByIndex(STORE_WORDS, 'userId_language', [userId, language])
}

export async function deleteAllOfUser(userId) {
    await removeByIndex(STORE_WORDS, 'userId', userId)
}

export async function recordReview(id, { correct }) {
    const cur = await getWord(id)
    if (!cur) return null
    const delta = correct ? 1 : -1
    const mastery = clampMastery((cur.mastery || 0) + delta)
    const t = nowIso()
    const next = {
        ...cur,
        mastery,
        correctCount: (cur.correctCount || 0) + (correct ? 1 : 0),
        wrongCount: (cur.wrongCount || 0) + (correct ? 0 : 1),
        lastReviewedAt: t,
        nextReviewAt: nextReviewFrom(mastery, t),
        updatedAt: t
    }
    await put(STORE_WORDS, next)
    return next
}

export async function bulkImport(words) {
    for (const w of words) {
        await put(STORE_WORDS, w)
    }
    return words.length
}
