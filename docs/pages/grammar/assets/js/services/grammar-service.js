/**
 * 语法数据加载（只读）
 * 数据位于 /data/grammar/{lang}.json
 */

import { isGrammarDoc, indexGrammar, collectIds } from '../models/grammar.js'

const cache = new Map()     // lang -> doc
const pending = new Map()   // lang -> Promise

export async function loadGrammar(language) {
    if (!language) return null
    if (cache.has(language)) return cache.get(language)
    if (pending.has(language)) return pending.get(language)

    const url = `./data/grammar/${encodeURIComponent(language)}.json`

    const p = fetch(url, { cache: 'no-cache' })
        .then(async (res) => {
            if (res.status === 404) return null
            if (!res.ok) throw new Error(`加载语法失败：${res.status} ${res.statusText}`)
            const json = await res.json()
            if (!isGrammarDoc(json)) {
                throw new Error(`语法文件格式不正确：${language}`)
            }
            cache.set(language, json)
            return json
        })
        .catch((err) => {
            console.warn(`[grammar] ${language}: ${err.message}`)
            return null
        })
        .finally(() => {
            pending.delete(language)
        })

    pending.set(language, p)
    return p
}

export async function hasGrammar(language) {
    const doc = await loadGrammar(language)
    return !!doc
}

export async function getIndex(language) {
    const doc = await loadGrammar(language)
    return indexGrammar(doc)
}

export async function getIds(language) {
    const doc = await loadGrammar(language)
    return collectIds(doc)
}

/**
 * 校验并规范化 grammarRef：
 *   - 语法文件不存在 → 原样返回，由 UI 处理为普通文本
 *   - 语法文件存在但 id 不存在 → 返回 null
 */
export async function resolveRef(language, ref) {
    if (!ref) return { ok: false, ref: null, reason: 'empty' }
    const doc = await loadGrammar(language)
    if (!doc) return { ok: false, ref, reason: 'no-grammar' }
    const ids = collectIds(doc)
    if (!ids.has(ref)) return { ok: false, ref, reason: 'not-found' }
    return { ok: true, ref, reason: 'ok' }
}

export function clearCache(language) {
    if (language) cache.delete(language)
    else cache.clear()
}

/** 批量预加载 */
export async function preload(languages) {
    await Promise.all(languages.map((l) => loadGrammar(l)))
}

/* ---------- 从 models/grammar.js re-export，方便视图层统一从 service 引入 ---------- */
export {
    getParadigmTemplate,
    getDeriveSpec,
    getDeriveParts,
    getGenderOptions,
    genderOfColumn,
    collectInflectAnchors,
    indexParadigmTables,
    indexParadigmRows
} from '../models/grammar.js'
