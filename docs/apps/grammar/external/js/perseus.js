/**
 * Perseus 形态分析：官方 Word Study Tool 无 CORS 头、Scaife 接口有反爬验证，只能直连 morph.perseids.org 的 Morpheus 引擎（只给词形，无释义）。
 * 导出 `analyzeWord({ word, langCode })` → `{ entries: [{ lemma, rawPos, pos, posLabel, analysis, classLabel, stem, patch }] } | null`，按「原形 + 词性」归并。
 * 判不出来的词干与语法锚点一律留空：错填比不填更贵，它会静默生成一张错的变格表。
 */

import { requestJSON } from '../../assets/js/services/http.js'

const API = 'https://morph.perseids.org/analysis/word'

/** 请求参数，统一由 http.js 执行 */
const HTTP = {
    timeout: 20000,
    retries: 2,
    minInterval: 400,
    concurrency: 1,
    cacheTtl: 30 * 24 * 60 * 60 * 1000
}

/** 项目语言 code → Morpheus 的 (lang, engine)；不在表里的语言不支持 */
const ENGINES = {
    grc: { lang: 'grc', engine: 'morpheusgrc' },
    la: { lang: 'lat', engine: 'morpheuslat' }
}

/* ---------------- 把 Morpheus 的英文术语换成本站说法 ---------------- */

const POS_MAP = {
    noun: 'noun',
    verb: 'verb',
    adjective: 'adj',
    adverb: 'adv',
    pronoun: 'pron',
    preposition: 'prep',
    postposition: 'postp',
    conjunction: 'conj',
    particle: 'particle',
    participle: 'participle',
    numeral: 'num',
    interjection: 'interj',
    exclamation: 'interj',
    article: 'other',
    punctuation: 'other'
}

const POS_LABEL = {
    noun: '名词',
    verb: '动词',
    adj: '形容词',
    adv: '副词',
    pron: '代词',
    prep: '前置介词',
    postp: '后置介词',
    conj: '连词',
    particle: '助词',
    participle: '分词',
    num: '数词',
    interj: '感叹词',
    other: '其它'
}

const GENDER_MAP = { masculine: 'm', feminine: 'f', neuter: 'n' }

const CASE_LABEL = {
    nominative: '主格',
    genitive: '属格',
    dative: '与格',
    accusative: '宾格',
    vocative: '呼格',
    ablative: '夺格',
    locative: '方位格',
    instrumental: '工具格'
}

const NUM_LABEL = { singular: '单数', dual: '双数', plural: '复数' }

const GENDER_LABEL = { masculine: '阳性', feminine: '阴性', neuter: '中性' }

const MOOD_LABEL = {
    indicative: '陈述式',
    subjunctive: '虚拟式',
    optative: '祈愿式',
    imperative: '命令式',
    infinitive: '不定式',
    participle: '分词',
    gerund: '动名词',
    gerundive: '将来被动分词',
    supine: '目的分词'
}

const TENSE_LABEL = {
    present: '现在时',
    imperfect: '未完成过去时',
    future: '将来时',
    perfect: '完成时',
    pluperfect: '过去完成时',
    futureperfect: '将来完成时',
    aorist: '不定过去时'
}

const VOICE_LABEL = {
    active: '主动',
    passive: '被动',
    middle: '中动',
    mediopassive: '中被动'
}

const PERSON_LABEL = { '1st': '第一人称', '2nd': '第二人称', '3rd': '第三人称' }

const DECL_LABEL = {
    '1st': '第一变格法',
    '2nd': '第二变格法',
    '3rd': '第三变格法',
    '4th': '第四变格法',
    '5th': '第五变格法',
    '1st & 2nd': '第一 / 第二变格法'
}

const CONJ_LABEL = {
    conj1: '第一变位法',
    conj2: '第二变位法',
    conj3: '第三变位法',
    conj3io: '第三变位法（-iō）',
    conj4: '第四变位法'
}

/** 希腊语动词的「类」由 stemtype 给（没有像拉丁语那样的单一变位法锚点） */
const GRC_VERB_CLASS = {
    w_vb: '-ω 动词',
    aw_vb: '-αω 缩约动词',
    ew_vb: '-εω 缩约动词',
    ow_vb: '-οω 缩约动词',
    mi_vb: '-μι 动词',
    numi_vb: '-νυμι 动词',
    eimi: 'εἰμί 型'
}

const ANALYSIS_FIELDS = [
    ['case', CASE_LABEL],
    ['num', NUM_LABEL],
    ['gend', GENDER_LABEL],
    ['mood', MOOD_LABEL],
    ['tense', TENSE_LABEL],
    ['voice', VOICE_LABEL],
    ['pers', PERSON_LABEL]
]

/** 形态排序：主格 → 属格 → …，与变格表一致 */
const CASE_ORDER = ['nominative', 'genitive', 'dative', 'accusative', 'vocative', 'ablative', 'locative', 'instrumental']

/** 一张卡片最多列几种形态 */
const MAX_ANALYSES = 4

/* ---------------- JSON-LD 解析 ---------------- */

/** Morpheus 的值是 `{ $: 'noun' }`，个别层级直接是字符串 */
function val(x) {
    if (x && typeof x === 'object') return String(x.$ ?? '').trim()
    return x == null ? '' : String(x).trim()
}

function list(x) {
    if (x == null) return []
    return Array.isArray(x) ? x.filter(Boolean) : [x]
}

/** `Body` 可能是对象或数组；查不到分析时只有 `hasBody`（资源指针）而没有 `Body` */
function entriesOf(data) {
    const bodies = list(data?.RDF?.Annotation?.Body)
    const out = []
    for (const body of bodies) {
        for (const entry of list(body?.rest?.entry)) {
            if (entry && typeof entry === 'object') out.push(entry)
        }
    }
    return out
}

function analysisOf(infl) {
    const parts = []
    for (const [key, labels] of ANALYSIS_FIELDS) {
        const raw = val(infl?.[key])
        if (!raw || raw === '(null)') continue
        parts.push(labels[raw] || raw)
    }
    return parts.join(' · ')
}

/* ---------------- 词干 ---------------- */

/** Morpheus 用 `_` 标长音：`re_` → `rē`；转不出来（残留 `_`）就不认这个词干 */
const LONG_VOWEL = { a: 'ā', e: 'ē', i: 'ī', o: 'ō', u: 'ū', y: 'ȳ' }

function cleanStem(raw) {
    const s = String(raw || '').trim()
    if (!s) return ''
    const expanded = s.replace(/([aeiouy])_/gi, (_, v) => LONG_VOWEL[v.toLowerCase()] || '_')
    return expanded.includes('_') ? '' : expanded
}

/**
 * 拉丁语第三变格法只有主格时词干不可靠（rēx → `re_`，真正词干是 rēg），不填；
 * 希腊语词干不带重音（λογ vs 语法表的 λόγ），交给表单按基本形态推导。
 */
function stemsOf({ langCode, pos, decl, stem }) {
    if (langCode !== 'la') return null
    const s = cleanStem(stem)
    if (!s) return null
    if (pos === 'verb') return { base: s }
    if (pos === 'noun' && (decl === '1st' || decl === '2nd' || decl === '4th')) return { base: s }
    return null
}

/* ---------------- 语法锚点 ---------------- */

/**
 * 拉丁语：变格号 / 变位法 → 本站锚点。分不出小类的（第三变格法的 i-词干等）
 * 给该变格法的大类锚点，再判不出来就留空。
 */
function latinAnchor({ pos, decl, gender, stemtype }) {
    if (pos === 'noun') {
        if (decl === '1st') return 'la-noun-1st-decl'
        if (decl === '2nd') {
            if (gender === 'n') return 'la-noun-2nd-decl-n'
            if (gender === 'f') return 'la-noun-2nd-decl-f'
            return 'la-noun-2nd-decl'
        }
        if (decl === '3rd') {
            if (gender === 'n') return 'la-noun-3rd-decl-n'
            return /^is_/.test(stemtype) ? 'la-noun-3rd-decl-i' : 'la-noun-3rd-decl'
        }
        if (decl === '4th') return gender === 'n' ? 'la-noun-4th-decl-n' : 'la-noun-4th-decl'
        if (decl === '5th') return 'la-noun-5th-decl'
        return null
    }
    if (pos === 'verb') {
        const m = String(stemtype || '').match(/^conj([1-4])/)
        if (!m) return null
        return `la-verb-${m[1]}${['st', 'nd', 'rd', 'th'][Number(m[1]) - 1]}-conj`
    }
    if (pos === 'adj') {
        if (decl === '1st & 2nd') return 'la-adj-1st-2nd'
        if (decl === '3rd') return 'la-adj-3rd'
    }
    return null
}

/**
 * 希腊语：只给能确定的大类。第三变格法的小类（-σ / 流音 / -ι …）在单数主格上
 * 判不出来，希腊语动词的锚点是「类 × 时态」，都留空。
 */
function greekAnchor({ pos, decl, gender, lemma }) {
    if (pos === 'noun') {
        if (decl === '1st') {
            if (gender === 'm') return 'grc-noun-1st-decl-m'
            return /η$/.test(lemma) ? 'grc-noun-1st-decl-e' : 'grc-noun-1st-decl-a'
        }
        if (decl === '2nd') return gender === 'n' ? 'grc-noun-2nd-decl-n' : 'grc-noun-2nd-decl-m'
        return null
    }
    if (pos === 'adj') {
        if (decl === '1st & 2nd') return 'grc-adj-1st-2nd'
        if (decl === '3rd') return 'grc-adj-3rd'
    }
    return null
}

function classLabelOf({ langCode, pos, decl, stemtype }) {
    if (pos === 'verb') {
        if (langCode === 'la') return CONJ_LABEL[stemtype] || ''
        if (langCode === 'grc') return GRC_VERB_CLASS[stemtype] || ''
        return ''
    }
    if (pos === 'noun' || pos === 'adj') return DECL_LABEL[decl] || ''
    return ''
}

/* ---------------- 主入口 ---------------- */

export async function analyzeWord({ word, langCode } = {}) {
    const trimmed = String(word || '').trim()
    if (!trimmed) return null

    const engine = ENGINES[langCode]
    if (!engine) return null

    const data = await requestJSON(API, {
        ...HTTP,
        query: { lang: engine.lang, engine: engine.engine, word: trimmed }
    })

    const entries = entriesOf(data)
    if (!entries.length) return { entries: [] }

    /* 同一个「原形 + 词性」的多个分析归并成一张卡片 */
    const groups = new Map()
    for (const entry of entries) {
        const dict = entry.dict || {}
        const lemma = val(dict.hdwd).replace(/\d+$/, '') // manus1 → manus
        if (!lemma) continue
        const rawPos = val(dict.pofs)
        const pos = POS_MAP[rawPos] || 'other'
        const key = `${lemma}|${pos}`
        if (!groups.has(key)) groups.set(key, { lemma, rawPos, pos, dict, infls: [] })
        groups.get(key).infls.push(...list(entry.infl))
    }

    const out = []
    for (const group of groups.values()) {
        const { lemma, rawPos, pos, dict, infls } = group
        const decl = val(dict.decl)
        const rawGender = val(dict.gend)
        const gender = GENDER_MAP[rawGender] || ''

        const analyses = []
        for (const infl of infls) {
            const text = analysisOf(infl)
            if (!text || analyses.some((a) => a.text === text)) continue
            const order = CASE_ORDER.indexOf(val(infl?.case))
            analyses.push({ text, order: order === -1 ? CASE_ORDER.length : order })
        }
        analyses.sort((a, b) => a.order - b.order)
        const analysis = analyses.length > MAX_ANALYSES
            ? `${analyses.slice(0, MAX_ANALYSES).map((a) => a.text).join('；')} 等 ${analyses.length} 项`
            : analyses.map((a) => a.text).join('；')

        const stemInfl = infls.find((i) => val(i?.term?.stem))
        const stemType = val(infls[0]?.stemtype)
        const rawStem = cleanStem(val(stemInfl?.term?.stem))

        const anchor = langCode === 'la'
            ? latinAnchor({ pos, decl, gender, stemtype: stemType })
            : greekAnchor({ pos, decl, gender, lemma })

        // 只有真正会回填给表单的词干才展示，免得「卡片上有词干、表单里没有」两头对不上
        const stems = stemsOf({ langCode, pos, decl, stem: rawStem })
        const stem = stems?.base || ''
        const classLabel = classLabelOf({ langCode, pos, decl, stemtype: stemType })

        const summary = [
            `词性 ${POS_LABEL[pos] || pos}`,
            classLabel,
            stem ? `词干 ${stem}` : ''
        ].filter(Boolean).join(' · ')

        out.push({
            lemma,
            rawPos,
            pos,
            posLabel: POS_LABEL[pos] || pos,
            analysis,
            classLabel,
            stem,
            patch: {
                pos,
                // Morpheus 没有释义：这个源只做形态，不产出 meanings
                meanings: [],
                stems,
                inflectionType: anchor ? { grammarRef: anchor, label: '' } : null,
                attributes: gender ? { gender } : null,
                summary
            }
        })
    }

    if (!out.length) return { entries: [] }
    return { entries: out }
}
