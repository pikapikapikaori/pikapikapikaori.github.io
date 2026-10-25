import { STORE_SETTINGS, put, get, remove } from './db.js'
import { LANGUAGES } from '../data/languages.js'
import { DEFAULT_SETTINGS } from '../config/config.js'

export function normalizeSettings(raw) {
    const s = { ...DEFAULT_SETTINGS, ...(raw || {}) }

    // languageOrder 校验：数组、去重、过滤非法 code
    const valid = new Set(LANGUAGES.map((l) => l.code))
    const arr = Array.isArray(s.languageOrder) ? s.languageOrder : []
    const seen = new Set()
    s.languageOrder = arr
        .map((c) => String(c || '').trim())
        .filter((c) => valid.has(c) && !seen.has(c) && seen.add(c))

    // groupOrder：过滤非法值，缺的组按默认顺序补到末尾
    const VALID_GROUPS = ['classical', 'modern']
    const ga = Array.isArray(s.groupOrder) ? s.groupOrder : []
    const gseen = new Set()
    s.groupOrder = ga
        .map((k) => String(k || '').trim())
        .filter((k) => VALID_GROUPS.includes(k) && !gseen.has(k) && gseen.add(k))
    for (const k of VALID_GROUPS) {
        if (!gseen.has(k)) {
            s.groupOrder.push(k)
            gseen.add(k)
        }
    }

    return s
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
