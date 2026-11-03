/**
 * 调试用：语法数据的结构校验 + derive 自检，结果直接打在 console 里。
 * 只在 `__ln.dev` 下暴露，界面不引用。
 */

import { GRAMMAR_FILES } from '../config/config.js'
import {
    loadGrammar, verifyGrammarFiles,
    clearCache, clearProfileCache, clearScriptProfileCache
} from '../services/grammar-service.js'
import { indexGrammar, collectIds } from '../models/grammar.js'

/** 单个语言：结构校验 + derive 自检 */
export async function checkGrammar(code) {
    if (!code) throw new Error('用法：await __ln.dev.checkGrammar(\'la\')')
    const items = await verifyGrammarFiles({ codes: [code] })
    printReport(items)
    return items[0]
}

/** 全部语言（约 1 秒，逐语言让出主线程） */
export async function checkAllGrammar() {
    const items = await verifyGrammarFiles()
    printReport(items)
    return items
}

/** 只看 derive 自检的结果 */
export async function verifyDerive(code) {
    const item = await checkGrammar(code)
    return item ? item.derive : null
}

/** 拿解析好的语法文档对象（走缓存；有 error 的文件返回 null） */
export function dumpGrammar(code) {
    return loadGrammar(code)
}

/** 当前会加载哪些语言 */
export function listGrammarLangs() {
    return [...GRAMMAR_FILES]
}

/** 该语言有没有语法数据文件 */
export async function hasGrammar(code) {
    return !!(await loadGrammar(code))
}

/** 引用索引（锚点 → 位置） */
export async function getIndex(code) {
    const doc = await loadGrammar(code)
    return indexGrammar(doc)
}

/** 该语言全部锚点 id */
export async function getIds(code) {
    const doc = await loadGrammar(code)
    return collectIds(doc)
}

/** 校验并规范化 grammarRef：`{ ok, ref, reason }` */
export async function resolveRef(code, ref) {
    if (!ref) return { ok: false, ref: null, reason: 'empty' }
    const doc = await loadGrammar(code)
    if (!doc) return { ok: false, ref, reason: 'no-grammar' }
    const ids = collectIds(doc)
    if (!ids.has(ref)) return { ok: false, ref, reason: 'not-found' }
    return { ok: true, ref, reason: 'ok' }
}

/** 预加载若干语言的语法数据 */
export async function preload(langs = GRAMMAR_FILES) {
    await Promise.all(langs.map((code) => loadGrammar(code)))
}

/** 清掉语法数据 / 语言档案 / 文字档案的模块级缓存（改完 JSON 不必刷新页面） */
export function clearGrammarCache(code) {
    clearCache(code)
    clearProfileCache(code)
    clearScriptProfileCache(code)
}

/* ---------------- 输出 ---------------- */

function printReport(items) {
    const rows = items.map((item) => ({
        language: item.code,
        name: item.name || '',
        structure: `${item.structure.errors.length}E / ${item.structure.warnings.length}W`,
        derive: `${item.derive.errors.length}E / ${item.derive.warnings.length}W`,
        cells: item.derive.checked ?? ''
    }))
    console.table(rows)

    let failing = 0
    for (const item of items) {
        const lines = [
            ...item.structure.errors.map((text) => ['error', `结构：${text}`]),
            ...item.structure.warnings.map((text) => ['warn', `结构：${text}`]),
            ...item.derive.errors.map((text) => ['error', `derive：${text}`]),
            ...item.derive.warnings.map((text) => ['warn', `derive：${text}`])
        ]
        if (!lines.length) continue
        failing += 1
        console.group(`${item.code}${item.name ? ` · ${item.name}` : ''}`)
        for (const [level, text] of lines) {
            if (level === 'error') console.error(text)
            else console.warn(text)
        }
        console.groupEnd()
    }

    if (failing === 0) console.log(`%c${items.length} 个语言全部通过（0 error / 0 warning）`, 'color:#2f9e55')
    else console.log(`${items.length} 个语言中 ${failing} 个有问题`)
}
