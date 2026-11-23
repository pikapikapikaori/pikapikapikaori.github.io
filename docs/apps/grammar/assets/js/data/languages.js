import { GRAMMAR_FILES } from '../config/config.js'
import { grammarFlags } from '../models/grammar.js'


export let LANGUAGES = []

export const LANGUAGE_MAP = {}

let loading = null

function metaOf(code, doc) {
    const group = doc.group && typeof doc.group === 'object' ? doc.group : {}
    const flags = grammarFlags(doc)
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
        grammar: flags.grammar,
        paradigm: flags.paradigm,
        terms: doc.terms && typeof doc.terms === 'object' ? doc.terms : {},
        pos: Array.isArray(doc.pos) ? doc.pos : null,
    }
}

export function loadLanguages() {
    if (loading) return loading
    loading = (async () => {
        const base = new URL('../../../data/language/', import.meta.url)
        const list = await Promise.all(GRAMMAR_FILES.map(async (code) => {
            try {
                const res = await fetch(new URL(`${code}/meta.json`, base))
                if (!res.ok) throw new Error(String(res.status))
                const meta = await res.json()
                const errors = checkMeta(code, meta)
                if (errors.length) return null
                return metaOf(code, meta)
            } catch (err) {
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

function checkMeta(code, meta) {
    const errors = []
    if (!meta || typeof meta !== 'object') return ['meta.json 不是对象']
    if (!Number.isInteger(meta.version)) errors.push('`version` 必须是整数')
    if (meta.language !== code) errors.push(`\`language\` 是 "${meta.language}"，与目录名 "${code}" 不一致`)
    if (typeof meta.name !== 'string' || !meta.name) errors.push('缺少 `name`')
    if (!meta.grammarFiles || typeof meta.grammarFiles !== 'object') {
        errors.push('缺少 `grammarFiles`')
    } else {
        const { chapters, paradigms } = meta.grammarFiles
        if (chapters !== false && !(Array.isArray(chapters) && chapters.length > 0)) {
            errors.push('`grammarFiles.chapters` 必须是非空数组或 false')
        }
        if (paradigms !== false && (typeof paradigms !== 'string' || !paradigms)) {
            errors.push('`grammarFiles.paradigms` 必须是路径字符串或 false')
        }
    }
    return errors
}

export function getLanguage(code) {
    return LANGUAGES.find((l) => l.code === code) || null
}
