/** 笔记：一份用户 + 语言对应一条记录，行序即数组顺序。 */

import { STORE_NOTES, get, put, getAllByIndex, removeByIndex } from './db.js'
import { nowIso } from '../utils/date.js'

export function noteKey(userId, language) {
    return `${userId}:${language}`
}

export async function getNote(userId, language) {
    if (!userId || !language) return null
    return get(STORE_NOTES, noteKey(userId, language))
}

export async function saveNote(userId, language, lines) {
    if (!userId || !language) return null
    const id = noteKey(userId, language)
    const prev = await get(STORE_NOTES, id)
    const row = {
        id,
        userId,
        language,
        lines: Array.isArray(lines) ? lines.map((line) => String(line ?? '')) : [],
        createdAt: (prev && prev.createdAt) || nowIso(),
        updatedAt: nowIso()
    }
    await put(STORE_NOTES, row)
    return row
}

export async function listNotes(userId) {
    if (!userId) return []
    return (await getAllByIndex(STORE_NOTES, 'userId', userId)) || []
}

export async function deleteNotes(userId) {
    if (!userId) return 0
    return removeByIndex(STORE_NOTES, 'userId', userId)
}
