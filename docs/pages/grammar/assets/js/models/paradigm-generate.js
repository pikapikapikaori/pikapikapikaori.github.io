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

/** 取某个词干变体的实际词干；未声明该变体时退回 base */
export function resolveStem(stem, stemForm, spec) {
    const base = String(stem ?? '').trim()
    if (!base || !stemForm || stemForm === 'base') return base

    // 直接给出的词干（用于无法用规则表达的变体，如 la reg → rēx）
    const literal = spec?.stems?.[stemForm]
    if (typeof literal === 'string' && literal) return literal

    const rules = spec?.stemForms?.[stemForm]
    return Array.isArray(rules) ? applyRuleList(base, rules) : base
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
        stemForm: cell.stemForm ?? def.stemForm
    }
}

/**
 * 按词尾规则填表。只填空格子，已有值一律不覆盖。
 *
 * @param {object}   options
 * @param {string}   options.stem      主要部分（词干）
 * @param {object}   options.spec      derive 规格
 * @param {object}   options.template  paradigms[pos]
 * @param {object}   [options.existing] 词条已有的 paradigm
 * @returns {{ paradigm: object, filled: object[], skipped: object[] }}
 */
export function generateParadigm({ stem, spec, template, existing } = {}) {
    const result = { paradigm: {}, filled: [], skipped: [] }
    if (!spec || !template || !Array.isArray(template.tables)) return result
    if (!String(stem ?? '').trim()) return result

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
                if (!cell || (!cell.suffix && !cell.prefix)) {
                    result.skipped.push({ ...at, reason: 'no-ending' })
                    continue
                }
                if (String(current[table.key]?.[row.key]?.[col.key] ?? '').trim()) {
                    result.skipped.push({ ...at, reason: 'existing' })
                    continue
                }

                const base = resolveStem(stem, cell.stemForm, spec)
                const naive = String(cell.prefix) + base + endingText(cell.suffix)
                const form = applyRuleList(naive, formRules).trim()
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

    const checkRules = (rules, where) => {
        if (rules == null) return
        if (!Array.isArray(rules)) {
            problems.push(`${where} 不是数组`)
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

    for (const [name, rules] of Object.entries(spec.stemForms || {})) {
        checkRules(rules, `stemForms.${name}`)
    }
    checkRules(spec.formRules, 'formRules')

    const index = buildTableIndex(template)
    const knownStemForm = (name) => !!(
        name
        && ((spec.stems && typeof spec.stems[name] === 'string')
            || (spec.stemForms && spec.stemForms[name]))
    )

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
export function checkDeriveExample(spec, template) {    const out = { ok: false, missing: [], mismatches: [], extra: [] }
    if (!spec?.stemExample || !spec?.expect) return out

    const { paradigm } = generateParadigm({
        stem: spec.stemExample,
        spec,
        template,
        existing: {}
    })

    for (const [tableKey, rows] of Object.entries(spec.expect)) {
        for (const [rowKey, cells] of Object.entries(rows || {})) {
            for (const [colKey, want] of Object.entries(cells || {})) {
                const got = paradigm?.[tableKey]?.[rowKey]?.[colKey]
                const at = `${tableKey}/${rowKey}/${colKey}`
                if (got == null) out.missing.push({ at, want })
                else if (got !== want) out.mismatches.push({ at, want, got })
            }
        }
    }

    for (const [tableKey, rows] of Object.entries(paradigm)) {
        for (const [rowKey, cells] of Object.entries(rows)) {
            for (const [colKey, got] of Object.entries(cells)) {
                if (spec.expect?.[tableKey]?.[rowKey]?.[colKey] == null) {
                    out.extra.push({ at: `${tableKey}/${rowKey}/${colKey}`, got })
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

        const res = checkDeriveExample(spec, tpl)
        out.checked++
        for (const m of res.missing) out.errors.push(`${where}: ${m.at} 未生成（期望 ${m.want}）`)
        for (const m of res.mismatches) out.errors.push(`${where}: ${m.at} 生成 ${m.got}，期望 ${m.want}`)
        for (const m of res.extra) out.warnings.push(`${where}: ${m.at} 生成了 ${m.got}，expect 未覆盖`)
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
