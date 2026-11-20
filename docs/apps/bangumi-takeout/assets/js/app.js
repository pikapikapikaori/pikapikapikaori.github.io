import { items, meta, replaceUser } from './storage.js'
import { normalizeExport, toViewItems } from './model.js'
import { CURRENT_USER_KEY, INFO_SCOPE, VIEW_CLEARED_KEY } from './config.js'

export const state = {
    data: null,
}

export async function loadUser(username) {
    const record = await meta.get(username)
    if (!record) return null
    const records = await items.getByOwner(username)
    return {
        user: record.user,
        generatedAt: record.generated_at || 0,
        items: toViewItems(records),
    }
}

export async function tryCache() {
    if (localStorage.getItem(VIEW_CLEARED_KEY)) return null
    const saved = localStorage.getItem(CURRENT_USER_KEY)
    if (saved) {
        const hit = await loadUser(saved)
        if (hit) {
            state.data = hit
            return hit
        }
    }
    const all = await meta.list()
    if (!all.length) return null
    all.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    const hit = await loadUser(all[0].username)
    if (!hit) return null
    state.data = hit
    selectUser(all[0].username)
    return hit
}

export function selectUser(username) {
    localStorage.setItem(CURRENT_USER_KEY, username)
    localStorage.removeItem(VIEW_CLEARED_KEY)
}

export function clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY)
    localStorage.setItem(VIEW_CLEARED_KEY, '1')
    state.data = null
}

// An import replaces the user's stored data as a whole, including its task state.
export async function importExport(raw) {
    const { user, generatedAt, records, report } = normalizeExport(raw)
    const now = Date.now()

    await replaceUser(user.username, {
        username: user.username,
        user,
        generated_at: generatedAt,
        updated_at: now,
        completeness: { total: records.length, done: records.length },
        task: null,
    }, records, { infoScope: INFO_SCOPE.PRIVATE })

    selectUser(user.username)
    state.data = { user, generatedAt, items: toViewItems(records), report }
    return state.data
}
