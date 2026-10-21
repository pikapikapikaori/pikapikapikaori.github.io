/**
 * Wiktionary 查询服务
 */

import { requestJSON } from '../../assets/js/services/http.js'

const API = 'https://en.wiktionary.org/w/api.php'

/**
 * 这个源自己的请求参数（节流 / 超时 / 重试 / 缓存）：
 * 统一由 assets/js/services/http.js 执行，按站点排队，跨源共享。
 */
const HTTP = {
    timeout: 15000,
    retries: 2,
    minInterval: 250,
    concurrency: 1,
    cacheTtl: 7 * 24 * 60 * 60 * 1000
}

const LANG_TO_WIKTIONARY = {
    'la': 'Latin',
    'grc': 'Ancient Greek',
    'he': 'Hebrew',
    'sa': 'Sanskrit',
    'mnc': 'Manchu',
    'ja': 'Japanese',
    'zh-cls': 'Chinese',
    'en': 'English',
    'fr': 'French',
    'de': 'German'
}

/** 界面文案：选词条时用「语言 · 词性」区分同页的多个条目 */
const LANG_LABEL = {
    'la': '拉丁语',
    'grc': '古希腊语',
    'he': '希伯来语',
    'sa': '梵语',
    'mnc': '满语',
    'ja': '日语',
    'zh-cls': '文言',
    'en': '英语',
    'fr': '法语',
    'de': '德语'
}

const POS_LABEL = {
    noun: '名词',
    verb: '动词',
    adj: '形容词',
    adv: '副词',
    pron: '代词',
    prep: '介词',
    conj: '连词',
    particle: '助词',
    participle: '分词',
    num: '数词',
    interj: '感叹词',
    other: '其它'
}

const POS_MAP = {
    'Noun': 'noun',
    'Verb': 'verb',
    'Adjective': 'adj',
    'Adverb': 'adv',
    'Pronoun': 'pron',
    'Preposition': 'prep',
    'Conjunction': 'conj',
    'Particle': 'particle',
    'Participle': 'participle',
    'Numeral': 'num',
    'Interjection': 'interj',
    'Proper noun': 'noun',
    'Article': 'other',
    'Determiner': 'other',
    'Postposition': 'prep',
    'Prefix': 'other',
    'Suffix': 'other'
}

/* ---------------- HTTP ---------------- */

function apiGet(params) {
    return requestJSON(API, {
        ...HTTP,
        query: { ...params, origin: '*' }
    })
}

/**
 * 一次拿全 `action=parse` 的结果：
 * - `wikitext` 用来解析释义与词头模板
 * - `sections` 是解析器给出的标题层级（section 切分依据，比正则可靠）
 *
 * 只要这两样：变格 / 变位表由本站的 derive 引擎按主要部分生成，不再从表格里刮。
 */
async function fetchParsedPage(lemma) {
    const data = await apiGet({
        action: 'parse',
        page: lemma,
        prop: 'sections|wikitext',
        format: 'json',
        formatversion: '2',
        redirects: '1',
        disableeditsection: '1'
    })
    if (data?.error) return null

    const parse = data?.parse
    if (!parse) return null
    return {
        wikitext: parse.wikitext || '',
        sections: Array.isArray(parse.sections) ? parse.sections : []
    }
}

/* ---------------- 按解析器的标题层级切分 wikitext ---------------- */

/**
 * 把 sections 里的 `byteoffset` 批量换算成 JS 字符串下标。
 * 该值实际是字符（码点）偏移而不是 UTF-8 字节数——带变音符 / 组合符的 wikitext
 * 上两者差得很远，按字节换算会整段错位；含代理对时再补一次偏移。
 */
function offsetsToIndexes(wikitext, offsets) {
    const pending = new Set(offsets.map((off) => Math.max(0, off)))
    const indexByOffset = new Map()

    let count = 0
    let index = 0
    for (const ch of wikitext) {
        if (pending.has(count)) indexByOffset.set(count, index)
        count++
        index += ch.length
    }
    return indexByOffset
}

/**
 * 把 `action=parse` 的 sections 列表（标题层级 + byteoffset）落成 wikitext 切片。
 * 每节的范围止于下一个「层级不高于它」的标题，子标题因此仍留在父节里。
 */
function buildSections(wikitext, rawSections) {
    const offsets = rawSections.map((s) => Number(s.byteoffset) || 0)
    const indexByOffset = offsetsToIndexes(wikitext, offsets)

    const sections = rawSections.map((s, i) => {
        const start = indexByOffset.get(Math.max(0, offsets[i])) ?? wikitext.length
        const lineEnd = wikitext.indexOf('\n', start)
        return {
            level: Number(s.level) || 0,
            line: String(s.line || '').trim(),
            start,
            contentStart: lineEnd === -1 ? wikitext.length : lineEnd + 1,
            end: wikitext.length
        }
    })

    for (let i = 0; i < sections.length; i++) {
        for (let j = i + 1; j < sections.length; j++) {
            if (sections[j].level <= sections[i].level) {
                sections[i].end = sections[j].start
                break
            }
        }
        // 上一级标题（词性常挂在「Etymology 1」这类小节下面）
        sections[i].parentLine = ''
        for (let j = i - 1; j >= 0; j--) {
            if (sections[j].level < sections[i].level) {
                sections[i].parentLine = sections[j].line
                break
            }
        }
    }
    return sections
}

/** 语言节 = 文本与语言名完全一致的二级标题 */
function findLanguageSection(sections, langName) {
    return sections.find((s) => s.level === 2 && s.line === langName) || null
}

/**
 * 语言节里的词性小节。标题层级不固定：简单词条是 `===Noun===`，
 * 分词源的词条会挂成 `===Etymology 1===` 下面的 `====Verb====`，所以按标题名认，不按层级认。
 */
function extractPosSections(wikitext, sections, langSection) {
    return sections
        .filter((s) => s.level > 2 && s.start > langSection.start && s.start < langSection.end)
        .filter((s) => POS_MAP[s.line])
        .map((s) => ({
            pos: s.line,
            parent: s.parentLine === langSection.line ? '' : s.parentLine,
            content: wikitext.slice(s.contentStart, s.end).trim()
        }))
}

function stripWikiMarkup(s) {
    let str = String(s)

    // 注释、HTML 标签
    str = str.replace(/<!--[\s\S]*?-->/g, '')
    str = str.replace(/<\/?[^>]+>/g, '')

    // 粗体 / 斜体
    str = str.replace(/'''/g, '')
    str = str.replace(/''/g, '')

    // 循环处理模板与链接，直到字符串稳定
    let prev
    let guard = 0
    do {
        prev = str
        str = str.replace(/\{\{[^{}]*\}\}/g, '')
        str = str.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
        guard++
    } while (str !== prev && guard < 6)

    // 未闭合的链接标记
    str = str.replace(/\[\[/g, '')
    str = str.replace(/\]\]/g, '')

    // 外链 [url text] / [url]
    str = str.replace(/\[https?:[^\s\]]+\s+([^\]]+)\]/g, '$1')
    str = str.replace(/\[https?:[^\s\]]+\]/g, '')

    // HTML 实体
    str = str
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')

    return str.replace(/\s+/g, ' ').trim()
}

/** 词性小节里的释义行（`#` 开头的顶层列表项，不含 `#:` / `#*` 子层） */
function extractMeanings(posContent) {
    const meanings = []
    for (const line of posContent.split('\n')) {
        const t = line.trim()
        if (!/^#[^*:!]/.test(t)) continue
        const text = stripWikiMarkup(t.replace(/^#\s*/, ''))
        if (text) meanings.push({ text, lang: 'en', source: 'wiktionary' })
    }
    return meanings
}

function extractTemplates(posContent) {
    const templates = []
    const re = /\{\{([^|}\n]+)((?:\|[^{}\n]*)*)\}\}/g
    for (const m of posContent.matchAll(re)) {
        const name = m[1].trim()
        const args = m[2]
            .split('|')
            .slice(1)
            .map((a) => a.trim())
            .filter(Boolean)
        templates.push({ name, args })
    }
    return templates
}

/* ---------------- 词头模板：主要部分 ---------------- */

/**
 * 从词头模板里抠「主要部分」。模板只报词形（如 regō、rēx），
 * 词干要按各语言的规则自己剪；剪不出来就留空，交给用户填。
 */
const LA_VERB_ANCHORS = {
    1: 'la-verb-1st-conj',
    2: 'la-verb-2nd-conj',
    3: 'la-verb-3rd-conj',
    4: 'la-verb-4th-conj'
}

/** 位置参数（丢掉 `g=f` 这类具名参数） */
function positionalArgs(args) {
    return (args || []).filter((a) => a && !a.includes('='))
}

/**
 * 拉丁语现在时词干：从第一人称单数去掉词尾与题元元音。
 * amō → am，moneō → mon，regō → reg，audiō → aud，sequor → sequ
 */
function latinPresentStem(form) {
    let s = String(form || '').trim()
    if (/ō$/.test(s)) s = s.slice(0, -1)
    else if (/or$/.test(s)) s = s.slice(0, -2)
    else return null
    s = s.replace(/[eīi]$/, '')
    return s || null
}

/**
 * `{{la-verb|3|regō|rēx|rēct}}`
 * 位置参数：变位类型、第一人称单数、完成时词干、目的分词词干。
 * 异态 / 半异态（`depon` / `p3inf`）只给目的分词词干。
 */
function parseLatinVerb({ args }) {
    const params = positionalArgs(args)
    const cls = params[0] || ''
    const oneSg = params[1] || ''
    const deponent = /depon|p3inf/.test(cls)
    const isForm = (v) => Boolean(v) && v !== '-'

    const stems = {}
    const base = latinPresentStem(oneSg)
    if (base) stems.base = base
    if (isForm(params[2])) {
        if (deponent) stems.ppp = params[2]
        else stems.perf = params[2]
    }
    if (isForm(params[3])) stems.ppp = params[3]

    const conj = Number(String(cls).charAt(0))
    return {
        stems,
        inflectionType: LA_VERB_ANCHORS[conj]
            ? { grammarRef: LA_VERB_ANCHORS[conj], label: '' }
            : null
    }
}

/** 名词词干：`aqua<1>` → aqu；`rēx/rēg<3>` 的斜杠后是显式词干 */
function latinNounStem(lemma, decl) {
    const w = String(lemma || '').trim()
    if (!w || /\s/.test(w)) return null
    if (decl === '1') return w.replace(/[aā]$/, '') || null
    // -er 名词有的掉 e（ager → agr）有的保留（puer），规则判不出来，保守取整词
    if (decl === '2') return w.replace(/(?:us|um|os|om|on)$/, '') || null
    if (decl === '4') return w.replace(/(?:ū|us|u)$/, '') || null
    if (decl === '5') return w.replace(/(?:ēs|ēī)$/, '') || null
    return null
}

/** 变格号 → 语法锚点；变格号本身分不出小类的（第三变格法等）不给 */
function latinNounAnchor(lemma, decl, gender = '') {
    const w = String(lemma || '')
    if (decl === '1') return 'la-noun-1st-decl'
    if (decl === '2') {
        if (/(?:um|on|om)$/.test(w)) return 'la-noun-2nd-decl-n'
        if (gender === 'f') return 'la-noun-2nd-decl-f'
        return /(?:us|os)$/.test(w) ? 'la-noun-2nd-decl' : null
    }
    if (decl === '4') return /(?:ū|u)$/.test(w) ? 'la-noun-4th-decl-n' : 'la-noun-4th-decl'
    if (decl === '5') return /^diēs$/i.test(w) ? 'la-noun-5th-decl-dies' : 'la-noun-5th-decl'
    return null
}

/** `g=m` / `g2=f` 这类具名参数里的语法性 */
function latinGender(args) {
    for (const arg of args || []) {
        const m = String(arg).match(/^g\d*\s*=\s*([mfn])\b/)
        if (m) return m[1]
    }
    return ''
}

/** `{{la-noun|aqua<1>|g=f}}` / `{{la-noun|rēx/rēg<3>|g=m}}` */
function parseLatinNoun({ args }) {
    const raw = positionalArgs(args)[0] || ''
    const decl = (raw.match(/<([^>]*)>/) || [])[1] || ''
    const [lemma, explicitStem] = raw.replace(/<[^>]*>/g, '').split('/')

    const gender = latinGender(args)
    const stem = explicitStem || latinNounStem(lemma, decl.charAt(0))
    const anchor = latinNounAnchor(lemma, decl.charAt(0), gender)
    return {
        stems: stem ? { base: stem } : {},
        inflectionType: anchor ? { grammarRef: anchor, label: '' } : null,
        attributes: gender ? { gender } : null
    }
}

const HEADWORD_TEMPLATES = {
    'la-verb': { pos: 'verb', parse: parseLatinVerb },
    'la-noun': { pos: 'noun', parse: parseLatinNoun }
}

/** 该词性小节里的词头模板 → `{ stems, inflectionType }` */
function extractHeadword(templates, pos) {
    const head = templates.find((t) => {
        const def = HEADWORD_TEMPLATES[t.name]
        return def && def.pos === pos
    })
    if (!head) return { stems: {}, inflectionType: null, attributes: null }
    try {
        return HEADWORD_TEMPLATES[head.name].parse(head)
    } catch (err) {
        console.warn('[wiktionary] 词头模板解析失败', head.name, err)
        return { stems: {}, inflectionType: null, attributes: null }
    }
}

/* ---------------- 主入口 ---------------- */

export async function lookupWord(lemma, langCode) {
    const trimmed = String(lemma || '').trim()
    if (!trimmed) throw new Error('基本形态为空')

    const wikiLang = LANG_TO_WIKTIONARY[langCode]
    if (!wikiLang) throw new Error(`不支持的语言：${langCode}`)

    const page = await fetchParsedPage(trimmed)
    if (!page) return null

    const wikitext = page.wikitext
    const sections = buildSections(wikitext, page.sections)
    const langSection = findLanguageSection(sections, wikiLang)
    if (!langSection) return null

    const posSections = extractPosSections(wikitext, sections, langSection)
    if (posSections.length === 0) return null

    const results = []
    for (const sec of posSections) {
        const pos = POS_MAP[sec.pos]
        if (!pos) continue

        const meanings = extractMeanings(sec.content)
        if (meanings.length === 0) continue

        const headword = extractHeadword(extractTemplates(sec.content), pos)

        results.push({
            language: langCode,
            lemma: trimmed,
            pos,
            wikiPos: sec.pos,
            label: [LANG_LABEL[langCode] || wikiLang, POS_LABEL[pos] || sec.pos, sec.parent]
                .filter(Boolean)
                .join(' · '),
            inflectionType: headword.inflectionType,
            stems: headword.stems,
            attributes: headword.attributes,
            meanings
        })
    }

    if (results.length === 0) return null
    return results
}

/** 单条查询结果 → 表单补丁（只回填释义与主要部分，变格 / 变位表交给 derive 生成） */
function buildPatch(result) {
    const meanings = (result.meanings || []).map((m) => ({
        text: m.text,
        lang: m.lang || 'en',
        source: 'wiktionary'
    }))

    const stems = Object.keys(result.stems || {}).length ? { ...result.stems } : null
    const inflectionType = result.inflectionType?.grammarRef
        ? { ...result.inflectionType }
        : null
    const attributes = result.attributes && Object.keys(result.attributes).length
        ? { ...result.attributes }
        : null

    const parts = [`词性 ${POS_LABEL[result.pos] || result.pos}`]
    if (meanings.length) parts.push(`${meanings.length} 条释义`)
    if (stems) parts.push(`主要部分 ${Object.keys(stems).join(' / ')}`)

    return {
        pos: result.pos,
        meanings,
        stems,
        inflectionType,
        attributes,
        summary: parts.join(' · ')
    }
}

/**
 * 表单便捷入口：查询并返回 ready-to-apply 的数据
 *
 * @param {object} opts
 *   lemma          待查询的基本形态
 *   langCode       项目内语言 code
 *   preferredPos   当前表单已选的词性（优先匹配）
 *   grammarDoc     语法速查 JSON（未使用，保留签名以备未来扩展）
 * @returns {Promise<object|null>}
 *   {
 *     pos,            // 建议填充到 posSelect 的词性
 *     meanings,       // Word.meanings 格式
 *     stems,          // 建议回填的主要部分（来自 {{la-noun}} / {{la-verb}} 等词头模板）
 *     inflectionType, // 建议选中的语法锚点 { grammarRef, label }
 *     summary,        // 提示文案
 *     choices         // 同一页有多个词条时：`[{ label, patch }]`，patch 结构与本对象相同
 *   }
 *   未找到返回 null
 */
export async function lookupWordForForm({
    lemma,
    langCode,
    preferredPos = '',
    grammarDoc = null
}) {
    const results = await lookupWord(lemma, langCode)
    if (!results || results.length === 0) return null

    const patches = results.map(buildPatch)
    const primary = patches.find((p) => p.pos === preferredPos) || patches[0]

    if (patches.length > 1) {
        const choices = results.map((r, i) => ({ label: r.label, patch: patches[i] }))
        // 同名词条（同一词源小节下的同名词性）补序号，不然下拉里分不出来
        const counts = new Map()
        for (const c of choices) counts.set(c.label, (counts.get(c.label) || 0) + 1)
        const seen = new Map()
        for (const c of choices) {
            if (counts.get(c.label) < 2) continue
            const n = (seen.get(c.label) || 0) + 1
            seen.set(c.label, n)
            c.label = `${c.label} (${n})`
        }
        primary.choices = choices
    }
    return primary
}
