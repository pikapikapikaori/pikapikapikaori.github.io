import { STORE_SETTINGS, put, get, remove } from './db.js'
import { LANGUAGES } from '../data/languages.js'

export const DEFAULT_SETTINGS = {
    theme: 'auto',            // auto | light | dark
    fontMode: 'default',      // default | system | local
    fontFamily: null,         // local 模式下的字体名
    fontUrl: null,            // local 模式下的 objectURL（不持久化跨会话，仅本次会话有效）
    pageSize: 30,             // 20 - 50
    reviewOrder: 'mastery-asc', // mastery-asc | added-desc | random
    defaultSource: 'manual',  // manual | wiktionary | ...
    sortField: 'addedAt',     // addedAt | encounterCount | mastery | lemma
    sortOrder: 'desc',        // asc | desc
    languageOrder: [],        // 用户自定义的语言排列顺序
    groupOrder: ['classical', 'modern']
}

export function normalizeSettings(raw) {
    const s = { ...DEFAULT_SETTINGS, ...(raw || {}) }

    // languageOrder 校验：数组、去重、过滤非法 code
    const valid = new Set(LANGUAGES.map((l) => l.code))
    const arr = Array.isArray(s.languageOrder) ? s.languageOrder : []
    const seen = new Set()
    s.languageOrder = arr
        .map((c) => String(c || '').trim())
        .filter((c) => valid.has(c) && !seen.has(c) && seen.add(c))

    // groupOrder 校验
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
