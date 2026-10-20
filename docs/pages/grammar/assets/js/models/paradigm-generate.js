/**
 * 由「主要部分（词干）+ 变格 / 变位类型」生成 paradigm 表格。
 *
 * 规则数据来自语法 JSON：`sections[].items[].derive`，字段说明见 docs/SCHEMA.md。
 *
 * 本文件刻意保持自包含（不 import 其它模块）：
 * 本文件必须保持自包含：界面上的校验按钮直接 import 它，没有构建步骤。
 */

/** 词尾允许写成 "-a"，读入时去掉开头的连字符 */
function endingText(value) {
    return String(value ?? '').replace(/^[-\u2010-\u2015\uff0d]+/, '')
}

/**
 * 该表格行是否声明了不存在的列
 * 例如命令式只有第二人称：{ key: 'pres-act-impr', disabled: ['1sg','1pl','3sg','3pl'] }
 */
export function isCellDisabled(row, colKey) {
    if (!row || !Array.isArray(row.disabled)) return false
    return row.disabled.includes(String(colKey))
}

/** 规则 pattern 必须锚定，否则一次替换就能把整张表写坏 */
export function isAnchoredPattern(pattern) {
    return typeof pattern === 'string' && (pattern.startsWith('^') || pattern.endsWith('$'))
}

function compileRule(rule) {
    if (!rule || typeof rule.pattern !== 'string') return null
    try {
        return { re: new RegExp(rule.pattern, rule.flags || ''), to: String(rule.replace ?? '') }
    } catch {
        return null
    }
}

/** 按顺序套用一组 { pattern, replace, flags } 规则 */
export function applyRuleList(text, rules) {
    let out = String(text ?? '')
    for (const rule of rules || []) {
        const compiled = compileRule(rule)
        if (compiled) out = out.replace(compiled.re, compiled.to)
    }
    return out
}

/**
 * 归一化 stemForms 的一项：
 *   数组            → 直接作用于 base 的规则
 *   { from, rules } → 先取另一个词干变体的结果，再套规则（同一词干的派生形式，如完成时中动词干）
 */
function readStemForm(entry) {
    if (Array.isArray(entry)) return { from: null, rules: entry }
    if (entry && typeof entry === 'object') {
        return {
            from: typeof entry.from === 'string' && entry.from ? entry.from : null,
            rules: Array.isArray(entry.rules) ? entry.rules : []
        }
    }
    return null
}

/**
 * 取某个词干变体的实际词干
 * 顺序：用户填的主要部分 → 类型里直接给出的字面量 → 词干变体规则 → base
 * 规则可以链式：{ from: 'perf', rules: [...] } 表示「先按 perf 取词干，再做一次音变」
 */
export function resolveStem(stem, stemForm, spec, userStems, seen) {
    const base = String(stem ?? '').trim()

    const provided = userStems && typeof userStems === 'object' ? userStems[stemForm] : ''
    if (typeof provided === 'string' && provided.trim()) return provided.trim()

    if (!base || !stemForm || stemForm === 'base') return base

    // 类型里直接给出的词干（无法用规则表达时使用）
    const literal = spec?.stems?.[stemForm]
    if (typeof literal === 'string' && literal) return literal

    const form = readStemForm(spec?.stemForms?.[stemForm])
    if (!form) return base

    const visited = seen instanceof Set ? seen : new Set()
    if (visited.has(stemForm)) return base
    visited.add(stemForm)

    const source = form.from ? resolveStem(stem, form.from, spec, userStems, visited) : base
    if (!source) return base
    return applyRuleList(source, form.rules)
}

/** 归一化「主要部分」入参：允许直接给字符串（仅 base） */
export function normalizeStemParts(stem, stems) {
    const out = {}
    if (stems && typeof stems === 'object') {
        for (const [key, value] of Object.entries(stems)) {
            const text = String(value ?? '').trim()
            if (key && text) out[key] = text
        }
    } else if (typeof stems === 'string' && stems.trim()) {
        out.base = stems.trim()
    }
    if (!out.base) {
        const fallback = String(stem ?? '').trim()
        if (fallback) out.base = fallback
    }
    return out
}

/* ---------------- 音节与重音（derive.post.accent） ---------------- */

/*
 * 由 derive.post.accent 指定：按音节重新指派重音。
 * 「单一词干 + 词尾纯拼接」拿不到重音位置，而重音位置由音节数与音节量决定：
 *   古希腊语动词用退重音（recessive），名词 / 形容词用持续重音（persistent）。
 *
 * 约定：
 *   - 词干按它在基本形态里的样子写（重音照写）；重音落在词尾的类型，词尾自带重音。
 *   - 该格的重音取词尾那一侧（词尾自带重音）或词干那一侧，再按限制法校正。
 *   - 长音符（ᾱ ῑ ῡ，分解后是组合长音符 U+0304）只是元音长短的标注，输出会去掉。
 */

const VOWEL_LETTERS = new Set(['α', 'ε', 'η', 'ι', 'ο', 'υ', 'ω'])
const DIPHTHONGS = new Set(['αι', 'ει', 'οι', 'υι', 'αυ', 'ευ', 'ου', 'ηυ', 'ωυ'])
/** 词末的 αι / οι 按短音计算（希腊语重音法则） */
const FINAL_SHORT_DIPHTHONGS = new Set(['αι', 'οι'])
const DOUBLE_CONSONANTS = new Set(['ξ', 'ψ', 'ζ'])
/** 词末 -εως / -εων（i 词干的阿提卡式属格，如 πόλεως / πόλεων）在限制法里按短末音节算 */
const FINAL_SHORT_SEQUENCES = ['εως', 'εων']
const IOTA_SUBSCRIPT = '\u0345'
/** 分音符（ϊ / ϋ）：标明与前一元音不合为双元音 */
const DIALYTIKA = '\u0308'
const ACUTE = '\u0301'
const CIRCUMFLEX = '\u0342'
const MACRON = '\u0304'
const BREVE = '\u0306'
const ACCENT_MARKS = [ACUTE, CIRCUMFLEX, '\u0344']
const LENGTH_MARKS = [MACRON, BREVE]
const COMBINING = /\p{M}/u

/** 支持的重音模式 */
export const ACCENT_MODES = ['recessive', 'penult', 'persistent', 'acute', 'none', 'sa', 'sa-vedic']

/* ---------------- 梵语连声（sandhi） ---------------- */

const SA_VOWEL = 'aāiīuūṛ'
const SA_ACCENTED = 'āīūṛ'
const SVARITA = '\u0302'
const ANUDATTA = '\u0331'

/** 词尾弱化：浊 / 送气 → 同部位清不送气；咝音与 r → visarga；m → anusvāra */
const SA_FINAL = {
    g: 'k', gh: 'k', k: 'k', kh: 'k',
    j: 'k', jh: 'k', c: 'k', ch: 'k', ñ: 'ṅ',
    ḍ: 'ṭ', ḍh: 'ṭ', ṭ: 'ṭ', ṭh: 'ṭ',
    d: 't', dh: 't', t: 't', th: 't',
    b: 'p', bh: 'p', p: 'p', ph: 'p',
    ś: 'ḥ', ṣ: 'ḥ', s: 'ḥ', r: 'ḥ', ḥ: 'ḥ',
    m: 'ṃ', ṃ: 'ṃ',
}

/**
 * 词内连声：把左段末尾与右段开头按梵语规则合并
 * 只处理最常见的一组（元音连声 + 唇 / 齿鼻音不变），其余原样拼接。
 */
export function saJoin(left, right) {
    const L = String(left ?? '')
    const R = String(right ?? '')
    if (!L || !R) return L + R

    const l = L.slice(-1)
    const r = R[0]
    const rest = R.slice(1)

    // 双元音：a/ā + e/ai / o/au
    const diph = R.slice(0, 2)
    if ('aā'.includes(l) && (diph === 'ai' || diph === 'au')) {
        return L.slice(0, -1) + diph + R.slice(2)
    }

    if (SA_VOWEL.includes(l) && (SA_VOWEL + 'eo').includes(r)) {
        const aGrade = 'aā'
        if (aGrade.includes(l)) {
            if (aGrade.includes(r)) return L.slice(0, -1) + 'ā' + rest
            if ('iī'.includes(r)) return L.slice(0, -1) + 'e' + rest
            if ('uū'.includes(r)) return L.slice(0, -1) + 'o' + rest
            if (r === 'ṛ') return L.slice(0, -1) + 'ar' + rest
        }
        if ('iī'.includes(l)) {
            if ('iī'.includes(r)) return L.slice(0, -1) + 'ī' + rest
            // i / ī 变成半元音 y（不是「保留 i 再加 y」）
            return L.slice(0, -1) + 'y' + R
        }
        if ('uū'.includes(l)) {
            if ('uū'.includes(r)) return L.slice(0, -1) + 'ū' + rest
            return L.slice(0, -1) + 'v' + R
        }
        if (l === 'ṛ') return L.slice(0, -1) + 'r' + R
    }
    return L + R
}

/** 词尾停顿式：把词末辅音按 padasandhi 弱化 */
export function saWordFinal(text) {
    const s = String(text ?? '')
    if (!s) return s
    const last = s.slice(-1)
    const mapped = SA_FINAL[last]
    if (!mapped || mapped === last) return s
    return s.slice(0, -1) + mapped
}

/** 梵语重音：保持词干原有的锐重音；sa-vedic 另给 udātta 之后的音节补 svarita */
export function applySaAccent(text, mode) {
    const s = String(text ?? '')
    if (!s || !mode || mode === 'none') return s
    if (mode !== 'sa-vedic') return s

    const units = toUnits(s)
    const vowels = []
    units.forEach((u, i) => {
        if (SA_VOWEL.includes(u.ch) || SA_ACCENTED.includes(u.ch)) vowels.push(i)
    })
    if (!vowels.length) return s

    let udatta = -1
    vowels.forEach((idx, k) => {
        if (units[idx].marks.includes(ACUTE)) udatta = k
    })
    if (udatta < 0 || udatta + 1 >= vowels.length) return s

    const next = units[vowels[udatta + 1]]
    if (next.marks.includes(ACUTE)) return s
    next.marks = next.marks.filter((m) => m !== CIRCUMFLEX && m !== ANUDATTA)
    next.marks.push(SVARITA)
    return fromUnits(units)
}

/** 拆成「字母 + 其后的组合记号」，便于按字母运算 */
function toUnits(text) {
    const units = []
    for (const ch of String(text ?? '').normalize('NFD')) {
        if (COMBINING.test(ch) && units.length) units[units.length - 1].marks.push(ch)
        else units.push({ ch, marks: [] })
    }
    return units
}

function fromUnits(units, { stripLength = false } = {}) {
    let out = ''
    for (const unit of units) {
        out += unit.ch
        for (const mark of unit.marks) {
            if (stripLength && LENGTH_MARKS.includes(mark)) continue
            out += mark
        }
    }
    return out.normalize('NFC')
}

function isVowel(unit) {
    return VOWEL_LETTERS.has(unit.ch)
}

const GREEK_LETTER = /[\u0370-\u03ff\u1f00-\u1fff]/

/** 音节量只看希腊字母；括号、斜杠等标记不算辅音 */
function consonantWeight(ch) {
    if (!GREEK_LETTER.test(ch)) return 0
    return DOUBLE_CONSONANTS.has(ch) ? 2 : 1
}

/** 音节核：元音或双元音（双元音算一个核） */
function findNuclei(units) {
    const nuclei = []
    let i = 0
    while (i < units.length) {
        if (!isVowel(units[i])) { i += 1; continue }
        let end = i
        const noDiphthong = units[i].marks.includes(DIALYTIKA)
        if (!noDiphthong && i + 1 < units.length && isVowel(units[i + 1])
            && !units[i + 1].marks.includes(DIALYTIKA)
            && DIPHTHONGS.has(units[i].ch + units[i + 1].ch)) {
            end = i + 1
        }
        nuclei.push({ start: i, end, letters: units.slice(i, end + 1).map((u) => u.ch).join('') })
        i = end + 1
    }
    return nuclei
}

/** 音节切分（供调试与复用）：返回每个音节的核 */
export function splitSyllables(text) {
    const units = toUnits(text)
    const nuclei = findNuclei(units)
    return nuclei.map((nuc, i) => {
        const from = i === 0 ? 0 : nuclei[i - 1].end + 1
        return fromUnits(units.slice(from, nuc.end + 1), { stripLength: false })
    })
}

/*
 * 音节的量分两种，希腊语的重音法则对它们的用法不同：
 *   nature   —— 核本身（长元音 / 双元音 / 标了长音符）为长
 *   position —— 核后有两个以上辅音（或双辅音 ξ ψ ζ）为长
 * 限制法只要求「倒数第三音节的重音必须配短末音节」；而「倒数第二音节转弯曲重音」
 * 只在倒数第二是 nature 长时才发生（位置长不转，如 λυθέντος、ὄρνις）。
 */
function syllableWeights(units, nuclei) {
    return nuclei.map((nuc) => {
        let nature = 1
        if (nuc.end > nuc.start) nature = 2
        else if (nuc.letters === 'η' || nuc.letters === 'ω') nature = 2
        else if (units[nuc.start].marks.includes(MACRON)) nature = 2
        else if (units[nuc.start].marks.includes(IOTA_SUBSCRIPT)) nature = 2

        let position = 0
        for (let k = nuc.end + 1; k < units.length; k += 1) {
            if (isVowel(units[k])) break
            position += consonantWeight(units[k].ch)
        }
        return { nature, position }
    })
}

/**
 * 末音节是否算短。
 * 词末的 αι / οι 与 -εως / -εων 按短音算；但祈愿式的词尾 -οι / -αι 是长音
 * （λύοι 与 λύσαι 重音在倒数第二且为锐重音，对比不定式 λῦσαι 的弯曲重音），
 * 由 finalDiphthongLong 标出。
 */
function ultimaIsShort(nuclei, weights, shortFinal, finalDiphthongLong) {
    const last = nuclei.length - 1
    if (last < 0) return true
    if (shortFinal) return true
    const { nature, position } = weights[last]
    if (!position && FINAL_SHORT_DIPHTHONGS.has(nuclei[last].letters)) {
        return !finalDiphthongLong
    }
    return nature < 2 && position < 2
}

function accentKindOf(unit) {
    if (unit.marks.includes(ACUTE)) return 'acute'
    if (unit.marks.includes(CIRCUMFLEX)) return 'circumflex'
    return ''
}

/** 字符串里是否写了重音记号 */
export function hasAccentMark(text) {
    return toUnits(text).some((unit) => accentKindOf(unit))
}

/** 所有带重音的核，按从左到右排列 */
function findAccents(units, nuclei) {
    const out = []
    nuclei.forEach((nuc, index) => {
        for (let k = nuc.start; k <= nuc.end; k += 1) {
            const kind = accentKindOf(units[k])
            if (kind) { out.push({ index, kind }); return }
        }
    })
    return out
}

/**
 * 按音节指派重音。
 * @param {string} text   已经拼好的词形（可含重音与长音符）
 * @param {string} mode   'recessive' | 'persistent' | 'none'
 * @param {object} [options]
 * @param {boolean} [options.endingAccented] 词尾那一侧自带重音时置 true（优先取靠后的那个）
 * @param {boolean} [options.finalDiphthongLong] 词末的 αι / οι 算长音（祈愿式）
 */
export function applyAccent(text, mode, { endingAccented = false, finalDiphthongLong = false } = {}) {
    if (!mode || mode === 'none') return text
    const units = toUnits(text)
    const nuclei = findNuclei(units)
    const plain = () => fromUnits(units, { stripLength: true })
    if (!nuclei.length) return plain()

    const weights = syllableWeights(units, nuclei)
    const last = nuclei.length - 1
    const plainText = fromUnits(units)
    const shortFinal = FINAL_SHORT_SEQUENCES.some((seq) => plainText.endsWith(seq))
    const shortUltima = ultimaIsShort(nuclei, weights, shortFinal, finalDiphthongLong)
    let index = 0
    let kind = 'acute'

    if (mode === 'penult') {
        // 固定在倒数第二音节（不定式 -ναι / -σθαι、-μενος 分词等）
        index = Math.max(0, nuclei.length - 2)
        if (index === last - 1 && weights[index].nature >= 2 && shortUltima) kind = 'circumflex'
    } else if (mode === 'recessive') {
        // 退重音：在限制法允许的范围内尽量往前
        index = (nuclei.length >= 3 && shortUltima) ? nuclei.length - 3 : Math.max(0, nuclei.length - 2)
        if (index === last - 1 && weights[index].nature >= 2 && shortUltima) kind = 'circumflex'
    } else {
        // 持续重音：保持原有的那一侧，只做限制法校正
        const accents = findAccents(units, nuclei)
        if (!accents.length) return plain()
        const authored = endingAccented ? accents[accents.length - 1] : accents[0]
        const earliest = shortUltima ? Math.max(0, nuclei.length - 3) : Math.max(0, nuclei.length - 2)
        index = Math.min(last, Math.max(authored.index, earliest))
        if (index === last) kind = authored.kind
        else if (index === last - 1) {
            kind = (weights[index].nature >= 2 && shortUltima) ? 'circumflex' : 'acute'
        }
        // 个别形式（如 λυθείεν）固定在原音节但用锐重音
        if (mode === 'acute') kind = 'acute'
    }

    for (const unit of units) {
        unit.marks = unit.marks.filter((m) => !ACCENT_MARKS.includes(m) && !LENGTH_MARKS.includes(m))
    }
    units[nuclei[index].end].marks.push(kind === 'circumflex' ? CIRCUMFLEX : ACUTE)
    return fromUnits(units, { stripLength: true })
}

/**
 * 取该格的重音模式
 * post.accent 可写成字符串，或写成 { '*': 默认模式, 表: 模式 | { 行: 模式 } } 按表 / 行覆盖
 */
export function resolveAccentMode(spec, tableKey, rowKey, colKey) {
    const node = spec?.post?.accent
    if (typeof node === 'string') return node
    if (!node || typeof node !== 'object') return ''
    const pick = (value) => {
        if (typeof value === 'string') return value
        if (!value || typeof value !== 'object') return ''
        const row = value[rowKey]
        if (typeof row === 'string') return row
        if (row && typeof row === 'object') {
            if (typeof row[colKey] === 'string') return row[colKey]
            if (typeof row['*'] === 'string') return row['*']
        }
        // 该表自己的默认档
        if (typeof value['*'] === 'string') return value['*']
        return ''
    }
    return pick(node[tableKey]) || pick(node['*'])
}

/** 合并行级默认值与格级声明，得到 { prefix, suffix, stemForm } */
function resolveCell(spec, tableKey, rowKey, colKey) {
    const row = spec?.endings?.[tableKey]?.[rowKey]
    if (!row) return null
    const cell = row[colKey]
    if (cell == null) return null
    const def = spec?.rowDefaults?.[tableKey]?.[rowKey] || {}
    if (typeof cell === 'string' || typeof cell === 'number') {
        return { prefix: def.prefix || '', suffix: String(cell), stemForm: def.stemForm }
    }
    if (typeof cell !== 'object') return null
    return {
        prefix: cell.prefix ?? def.prefix ?? '',
        suffix: cell.suffix ?? def.suffix ?? '',
        stemForm: cell.stemForm ?? def.stemForm,
        stemOnly: cell.stemOnly === true
    }
}

/**
 * 按词尾规则填表。只填空格子，已有值一律不覆盖。
 *
 * @param {object}   options
 * @param {string}   options.stem      主要部分（词干）；与 stems 二选一
 * @param {object}   [options.stems]   多个主要部分 { base, perf, ppp, ... }，优先于 stem
 * @param {object}   options.spec      derive 规格
 * @param {object}   options.template  paradigms[pos]
 * @param {object}   [options.existing] 词条已有的 paradigm
 * @returns {{ paradigm: object, filled: object[], skipped: object[] }}
 */
export function generateParadigm({ stem, stems, spec, template, existing } = {}) {
    const result = { paradigm: {}, filled: [], skipped: [] }
    if (!spec || !template || !Array.isArray(template.tables)) return result
    const parts = normalizeStemParts(stem, stems)
    const base = parts.base || ''
    if (!base) return result

    const formRules = Array.isArray(spec.formRules) ? spec.formRules : []
    const current = existing && typeof existing === 'object' ? existing : {}

    for (const table of template.tables) {
        for (const row of table.rows || []) {
            for (const col of table.columns || []) {
                const at = { tableKey: table.key, rowKey: row.key, colKey: col.key }
                if (isCellDisabled(row, col.key)) {
                    result.skipped.push({ ...at, reason: 'disabled' })
                    continue
                }
                const cell = resolveCell(spec, table.key, row.key, col.key)
                if (!cell || (!cell.suffix && !cell.prefix && !cell.stemOnly)) {
                    result.skipped.push({ ...at, reason: 'no-ending' })
                    continue
                }
                if (String(current[table.key]?.[row.key]?.[col.key] ?? '').trim()) {
                    result.skipped.push({ ...at, reason: 'existing' })
                    continue
                }

                const part = resolveStem(base, cell.stemForm, spec, parts)
                const prefix = String(cell.prefix)
                const suffix = endingText(cell.suffix)
                const sandhi = spec.post?.sandhi
                let naive = cell.stemOnly ? prefix + part : prefix + part + suffix
                if (sandhi && !cell.stemOnly) {
                    naive = saJoin(prefix + part, suffix)
                    if (sandhi === 'sa-word' || (typeof sandhi === 'object' && sandhi.scope === 'word')) {
                        naive = saWordFinal(naive)
                    }
                }

                const mode = resolveAccentMode(spec, table.key, row.key, col.key)
                const applied = applyRuleList(naive, formRules)
                const form = (mode === 'sa' || mode === 'sa-vedic'
                    ? applySaAccent(applied, mode)
                    : applyAccent(applied, mode, {
                        endingAccented: hasAccentMark(suffix),
                        // 祈愿式词尾 -οι / -αι 是长音
                        finalDiphthongLong: /-opt$/.test(row.key)
                    })).trim()
                if (!form) {
                    result.skipped.push({ ...at, reason: 'empty' })
                    continue
                }

                if (!result.paradigm[table.key]) result.paradigm[table.key] = {}
                if (!result.paradigm[table.key][row.key]) result.paradigm[table.key][row.key] = {}
                result.paradigm[table.key][row.key][col.key] = form
                result.filled.push({ ...at, form })
            }
        }
    }
    return result
}

/* ---------------- 校验 ---------------- */

function buildTableIndex(template) {
    const index = new Map()
    for (const table of template?.tables || []) {
        const rows = new Map()
        for (const row of table.rows || []) {
            const cols = new Map()
            for (const c of table.columns || []) cols.set(c.key, row)
            rows.set(row.key, cols)
        }
        index.set(table.key, rows)
    }
    return index
}

/**
 * 校验 derive 规格，返回问题描述数组（空数组即通过）。
 * @param {object} spec
 * @param {object} [template] paradigms[pos]，传入时同时校验 key 与模板是否对齐
 */
export function validateDeriveSpec(spec, template) {
    const problems = []
    if (!spec || typeof spec !== 'object') return ['derive 不是对象']

    if (!spec.endings || typeof spec.endings !== 'object') problems.push('缺少 endings')
    if (spec.stemExample != null && typeof spec.stemExample !== 'string') {
        problems.push('stemExample 不是字符串')
    }
    if (spec.expect && !spec.stemExample) problems.push('有 expect 但没有 stemExample')

    const checkRules = (rules, where, entry = null) => {
        if (entry && entry.from != null) {
            const from = entry.from
            const known = from === 'base'
                || (spec.stemForms && Object.prototype.hasOwnProperty.call(spec.stemForms, from))
                || (spec.stems && typeof spec.stems[from] === 'string')
            if (typeof from !== 'string' || !from) problems.push(`${where}.from 不是字符串`)
            else if (!known) problems.push(`${where}.from 指向了未定义的词干变体：${from}`)
        }
        if (rules == null) return
        if (!Array.isArray(rules)) {
            problems.push(`${where}.rules 不是数组`)
            return
        }
        rules.forEach((rule, i) => {
            const at = `${where}[${i}]`
            if (!rule || typeof rule.pattern !== 'string') {
                problems.push(`${at} 缺少 pattern`)
                return
            }
            if (!compileRule(rule)) problems.push(`${at} 正则非法：${rule.pattern}`)
            else if (!isAnchoredPattern(rule.pattern)) {
                problems.push(`${at} 未锚定（pattern 需以 ^ 或 $ 收尾）：${rule.pattern}`)
            }
            if (rule.replace != null && typeof rule.replace !== 'string') {
                problems.push(`${at}.replace 不是字符串`)
            }
        })
    }

    for (const [name, entry] of Object.entries(spec.stemForms || {})) {
        if (Array.isArray(entry)) {
            checkRules(entry, `stemForms.${name}`)
            continue
        }
        if (entry && typeof entry === 'object') {
            checkRules(entry.rules, `stemForms.${name}`, entry)
            continue
        }
        problems.push(`stemForms.${name} 不是数组或 { from, rules } 对象`)
    }
    checkRules(spec.formRules, 'formRules')

    const index = buildTableIndex(template)
    // 'base' 是内置的原样词干，不需要在 stemForms 里声明
    const knownStemForm = (name) => !!(
        name === 'base'
        || (name && ((spec.stems && typeof spec.stems[name] === 'string')
            || (spec.stemForms && spec.stemForms[name])))
    )

    const checkTableKey = (tableKey, where) => {
        if (!index.has(tableKey)) problems.push(`${where} 的表 key 不在模板中：${tableKey}`)
    }

    const checkRowKey = (tableKey, rowKey, where) => {
        const rows = index.get(tableKey)
        if (!rows) {
            problems.push(`${where} 的表 key 不在模板中：${tableKey}`)
            return
        }
        if (!rows.has(rowKey)) problems.push(`${where} 的行 key 不在模板中：${tableKey}/${rowKey}`)
    }

    const checkPath = (tableKey, rowKey, colKey, where) => {
        if (!index.size) return
        const rows = index.get(tableKey)
        if (!rows) {
            problems.push(`${where} 的表 key 不在模板中：${tableKey}`)
            return
        }
        const cols = rows.get(rowKey)
        if (!cols) {
            problems.push(`${where} 的行 key 不在模板中：${tableKey}/${rowKey}`)
            return
        }
        if (colKey) {
            if (!cols.has(colKey)) {
                problems.push(`${where} 的列 key 不在模板中：${tableKey}/${rowKey}/${colKey}`)
            } else if (isCellDisabled(cols.get(colKey), colKey)) {
                problems.push(`${where} 命中不存在的形式（该行 disabled 了 ${colKey}）`)
            }
        }
    }

    for (const [tableKey, rows] of Object.entries(spec.endings || {})) {
        for (const [rowKey, cells] of Object.entries(rows || {})) {
            for (const [colKey, cell] of Object.entries(cells || {})) {
                const where = `endings.${tableKey}.${rowKey}.${colKey}`
                checkPath(tableKey, rowKey, colKey, where)
                if (cell && typeof cell === 'object') {
                    if (cell.stemOnly === true) continue
                    if (cell.suffix == null && cell.prefix == null) {
                        problems.push(`${where} 既没有 suffix 也没有 prefix`)
                    }
                    if (cell.stemForm && !knownStemForm(cell.stemForm)) {
                        problems.push(`${where} 引用了未定义的 stemForm：${cell.stemForm}`)
                    }
                }
            }
        }
    }

    const checkAccentNode = (node, where, level, path) => {
        if (node == null) return
        if (typeof node === 'string') {
            if (!ACCENT_MODES.includes(node)) problems.push(`${where} 不是已知的重音模式：${node}`)
            return
        }
        if (typeof node !== 'object') {
            problems.push(`${where} 不是字符串或对象`)
            return
        }
        for (const [key, value] of Object.entries(node)) {
            const at = `${where}.${key}`
            if (index.size && level === 'table' && key !== '*') checkTableKey(key, at)
            if (index.size && level === 'row' && path.table) checkRowKey(path.table, key, at)
            if (index.size && level === 'cell' && path.table && path.row) {
                checkPath(path.table, path.row, key, at)
            }
            checkAccentNode(value, at, level === 'table' ? 'row' : 'cell', { table: path.table, row: key })
        }
    }
    checkAccentNode(spec.post?.accent, 'post.accent', 'table', {})

    // 主要部分声明：{ key, label?, example?, hint?, required? }，第一项固定为 base
    if (spec.parts != null) {
        if (!Array.isArray(spec.parts)) problems.push('parts 不是数组')
        else {
            spec.parts.forEach((part, i) => {
                const at = `parts[${i}]`
                if (!part || typeof part !== 'object') {
                    problems.push(`${at} 不是对象`)
                    return
                }
                if (typeof part.key !== 'string' || !part.key) problems.push(`${at} 缺少 key`)
                for (const field of ['label', 'example', 'hint']) {
                    if (part[field] != null && typeof part[field] !== 'string') {
                        problems.push(`${at}.${field} 不是字符串`)
                    }
                }
                if (part.required != null && typeof part.required !== 'boolean') {
                    problems.push(`${at}.required 不是布尔值`)
                }
            })
            if (spec.parts[0] && spec.parts[0].key !== 'base') {
                problems.push('parts 的第一项 key 应当是 base')
            }
        }
    }

    for (const [tableKey, rows] of Object.entries(spec.rowDefaults || {})) {
        for (const [rowKey, def] of Object.entries(rows || {})) {
            const where = `rowDefaults.${tableKey}.${rowKey}`
            checkPath(tableKey, rowKey, null, where)
            if (def?.stemForm && !knownStemForm(def.stemForm)) {
                problems.push(`${where} 引用了未定义的 stemForm：${def.stemForm}`)
            }
        }
    }

    for (const [tableKey, rows] of Object.entries(spec.expect || {})) {
        for (const [rowKey, cells] of Object.entries(rows || {})) {
            for (const colKey of Object.keys(cells || {})) {
                checkPath(tableKey, rowKey, colKey, `expect.${tableKey}.${rowKey}.${colKey}`)
            }
        }
    }

    return problems
}

/**
 * 用 stemExample 自检：生成结果与 expect 逐格比对。
 * @returns {{ ok: boolean, missing: object[], mismatches: object[], extra: object[] }}
 *   ok 只取决于 missing / mismatches；extra 是「生成了但 expect 没写」的提示
 */
export function checkDeriveExample(spec, template, options = {}) {
    const { stems = null, expect = null, reportExtra = true } = options
    const out = { ok: false, missing: [], mismatches: [], extra: [] }
    const want = expect || spec?.expect
    if (!spec?.stemExample || !want) return out

    const { paradigm } = generateParadigm({
        stem: spec.stemExample,
        stems,
        spec,
        template,
        existing: {}
    })

    for (const [tableKey, rows] of Object.entries(want)) {
        for (const [rowKey, cells] of Object.entries(rows || {})) {
            for (const [colKey, want] of Object.entries(cells || {})) {
                const got = paradigm?.[tableKey]?.[rowKey]?.[colKey]
                const at = `${tableKey}/${rowKey}/${colKey}`
                if (got == null) out.missing.push({ at, want })
                else if (got !== want) out.mismatches.push({ at, want, got })
            }
        }
    }

    if (reportExtra) {
        for (const [tableKey, rows] of Object.entries(paradigm)) {
            for (const [rowKey, cells] of Object.entries(rows)) {
                for (const [colKey, got] of Object.entries(cells)) {
                    if (want?.[tableKey]?.[rowKey]?.[colKey] == null) {
                        out.extra.push({ at: `${tableKey}/${rowKey}/${colKey}`, got })
                    }
                }
            }
        }
    }

    out.ok = out.missing.length === 0 && out.mismatches.length === 0
    return out
}

/* ---------------- 全量校验（浏览器按钮 / node 脚本共用） ---------------- */

/**
 * 找出某个 derive 规格对应的 paradigms 模板
 * 依次尝试：spec.pos → section id 里的词性 → 包含全部 endings 表 key 的那个词性
 */
export function resolveDeriveTemplate(doc, spec, sectionId, itemId) {
    const paradigms = doc?.paradigms || {}
    if (spec?.pos && paradigms[spec.pos]) return paradigms[spec.pos]

    const id = String(sectionId || itemId || '')
    for (const pos of Object.keys(paradigms)) {
        if (new RegExp(`-${pos}(-|$)`).test(id)) return paradigms[pos]
    }

    const tableKeys = Object.keys(spec?.endings || {})
    for (const tpl of Object.values(paradigms)) {
        const keys = new Set((tpl.tables || []).map((t) => t.key))
        if (tableKeys.length && tableKeys.every((k) => keys.has(k))) return tpl
    }
    return null
}

/**
 * 校验一份语法文档里的全部 derive 规格
 * @returns {{ lang, specs, checked, errors: string[], warnings: string[] }}
 */
export function verifyGrammarDoc(lang, doc) {
    const out = { lang, specs: 0, checked: 0, errors: [], warnings: [] }

    const check = (spec, id, sectionId, itemId) => {
        out.specs++
        const where = `${lang} · ${id || '(无 id)'}`
        const tpl = resolveDeriveTemplate(doc, spec, sectionId, itemId)

        for (const problem of validateDeriveSpec(spec, tpl)) {
            out.errors.push(`${where}: ${problem}`)
        }
        if (!tpl && Object.keys(doc?.paradigms || {}).length) {
            out.warnings.push(`${where}: 未能确定对应的 paradigm 模板，跳过 key 对齐检查`)
        }

        if (!spec.stemExample || !spec.expect) {
            out.warnings.push(`${where}: 缺少 stemExample / expect，无法自检`)
            return
        }

        const report = (res, suffix) => {
            for (const m of res.missing) out.errors.push(`${where}${suffix}: ${m.at} 未生成（期望 ${m.want}）`)
            for (const m of res.mismatches) out.errors.push(`${where}${suffix}: ${m.at} 生成 ${m.got}，期望 ${m.want}`)
            for (const m of res.extra) out.warnings.push(`${where}${suffix}: ${m.at} 生成了 ${m.got}，expect 未覆盖`)
        }

        // 第一遍：只填基准词干（验证词干变体规则）
        const res = checkDeriveExample(spec, tpl)
        out.checked++
        report(res, '')

        // 第二遍：主要部分全填（用 parts 里的例词），验证「用户全填」这条路径
        if (Array.isArray(spec.parts) && spec.parts.length) {
            const stems = {}
            for (const part of spec.parts) {
                if (part?.key && typeof part.example === 'string' && part.example) stems[part.key] = part.example
            }
            if (!stems.base) stems.base = spec.stemExample
            const wantParts = spec.expectParts || spec.expect
            const resParts = checkDeriveExample(spec, tpl, {
                stems,
                expect: wantParts,
                reportExtra: !!spec.expectParts
            })
            out.checked++
            report(resParts, '（主要部分全填）')
        }
    }

    for (const section of doc?.sections || []) {
        if (!section) continue
        // derive 可以挂在 section 上（一个变位法的规则覆盖它全部时态表）
        if (section.derive) check(section.derive, section.id, section.id, null)

        for (const item of section.items || []) {
            if (item && item.derive) check(item.derive, item.id, section.id, item.id)
        }
    }

    return out
}

/**
 * 汇总多份语法文档的校验结果
 * @param {{ lang: string, doc: object }[]} docs
 * @returns {{ files, specs, checked, errors: string[], warnings: string[], ok: boolean }}
 */
export function verifyGrammarDocs(docs) {
    const errors = []
    const warnings = []
    let specs = 0
    let checked = 0

    for (const entry of docs || []) {
        const res = verifyGrammarDoc(entry.lang, entry.doc)
        specs += res.specs
        checked += res.checked
        errors.push(...res.errors)
        warnings.push(...res.warnings)
    }

    return {
        files: (docs || []).length,
        specs,
        checked,
        errors,
        warnings,
        ok: errors.length === 0
    }
}
