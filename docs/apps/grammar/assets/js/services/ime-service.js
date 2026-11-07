/** 输入助手的数据加载：ime.js 与 script.js。 */

import { loadGrammarMeta, loadScriptProfile } from './grammar-service.js'

const cache = new Map()
const pending = new Map()

const LANGS_BASE = new URL('../../../data/language/', import.meta.url)

/** @returns {Promise<null | object>} 该语言 ime.js 的导出对象 */
export function loadIme(code) {
    if (!code) return Promise.resolve(null)
    if (cache.has(code)) return Promise.resolve(cache.get(code))
    if (pending.has(code)) return pending.get(code)

    const p = (async () => {
        const meta = await loadGrammarMeta(code)
        const path = meta?.files?.ime
        if (!path) return null

        let config = null
        try {
            const mod = await import(/* @vite-ignore */ new URL(`${encodeURIComponent(code)}/${path}`, LANGS_BASE).href)
            config = mod.default || mod
        } catch (err) {
            console.warn(`[ime] ${code}: ${path} 加载失败`, err)
            return null
        }

        const script = meta?.files?.script ? await loadScriptProfile(code, meta) : null
        const resolved = {
            code,
            name: config.name || code,
            placeholderBase: config.placeholderBase || '',
            cased: config.cased === true,
            marks: Array.isArray(config.marks) ? config.marks : [],
            /* 「还原」并到第几行；以及按符号指定样字（如希伯来语中点用 ב） */
            restoreRow: Number.isInteger(config.restoreRow) ? config.restoreRow : 0,
            samples: config.samples && typeof config.samples === 'object' ? config.samples : null,
            // 单个语言的 applies 写错（例如空基字上取 [0]）不该让整个面板渲染不出来
            applies: (base, group) => {
                if (typeof config.applies !== 'function') return true
                try {
                    return config.applies(base, group) !== false
                } catch {
                    return true
                }
            },
            keyboard: config.keyboard || null,
            translit: script && typeof script.toScript === 'function'
                ? { convert: script.toScript }
                : null,
            toScript: script && typeof script.toScript === 'function' ? script.toScript : null,
            toRoman: script && typeof script.toRoman === 'function' ? script.toRoman : null
        }
        // 没有可用能力的语言（例如只有一张空表）视为没有助手
        const usable = resolved.marks.some((g) => g.items?.length) || !!resolved.translit || !!resolved.keyboard
        if (!usable) return null
        cache.set(code, resolved)
        return resolved
    })()
        .catch((err) => {
            console.warn(`[ime] ${code}: 加载失败`, err)
            return null
        })
        .finally(() => { pending.delete(code) })

    pending.set(code, p)
    return p
}
