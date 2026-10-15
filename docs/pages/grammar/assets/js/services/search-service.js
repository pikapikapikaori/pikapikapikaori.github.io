/**
 * 检索（仅当前语言内）
 * 命中范围：lemma / meanings[].text / examples[].text / collocations[].text
 *
 * 大小写、变音、长短音不敏感。
 */

import { listByLanguage } from '../store/word-store.js'
import { highlight as hl, snippet as sn } from '../utils/text-normalize.js'
import { normalizeSearch } from '../utils/text-normalize.js'

export const SEARCH_SCOPE = [
    { value: 'all',         label: '全部' },
    { value: 'lemma',       label: '基本形态' },
    { value: 'meaning',     label: '含义' },
    { value: 'example',     label: '例句' },
    { value: 'collocation', label: '固定搭配' }
]

export async function search(userId, language, query, options = {}) {
    const q = String(query || '').trim()
    if (!q) return { query: q, hits: [], total: 0 }

    const scope = options.scope || 'all'
    const all = await listByLanguage(userId, language)
    const hits = []

    for (const w of all) {
        const matches = collectMatches(w, q, scope)
        if (matches.length) {
            hits.push({ word: w, matches: matches.slice(0, 6) })
        }
    }

    hits.sort((a, b) => {
        const am = a.matches[0]
        const bm = b.matches[0]
        // lemma 命中优先
        if (am.field === 'lemma' && bm.field !== 'lemma') return -1
        if (bm.field === 'lemma' && am.field !== 'lemma') return 1
        return 0
    })

    return { query: q, hits, total: hits.length }
}

function collectMatches(word, q, scope) {
    const out = []
    const nq = normalizeSearch(q)
    if (!nq) return out

    const hit = (s) => normalizeSearch(s).includes(nq)

    if (scope === 'all' || scope === 'lemma') {
        if (hit(word.lemma)) {
            out.push({
                field: 'lemma',
                label: '基本形态',
                text: word.lemma,
                snippet: word.lemma,
                highlight: () => hl(word.lemma, q)
            })
        }
    }

    if (scope === 'all' || scope === 'meaning') {
        for (const m of word.meanings || []) {
            const t = String(m.text || '')
            if (hit(t)) {
                out.push({
                    field: 'meaning',
                    label: m.lang === 'en' ? '含义 (EN)' : '含义',
                    text: t,
                    source: m.source,
                    snippet: sn(t, q),
                    highlight: () => hl(sn(t, q), q)
                })
            }
        }
    }

    if (scope === 'all' || scope === 'example') {
        for (const e of word.examples || []) {
            const t = String(e.text || '')
            const tr = String(e.translation || '')
            if (hit(t) || hit(tr)) {
                const src = hit(t) ? t : tr
                out.push({
                    field: 'example',
                    label: '例句',
                    text: src,
                    source: e.source,
                    citation: e.citation || '',
                    snippet: sn(src, q),
                    highlight: () => hl(sn(src, q), q)
                })
            }
        }
    }

    if (scope === 'all' || scope === 'collocation') {
        for (const c of word.collocations || []) {
            const t = String(c.text || '')
            const g = String(c.gloss || '')
            if (hit(t) || hit(g)) {
                const src = hit(t) ? t : g
                out.push({
                    field: 'collocation',
                    label: '固定搭配',
                    text: src,
                    source: c.source,
                    snippet: sn(src, q),
                    highlight: () => hl(sn(src, q), q)
                })
            }
        }
    }

    return out
}
