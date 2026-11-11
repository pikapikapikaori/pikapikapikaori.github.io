/** 搜索用的规范化：忽略大小写与附加符号；查重时仍严格比较。 */

export function normalizeSearch(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/ς/g, 'σ')
}

export function toStringArray(v) {
    if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean)
    if (v == null) return []
    const s = String(v).trim()
    return s ? [s] : []
}
