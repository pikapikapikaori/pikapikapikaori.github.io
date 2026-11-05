/**
 * 批量导入生词：解析 JSON（单对象 / 数组 / `{ words: [...] }`）、逐条校验并合并到 store。
 */

import { LANGUAGES } from '../data/languages.js'
import { POS_LIST } from '../config/config.js'
import { normalizeParadigm, normalizeStems } from '../models/word.js'
import { addOrMerge, findByKey } from '../store/word-store.js'

const POS_VALUES = new Set(POS_LIST.map((p) => p.value))
/** 语言 code 集合（LANGUAGES 是启动后才填充的，所以要按需计算） */
const langValues = () => new Set(LANGUAGES.map((l) => l.code))

/* ---------------- 解析 ---------------- */

export function parseWordJson(text) {
    const s = String(text || '').trim()
    if (!s) return { words: [], error: '内容为空' }
    let data
    try {
        data = JSON.parse(s)
    } catch (err) {
        return { words: [], error: `JSON 解析失败：${err.message}` }
    }

    if (Array.isArray(data)) return { words: data }
    if (data && typeof data === 'object') {
        if (Array.isArray(data.words)) return { words: data.words }
        if (data.lemma || data.language) return { words: [data] }
    }
    return { words: [], error: '无法识别的 JSON 结构（应为对象、数组或 { words: [...] }）' }
}

/* ---------------- 校验 ---------------- */

export function validateWord(raw) {
    if (!raw || typeof raw !== 'object') return '不是对象'

    const language = String(raw.language || '').trim()
    if (!language) return 'language 字段为空'
    if (!langValues().has(language)) return `未知语言：${language}`

    const lemma = String(raw.lemma || '').trim()
    if (!lemma) return 'lemma 字段为空'

    const pos = String(raw.pos || '').trim()
    if (!pos) return 'pos 字段为空'
    if (!POS_VALUES.has(pos)) return `未知词性：${pos}`

    if (raw.meanings != null && !Array.isArray(raw.meanings)) return 'meanings 不是数组'
    if (raw.stems != null && typeof raw.stems !== 'object') return 'stems 不是对象'
    if (raw.stems && typeof raw.stems === 'object') {
        for (const [key, value] of Object.entries(raw.stems)) {
            if (typeof value !== 'string') return `stems.${key} 不是字符串`
        }
    }
    if (raw.paradigm != null && (typeof raw.paradigm !== 'object' || Array.isArray(raw.paradigm))) {
        return 'paradigm 不是对象'
    }
    return null
}

/* ---------------- 导入 ---------------- */

function entryLabel(raw, index) {
    const lemma = raw && raw.lemma ? String(raw.lemma).trim() : '?'
    const pos = raw && raw.pos ? String(raw.pos).trim() : ''
    return pos ? `#${index + 1} ${lemma}（${pos}）` : `#${index + 1} ${lemma}`
}

/** 与 addOrMerge 的唯一键保持一致（userId + language + lemma + pos） */
function recordKey(userId, raw) {
    return [
        userId,
        String(raw.language).trim(),
        String(raw.lemma).trim(),
        String(raw.pos).trim() || 'other'
    ].join('\u0001')
}

/**
 * 导入前预览：只统计「新增 / 合并 / 跳过」，不写入任何数据；同批次内重复的条目按「合并」计入，与实际导入一致
 * @returns {{ created, merged, skipped, total, errors, items: { created, merged } }}
 */
export async function previewWords(userId, words) {
    const stats = {
        created: 0, merged: 0, skipped: 0, total: words.length,
        errors: [], items: { created: [], merged: [] }
    }
    // 本批次已出现过的键：后续重复条目会合并到前一条上
    const seen = new Set()

    for (let i = 0; i < words.length; i++) {
        const raw = words[i]
        const reason = validateWord(raw)
        if (reason) {
            stats.skipped++
            stats.errors.push({
                index: i,
                lemma: raw && raw.lemma ? String(raw.lemma) : '?',
                reason
            })
            continue
        }

        const key = recordKey(userId, raw)
        const exists = seen.has(key)
            || !!(await findByKey(userId, String(raw.language).trim(),
                String(raw.lemma).trim(), String(raw.pos).trim()))

        if (exists) {
            stats.merged++
            stats.items.merged.push(entryLabel(raw, i))
        } else {
            stats.created++
            stats.items.created.push(entryLabel(raw, i))
            seen.add(key)
        }
    }
    return stats
}

/** @returns {{ created, merged, skipped, total, errors: [{ index, lemma, reason }] }} */
export async function importWords(userId, words) {
    const stats = { created: 0, merged: 0, skipped: 0, total: words.length, errors: [] }

    for (let i = 0; i < words.length; i++) {
        const raw = words[i]
        const reason = validateWord(raw)
        if (reason) {
            stats.skipped++
            stats.errors.push({
                index: i,
                lemma: raw && raw.lemma ? String(raw.lemma) : '?',
                reason
            })
            continue
        }

        try {
            const result = await addOrMerge(userId, {
                language: String(raw.language).trim(),
                lemma: String(raw.lemma).trim(),
                pos: String(raw.pos).trim(),
                inflectionType: raw.inflectionType || null,
                paradigm: normalizeParadigm(raw.paradigm),
                attributes: raw.attributes || {},
                stems: normalizeStems(raw.stems),
                inflections: (raw.inflections || []).map(({ source, ...rest }) => rest),
                meanings: raw.meanings || [],
                collocations: raw.collocations || [],
                examples: raw.examples || [],
                derivatives: raw.derivatives || [],
                tags: raw.tags || [],
                notes: raw.notes || ''
            })
            if (result.created) stats.created++
            else stats.merged++
        } catch (err) {
            stats.skipped++
            stats.errors.push({
                index: i,
                lemma: raw && raw.lemma ? String(raw.lemma) : '?',
                reason: `写入失败：${err.message}`
            })
        }
    }
    return stats
}

