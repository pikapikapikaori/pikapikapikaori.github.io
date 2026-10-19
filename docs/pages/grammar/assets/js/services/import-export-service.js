import {
    buildExportPayload, validateExportPayload,
    CURRENT_VERSION, EXPORT_KIND
} from '../models/user.js'
import {
    listAll, findByKey, saveWord, bulkImport
} from '../store/word-store.js'
import { createUser, saveUser } from '../store/user-store.js'
import { put as dbPut, STORE_SETTINGS, STORE_USERS } from '../store/db.js'
import { normalizeSettings } from '../store/settings-store.js'
import { normalizeParadigm, normalizeStem, normalizeGenders } from '../models/word.js'
import { wordId } from '../utils/id.js'
import { nowIso } from '../utils/date.js'

/* ---------------- 导出 ---------------- */

export async function exportUser(user, settings, words) {
    const payload = buildExportPayload({
        user: { ...user },
        settings: normalizeSettings(settings),
        words: words.map(cleanWordForExport)
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
        gender: normalizeGenders(w.gender, w.pos),
        stem: normalizeStem(w.stem),
        inflections: w.inflections || [],
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

/* ---------------- 导入 ---------------- */

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

    const migrated = migrate(payload)
    const { user, settings, words } = migrated

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

    const stats = { created: 0, merged: 0, skipped: 0, total: words.length }

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
        gender: normalizeGenders(raw.gender, pos),
        stem: normalizeStem(raw.stem),
        inflections: raw.inflections || [],
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

function mergePreservingProgress(existing, incoming) {
    const merged = { ...existing }

    merged.paradigm = mergeParadigmLocal(existing.paradigm, incoming.paradigm)

    merged.stem = normalizeStem(existing.stem) || normalizeStem(incoming.stem)
    merged.gender = normalizeGenders(
        [...(existing.gender || []), ...(incoming.gender || [])], merged.pos)

    merged.inflections = appendUnique(existing.inflections, incoming.inflections)
    merged.meanings    = appendUnique(existing.meanings, incoming.meanings)
    merged.collocations= appendUnique(existing.collocations, incoming.collocations)
    merged.examples    = appendUnique(existing.examples, incoming.examples)

    merged.derivatives = uniqArray([...(existing.derivatives || []), ...(incoming.derivatives || [])])
    merged.tags        = uniqArray([...(existing.tags || []), ...(incoming.tags || [])])

    const ei = existing.inflectionType || {}
    const ii = incoming.inflectionType || {}
    if (!(ei.label || ei.grammarRef) && (ii.label || ii.grammarRef)) {
        merged.inflectionType = { ...ii }
    }

    merged.encounterCount = (existing.encounterCount || 0) + (incoming.encounterCount || 0)

    merged.mastery        = existing.mastery || 0
    merged.correctCount   = existing.correctCount || 0
    merged.wrongCount     = existing.wrongCount || 0
    merged.lastReviewedAt = existing.lastReviewedAt || null
    merged.nextReviewAt   = existing.nextReviewAt || null

    merged.notes = existing.notes || incoming.notes || ''
    merged.updatedAt = nowIso()
    return merged
}

function mergeParadigmLocal(a, b) {
    const A = normalizeParadigm(a)
    const B = normalizeParadigm(b)
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
    const out = [...(base || [])]
    for (const item of extra || []) {
        if (!item) continue
        const key = entryKey(item)
        if (!out.some((x) => entryKey(x) === key)) out.push({ ...item })
    }
    return out
}
function entryKey(e) {
    return [
        e.text ?? '', e.form ?? '', e.label ?? '', e.group ?? '',
        e.translation ?? '', e.citation ?? '', e.source ?? ''
    ].join('\u0001')
}
function uniqArray(arr) {
    const seen = new Set(); const out = []
    for (const x of arr) {
        const s = String(x ?? '').trim()
        if (!s || seen.has(s)) continue
        seen.add(s); out.push(s)
    }
    return out
}

/* ---------------- 迁移 ---------------- */

const MIGRATIONS = {}

function migrate(payload) {
    let cur = payload
    while (cur.version < CURRENT_VERSION) {
        const from = cur.version
        const fn = MIGRATIONS[from]
        if (typeof fn !== 'function') {
            throw new Error(`缺少从 v${from} 到 v${from + 1} 的迁移函数`)
        }
        cur = fn(cur)
        if (!cur || typeof cur !== 'object') {
            throw new Error(`迁移 v${from} → v${from + 1} 返回了非法结果`)
        }
        cur.version = from + 1
    }
    return cur
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
