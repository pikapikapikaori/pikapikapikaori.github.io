/**
 * 批量导入生词
 * - 解析 JSON（单对象 / 数组 / { words: [...] }）
 * - 逐条校验 + 合并到 store
 * - 动态生成 AI 提示词（含当前语言的完整 paradigm 模板）
 */

import { LANGUAGES, LANGUAGE_MAP } from '../data/languages.js'
import { POS_LIST } from '../config/config.js'
import { normalizeParadigm, normalizeStems, normalizeGenders } from '../models/word.js'
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
    if (raw.stem != null && typeof raw.stem !== 'string') return 'stem 不是字符串（旧字段，建议用 stems）'
    if (raw.gender != null
        && !Array.isArray(raw.gender)
        && typeof raw.gender !== 'string') return 'gender 不是数组'
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

/**
 * 与 addOrMerge 的唯一键保持一致（userId + language + lemma + pos）
 */
function recordKey(userId, raw) {
    return [
        userId,
        String(raw.language).trim(),
        String(raw.lemma).trim(),
        String(raw.pos).trim() || 'other'
    ].join('\u0001')
}

/**
 * 导入前预览：只统计「新增 / 合并 / 跳过」，不写入任何数据
 * 同一批次内重复的条目按「合并」计入，与实际导入行为一致。
 * @returns { created, merged, skipped, total, errors, items: { created, merged } }
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

/**
 * @returns { created, merged, skipped, total, errors: [{index, lemma, reason}] }
 */
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
                gender: normalizeGenders(raw.gender, String(raw.pos).trim()),
                attributes: raw.attributes || {},
                stems: normalizeStems(raw.stems ?? raw.stem),
                inflections: raw.inflections || [],
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

/* ---------------- 提示词生成 ---------------- */

export function buildPrompt(languageCode, grammarDoc) {
    const lang = LANGUAGE_MAP[languageCode]
    const langName = lang ? `${lang.name}（${lang.code}）` : languageCode

    const L = []
    L.push(`# 任务：为「${langName}」生成生词 JSON`)
    L.push('')
    L.push('你是语言学习助手的后端。请根据用户给出的词，生成符合下方 schema 的 JSON。')
    L.push('**只输出 JSON**，不要 markdown 代码块包裹，不要任何解释文字。')
    L.push('')
    L.push('## 输出格式（三选一，推荐数组）')
    L.push('')
    L.push('- 单个词：一个 JSON 对象 `{ ... }`')
    L.push('- 多个词：一个 JSON 数组 `[ { ... }, { ... } ]`')
    L.push('- 或包装：`{ "words": [ { ... }, { ... } ] }`')
    L.push('')
    L.push('## Word 对象字段')
    L.push('')
    L.push('| 字段 | 类型 | 必填 | 说明 |')
    L.push('|---|---|---|---|')
    L.push(`| language | string | 是 | 语言 code，**本任务固定为 \`${languageCode}\`** |`)
    L.push('| lemma | string | 是 | 基本形态。**严格区分大小写、变音符号、长短音** |')
    L.push('| pos | enum | 是 | noun / verb / adj / adv / pron / prep / postp / ambip / conj / particle / participle / num / interj / other |')
    L.push('| inflectionType | object | 否 | `{ "label": string, "grammarRef": string \\| null }` |')
    L.push('| meanings | array | 是 | `[{ "text", "lang": "zh" \\| "en", "source" }]`，至少一条 |')
    L.push('| paradigm | object | 否 | 变位/变格表格，结构见下 |')
    L.push('| paradigmRoman | object | 否 | 竖写文字（满文）的转写副本，结构与 `paradigm` 相同；只用于检索，通常不必手填 |')
    L.push('| stems | object | 否 | 词干 `{ "base": 词干, ... }`，**不写末尾连字符**，如 la `{ "base": "am", "perf": "amāv", "presptcp": "amant", "ppp": "amāt", "futact": "amātūr", "futpass": "amand" }`、grc `{ "base": "λόγ" }` |')
    L.push('| gender | string[] | 否 | 语法性，**仅 pos=noun**；取值 `m` / `f` / `n`，可多选 |')
    L.push('| inflections | array | 否 | 补充形式 `[{ "group"?, "label", "form", "source" }]` |')
    L.push('| collocations | array | 否 | `[{ "text", "gloss", "source" }]` |')
    L.push('| examples | array | 否 | `[{ "text", "translation", "citation", "source" }]` |')
    L.push('| derivatives | string[] | 否 | 派生词基本形态 |')
    L.push('| tags | string[] | 否 | 标签 |')
    L.push('| notes | string | 否 | 备注 |')
    L.push('')
    L.push('`source` 取值：`"wiktionary"`（来自词典）/ `"manual"`（你补写的）。')
    L.push('')
    L.push('## paradigm 结构')
    L.push('')
    L.push('```')
    L.push('"paradigm": {')
    L.push('  "<tableKey>": {')
    L.push('    "<rowKey>": { "<colKey>": "词形", "<colKey>": "词形" }')
    L.push('  }')
    L.push('}')
    L.push('```')
    L.push('')
    L.push('**只填有值的格子，空白格不要写。不要编造 key，只能用下面列出的。**')
    L.push('')
    L.push('`stems` 是词干：词干是「所有词形共有的、其后只追加词尾的不变部分」，**不要写末尾的连字符**。')
    L.push('`stems.base` 是必填的基准词干（其余部分可留空，由变位类型的规则推导）；'
        + '如果该变位类型声明了额外的词干（见下表），能确定时请一并给出。')
    L.push('例：拉丁语 amō / amāre / amāvī → `am`；古希腊语 λόγος / λόγου → `λόγ`。')
    L.push('尽量取一个能让词尾直接拼接的词干，不要带会随词尾变化的元音。')
    L.push('')

    const paradigms = grammarDoc && grammarDoc.paradigms
    if (paradigms && typeof paradigms === 'object' && Object.keys(paradigms).length) {
        L.push('## 本语言的表格 key')
        L.push('')
        for (const [pos, tpl] of Object.entries(paradigms)) {
            L.push(`### ${posLabelZh(pos)} (${pos})`)
            L.push('')
            for (const table of tpl.tables || []) {
                L.push(`表 \`${table.key}\`${table.title ? '（' + table.title + '）' : ''}`)
                L.push('')
                const colLabels = (table.columns || [])
                    .map((c) => `\`${c.key}\`(${c.label})`).join(' / ')
                L.push(`- 列：${colLabels}`)
                L.push('')
                L.push('| rowKey | 含义 |')
                L.push('|---|---|')
                for (const row of table.rows || []) {
                    L.push(`| \`${row.key}\` | ${row.label} |`)
                }
                L.push('')
            }
        }
    } else {
        L.push('## 注意')
        L.push('')
        L.push('本语言未提供 paradigm 模板。若有变位/变格信息，请放到 `inflections` 数组里：')
        L.push('')
        L.push('```json')
        L.push('"inflections": [')
        L.push('  { "group": "现在时", "label": "1sg", "form": "词形", "source": "wiktionary" }')
        L.push(']')
        L.push('```')
        L.push('')
    }

    L.push('## 示例')
    L.push('')
    L.push(buildExample(languageCode, grammarDoc))
    L.push('')
    L.push('---')
    L.push('')
    L.push('## 现在，请处理以下词：')
    L.push('')
    L.push('（在此粘贴用户提供的词，每个一行，或一段文本）')

    return L.join('\n')
}

function posLabelZh(pos) {
    const hit = POS_LIST.find((p) => p.value === pos)
    return hit ? hit.label : pos
}

function buildExample(languageCode, grammarDoc) {
    const lines = ['```json', '{']
    lines.push(`  "language": "${languageCode}",`)
    lines.push('  "lemma": "例词",')
    lines.push('  "pos": "verb",')
    lines.push('  "inflectionType": { "label": "变位类型说明", "grammarRef": null },')
    lines.push('  "meanings": [')
    lines.push('    { "text": "中文含义", "lang": "zh", "source": "wiktionary" },')
    lines.push('    { "text": "English gloss", "lang": "en", "source": "wiktionary" }')
    lines.push('  ],')

    const paradigms = grammarDoc && grammarDoc.paradigms
    const verbTpl = paradigms && paradigms.verb
    if (verbTpl && Array.isArray(verbTpl.tables) && verbTpl.tables.length) {
        const t0 = verbTpl.tables[0]
        const r0 = (t0.rows || [])[0]
        const c0 = (t0.columns || [])[0]
        if (r0 && c0) {
            lines.push('  "paradigm": {')
            lines.push(`    "${t0.key}": {`)
            lines.push(`      "${r0.key}": { "${c0.key}": "在此填词形" }`)
            lines.push('    }')
            lines.push('  },')
        }
    } else {
        lines.push('  "paradigm": {},')
    }

    lines.push('  "stems": { "base": "在此填基准词干（不带末尾连字符）" },')
    lines.push('  "gender": ["m"],')

    lines.push('  "inflections": [')
    lines.push('    { "group": "补充", "label": "不定式", "form": "在此填词形", "source": "wiktionary" }')
    lines.push('  ],')
    lines.push('  "tags": [],')
    lines.push('  "notes": ""')
    lines.push('}')
    lines.push('```')
    return lines.join('\n')
}

export function downloadPrompt(languageCode, grammarDoc) {
    const content = buildPrompt(languageCode, grammarDoc)
    const lang = LANGUAGE_MAP[languageCode]
    const base = lang ? lang.code : languageCode || 'unknown'
    const name = `${base}-import-prompt.md`

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return name
}
