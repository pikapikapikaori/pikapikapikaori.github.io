import { loadGrammarMeta, loadScriptProfile } from './grammar-service.js'

const cache = new Map()
const pending = new Map()

const LANGS_BASE = new URL('../../../data/language/', import.meta.url)

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
        } catch {
            return null
        }

        const script = meta?.files?.script ? await loadScriptProfile(code, meta) : null
        const resolved = {
            code,
            name: config.name || code,
            placeholderBase: config.placeholderBase || '',
            cased: config.cased === true,
            marks: Array.isArray(config.marks) ? config.marks : [],
            restoreRow: Number.isInteger(config.restoreRow) ? config.restoreRow : 0,
            samples: config.samples && typeof config.samples === 'object' ? config.samples : null,
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
        const usable = resolved.marks.some((g) => g.items?.length) || !!resolved.translit || !!resolved.keyboard
        if (!usable) return null
        cache.set(code, resolved)
        return resolved
    })()
        .catch(() => {
            return null
        })
        .finally(() => { pending.delete(code) })

    pending.set(code, p)
    return p
}
