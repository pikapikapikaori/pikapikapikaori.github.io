/**
 * 文本工具
 *
 * 注意：本项目检索与查重要求 **区分大小写、变音符号、长短音**，
 * 因此这里不做任何归一化，仅提供高亮与截断等辅助函数。
 */

/** 返回 query 在 text 中出现的所有起止位置（区分大小写） */
export function matchIndices(text, query) {
    const t = String(text ?? '')
    const q = String(query ?? '')
    if (!q) return []
    const out = []
    let i = 0
    while (i <= t.length - q.length) {
        const idx = t.indexOf(q, i)
        if (idx === -1) break
        out.push([idx, idx + q.length])
        i = idx + Math.max(1, q.length)
    }
    return out
}

/** 生成带 <mark> 的高亮片段（返回 DocumentFragment，安全） */
export function highlight(text, query) {
    const t = String(text ?? '')
    const spans = matchIndices(t, query)
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
    const idx = t.indexOf(q)
    if (idx === -1) return t.length > radius * 2 ? t.slice(0, radius * 2) + '…' : t
    const start = Math.max(0, idx - radius)
    const end = Math.min(t.length, idx + q.length + radius)
    return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '')
}

/** 判断语言是否 RTL */
export const RTL_LANGS = new Set(['he', 'ar', 'fa'])

export function isRtl(lang) {
    return RTL_LANGS.has(lang)
}

/** 归一化语言 code（如 ja-classical 保留原样） */
export function normalizeLangCode(code) {
    return String(code || '').trim().toLowerCase()
}

/** 安全地把数组变成非空字符串数组 */
export function toStringArray(v) {
    if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean)
    if (v == null) return []
    const s = String(v).trim()
    return s ? [s] : []
}
