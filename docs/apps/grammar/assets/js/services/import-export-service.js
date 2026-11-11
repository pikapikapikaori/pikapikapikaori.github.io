import {
    buildExportPayload, validateExportPayload,
    CURRENT_VERSION, EXPORT_KIND
} from '../models/user.js'
import {
    findByKey, saveWord
} from '../store/word-store.js'
import { createUser, saveUser } from '../store/user-store.js'
import { put as dbPut, STORE_SETTINGS } from '../store/db.js'
import { normalizeSettings } from '../store/settings-store.js'
import { normalizeParadigm, normalizeStems, normalizeAttributes, mergeWordContent } from '../models/word.js'
import { wordId } from '../utils/id.js'
import { nowIso } from '../utils/date.js'
import { saveNote } from '../store/note-store.js'

export async function exportUser(user, settings, words, notes) {
    const payload = buildExportPayload({
        user: { ...user },
        settings: normalizeSettings(settings),
        words: words.map(cleanWordForExport),
        notes: (Array.isArray(notes) ? notes : []).map(cleanNoteForExport)
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const filename = buildFilename(user.name)
    triggerDownload(url, filename)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return filename
}

function cleanWordForExport(w) {
    return {
        id: w.id,
        userId: w.userId,
        language: w.language,
        lemma: w.lemma,
        pos: w.pos,
        inflectionType: w.inflectionType || { label: '', grammarRef: null },
        paradigm: normalizeParadigm(w.paradigm),
        attributes: normalizeAttributes(w.attributes),
        stems: normalizeStems(w.stems),
        inflections: normalizeInflections(w.inflections),
        meanings: w.meanings || [],
        collocations: w.collocations || [],
        examples: w.examples || [],
        derivatives: w.derivatives || [],
        encounterCount: w.encounterCount || 0,
        mastery: w.mastery || 0,
        correctCount: w.correctCount || 0,
        wrongCount: w.wrongCount || 0,
        lastReviewedAt: w.lastReviewedAt || null,
        nextReviewAt: w.nextReviewAt || null,
        tags: w.tags || [],
        notes: w.notes || '',
        addedAt: w.addedAt,
        updatedAt: w.updatedAt
    }
}

function cleanNoteForExport(row) {
    return {
        language: row.language,
        lines: Array.isArray(row.lines) ? row.lines.map((line) => String(line ?? '')) : []
    }
}

function buildFilename(name) {
    const safe = String(name || 'user').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40)
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
    return `${safe}-${stamp}.json`
}

function triggerDownload(url, filename) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
}

export async function importUser(source, options = {}) {
    const { mode = 'new', targetUserId = null } = options

    const text = await readSourceAsText(source)
    let payload
    try {
        payload = JSON.parse(text)
    } catch (err) {
        throw new Error(`JSON 解析失败：${err.message}`)
    }

    const check = validateExportPayload(payload)
    if (!check.ok) {
        throw new Error(`文件校验失败：\n${check.errors.join('\n')}`)
    }

    const { user, settings, words } = payload

    let finalUser
    if (mode === 'replace' && targetUserId) {
        finalUser = {
            id: targetUserId,
            name: user.name || '未命名用户',
            createdAt: user.createdAt || nowIso(),
            updatedAt: nowIso()
        }
    } else {
        finalUser = await createUser(user.name || '导入用户')
        if (user.createdAt) finalUser.createdAt = user.createdAt
        await saveUser(finalUser)
    }

    const stats = { created: 0, merged: 0, skipped: 0, total: words.length, notes: 0 }

    for (const raw of words) {
        const w = normalizeImportedWord(raw, finalUser.id)
        if (!w) { stats.skipped += 1; continue }

        const existing = await findByKey(finalUser.id, w.language, w.lemma, w.pos)
        if (!existing) {
            await saveWord({ ...w, id: wordId() })
            stats.created += 1
        } else {
            const merged = mergePreservingProgress(existing, w)
            await saveWord(merged)
            stats.merged += 1
        }
    }

    const st = normalizeSettings({ ...settings })
    await dbPut(STORE_SETTINGS, { userId: finalUser.id, ...st })

    for (const raw of Array.isArray(payload.notes) ? payload.notes : []) {
        const language = String((raw && raw.language) || '').trim()
        if (!language || !Array.isArray(raw.lines)) continue
        await saveNote(finalUser.id, language, raw.lines)
        stats.notes += 1
    }

    return { user: finalUser, stats }
}

function normalizeImportedWord(raw, userId) {
    if (!raw || typeof raw !== 'object') return null
    const language = String(raw.language || '').trim()
    const lemma = String(raw.lemma || '').trim()
    const pos = String(raw.pos || '').trim()
    if (!language || !lemma || !pos) return null

    return {
        ...raw,
        userId,
        language,
        lemma,
        pos,
        inflectionType: raw.inflectionType || { label: '', grammarRef: null },
        paradigm: normalizeParadigm(raw.paradigm),
        attributes: normalizeAttributes(raw.attributes),
        stems: normalizeStems(raw.stems),
        inflections: normalizeInflections(raw.inflections),
        meanings: raw.meanings || [],
        collocations: raw.collocations || [],
        examples: raw.examples || [],
        derivatives: raw.derivatives || [],
        encounterCount: Number.isFinite(raw.encounterCount) ? raw.encounterCount : 1,
        mastery: Number.isFinite(raw.mastery) ? raw.mastery : 0,
        correctCount: Number.isFinite(raw.correctCount) ? raw.correctCount : 0,
        wrongCount: Number.isFinite(raw.wrongCount) ? raw.wrongCount : 0,
        tags: raw.tags || [],
        notes: raw.notes || '',
        addedAt: raw.addedAt || nowIso(),
        updatedAt: raw.updatedAt || nowIso()
    }
}

/** 补充形式属于词条本身，不区分来源；旧文件里的 source 直接丢掉 */
function normalizeInflections(list) {
    if (!Array.isArray(list)) return []
    return list.map(({ source, ...rest }) => rest)
}

function mergePreservingProgress(existing, incoming) {
    const merged = mergeWordContent(existing, incoming, { preferIncoming: true })

    merged.encounterCount = (existing.encounterCount || 0) + (incoming.encounterCount || 0)

    merged.mastery        = existing.mastery || 0
    merged.correctCount   = existing.correctCount || 0
    merged.wrongCount     = existing.wrongCount || 0
    merged.lastReviewedAt = existing.lastReviewedAt || null
    merged.nextReviewAt   = existing.nextReviewAt || null
    merged.notes          = existing.notes || incoming.notes || ''

    merged.updatedAt = nowIso()
    return merged
}

export async function createEmptyUser(name) {
    const user = await createUser(name)
    const settings = normalizeSettings({})
    await dbPut(STORE_SETTINGS, { userId: user.id, ...settings })
    return { user, settings }
}

async function readSourceAsText(source) {
    if (typeof source === 'string') return source
    if (source instanceof Blob) return source.text()
    throw new Error('不支持的导入源')
}

export { EXPORT_KIND, CURRENT_VERSION }
