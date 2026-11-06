/** 搜索用的规范化：忽略大小写与附加符号；唯一键与查重仍严格比较。 */

export function normalizeSearch(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/ς/g, 'σ')
}

/** 同 normalizeSearch，并返回「规范化位置 → 原始位置」的映射 @returns {{ norm: string, map: number[] }} */
export function normalizeSearchWithMap(s) {
    const src = String(s ?? '')
    let norm = ''
    const map = []
    for (let i = 0; i < src.length; i++) {
        const ch = src[i]
        const stripped = ch.normalize('NFD').replace(/\p{M}/gu, '')
        const lower = stripped.toLowerCase()
        for (let j = 0; j < lower.length; j++) {
            map.push(i)
        }
        norm += lower
    }
    if (norm.includes('ς')) {
        norm = norm.replace(/ς/g, 'σ')
    }
    return { norm, map }
}

/** 返回原文中的匹配区间 [[start, end], ...] */
export function matchRangesNorm(text, query) {
    const t = String(text ?? '')
    const q = String(query ?? '')
    if (!q) return []
    const { norm, map } = normalizeSearchWithMap(t)
    const nq = normalizeSearch(q)
    if (!nq) return []

    const out = []
    let i = 0
    while (i <= norm.length - nq.length) {
        const idx = norm.indexOf(nq, i)
        if (idx === -1) break
        const origStart = map[idx]
        const origEnd = map[idx + nq.length - 1] + 1
        out.push([origStart, origEnd])
        i = idx + Math.max(1, nq.length)
    }
    return out
}

export function highlight(text, query) {
    const t = String(text ?? '')
    const spans = matchRangesNorm(t, query)
    const frag = document.createDocumentFragment()
    if (spans.length === 0) {
        frag.appendChild(document.createTextNode(t))
        return frag
    }
    let cursor = 0
    for (const [s, e] of spans) {
        if (s > cursor) frag.appendChild(document.createTextNode(t.slice(cursor, s)))
        const mark = document.createElement('mark')
        mark.className = 'search-hit__match'
        mark.textContent = t.slice(s, e)
        frag.appendChild(mark)
        cursor = e
    }
    if (cursor < t.length) frag.appendChild(document.createTextNode(t.slice(cursor)))
    return frag
}

export function toStringArray(v) {
    if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean)
    if (v == null) return []
    const s = String(v).trim()
    return s ? [s] : []
}
