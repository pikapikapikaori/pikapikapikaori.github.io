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

/* ---------- 语言档案（derive 的语言专属后期处理） ---------- */

/**
 * 语言档案位于 /data/paradigm/{lang}.js，导出 accentModes / accent / sandhi。
 * 没有该文件的语言（如拉丁语）返回 null，通用引擎会跳过重音与连声。
 */
const profiles = new Map()
const scriptProfiles = new Map()  // lang -> profile | null

/**
 * 语言档案（`data/paradigm/{lang}.js`）：只有该语言的 JSON 声明了 `profile: true`
 * 才去 import，其余语言直接返回 null——否则每次打开生词表单都会报一个 404。
 */
export async function loadParadigmProfile(language, doc = null) {
    if (!language) return null
    if (!doc || doc.profile !== true) return null
    if (profiles.has(language)) return profiles.get(language)

    let profile = null
    try {
        profile = await import(`../../../data/paradigm/${encodeURIComponent(language)}.js`)
    } catch {
        // 声明了档案但文件缺失 / 加载失败
        console.warn(`[grammar] ${language}: 档案加载失败`)
    }
    profiles.set(language, profile)
    return profile
}

/**
 * 「文字档案」：`data/script/<lang>.js`（转写 ⇄ 原文）。
 * 与 data/paradigm/ 完全同一套加载方式，只是由文档里的 `script: true` 声明。
 * 档案导出 `toScript` / `toRoman`（`hasScript` 可选）。
 */
export async function loadScriptProfile(language, doc = null) {
    if (!language) return null
    if (!doc || doc.script !== true) return null
    if (scriptProfiles.has(language)) return scriptProfiles.get(language)

    let profile = null
    try {
        profile = await import(`../../../data/script/${encodeURIComponent(language)}.js`)
    } catch {
        console.warn(`[grammar] ${language}: 文字档案加载失败`)
    }
    scriptProfiles.set(language, profile)
    return profile
}

/** 同步取已预加载的文字档案（检索等同步场景用） */
export function getScriptProfile(language) {
    return scriptProfiles.get(language) || null
}

/** 应用启动时预加载（检索要在同步流程里用到转换函数） */
export async function preloadScriptProfiles(languages = []) {
    await Promise.all(languages.map(async (language) => {
        if (scriptProfiles.has(language)) return
        let profile = null
        try {
            profile = await import(`../../../data/script/${encodeURIComponent(language)}.js`)
        } catch {
            console.warn(`[grammar] ${language}: 文字档案加载失败`)
        }
        scriptProfiles.set(language, profile)
    }))
}

export function clearScriptProfileCache(language) {
    if (language) scriptProfiles.delete(language)
    else scriptProfiles.clear()
}

export function clearProfileCache(language) {
    if (language) profiles.delete(language)
    else profiles.clear()
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
    getFieldDefs,
    termsOf,
    fillTerms,
    getDeclensionField,
    fieldDefsOfTemplate,
    fieldValues,
    genderOfColumn,
    genderOfRow,
    collectInflectAnchors,
    indexParadigmTables,
    indexParadigmRows
} from '../models/grammar.js'
