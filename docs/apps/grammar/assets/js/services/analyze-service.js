
import { ANALYZE_SOURCES, EXTERNAL_BASE } from '../config/config.js'

function sourcesFor(langCode) {
    return ANALYZE_SOURCES.filter((s) => !s.langs || s.langs.includes(langCode))
}

export function hasAnalyzer(langCode) {
    return sourcesFor(langCode).length > 0
}

export async function loadAnalyzers(langCode) {
    const loaded = await Promise.all(sourcesFor(langCode).map(async (src) => {
        try {
            const mod = await import(new URL(`${src.file}.js`, EXTERNAL_BASE))
            if (typeof mod.analyzeWord !== 'function') {
                return null
            }
            return { ...src, analyzeWord: mod.analyzeWord }
        } catch (err) {
            return null
        }
    }))
    return loaded.filter(Boolean)
}

export async function analyze({ word, langCode, sources = [] }) {
    const settled = await Promise.all(sources.map(async (source) => {
        try {
            const res = await source.analyzeWord({ word, langCode })
            return { source, entries: res?.entries || [] }
        } catch (err) {
            return { source, error: err }
        }
    }))

    const entries = []
    const errors = []
    for (const item of settled) {
        if (item.error) {
            errors.push({ source: item.source, error: item.error })
            continue
        }
        for (const entry of item.entries) {
            entries.push({
                ...entry,
                sourceId: item.source.id,
                sourceLabel: item.source.label
            })
        }
    }
    return { entries, errors }
}
