import {
    STORE_WORDS,
    put, get, remove, getAllByIndex, getOneByIndex, removeByIndex
} from './db.js'
import { createWord, mergeWordContent, normalizeParadigm } from '../models/word.js'
import { nowIso, nextReviewFrom, clampMastery } from '../utils/date.js'
import { foldBreve } from '../utils/breve.js'

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

    let existing = await findByKey(userId, language, lemma, pos)
    if (!existing) {
        // 短音符不参与唯一性：i 与 ĭ 视为同一个词（长音符仍然区分）
        const folded = foldBreve(lemma)
        const siblings = await listByLanguage(userId, language)
        existing = siblings.find((w) => w.pos === pos && foldBreve(w.lemma) === folded) || null
    }

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
    const merged = mergeWordContent(existing, incoming, { replaceInflectionType: true })
    merged.encounterCount = (existing.encounterCount || 0) + 1
    merged.updatedAt = nowIso()
    return merged
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
