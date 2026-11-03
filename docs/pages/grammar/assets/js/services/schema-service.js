/** 数据格式文档：目录在 /data/schema/manifest.json，每篇一个 JSON；另提供复制与下载。 */

let cache = null
let pending = null

/**
 * 读取全部篇目（体量很小，一次读完，切换篇目不闪）。
 * @returns {Promise<{ title: string, docs: Array<{ id, title, lead, order, updatedAt, markdown }> }>}
 */
export function loadSchema() {
    if (cache) return Promise.resolve(cache)
    if (pending) return pending

    pending = (async () => {
        const res = await fetch('./data/schema/manifest.json', { cache: 'no-cache' })
        if (!res.ok) throw new Error(`加载目录失败：${res.status} ${res.statusText}`)
        const manifest = await res.json()
        const entries = Array.isArray(manifest?.docs) ? manifest.docs : []

        const docs = await Promise.all(entries.map(async (entry) => {
            const file = entry.file || `${entry.id}.json`
            const r = await fetch(`./data/schema/${encodeURIComponent(file)}`, { cache: 'no-cache' })
            if (!r.ok) throw new Error(`加载 ${entry.id} 失败：${r.status} ${r.statusText}`)
            const doc = await r.json()
            return {
                id: doc.id || entry.id,
                title: doc.title || entry.title || entry.id,
                lead: typeof doc.lead === 'string' ? doc.lead : '',
                updatedAt: doc.updatedAt || '',
                order: Number.isFinite(doc.order) ? doc.order : (Number.isFinite(entry.order) ? entry.order : 99),
                markdown: String(doc.markdown || '')
            }
        }))
        docs.sort((a, b) => a.order - b.order)

        cache = { title: manifest?.title || '数据格式', docs }
        return cache
    })().finally(() => { pending = null })

    return pending
}

/** 写入剪贴板；不支持 Clipboard API 时退回到临时 textarea */
export async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch { /* 落到兼容路径 */ }
    }

    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    ta.remove()
    if (!ok) throw new Error('当前浏览器不允许写入剪贴板')
    return true
}

export function downloadMarkdown(filename, text) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return filename
}
