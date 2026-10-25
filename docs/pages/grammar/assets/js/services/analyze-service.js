/**
 * 形态分析服务：按语言筛源、按需加载源、并发查询并归并结果（组件只负责画）。
 * 分析源清单在 `config.js` 的 `ANALYZE_SOURCES`，一个 API 一个 `external/js/{file}.js`，加源不必改这里。
 */

import { ANALYZE_SOURCES, EXTERNAL_BASE } from '../config/config.js'

/** 该语言可用的分析源（`langs` 缺省表示支持所有语言） */
function sourcesFor(langCode) {
    return ANALYZE_SOURCES.filter((s) => !s.langs || s.langs.includes(langCode))
}

/** 该语言有没有分析源 —— 生词列表页据此决定是否显示「分析」入口 */
export function hasAnalyzer(langCode) {
    return sourcesFor(langCode).length > 0
}

/**
 * 按清单动态 import；缺文件 / 断网 / 没有导出 `analyzeWord` 的源直接跳过（与生词表单加载外部源同样的容错）
 */
export async function loadAnalyzers(langCode) {
    const loaded = await Promise.all(sourcesFor(langCode).map(async (src) => {
        try {
            const mod = await import(new URL(`${src.file}.js`, EXTERNAL_BASE))
            if (typeof mod.analyzeWord !== 'function') {
                console.warn(`[analyze] ${src.id} 没有导出 analyzeWord`)
                return null
            }
            return { ...src, analyzeWord: mod.analyzeWord }
        } catch (err) {
            console.warn(`[analyze] ${src.id} 加载失败`, err)
            return null
        }
    }))
    return loaded.filter(Boolean)
}

/**
 * 并发查全部源。查询失败的源不产出条目，只进 `errors`；每条 entry 都盖上 `sourceId` / `sourceLabel`。
 * @param {{ word: string, langCode: string, sources: object[] }} opts  sources 即 `loadAnalyzers()` 的返回值
 * @returns {Promise<{ entries: object[], errors: { source, error }[] }>}
 */
export async function analyze({ word, langCode, sources = [] }) {
    const settled = await Promise.all(sources.map(async (source) => {
        try {
            const res = await source.analyzeWord({ word, langCode })
            return { source, entries: res?.entries || [] }
        } catch (err) {
            console.error(`[analyze] ${source.id}`, err)
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
