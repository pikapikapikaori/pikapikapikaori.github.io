import { STORE_SETTINGS, put, get, remove } from './db.js'

export const DEFAULT_SETTINGS = {
    theme: 'auto',            // auto | light | dark
    fontMode: 'default',      // default | system | local
    fontFamily: null,         // local 模式下的字体名
    fontUrl: null,            // local 模式下的 objectURL（不持久化跨会话，仅本次会话有效）
    pageSize: 30,             // 20 - 50
    reviewOrder: 'mastery-asc', // mastery-asc | added-desc | random
    defaultSource: 'manual',  // manual | wiktionary | ...
    sortField: 'addedAt',     // addedAt | encounterCount | mastery | lemma
    sortOrder: 'desc'         // asc | desc
}

export function normalizeSettings(raw) {
    return { ...DEFAULT_SETTINGS, ...(raw || {}) }
}

export async function getSettings(userId) {
    if (!userId) return { ...DEFAULT_SETTINGS }
    const row = await get(STORE_SETTINGS, userId)
    if (!row) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(row)
}

export async function saveSettings(userId, patch) {
    if (!userId) return { ...DEFAULT_SETTINGS }
    const cur = await getSettings(userId)
    const next = normalizeSettings({ ...cur, ...patch })
    await put(STORE_SETTINGS, { userId, ...next })
    return next
}

export async function resetSettings(userId) {
    if (!userId) return
    await remove(STORE_SETTINGS, userId)
}
