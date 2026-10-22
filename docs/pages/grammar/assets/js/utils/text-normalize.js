/**
 * 文本工具
 *
 * 检索使用「大小写 + 变音符号 / 气符不敏感」的规范化：
 *   NFD 分解 → 去除组合标记 → 小写 → 词尾 sigma 归并
 * 唯一键、查重仍然严格区分大小写与变音符号，不受本文件影响。
 */

/* ---------------- 规范化 ---------------- */

/** 搜索规范化 */
export function normalizeSearch(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/ς/g, 'σ')
}

/**
 * 规范化并保留「规范化位置 → 原始位置」的映射
 * @returns {{ norm: string, map: number[] }}
 */
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

/* ---------------- 匹配 ---------------- */

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

/** 保留旧名，返回 [[start, end], ...]（已改为规范化匹配） */
export function matchIndices(text, query) {
    return matchRangesNorm(text, query)
}

/** 生成带 <mark> 的高亮片段（DocumentFragment） */
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

/** 截取一段包含 query 的上下文片段 */
export function snippet(text, query, radius = 40) {
    const t = String(text ?? '')
    const q = String(query ?? '')
    if (!q) return t.length > radius * 2 ? t.slice(0, radius * 2) + '…' : t

    const spans = matchRangesNorm(t, q)
    if (spans.length === 0) {
        return t.length > radius * 2 ? t.slice(0, radius * 2) + '…' : t
    }
    const [s, e] = spans[0]
    const start = Math.max(0, s - radius)
    const end = Math.min(t.length, e + radius)
    return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '')
}

/* ---------------- 语言辅助 ---------------- */

export function normalizeLangCode(code) {
    return String(code || '').trim().toLowerCase()
}

export function toStringArray(v) {
    if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean)
    if (v == null) return []
    const s = String(v).trim()
    return s ? [s] : []
}
