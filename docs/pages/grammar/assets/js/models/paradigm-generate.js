/**
 * 由「主要部分（词干）+ 变格 / 变位类型」生成 paradigm 表格。
 *
 * 规则数据来自语法 JSON：`sections[].items[].derive`，字段说明见 docs/SCHEMA.md。
 *
 * 分工：本文件只做「词干 + 词尾 → 拼接 → 套正则」这套与语言无关的机械流程；
 * 重音、连声等需要语言学知识的后期处理放在 data/paradigm/<lang>.js，
 * 由调用方通过 `profile` 参数传进来（见 docs/SCHEMA.md §7.1）。
 *
 * 本文件必须保持自包含（不 import 其它模块）：界面上的校验按钮直接 import 它，没有构建步骤。
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
 *
 * 特殊来源 `from: 'headword'`：拿**基本形态**（lemma，如法语 / 德语动词的不定式）作为输入，
 * 让 base 这类词干不必由用户重复填写。
 */
/** base 词干：用户填的 base → stems.base 字面量 → stemForms.base（通常来自 headword） */
function resolveBase(stem, spec, parts, seen) {
    const direct = String(parts.base ?? stem ?? '').trim()
    if (direct) return direct

    const literal = spec?.stems?.base
    if (typeof literal === 'string' && literal) return literal

    const form = readStemForm(spec?.stemForms?.base)
    if (!form) return ''

    const visited = seen instanceof Set ? seen : new Set()
    if (visited.has('base')) return ''
    visited.add('base')

    let source = ''
    if (form.from === 'headword') source = String(parts.headword ?? '').trim()
    else if (form.from) source = resolveStem(stem, form.from, spec, parts, visited)
    else source = ''

    return source ? applyRuleList(source, form.rules) : ''
}

/**
 * 该词干变体是否「有来源」：用户填的主要部分、类型里的字面量、或能由规则（含 headword）推出。
 * 生成表格前用它判断整张表是否可生成 —— 没有来源时**不能**悄悄退回 base。
 */
function baseHasSource(stem, spec, parts, seen) {
    if (String(parts.base ?? stem ?? '').trim()) return true
    if (typeof spec?.stems?.base === 'string' && spec.stems.base) return true
    const form = readStemForm(spec?.stemForms?.base)
    if (!form) return false
    if (form.from === 'headword') return !!String(parts.headword ?? '').trim()
    if (form.from) return canResolveStem(stem, form.from, spec, parts, seen)
    return false
}

export function canResolveStem(stem, stemForm, spec, userStems, seen) {
    const parts = userStems && typeof userStems === 'object' ? userStems : {}
    const key = stemForm || 'base'
    const visited = seen instanceof Set ? seen : new Set()

    if (String(parts[key] ?? '').trim()) return true
    if (typeof spec?.stems?.[key] === 'string' && spec.stems[key]) return true

    const form = readStemForm(spec?.stemForms?.[key])
    const requiredPart = Array.isArray(spec?.parts)
        && spec.parts.some((p) => p && p.key === key && p.required === true)
    // 空规则数组 `[]` 表示「与 base 相同」（法语不变的复数 / 阴性），算有来源；
    // 但声明成必填的主要部分（德语强变化的 pret / pp）即使写了空数组也不能自动推出
    if (!form) return key === 'base' ? baseHasSource(stem, spec, parts, visited) : false
    if (!form.from && !form.rules.length && requiredPart) return false

    if (visited.has(key)) return false
    visited.add(key)

    if (form.from === 'headword') return !!String(parts.headword ?? '').trim()
    if (form.from) return canResolveStem(stem, form.from, spec, parts, visited)
    return baseHasSource(stem, spec, parts, visited)
}

/** 主要部分输入框的「推导预览」：能推出来就给值，推不出给空串 */
export function previewStem(stem, stemForm, spec, userStems) {
    if (!spec || !canResolveStem(stem, stemForm, spec, userStems)) return ''
    return resolveStem(stem, stemForm, spec, userStems)
}

export function resolveStem(stem, stemForm, spec, userStems, seen) {
    const parts = userStems && typeof userStems === 'object' ? userStems : {}
    const key = stemForm || 'base'
    const visited = seen instanceof Set ? seen : new Set()

    const provided = parts[key]
    if (typeof provided === 'string' && provided.trim()) return provided.trim()

    // 类型里直接给出的词干（无法用规则表达时使用）
    const literal = spec?.stems?.[key]
    if (typeof literal === 'string' && literal) return literal

    if (key === 'base') return resolveBase(stem, spec, parts, visited)

    const form = readStemForm(spec?.stemForms?.[key])
    if (!form) return resolveBase(stem, spec, parts, visited)

    if (visited.has(key)) return resolveBase(stem, spec, parts, visited)
    visited.add(key)

    let source = ''
    if (form.from === 'headword') source = String(parts.headword ?? '').trim()
    else if (form.from) source = resolveStem(stem, form.from, spec, parts, visited)
    else source = resolveBase(stem, spec, parts, visited)

    if (!source) return ''
    return applyRuleList(source, form.rules)
}

/** 归一化「主要部分」入参：允许直接给字符串（仅 base）；headword = 基本形态 */
export function normalizeStemParts(stem, stems, headword) {
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
    const head = String(headword ?? '').trim()
    if (head) out.headword = head
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

export const ACUTE = '\u0301'
export const CIRCUMFLEX = '\u0342'
const MACRON = '\u0304'
const BREVE = '\u0306'
export const ACCENT_MARKS = [ACUTE, CIRCUMFLEX, '\u0344']
export const LENGTH_MARKS = [MACRON, BREVE]
const COMBINING = /\p{M}/u

/** 拆成「字母 + 其后的组合记号」，便于按字母运算 */
export function toUnits(text) {
    const units = []
    for (const ch of String(text ?? '').normalize('NFD')) {
        if (COMBINING.test(ch) && units.length) units[units.length - 1].marks.push(ch)
        else units.push({ ch, marks: [] })
    }
    return units
}

/** 这段文字是否自带重音记号 */
export function hasAccentMark(text) {
    return toUnits(text).some((unit) => unit.marks.some((mark) => ACCENT_MARKS.includes(mark)))
}

export function fromUnits(units, { stripLength = false } = {}) {
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
        stemOnly: cell.stemOnly === true,
        // 条件词尾：词干已经以这些串之一结尾时不再追加 suffix
        unlessEndsWith: cell.unlessEndsWith ?? def.unlessEndsWith
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
 * @param {object}   [options.profile] 语言档案（data/paradigm/<lang>.js）：
 *                                     `sandhi` / `accent`（拼接型）或 `realize`（骨架型）
 * @returns {{ paradigm: object, filled: object[], skipped: object[] }}
 */
export function generateParadigm({ stem, stems, headword, spec, template, existing, profile, overwrite = false } = {}) {
    const result = { paradigm: {}, paradigmRoman: {}, filled: [], skipped: [], skippedTables: [] }
    if (!spec || !template || !Array.isArray(template.tables)) return result
    const parts = normalizeStemParts(stem, stems, headword)
    // 竖排文字（满文等）：用户填的可能是文字本身，先统一转成转写再做规则与重音
    if (typeof profile?.toRoman === 'function') {
        for (const key of Object.keys(parts)) {
            const value = String(parts[key] ?? '')
            if (value) parts[key] = profile.toRoman(value)
        }
    }
    // 是否要把结果转成文字（满文）
    const useScript = typeof profile?.toScript === 'function'
    const base = parts.base || ''
    // base 可以为空：只要类型声明了 base 的规则（通常是 { from: 'headword' }）
    const canDeriveBase = !!spec.stems?.base || !!spec.stemForms?.base
    if (!base && !(parts.headword && canDeriveBase)) return result

    // 骨架型规格可以带 `variants`：按「基本形态的骨架」在几个模式变体里选一个
    // （希伯来语名词就是这么由基本形态判定元音模式的）
    let activeSpec = spec
    if (spec.mode === 'skeleton' && Array.isArray(spec.variants) && spec.variants.length) {
        const key = typeof profile?.skeletonKey === 'function'
            ? profile.skeletonKey
            : (x) => String(x ?? '')
        const want = typeof profile?.toSkeleton === 'function' ? key(profile.toSkeleton(headword, base)) : null
        const hit = want
            ? spec.variants.find((v) => key(v.match) === want)
                || spec.variants.find((v) => v.match && key(v.match) === want)
            : null
        if (!hit) {
            result.noVariant = { headword: String(headword ?? ''), skeleton: want }
            return result
        }
        activeSpec = { ...spec, endings: hit.endings, rowDefaults: hit.rowDefaults || spec.rowDefaults }
        result.variant = hit.id || null
    }

    const formRules = Array.isArray(spec.formRules) ? spec.formRules : []
    const current = existing && typeof existing === 'object' ? existing : {}
    // 骨架型（`mode: 'skeleton'`）：格子写的是「元音（辅音）骨架」，`_` 由词根辅音依次代入，
    // 例如希伯来语 `_ ָ _ ַ _` + 词根 קטל → קָטַל。代入由语言档案的 realize() 负责。
    const skeletonMode = spec.mode === 'skeleton'

    for (const table of template.tables) {
        // 词干没有来源（没填、也没有规则可推）时整张表跳过，不能退回 base 硬凑
        if (!skeletonMode) {
            const need = new Set()
            for (const row of table.rows || []) {
                for (const col of table.columns || []) {
                    if (isCellDisabled(row, col.key)) continue
                    const cell = resolveCell(activeSpec, table.key, row.key, col.key)
                    if (!cell || (!cell.suffix && !cell.prefix && !cell.stemOnly)) continue
                    need.add(cell.stemForm || 'base')
                }
            }
            const missing = [...need].filter((key) => !canResolveStem(base, key, activeSpec, parts))
            if (missing.length) {
                result.skippedTables.push({ tableKey: table.key, missing })
                continue
            }
        }
        for (const row of table.rows || []) {
            for (const col of table.columns || []) {
                const at = { tableKey: table.key, rowKey: row.key, colKey: col.key }
                if (isCellDisabled(row, col.key)) {
                    result.skipped.push({ ...at, reason: 'disabled' })
                    continue
                }
                const cell = resolveCell(activeSpec, table.key, row.key, col.key)
                if (!cell || (!cell.suffix && !cell.prefix && !cell.stemOnly)) {
                    result.skipped.push({ ...at, reason: 'no-ending' })
                    continue
                }
                if (!overwrite && String(current[table.key]?.[row.key]?.[col.key] ?? '').trim()) {
                    result.skipped.push({ ...at, reason: 'existing' })
                    continue
                }

                const part = resolveStem(base, cell.stemForm, spec, parts)
                const prefix = String(cell.prefix)
                let suffix = endingText(cell.suffix)
                // 语言档案可以按词干改写字尾（如满语的元音和谐：-hV → -ha / -he / -ho）
                if (suffix && typeof profile?.harmonize === 'function') {
                    suffix = profile.harmonize(part, suffix, { tableKey: table.key, rowKey: row.key, colKey: col.key })
                }
                if (suffix && Array.isArray(cell.unlessEndsWith)
                    && cell.unlessEndsWith.some((end) => String(prefix + part).endsWith(String(end)))) {
                    suffix = ''
                }
                const sandhi = spec.post?.sandhi
                const join = profile?.sandhi?.join
                let naive
                if (skeletonMode) {
                    if (typeof profile?.realize !== 'function') {
                        result.skipped.push({ ...at, reason: 'no-realize' })
                        continue
                    }
                    naive = String(profile.realize(part, suffix) ?? '')
                    if (!naive) {
                        result.skipped.push({ ...at, reason: 'empty' })
                        continue
                    }
                } else {
                    naive = cell.stemOnly ? prefix + part : prefix + part + suffix
                }
                if (!skeletonMode && sandhi && join && !cell.stemOnly) {
                    naive = join(prefix + part, suffix)
                    const scope = typeof sandhi === 'object' ? sandhi.scope : undefined
                    if (scope === 'word' && profile?.sandhi?.wordFinal) {
                        naive = profile.sandhi.wordFinal(naive)
                    }
                }

                const mode = resolveAccentMode(activeSpec, table.key, row.key, col.key)
                const applied = applyRuleList(naive, formRules)
                const accented = mode && typeof profile?.accent === 'function'
                    ? profile.accent(applied, mode, {
                        endingAccented: hasAccentMark(suffix),
                        // 古希腊语祈愿式词尾 -οι / -αι 是长音
                        finalDiphthongLong: /-opt$/.test(row.key)
                    })
                    : applied
                const form = String(accented ?? '').trim()
                if (!form) {
                    result.skipped.push({ ...at, reason: 'empty' })
                    continue
                }

                const shown = useScript ? String(profile.toScript(form) ?? form) : form
                if (!result.paradigm[table.key]) result.paradigm[table.key] = {}
                if (!result.paradigm[table.key][row.key]) result.paradigm[table.key][row.key] = {}
                result.paradigm[table.key][row.key][col.key] = shown
                if (useScript) {
                    if (!result.paradigmRoman[table.key]) result.paradigmRoman[table.key] = {}
                    if (!result.paradigmRoman[table.key][row.key]) result.paradigmRoman[table.key][row.key] = {}
                    result.paradigmRoman[table.key][row.key][col.key] = form
                }
                result.filled.push({ ...at, form: shown })
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
export function validateDeriveSpec(spec, template, profile) {
    const problems = []
    if (!spec || typeof spec !== 'object') return ['derive 不是对象']

    const hasVariants = Array.isArray(spec.variants) && spec.variants.length > 0
    if (!hasVariants && (!spec.endings || typeof spec.endings !== 'object')) problems.push('缺少 endings')
    if (hasVariants) {
        const seen = new Set()
        spec.variants.forEach((v, i) => {
            const at = `variants[${i}]`
            if (!v || typeof v !== 'object') { problems.push(`${at} 不是对象`); return }
            if (typeof v.match !== 'string' || !v.match) problems.push(`${at} 缺少 match（基本形态的骨架）`)
            else if (seen.has(v.match)) problems.push(`${at}.match 与前面的变体重复：${v.match}`)
            else seen.add(v.match)
            if (!v.endings || typeof v.endings !== 'object') problems.push(`${at} 缺少 endings`)
            if (v.headword != null && typeof v.headword !== 'string') problems.push(`${at}.headword 不是字符串`)
        })
    }
    if (spec.mode != null && spec.mode !== 'skeleton') {
        problems.push(`mode 只能是 "skeleton"：${spec.mode}`)
    }
    if (spec.stemExample != null && typeof spec.stemExample !== 'string') {
        problems.push('stemExample 不是字符串')
    }
    if (spec.expect && !spec.stemExample) problems.push('有 expect 但没有 stemExample')

    const checkRules = (rules, where, entry = null) => {
        if (entry && entry.from != null) {
            const from = entry.from
            const known = from === 'base' || from === 'headword'
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
    // 可用的词干变体：base、stems 字面量、stemForms 规则，以及 parts 里声明由用户填写的项
    const knownStemForm = (name) => !!(
        name === 'base'
        || (name && ((spec.stems && typeof spec.stems[name] === 'string')
            || (spec.stemForms && spec.stemForms[name])
            || (Array.isArray(spec.parts) && spec.parts.some((part) => part && part.key === name))))
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
                    if (cell.unlessEndsWith != null) {
                        const ok = Array.isArray(cell.unlessEndsWith)
                            && cell.unlessEndsWith.every((x) => typeof x === 'string' && x)
                        if (!ok) problems.push(`${where}.unlessEndsWith 应为非空字符串数组`)
                        else if (cell.suffix == null) problems.push(`${where}.unlessEndsWith 需要同时给 suffix`)
                    }
                }
            }
        }
    }

    const checkAccentNode = (node, where, level, path) => {
        if (node == null) return
        if (typeof node === 'string') {
            const modes = profile?.accentModes || []
            if (modes.length && !modes.includes(node)) {
                problems.push(`${where} 不是已知的重音模式：${node}`)
            }
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
            const declaresBase = !!(spec.stems?.base || spec.stemForms?.base)
            if (spec.parts[0] && spec.parts[0].key !== 'base' && !declaresBase) {
                problems.push('parts 的第一项 key 应当是 base（或用 stemForms.base / stems.base 声明）')
            }
            for (const part of spec.parts) {
                if (!part || typeof part !== 'object') continue
                if (part.kind != null && part.kind !== 'select') {
                    problems.push(`parts.${part.key}.kind 只支持 "select"`)
                }
                if (part.kind === 'select') {
                    const opts = part.options
                    if (!Array.isArray(opts) || !opts.length || opts.some((o) => typeof o !== 'string' || !o)) {
                        problems.push(`parts.${part.key}.options 必须是非空字符串数组`)
                    }
                }
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
    const { stems: optionStems = null, expect = null, reportExtra = true, profile = null } = options
    // exampleStems：主要部分无法由基本形态推导时（如德语强变化的过去时），
    // 自检就用这里给出的示例值，否则 expect 里那些格子必然对不上
    const stems = { ...(spec?.exampleStems || {}), ...(optionStems || {}) }
    const headword = options.headword ?? spec?.headwordExample ?? null
    const out = { ok: false, missing: [], mismatches: [], extra: [] }

    // 带 variants 的规格：逐个变体用自己的「基本形态」自检
    if (Array.isArray(spec?.variants) && spec.variants.length) {
        const out2 = { ok: true, missing: [], mismatches: [], extra: [] }
        spec.variants.forEach((v, i) => {
            if (!v || !v.headword || !v.expect) return
            const res = checkDeriveExample(
                {
                    ...spec,
                    variants: null,
                    endings: v.endings,
                    stemExample: v.root || spec.stemExample,
                    expect: v.expect
                },
                template,
                { ...options, expect: v.expect, headword: v.headword }
            )
            const tag = `${v.id || v.headword}`
            for (const m of res.missing) out2.missing.push({ at: `${tag}: ${m.at}`, want: m.want })
            for (const m of res.mismatches) out2.mismatches.push({ at: `${tag}: ${m.at}`, want: m.want, got: m.got })
            for (const m of res.extra) out2.extra.push({ at: `${tag}: ${m.at}`, got: m.got })
            out2.ok = out2.ok && res.ok
        })
        return out2
    }

    const want = expect || spec?.expect
    if (!spec?.stemExample || !want) return out

    const generated = generateParadigm({
        stem: spec.stemExample,
        stems,
        headword: headword ?? spec.headwordExample ?? null,
        spec,
        template,
        existing: {},
        profile
    })
    // 有「转写 → 文字」转换的语言（满文）：expect 写的是转写，比对转写那一份
    const paradigm = Object.keys(generated.paradigmRoman || {}).length
        ? generated.paradigmRoman
        : generated.paradigm

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
/**
 * 取锚点上的 derive 规格（item 优先，其次 section）。
 * 锚点自己没写 `derive` 时可以写 `deriveRef: "<另一个锚点 id>"` 复用那份规格，
 * 避免把同一份长规格复制到多个章节（满语元音和谐、希伯来语名词类别）。
 */
export function resolveDeriveSpec(doc, id, seen = null) {
    if (!doc || !id) return null
    let section = null
    let item = null
    for (const sec of doc.sections || []) {
        if (sec && sec.id === id) { section = sec; break }
        const hit = (sec?.items || []).find((it) => it && it.id === id)
        if (hit) { section = sec; item = hit; break }
    }
    if (!section && !item) return null

    const spec = (item && item.derive) || (section && section.derive)
    if (spec && typeof spec === 'object') return spec

    const ref = (item && item.deriveRef) || (section && section.deriveRef)
    if (!ref || typeof ref !== 'string') return null
    const visited = seen || new Set()
    if (visited.has(id)) return null
    visited.add(id)
    return resolveDeriveSpec(doc, ref, visited)
}

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
export function verifyGrammarDoc(lang, doc, profile) {
    const out = { lang, specs: 0, checked: 0, errors: [], warnings: [] }

    const check = (spec, id, sectionId, itemId) => {
        out.specs++
        const where = `${lang} · ${id || '(无 id)'}`
        const tpl = resolveDeriveTemplate(doc, spec, sectionId, itemId)

        for (const problem of validateDeriveSpec(spec, tpl, profile)) {
            out.errors.push(`${where}: ${problem}`)
        }
        if (!tpl && Object.keys(doc?.paradigms || {}).length) {
            out.warnings.push(`${where}: 未能确定对应的 paradigm 模板，跳过 key 对齐检查`)
        }

        const isVariantSpec = Array.isArray(spec.variants) && spec.variants.length > 0
        if (!isVariantSpec && (!spec.stemExample || !spec.expect)) {
            out.warnings.push(`${where}: 缺少 stemExample / expect，无法自检`)
            return
        }
        if (isVariantSpec && !spec.variants.some((v) => v && v.headword && v.expect)) {
            out.warnings.push(`${where}: variants 都没有 headword / expect，无法自检`)
            return
        }

        const report = (res, suffix) => {
            for (const m of res.missing) out.errors.push(`${where}${suffix}: ${m.at} 未生成（期望 ${m.want}）`)
            for (const m of res.mismatches) out.errors.push(`${where}${suffix}: ${m.at} 生成 ${m.got}，期望 ${m.want}`)
            for (const m of res.extra) out.warnings.push(`${where}${suffix}: ${m.at} 生成了 ${m.got}，expect 未覆盖`)
        }

        // 第一遍：只填基准词干（验证词干变体规则）
        // `expectPartial: true`：expect 只覆盖部分格子（弱根网格很长，只人工核对关键格），
        // 此时不报「生成了但 expect 未覆盖」的提示
        const res = checkDeriveExample(spec, tpl, { profile, reportExtra: !spec.expectPartial })
        out.checked++
        report(res, '')

        // 第二遍：主要部分全填（用 parts 里的例词），验证「用户全填」这条路径
        // 带 variants 的规格每个变体自带词根，没有「全填」这一路径
        if (!isVariantSpec && Array.isArray(spec.parts) && spec.parts.length) {
            const stems = {}
            for (const part of spec.parts) {
                if (part?.key && typeof part.example === 'string' && part.example) stems[part.key] = part.example
            }
            // 用 headword 推 base 的规格：全填路径补上基本形态
            if (!stems.base && spec.headwordExample) stems.headword = spec.headwordExample
            if (!stems.base && !stems.headword) stems.base = spec.stemExample
            const wantParts = spec.expectParts || spec.expect
            const resParts = checkDeriveExample(spec, tpl, {
                stems,
                expect: wantParts,
                reportExtra: !!spec.expectParts,
                profile
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

    // deriveRef：锚点复用别处的 derive，检查指向是否存在、能否解出规格、是否与 derive 同时出现
    const ids = new Set()
    for (const section of doc?.sections || []) {
        if (section?.id) ids.add(section.id)
        for (const item of section?.items || []) if (item?.id) ids.add(item.id)
    }

    // 表格上的 anchors 必须指向存在的锚点，否则词卡会永远显示默认表
    for (const [pos, tpl] of Object.entries(doc?.paradigms || {})) {
        for (const table of tpl?.tables || []) {
            for (const id of table?.anchors || []) {
                if (!ids.has(id)) {
                    out.errors.push(`${lang} · paradigms.${pos}.${table.key}: anchors 指向不存在的锚点 ${id}`)
                }
            }
        }
    }

    for (const section of doc?.sections || []) {
        for (const node of [section, ...(section?.items || [])]) {
            if (!node || !node.deriveRef) continue
            const where = `${lang} · ${node.id || '(无 id)'}`
            if (typeof node.deriveRef !== 'string') {
                out.errors.push(`${where}: deriveRef 不是字符串`)
                continue
            }
            if (node.derive) {
                out.errors.push(`${where}: deriveRef 与 derive 同时存在，只能二选一`)
                continue
            }
            if (!ids.has(node.deriveRef)) {
                out.errors.push(`${where}: deriveRef 指向不存在的锚点 ${node.deriveRef}`)
                continue
            }
            if (!resolveDeriveSpec(doc, node.id)) {
                out.errors.push(`${where}: deriveRef ${node.deriveRef} 解不出 derive 规格（可能循环引用）`)
            }
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
        const res = verifyGrammarDoc(entry.lang, entry.doc, entry.profile)
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
