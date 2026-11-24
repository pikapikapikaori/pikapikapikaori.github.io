import { resolveDeriveSpec } from './paradigm-generate.js'
import { POS_LIST } from '../config/config.js'


const POS_VALUES = new Set(POS_LIST.map((p) => p.value))

export function validateGrammarDoc(lang, doc) {
    const errors = []
    const warnings = []
    const err = (m) => errors.push(m)
    const warn = (m) => warnings.push(m)

    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        return { errors: ['顶层不是 JSON 对象'], warnings }
    }

    if (!Number.isInteger(doc.version)) err('`version` 必须是整数')
    if (typeof doc.language !== 'string' || !doc.language) err('缺少 `language`')
    else if (doc.language !== lang) err(`\`language\` 是 "${doc.language}"，与文件名 "${lang}" 不一致`)
    if (typeof doc.name !== 'string' || !doc.name) err('缺少 `name`')
    if (!Array.isArray(doc.sections)) err('`sections` 必须是数组')

    if (doc.pos === undefined) {
        warn('没有声明 `pos`，将回落到全部词性')
    } else if (!Array.isArray(doc.pos)) {
        err('`pos` 必须是数组')
    } else {
        const unknown = doc.pos.filter((p) => !POS_VALUES.has(p))
        if (unknown.length) err(`\`pos\` 含未知词性：${unknown.join(', ')}`)
    }

    const groupIds = new Set()
    if (doc.groups !== undefined) {
        if (!Array.isArray(doc.groups)) err('`groups` 必须是数组')
        else {
            for (const g of doc.groups) {
                if (!g || typeof g.id !== 'string' || !g.id) err('`groups[]` 有条目缺少 `id`')
                else if (groupIds.has(g.id)) err(`\`groups\` 的 id 重复：${g.id}`)
                else groupIds.add(g.id)
            }
        }
    }

    const ids = new Set()
    const takeId = (id, where) => {
        if (typeof id !== 'string' || !id) {
            err(`${where} 缺少 \`id\``)
            return
        }
        if (ids.has(id)) err(`锚点 id 重复：${id}`)
        else ids.add(id)
        if (!id.startsWith(`${lang}-`)) warn(`${where} 的 id "${id}" 没有 "${lang}-" 前缀`)
    }

    for (const section of Array.isArray(doc.sections) ? doc.sections : []) {
        if (!section || typeof section !== 'object') {
            err('`sections[]` 有条目不是对象')
            continue
        }
        takeId(section.id, `section "${section.title || '?'}"`)
        if (section.group && !groupIds.has(section.group)) {
            err(`section "${section.id}" 的 \`group\` 指向不存在的分组：${section.group}`)
        }
        if (section.items !== undefined && !Array.isArray(section.items)) {
            err(`section "${section.id}" 的 \`items\` 必须是数组`)
            continue
        }
        if (!section.items || !section.items.length) warn(`section "${section.id}" 没有条目`)
        for (const item of section.items || []) {
            if (!item || typeof item !== 'object') {
                err(`section "${section.id}" 的 \`items[]\` 有条目不是对象`)
                continue
            }
            takeId(item.id, `item "${item.title || '?'}"`)
            if (item.tables !== undefined && !Array.isArray(item.tables)) {
                err(`item "${item.id}" 的 \`tables\` 必须是数组`)
            }
            if (item.derive !== undefined && (typeof item.derive !== 'object' || item.derive === null)) {
                err(`item "${item.id}" 的 \`derive\` 必须是对象`)
            }
            if (!item.tables?.length && !item.notes && !item.derive) {
                warn(`item "${item.id}" 既没有表格、备注，也没有 derive`)
            }
        }
    }

    if (doc.paradigms !== undefined) {
        if (!doc.paradigms || typeof doc.paradigms !== 'object' || Array.isArray(doc.paradigms)) {
            err('`paradigms` 必须是对象')
        } else {
            const posKeys = new Set(Object.keys(doc.paradigms))
            for (const [pos, def] of Object.entries(doc.paradigms)) {
                if (!POS_VALUES.has(pos)) err(`\`paradigms\` 的词性 ${pos} 不在 POS_LIST 里`)
                if (!def || typeof def !== 'object') {
                    err(`\`paradigms.${pos}\` 必须是对象`)
                    continue
                }
                if (def.extends !== undefined) {
                    if (typeof def.extends !== 'string' || !def.extends) {
                        err(`\`paradigms.${pos}.extends\` 必须是非空字符串`)
                    } else if (!posKeys.has(def.extends)) {
                        err(`\`paradigms.${pos}.extends\` 指向不存在的词性：${def.extends}`)
                    }
                }
                if (def.tables === undefined) {
                    if (def.extends === undefined) err(`\`paradigms.${pos}\` 既没有 \`tables\` 也没有 \`extends\``)
                    continue
                }
                if (!Array.isArray(def.tables)) {
                    err(`\`paradigms.${pos}.tables\` 必须是数组`)
                    continue
                }
                const keys = new Set()
                for (const table of def.tables) {
                    if (!table || typeof table !== 'object') {
                        err(`\`paradigms.${pos}.tables[]\` 有条目不是对象`)
                        continue
                    }
                    if (typeof table.key !== 'string' || !table.key) {
                        err(`\`paradigms.${pos}.tables[]\` 缺 \`key\``)
                        continue
                    }
                    if (keys.has(table.key)) err(`\`paradigms.${pos}\` 的表 key 重复：${table.key}`)
                    else keys.add(table.key)
                    if (!Array.isArray(table.columns) || !table.columns.length) {
                        err(`表 ${pos}.${table.key} 缺 \`columns\``)
                    }
                    if (!Array.isArray(table.rows) || !table.rows.length) {
                        err(`表 ${pos}.${table.key} 缺 \`rows\``)
                    }
                }
            }
            for (const pos of posKeys) {
                const seen = new Set([pos])
                let cur = doc.paradigms[pos]?.extends
                while (typeof cur === 'string') {
                    if (seen.has(cur)) {
                        warn(`\`paradigms.${pos}.extends\` 形成环（${[...seen, cur].join(' → ')}），继承会被忽略`)
                        break
                    }
                    seen.add(cur)
                    cur = doc.paradigms[cur]?.extends
                }
            }
        }
    }

    const hasParadigms = !!doc.paradigms && typeof doc.paradigms === 'object'
        && Object.keys(doc.paradigms).length > 0
    if (doc.paradigm === false && hasParadigms) {
        warn('`paradigm: false` 却写了 `paradigms`，模板不会被用到')
    }
    if (doc.paradigm !== false && !hasParadigms) {
        warn('没有 `paradigms`，该语言的变格表、变位表无法生成')
    }
    if (doc.grammar === false && Array.isArray(doc.sections) && doc.sections.length) {
        warn('`grammar: false` 但 `sections` 不为空，语法页不会显示这些内容')
    }

    return { errors, warnings }
}

export function grammarFlags(meta) {
    const files = (meta && meta.grammarFiles) || {}
    return {
        grammar: Array.isArray(files.chapters) && files.chapters.length > 0,
        paradigm: typeof files.paradigms === 'string' && files.paradigms.length > 0
    }
}

export function isGrammarDoc(obj) {
    return obj
    && typeof obj === 'object'
    && Number.isInteger(obj.version)
    && typeof obj.language === 'string'
    && Array.isArray(obj.sections)
}

export function indexGrammar(doc) {
    const byId = new Map()
    if (!isGrammarDoc(doc)) return byId
    for (const section of doc.sections) {
        if (!section || typeof section !== 'object') continue
        for (const item of section.items || []) {
            if (!item || typeof item.id !== 'string') continue
            byId.set(item.id, { item, section })
        }
    }
    return byId
}

export function collectIds(doc) {
    const ids = new Set()
    if (!isGrammarDoc(doc)) return ids
    for (const section of doc.sections || []) {
        if (section && typeof section.id === 'string') ids.add(section.id)
        for (const item of section?.items || []) {
            if (item && typeof item.id === 'string') ids.add(item.id)
        }
    }
    return ids
}

export function findAnchor(doc, id) {
    if (!isGrammarDoc(doc) || !id) return null
    for (const section of doc.sections) {
        if (section.id === id) return { section, item: null }
        for (const item of section.items || []) {
            if (item.id === id) return { section, item }
        }
    }
    return null
}

function resolveTemplate(paradigms, pos, seen) {
    if (!pos || seen.has(pos)) return null
    const tpl = paradigms[pos]
    if (!tpl || typeof tpl !== 'object') return null
    if (Array.isArray(tpl.tables)) return tpl

    const parent = typeof tpl.extends === 'string' ? tpl.extends.trim() : ''
    if (!parent) return null

    seen.add(pos)
    const inherited = resolveTemplate(paradigms, parent, seen)
    if (!inherited) return null
    return { ...tpl, tables: inherited.tables, extends: parent }
}

export function getParadigmTemplate(doc, pos) {
    if (!isGrammarDoc(doc)) return null
    const p = doc.paradigms
    if (!p || typeof p !== 'object') return null
    return resolveTemplate(p, pos, new Set())
}

const TERM_KEYS = [
    'inflectionType', 'inflectionTypePlaceholder',
    'basicTitle', 'special', 'indeclinable', 'paradigmTitle', 'extraForms', 'stemsTitle',
    'meanings', 'collocations', 'examples', 'derivatives', 'tags', 'notes', 'others',
    'paradigmTable', 'optionalSuffix', 'add', 'addMeaning',
    'posLabel', 'anchorLabel',
    'meaningPlaceholder', 'emptyMeanings',
    'inflectionGroupPlaceholder', 'inflectionLabelPlaceholder', 'inflectionFormPlaceholder',
    'collocationTextPlaceholder', 'collocationGlossPlaceholder', 'emptyCollocations',
    'exampleTextPlaceholder', 'exampleCitationPlaceholder', 'exampleTranslationPlaceholder',
    'emptyExamples',
    'derivativeSearchLabel', 'derivativeSearchPlaceholder', 'derivativeEmptyHint',
    'tagsPlaceholder', 'notesPlaceholder',
]

function textSet(value, keys) {
    const src = value && typeof value === 'object' ? value : {}
    const out = {}
    for (const key of keys) out[key] = typeof src[key] === 'string' ? src[key] : ''
    return out
}

export function termsOf(doc, pos) {
    const base = (doc && typeof doc.terms === 'object' && doc.terms) || {}
    const over = (pos && base.byPos && typeof base.byPos === 'object' ? base.byPos[pos] : null) || {}
    const pick = (key) => {
        const v = over[key] !== undefined ? over[key] : base[key]
        return typeof v === 'string' ? v : ''
    }
    const out = {}
    for (const key of TERM_KEYS) out[key] = pick(key)
    out.stems = textSet(over.stems || base.stems, ['label', 'placeholder', 'hint'])
    out.lemma = textSet(over.lemma || base.lemma, ['label', 'placeholder'])
    return out
}

export function fillTerms(text, posLabel) {
    return String(text || '').replace(/\{pos\}/g, String(posLabel ?? ''))
}

export function getFieldDefs(doc, pos) {
    return fieldDefsOfTemplate(getParadigmTemplate(doc, pos), pos)
}

export function fieldDefsOfTemplate(tpl, pos) {
    if (!tpl) return []
    const declared = Array.isArray(tpl.fields) ? tpl.fields : []
    const out = []
    for (const f of declared) {
        if (!f || !f.key || !Array.isArray(f.options) || !f.options.length) continue
        out.push({
            key: String(f.key),
            label: f.label || f.key,
            hint: f.hint || '',
            multi: f.multi === true,
            required: f.required === true,
            declensionCells: f.declensionCells === true,
            options: f.options.map((o) => ({ value: String(o.value), label: o.label || String(o.value) })),
        })
    }
    return out
}

export function fieldValues(word, key) {
    const raw = word && word.attributes ? word.attributes[key] : null
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
    return []
}

export function genderOfColumn(colKey) {
    const m = /_([mfn])$/.exec(String(colKey || ''))
    return m ? m[1] : ''
}

export function genderOfRow(rowKey) {
    const key = String(rowKey || '')
    return key === 'm' || key === 'f' || key === 'n' ? key : ''
}

function sectionBelongsTo(sectionId, lang, pos) {
    const base = `${lang}-${pos}`
    return sectionId === base || String(sectionId).startsWith(base + '-')
}

function shortLabel(title) {
    const text = String(title || '').trim()
    const m = /^(.*?)[（(]([^（）()]*)[）)](?:[　\s].*)?$/.exec(text)
    if (m) return `${m[1].trim()}（${m[2].trim()}）`
    return text.split('　')[0].trim() || text
}

export function collectInflectAnchors(doc, lang, pos) {
    const out = []
    if (!isGrammarDoc(doc) || !pos) return out

    for (const section of doc.sections) {
        if (!section || !section.id) continue
        if (!sectionBelongsTo(section.id, lang, pos)) continue

        if (section.inflect) {
            out.push({
                id: section.id,
                label: section.anchorLabel || section.title || section.id,
                short: shortLabel(section.title || section.id),
                kind: section.inflect
            })
        }
        for (const item of section.items || []) {
            if (!item || !item.id || !item.inflect) continue
            out.push({
                id: item.id,
                label: item.anchorLabel || item.title || item.id,
                short: item.anchorLabel || item.title || item.id,
                kind: item.inflect,
                fullLabel: `${section.title || section.id} · ${item.title || item.id}`
            })
        }
    }

    const seen = new Map()
    for (const a of out) seen.set(a.label, (seen.get(a.label) || 0) + 1)
    for (const a of out) {
        if (seen.get(a.label) > 1 && a.fullLabel) {
            a.label = a.fullLabel
            a.short = a.fullLabel
        }
        delete a.fullLabel
    }

    return out
}

export function getDeriveSpec(doc, id) {
    return resolveDeriveSpec(doc, id)
}

export function hiddenGenderCells(tpl, pos, holder) {
    const empty = { columns: [], rows: [] }
    const field = fieldDefsOfTemplate(tpl, pos).find((f) => f.declensionCells)
    if (!field) return empty
    const picked = fieldValues(holder, field.key)
    if (!picked.length) return empty
    const hidden = { columns: [], rows: [] }
    for (const table of tpl?.tables || []) {
        for (const col of table.columns || []) {
            const g = genderOfColumn(col.key)
            if (g && !picked.includes(g)) hidden.columns.push(col.key)
        }
        for (const row of table.rows || []) {
            const g = genderOfRow(row.key)
            if (g && !picked.includes(g)) hidden.rows.push(row.key)
        }
    }
    return hidden
}

export function getDeriveParts(doc, id) {
    const spec = getDeriveSpec(doc, id)
    return Array.isArray(spec?.parts) ? spec.parts.filter((p) => p && p.key) : []
}

export function stemLabelOf(doc, ref, pos) {
    const spec = ref ? getDeriveSpec(doc, ref) : null
    const parts = Array.isArray(spec?.parts) ? spec.parts : []
    const base = parts.find((part) => part && part.key === 'base')
    if (base && typeof base.label === 'string' && base.label.trim()) return base.label.trim()
    const label = termsOf(doc, pos).stems.label
    return label || '词干'
}

