function endingText(value) {
    return String(value ?? '').replace(/^[-\u2010-\u2015\uff0d]+/, '')
}

export function isCellDisabled(row, colKey) {
    if (!row || !Array.isArray(row.disabled)) return false
    return row.disabled.includes(String(colKey))
}

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

export function applyRuleList(text, rules) {
    let out = String(text ?? '')
    for (const rule of rules || []) {
        const compiled = compileRule(rule)
        if (compiled) out = out.replace(compiled.re, compiled.to)
    }
    return out
}

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

function derivedStem(profile, key, stem, spec, parts) {
    if (!profile || typeof profile.deriveStems !== 'function' || !key || key === 'base') return ''
    try {
        const all = profile.deriveStems(String(parts.base ?? stem ?? '').trim(), { spec, stems: parts })
        const value = all && all[key]
        return typeof value === 'string' ? value.trim() : ''
    } catch {
        return ''
    }
}

function resolveBase(stem, spec, parts, seen, profile) {
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
    else if (form.from) source = resolveStem(stem, form.from, spec, parts, visited, profile)
    else source = ''

    return source ? applyRuleList(source, form.rules) : ''
}

function baseHasSource(stem, spec, parts, seen, profile) {
    if (String(parts.base ?? stem ?? '').trim()) return true
    if (typeof spec?.stems?.base === 'string' && spec.stems.base) return true
    const form = readStemForm(spec?.stemForms?.base)
    if (!form) return false
    if (form.from === 'headword') return !!String(parts.headword ?? '').trim()
    if (form.from) return canResolveStem(stem, form.from, spec, parts, seen, profile)
    return false
}

export function canResolveStem(stem, stemForm, spec, userStems, seen, profile) {
    const parts = userStems && typeof userStems === 'object' ? userStems : {}
    const key = stemForm || 'base'
    const visited = seen instanceof Set ? seen : new Set()

    if (String(parts[key] ?? '').trim()) return true
    if (typeof spec?.stems?.[key] === 'string' && spec.stems[key]) return true
    if (derivedStem(profile, key, stem, spec, parts)) return true

    const form = readStemForm(spec?.stemForms?.[key])
    const requiredPart = Array.isArray(spec?.parts)
        && spec.parts.some((p) => p && p.key === key && p.required === true)
    if (!form) return key === 'base' ? baseHasSource(stem, spec, parts, visited, profile) : false
    if (!form.from && !form.rules.length && requiredPart) return false

    if (visited.has(key)) return false
    visited.add(key)

    if (form.from === 'headword') return !!String(parts.headword ?? '').trim()
    if (form.from) return canResolveStem(stem, form.from, spec, parts, visited, profile)
    return baseHasSource(stem, spec, parts, visited, profile)
}

export function previewStem(stem, stemForm, spec, userStems, profile = null, script = null) {
    if (!spec) return ''
    const parts = romanizeParts(normalizeStemParts(stem, userStems, userStems?.headword), spec, script)
    const base = parts.base || stem
    if (!canResolveStem(base, stemForm, spec, parts, null, profile)) return ''
    return resolveStem(base, stemForm, spec, parts, null, profile)
}

export function resolveStem(stem, stemForm, spec, userStems, seen, profile) {
    const parts = userStems && typeof userStems === 'object' ? userStems : {}
    const key = stemForm || 'base'
    const visited = seen instanceof Set ? seen : new Set()

    const provided = parts[key]
    if (typeof provided === 'string' && provided.trim()) return provided.trim()

    const literal = spec?.stems?.[key]
    if (typeof literal === 'string' && literal) return literal

    if (key === 'base') return resolveBase(stem, spec, parts, visited, profile)

    const form = readStemForm(spec?.stemForms?.[key])
    if (!form) return derivedStem(profile, key, stem, spec, parts) || resolveBase(stem, spec, parts, visited, profile)

    if (visited.has(key)) return derivedStem(profile, key, stem, spec, parts) || resolveBase(stem, spec, parts, visited, profile)
    visited.add(key)

    let source = ''
    if (form.from === 'headword') source = String(parts.headword ?? '').trim()
    else if (form.from) source = resolveStem(stem, form.from, spec, parts, visited, profile)
    else source = resolveBase(stem, spec, parts, visited, profile)

    if (!source) return ''
    return applyRuleList(source, form.rules)
}

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



export const ACUTE = '\u0301'
export const CIRCUMFLEX = '\u0342'
const MACRON = '\u0304'
const BREVE = '\u0306'
export const ACCENT_MARKS = [ACUTE, CIRCUMFLEX, '\u0344']
export const LENGTH_MARKS = [MACRON, BREVE]
const COMBINING = /\p{M}/u

export function toUnits(text) {
    const units = []
    for (const ch of String(text ?? '').normalize('NFD')) {
        if (COMBINING.test(ch) && units.length) units[units.length - 1].marks.push(ch)
        else units.push({ ch, marks: [] })
    }
    return units
}

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
        if (typeof value['*'] === 'string') return value['*']
        return ''
    }
    return pick(node[tableKey]) || pick(node['*'])
}

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
        unlessEndsWith: cell.unlessEndsWith ?? def.unlessEndsWith
    }
}

function rulesInRoman(spec, script) {
    if (typeof script?.hasScript !== 'function') return false
    const texts = []
    const collect = (node) => {
        if (node == null) return
        if (typeof node === 'string') { texts.push(node); return }
        if (Array.isArray(node)) { node.forEach(collect); return }
        if (typeof node === 'object') Object.values(node).forEach(collect)
    }
    collect(spec?.endings)
    for (const v of spec?.variants || []) collect(v?.endings)
    if (!texts.length) return false
    return !texts.some((t) => script.hasScript(t))
}

function romanizeParts(parts, spec, script) {
    if (typeof script?.toRoman !== 'function' || !rulesInRoman(spec, script)) return parts
    const metaKeys = new Set((spec.parts || []).filter((p) => p && p.kind === 'select').map((p) => p.key))
    const out = { ...parts }
    for (const key of Object.keys(out)) {
        const value = String(out[key] ?? '')
        if (value && !metaKeys.has(key)) out[key] = script.toRoman(value)
    }
    return out
}

export function generateParadigm({ stem, stems, headword, spec, template, existing, profile, script, overwrite = false } = {}) {
    const result = { paradigm: {}, filled: [], skipped: [], skippedTables: [] }
    if (!spec || !template || !Array.isArray(template.tables)) return result
    const parts = romanizeParts(normalizeStemParts(stem, stems, headword), spec, script)
    const useScript = typeof script?.toScript === 'function'
    const base = parts.base || ''
    const canDeriveBase = !!spec.stems?.base || !!spec.stemForms?.base
    if (!base && !(parts.headword && canDeriveBase)) return result

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

    if (spec.variantByStem && typeof spec.variantByStem === 'object') {
        const addEndings = {}
        const addDefaults = {}
        for (const [stemKey, options] of Object.entries(spec.variantByStem)) {
            const chosen = parts[stemKey]
            const hit = chosen && options && typeof options === 'object' ? options[chosen] : null
            if (!hit) continue
            if (hit.when && typeof hit.when === 'object') {
                const ok = Object.entries(hit.when).every(([k, v]) => parts[k] === v)
                if (!ok) continue
            }
            Object.assign(addEndings, hit.endings || {})
            Object.assign(addDefaults, hit.rowDefaults || {})
        }
        if (Object.keys(addEndings).length) {
            activeSpec = {
                ...activeSpec,
                endings: { ...activeSpec.endings, ...addEndings },
                rowDefaults: { ...activeSpec.rowDefaults, ...addDefaults }
            }
        }
    }

    result.usedTables = Object.keys(activeSpec.endings || {})

    const skeletonOptions = (s) => ({
        leneSlots: Array.isArray(s?.post?.leneSlots) ? s.post.leneSlots : []
    })

    const formRules = Array.isArray(spec.formRules) ? spec.formRules : []
    const current = existing && typeof existing === 'object' ? existing : {}
    const skeletonMode = spec.mode === 'skeleton'

    for (const table of template.tables) {
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
            const missing = [...need].filter((key) => !canResolveStem(base, key, activeSpec, parts, null, profile))
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

                const part = resolveStem(base, cell.stemForm, spec, parts, null, profile)
                const prefix = String(cell.prefix)
                let suffix = endingText(cell.suffix)
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
                    naive = String(profile.realize(part, suffix, skeletonOptions(spec)) ?? '')
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
                        finalDiphthongLong: /-opt$/.test(row.key)
                    })
                    : applied
                const form = String(accented ?? '').trim()
                if (!form) {
                    result.skipped.push({ ...at, reason: 'empty' })
                    continue
                }

                const shown = useScript ? String(script.toScript(form) ?? form) : form
                if (!result.paradigm[table.key]) result.paradigm[table.key] = {}
                if (!result.paradigm[table.key][row.key]) result.paradigm[table.key][row.key] = {}
                result.paradigm[table.key][row.key][col.key] = shown
                result.filled.push({ ...at, form: shown })
            }
        }
    }
    return result
}


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

export function validateDeriveSpec(spec, template, profile) {
    const problems = []
    if (!spec || typeof spec !== 'object') return ['derive 不是对象']

    const hasVariants = Array.isArray(spec.variants) && spec.variants.length > 0
    const partsOnly = spec.partsOnly === true
    if (!hasVariants && !partsOnly && (!spec.endings || typeof spec.endings !== 'object')) problems.push('缺少 endings')
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
    const derivedNames = (() => {
        if (!profile || typeof profile.deriveStems !== 'function') return new Set()
        try {
            return new Set(Object.keys(profile.deriveStems(spec.stemExample || '', { spec, stems: {} }) || {}))
        } catch {
            return new Set()
        }
    })()
    const knownStemForm = (name) => !!(
        name === 'base'
        || (name && ((spec.stems && typeof spec.stems[name] === 'string')
            || (spec.stemForms && spec.stemForms[name])
            || derivedNames.has(name)
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
            if (!partsOnly && spec.parts[0] && spec.parts[0].key !== 'base' && !declaresBase) {
                problems.push('parts 的第一项 key 应当是 base（或用 stemForms.base / stems.base 声明）')
            }
            if (partsOnly && !spec.parts.length) problems.push('partsOnly 的 derive 至少要声明一个词干')
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

export function checkDeriveExample(spec, template, options = {}) {
    const { stems: optionStems = null, expect = null, reportExtra = true, profile = null, script = null } = options
    const stems = { ...(spec?.exampleStems || {}), ...(optionStems || {}) }
    const headword = options.headword ?? spec?.headwordExample ?? null
    const out = { ok: false, missing: [], mismatches: [], extra: [] }

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
        profile,
        script
    })
    const paradigm = generated.paradigm

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

export function verifyGrammarDoc(lang, doc, profile, script = null) {
    const out = { lang, specs: 0, checked: 0, errors: [], warnings: [] }

    const check = (spec, id, sectionId, itemId) => {
        out.specs++
        const where = `${lang} · ${id || '(无 id)'}`
        const tpl = resolveDeriveTemplate(doc, spec, sectionId, itemId)

        for (const problem of validateDeriveSpec(spec, tpl, profile)) {
            out.errors.push(`${where}: ${problem}`)
        }
        if (!tpl && Object.keys(doc?.paradigms || {}).length) {
            out.warnings.push(`${where}: 未能确定对应的 paradigm 模板，跳过 key 检查`)
        }

        const isVariantSpec = Array.isArray(spec.variants) && spec.variants.length > 0
        if (!isVariantSpec && spec.partsOnly !== true && (!spec.stemExample || !spec.expect)) {
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

        const res = checkDeriveExample(spec, tpl, { profile, script, reportExtra: !spec.expectPartial })
        out.checked++
        report(res, '')

        if (!isVariantSpec && Array.isArray(spec.parts) && spec.parts.length) {
            const stems = {}
            for (const part of spec.parts) {
                if (part?.key && typeof part.example === 'string' && part.example) stems[part.key] = part.example
            }
            if (!stems.base && spec.headwordExample) stems.headword = spec.headwordExample
            if (!stems.base && !stems.headword) stems.base = spec.stemExample
            const wantParts = spec.expectParts || spec.expect
            const resParts = checkDeriveExample(spec, tpl, {
                stems,
                expect: wantParts,
                reportExtra: !!spec.expectParts,
                profile,
                script
            })
            out.checked++
            report(resParts, '（词干全填）')
        }
    }

    for (const section of doc?.sections || []) {
        if (!section) continue
        if (section.derive) check(section.derive, section.id, section.id, null)

        for (const item of section.items || []) {
            if (item && item.derive) check(item.derive, item.id, section.id, item.id)
        }
    }

    const ids = new Set()
    for (const section of doc?.sections || []) {
        if (section?.id) ids.add(section.id)
        for (const item of section?.items || []) if (item?.id) ids.add(item.id)
    }

    for (const [pos, tpl] of Object.entries(doc?.paradigms || {})) {
        for (const table of tpl?.tables || []) {
            for (const id of table?.anchors || []) {
                if (!ids.has(id)) {
                    out.errors.push(`${lang} · paradigms.${pos}.${table.key}: anchors 指向不存在的锚点 ${id}`)
                }
            }
        }
    }

    const groups = Array.isArray(doc?.groups) ? doc.groups.filter((g) => g && g.id) : []
    if (groups.length > 1) {
        const groupIds = new Set(groups.map((g) => g.id))
        for (const section of doc?.sections || []) {
            if (!section || !section.id) continue
            if (!section.group) {
                out.errors.push(`${lang} · ${section.id}: 缺少 group（文档声明了 ${groups.length} 个章节）`)
            } else if (!groupIds.has(section.group)) {
                out.errors.push(`${lang} · ${section.id}: group "${section.group}" 不在 groups 里`)
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

