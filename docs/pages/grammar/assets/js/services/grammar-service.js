/**
 * 语法数据加载（只读）。
 * 数据位于 /data/language/{lang}/：meta.json（元信息 + 章节索引）、grammar/paradigms.json、
 * grammar/{chapter}.json（一章一个文件，文件名 = 章节 id）。
 */

import { GRAMMAR_FILES } from '../config/config.js'
import { isGrammarDoc, grammarFlags, validateGrammarDoc } from '../models/grammar.js'
import { verifyGrammarDoc } from '../models/paradigm-generate.js'

const LANG_BASE = new URL('../../../data/language/', import.meta.url)

const cache = new Map()       // lang -> 组合后的整份 doc
const pending = new Map()     // lang -> Promise
const metaCache = new Map()   // lang -> meta.json
const metaPending = new Map()
const chapterCache = new Map()  // `${lang}/${id}` -> sections
const chapterPending = new Map()

function langUrl(language, relative) {
    return new URL(`${encodeURIComponent(language)}/${relative}`, LANG_BASE)
}

async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}

/** 元信息（启动时 languages.js 已经拉过一次，这里命中同一份 JSON） */
export function loadGrammarMeta(language) {
    if (!language) return Promise.resolve(null)
    if (metaCache.has(language)) return Promise.resolve(metaCache.get(language))
    if (metaPending.has(language)) return metaPending.get(language)

    const p = fetchJSON(langUrl(language, 'meta.json'))
        .then((meta) => {
            if (meta) metaCache.set(language, meta)
            return meta
        })
        .catch((err) => {
            console.warn(`[grammar] ${language}: meta.json 读取失败：${err.message}`)
            return null
        })
        .finally(() => { metaPending.delete(language) })

    metaPending.set(language, p)
    return p
}

/** 一章的 sections */
export function loadChapter(language, chapterId) {
    if (!language || !chapterId) return Promise.resolve([])
    const key = `${language}/${chapterId}`
    if (chapterCache.has(key)) return Promise.resolve(chapterCache.get(key))
    if (chapterPending.has(key)) return chapterPending.get(key)

    const p = fetchJSON(langUrl(language, `grammar/${encodeURIComponent(chapterId)}.json`))
        .then((list) => {
            const sections = Array.isArray(list) ? list : []
            chapterCache.set(key, sections)
            return sections
        })
        .catch((err) => {
            console.warn(`[grammar] ${language}/${chapterId}: 章节读取失败：${err.message}`)
            return []
        })
        .finally(() => { chapterPending.delete(key) })

    chapterPending.set(key, p)
    return p
}

/** 把 meta + paradigms + 若干章组装成运行时统一使用的 doc 形状 */
function assemble(meta, paradigms, chapterSections) {
    const doc = {}
    for (const [key, value] of Object.entries(meta)) {
        if (key === 'files' || key === 'grammarFiles') continue
        doc[key] = value
    }
    const chapters = Array.isArray(meta.grammarFiles?.chapters) ? meta.grammarFiles.chapters : []
    const flags = grammarFlags(meta)
    doc.groups = chapters.map(({ id, title }) => ({ id, title }))
    doc.paradigms = paradigms || {}
    doc.sections = chapterSections.flatMap(({ id, sections }) =>
        sections.map((section) => ({ ...section, group: id })))
    // 派生值：数据里不存这两个布尔，视图与校验照旧读 doc.grammar / doc.paradigm
    doc.grammar = flags.grammar
    doc.paradigm = flags.paradigm
    return doc
}

/** 把一次校验结果打给 console：errors 用 error，warnings 用 warn */
function logReport(scope, code, { errors, warnings }) {
    for (const e of errors) console.error(`[${scope}] ${code}: ${e}`)
    for (const w of warnings) console.warn(`[${scope}] ${code}: ${w}`)
}

/**
 * 组合整份语法文档（元信息 + 全部章节 + paradigms）。
 * 词表单 / 词列表需要跨章的锚点，语法页请改用 loadGrammarForChapter()。
 */
export async function loadGrammar(language) {
    if (!language) return null
    if (cache.has(language)) return cache.get(language)
    if (pending.has(language)) return pending.get(language)

    const p = (async () => {
        const meta = await loadGrammarMeta(language)
        if (!meta) return null
        if (!grammarFlags(meta).grammar) return null

        const chapters = meta.grammarFiles.chapters
        const paradigmPath = meta.grammarFiles.paradigms
        const [paradigms, ...sectionLists] = await Promise.all([
            paradigmPath === false ? null : fetchJSON(langUrl(language, paradigmPath)).catch(() => null),
            ...chapters.map((chapter) => loadChapter(language, chapter.id))
        ])

        const doc = assemble(meta,
            paradigms,
            chapters.map((chapter, i) => ({ id: chapter.id, sections: sectionLists[i] || [] })))

        // 有结构错误就不加载（视图会退化成「无语法数据」），错误逐条打出来
        const report = validateGrammarDoc(language, doc)
        logReport('grammar', language, report)
        if (report.errors.length) return null
        if (!isGrammarDoc(doc)) return null
        cache.set(language, doc)
        return doc
    })()
        .catch((err) => {
            console.warn(`[grammar] ${language}: ${err.message}`)
            return null
        })
        .finally(() => { pending.delete(language) })

    pending.set(language, p)
    return p
}

/**
 * 只要一章的文档（语法页用）：`groups` 仍是完整章节列表，`sections` 只含本章。
 * chapterId 为空时退回整份文档。
 */
export async function loadGrammarForChapter(language, chapterId) {
    const meta = await loadGrammarMeta(language)
    if (!meta || !grammarFlags(meta).grammar) return null
    const chapters = meta.grammarFiles.chapters
    if (!chapterId || chapters.length <= 1) return loadGrammar(language)

    const [paradigms, sections] = await Promise.all([
        fetchJSON(langUrl(language, meta.grammarFiles.paradigms)).catch(() => null),
        loadChapter(language, chapterId)
    ])
    const doc = assemble(meta, paradigms, [{ id: chapterId, sections }])

    const report = validateGrammarDoc(language, doc)
    logReport('grammar', language, report)
    return report.errors.length ? null : doc
}

/* ---------- 语言档案（derive 的语言专属后期处理） ---------- */

const profiles = new Map()
const scriptProfiles = new Map()  // lang -> profile | null

/**
 * 语言档案（meta.files.paradigm，导出 accentModes / accent / sandhi）：meta 里没写这一项就直接返回 null，
 * 其余语言不去 import——否则每次打开生词表单都会报一个 404。
 */
export async function loadParadigmProfile(language, meta = null) {
    if (!language) return null
    if (!meta || !meta.files || !meta.files.paradigm) return null
    if (profiles.has(language)) return profiles.get(language)

    let profile = null
    try {
        profile = await import(/* @vite-ignore */ langUrl(language, meta.files.paradigm).href)
    } catch {
        // 声明了档案但文件缺失 / 加载失败
        console.warn(`[grammar] ${language}: 档案加载失败`)
    }
    profiles.set(language, profile)
    return profile
}

/**
 * 「文字档案」（meta.files.script，转写 ⇄ 原文）：加载方式同语言档案。
 * 导出 `toScript` / `toRoman`（`hasScript` 可选）。
 */
export async function loadScriptProfile(language, meta = null) {
    if (!language) return null
    if (!meta || !meta.files || !meta.files.script) return null
    if (scriptProfiles.has(language)) return scriptProfiles.get(language)

    let profile = null
    try {
        profile = await import(/* @vite-ignore */ langUrl(language, meta.files.script).href)
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
        const meta = await loadGrammarMeta(language)
        await loadScriptProfile(language, meta)
        if (!scriptProfiles.has(language)) scriptProfiles.set(language, null)
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
    if (language) {
        cache.delete(language)
        metaCache.delete(language)
        for (const key of chapterCache.keys()) {
            if (key.startsWith(`${language}/`)) chapterCache.delete(key)
        }
        return
    }
    cache.clear()
    metaCache.clear()
    chapterCache.clear()
}

/**
 * 逐个语言跑「结构校验 + derive 自检」，供设置页的「校验语法 JSON」按钮用。
 *
 * 与 `loadGrammar()` 的区别：这里直接抓 JSON，不走缓存、也不因为有 error 就中止，
 * 坏文件同样要能报出来。每个语言之间让出一帧，避免 sa / grc 的 derive 试算（约 100ms）
 * 把界面卡住。
 *
 * @returns {Promise<Array<{
 *   code, name,
 *   structure: { errors: string[], warnings: string[] },
 *   derive: { specs, checked, errors, warnings, skipped? }
 * }>>}
 */
export async function verifyGrammarFiles({ onProgress = null, codes = GRAMMAR_FILES } = {}) {
    const list = [...codes]
    const out = []

    for (let i = 0; i < list.length; i++) {
        const code = list[i]
        if (typeof onProgress === 'function') onProgress(i, list.length, code)

        const item = {
            code,
            name: '',
            structure: { errors: [], warnings: [] },
            derive: { specs: 0, checked: 0, errors: [], warnings: [] }
        }

        try {
            // 不走缓存：坏文件也要报出来
            const meta = await fetchJSON(langUrl(code, 'meta.json'))
            if (!meta) throw new Error('HTTP 404')
            item.name = typeof meta?.name === 'string' ? meta.name : ''

            const files = meta.grammarFiles || {}
            const chapters = Array.isArray(files.chapters) ? files.chapters : []
            const [paradigms, ...sectionLists] = await Promise.all([
                files.paradigms === false
                    ? null
                    : fetchJSON(langUrl(code, files.paradigms))
                        .catch((err) => {
                            item.structure.errors.push(`paradigms 读取失败：${err.message}`)
                            return null
                        }),
                ...chapters.map((chapter) => fetchJSON(langUrl(code, chapter.file))
                    .catch((err) => {
                        item.structure.errors.push(`${chapter.file} 读取失败：${err.message}`)
                        return null
                    }))
            ])

            const doc = assemble(meta, paradigms,
                chapters.map((chapter, i) => ({ id: chapter.id, sections: sectionLists[i] || [] })))
            const structure = validateGrammarDoc(code, doc)
            item.structure.errors.push(...structure.errors)
            item.structure.warnings.push(...structure.warnings)

            // 目录里没有登记进 chapters 的章节文件 = 漏登记
            for (const [i, list] of sectionLists.entries()) {
                if (list === null) continue
                if (!Array.isArray(list)) item.structure.errors.push(`${chapters[i].file} 不是数组`)
            }
            if (Array.isArray(files.chapters) && files.chapters.length === 0) {
                item.structure.warnings.push('`grammarFiles.chapters` 写成了空数组；没有语法页请写 false')
            }
            if (files.paradigms !== false && typeof files.paradigms !== 'string') {
                item.structure.errors.push('`grammarFiles.paradigms` 必须是路径字符串或 false')
            }

            let profile = null
            if (meta.files?.paradigm) {
                profile = await import(/* @vite-ignore */ langUrl(code, meta.files.paradigm).href).catch(() => null)
            }
            let script = null
            if (meta.files?.script) {
                script = await import(/* @vite-ignore */ langUrl(code, meta.files.script).href).catch(() => null)
                if (!script) item.structure.errors.push(`文字档案 ${meta.files.script} 加载失败`)
            }
            try {
                // 自检按「最终存储的写法」比对 expect，所以要把文字档案一并传进去
                const r = verifyGrammarDoc(code, doc, profile, script)
                item.derive = {
                    specs: r.specs,
                    checked: r.checked,
                    errors: r.errors,
                    warnings: r.warnings
                }
                if (meta.files?.paradigm && !profile) {
                    item.derive.warnings.push(`声明了 ${meta.files.paradigm}，但语言档案加载失败`)
                }
            } catch (err) {
                item.derive.errors.push(`derive 自检抛错：${err.message}`)
            }
        } catch (err) {
            item.structure.errors.push(`读取失败：${err.message}`)
        }

        out.push(item)
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
    return out
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
    fieldDefsOfTemplate,
    fieldValues,
    genderOfColumn,
    genderOfRow,
    collectInflectAnchors,
    stemLabelOf
} from '../models/grammar.js'
