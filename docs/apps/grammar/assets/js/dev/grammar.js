import { GRAMMAR_FILES } from '../config/config.js'
import {
    loadGrammar, verifyGrammarFiles,
    clearCache, clearProfileCache, clearScriptProfileCache
} from '../services/grammar-service.js'
import { indexGrammar, collectIds } from '../models/grammar.js'

export async function checkGrammar(code) {
    if (!code) throw new Error('用法：await __ln.dev.checkGrammar(\'la\')')
    const items = await verifyGrammarFiles({ codes: [code] })
    printReport(items)
    return items[0]
}

export async function checkAllGrammar() {
    const items = await verifyGrammarFiles()
    printReport(items)
    return items
}

export async function verifyDerive(code) {
    const item = await checkGrammar(code)
    return item ? item.derive : null
}

export function dumpGrammar(code) {
    return loadGrammar(code)
}

export function listGrammarLangs() {
    return [...GRAMMAR_FILES]
}

export async function hasGrammar(code) {
    return !!(await loadGrammar(code))
}

export async function getIndex(code) {
    const doc = await loadGrammar(code)
    return indexGrammar(doc)
}

export async function getIds(code) {
    const doc = await loadGrammar(code)
    return collectIds(doc)
}

export async function resolveRef(code, ref) {
    if (!ref) return { ok: false, ref: null, reason: 'empty' }
    const doc = await loadGrammar(code)
    if (!doc) return { ok: false, ref, reason: 'no-grammar' }
    const ids = collectIds(doc)
    if (!ids.has(ref)) return { ok: false, ref, reason: 'not-found' }
    return { ok: true, ref, reason: 'ok' }
}

export async function preload(langs = GRAMMAR_FILES) {
    await Promise.all(langs.map((code) => loadGrammar(code)))
}

export function clearGrammarCache(code) {
    clearCache(code)
    clearProfileCache(code)
    clearScriptProfileCache(code)
}

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
