import { GRAMMAR_FILES } from '../config/config.js'
import { validateGrammarDoc } from '../models/grammar.js'

/**
 * 语言元数据：真源是 `data/grammar/<code>.json` 顶层，这里只负责把它们全拉一遍并缓存
 * （语言选择页需要所有语言的元信息；正文在各语言打开时复用已下载的内容）。
 */

/** 加载完成前为空数组；`main.js` 启动时先 await loadLanguages() */
export let LANGUAGES = []

/** code → 元信息（加载后填充，供按 code 取对象的旧写法使用） */
export const LANGUAGE_MAP = {}

let loading = null

function metaOf(code, doc) {
    const group = doc.group && typeof doc.group === 'object' ? doc.group : {}
    return {
        code,
        name: doc.name || code,
        native: doc.native || doc.name || code,
        classical: doc.classical === true,
        group: {
            id: group.id || (doc.classical === true ? 'classical' : 'modern'),
            title: group.title || '',
            order: Number.isFinite(group.order) ? group.order : 99,
        },
        order: Number.isFinite(doc.order) ? doc.order : 99,
        vertical: doc.vertical === true,
        rtl: doc.rtl === true,
        grammar: doc.grammar !== false,
        paradigm: doc.paradigm !== false,
        terms: doc.terms && typeof doc.terms === 'object' ? doc.terms : {},
        pos: Array.isArray(doc.pos) ? doc.pos : null,
    }
}

/** 拉取所有语言的元信息（只执行一次，失败的语言会被跳过） */
export function loadLanguages() {
    if (loading) return loading
    loading = (async () => {
        const base = new URL('../../../data/grammar/', import.meta.url)
        const list = await Promise.all(GRAMMAR_FILES.map(async (code) => {
            try {
                const res = await fetch(new URL(`${code}.json`, base))
                if (!res.ok) throw new Error(String(res.status))
                const doc = await res.json()
                const report = validateGrammarDoc(code, doc)
                for (const e of report.errors) console.error(`[languages] ${code}: ${e}`)
                for (const w of report.warnings) console.warn(`[languages] ${code}: ${w}`)
                if (report.errors.length) return null
                return metaOf(code, doc)
            } catch (err) {
                console.warn(`[languages] 读取 ${code}.json 失败：`, err)
                return null
            }
        }))
        LANGUAGES = list.filter(Boolean).sort((a, b) => {
            if (a.group.order !== b.group.order) return a.group.order - b.group.order
            if (a.order !== b.order) return a.order - b.order
            return a.code.localeCompare(b.code)
        })
        for (const key of Object.keys(LANGUAGE_MAP)) delete LANGUAGE_MAP[key]
        for (const l of LANGUAGES) LANGUAGE_MAP[l.code] = l
        return LANGUAGES
    })()
    return loading
}

export function getLanguage(code) {
    return LANGUAGES.find((l) => l.code === code) || null
}

/** 分组标题（按 group.order 排序） */
export function languageGroups() {
    const map = new Map()
    for (const l of LANGUAGES) {
        if (!map.has(l.group.id)) map.set(l.group.id, { id: l.group.id, title: l.group.title, order: l.group.order })
    }
    return [...map.values()].sort((a, b) => a.order - b.order)
}
