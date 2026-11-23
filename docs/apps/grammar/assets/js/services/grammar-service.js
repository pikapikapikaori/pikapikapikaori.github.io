
import { GRAMMAR_FILES } from '../config/config.js'
import { isGrammarDoc, grammarFlags, validateGrammarDoc } from '../models/grammar.js'
import { verifyGrammarDoc } from '../models/paradigm-generate.js'

const LANG_BASE = new URL('../../../data/language/', import.meta.url)

const cache = new Map()
const pending = new Map()
const metaCache = new Map()
const metaPending = new Map()
const chapterCache = new Map()
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
            return null
        })
        .finally(() => { metaPending.delete(language) })

    metaPending.set(language, p)
    return p
}

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
            return []
        })
        .finally(() => { chapterPending.delete(key) })

    chapterPending.set(key, p)
    return p
}

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
    doc.grammar = flags.grammar
    doc.paradigm = flags.paradigm
    return doc
}

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

        const report = validateGrammarDoc(language, doc)
        if (report.errors.length) return null
        if (!isGrammarDoc(doc)) return null
        cache.set(language, doc)
        return doc
    })()
        .catch((err) => {
            return null
        })
        .finally(() => { pending.delete(language) })

    pending.set(language, p)
    return p
}

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
    return report.errors.length ? null : doc
}

const profiles = new Map()
const scriptProfiles = new Map()

export async function loadParadigmProfile(language, meta = null) {
    if (!language) return null
    if (!meta || !meta.files || !meta.files.paradigm) return null
    if (profiles.has(language)) return profiles.get(language)

    let profile = null
    try {
        profile = await import(/* @vite-ignore */ langUrl(language, meta.files.paradigm).href)
    } catch {
    }
    profiles.set(language, profile)
    return profile
}

export async function loadScriptProfile(language, meta = null) {
    if (!language) return null
    if (!meta || !meta.files || !meta.files.script) return null
    if (scriptProfiles.has(language)) return scriptProfiles.get(language)

    let profile = null
    try {
        profile = await import(/* @vite-ignore */ langUrl(language, meta.files.script).href)
    } catch {
    }
    scriptProfiles.set(language, profile)
    return profile
}

export function getScriptProfile(language) {
    return scriptProfiles.get(language) || null
}

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
                if (!profile) item.structure.errors.push(`语言档案 ${meta.files.paradigm} 加载失败`)
            }
            let script = null
            if (meta.files?.script) {
                script = await import(/* @vite-ignore */ langUrl(code, meta.files.script).href).catch(() => null)
                if (!script) item.structure.errors.push(`文字档案 ${meta.files.script} 加载失败`)
            }
            try {
                const r = verifyGrammarDoc(code, doc, profile, script)
                item.derive = {
                    specs: r.specs,
                    checked: r.checked,
                    errors: r.errors,
                    warnings: r.warnings
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

export {
    getParadigmTemplate,
    getDeriveSpec,
    getDeriveParts,
    getFieldDefs,
    termsOf,
    fillTerms,
    fieldDefsOfTemplate,
    hiddenGenderCells,
    collectInflectAnchors,
    stemLabelOf
} from '../models/grammar.js'
