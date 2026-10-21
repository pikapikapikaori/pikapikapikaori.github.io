/**
 * Wiktionary 查询服务
 */

const API = 'https://en.wiktionary.org/w/api.php'

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

const COL_KEY_MAP = {
    'singular': 'sg', 'plural': 'pl', 'dual': 'du',
    'masculine': 'm', 'feminine': 'f', 'neuter': 'n',
    'masc': 'm', 'fem': 'f', 'neut': 'n',
    '1st person singular': '1sg', '2nd person singular': '2sg', '3rd person singular': '3sg',
    'first-person singular': '1sg', 'second-person singular': '2sg', 'third-person singular': '3sg',
    '1st person dual': '1du', '2nd person dual': '2du', '3rd person dual': '3du',
    '1st person plural': '1pl', '2nd person plural': '2pl', '3rd person plural': '3pl',
    'first-person plural': '1pl', 'second-person plural': '2pl', 'third-person plural': '3pl',
    '1sg': '1sg', '2sg': '2sg', '3sg': '3sg',
    '1du': '1du', '2du': '2du', '3du': '3du',
    '1pl': '1pl', '2pl': '2pl', '3pl': '3pl',
    '单数': 'sg', '复数': 'pl', '双数': 'du',
    '阳性': 'm', '阴性': 'f', '中性': 'n'
}

const ROW_KEY_MAP = {
    'nominative': 'nom', 'genitive': 'gen', 'dative': 'dat',
    'accusative': 'acc', 'ablative': 'abl', 'vocative': 'voc',
    'locative': 'loc', 'instrumental': 'ins',
    'present': 'pres', 'future': 'fut', 'perfect': 'perf',
    'imperfect': 'impf', 'aorist': 'aor', 'past': 'past',
    'active': 'act', 'passive': 'pass', 'middle': 'mid',
    'indicative': 'ind', 'subjunctive': 'subj', 'imperative': 'imp',
    'participle': 'part',
    '主格': 'nom', '属格': 'gen', '与格': 'dat',
    '宾格': 'acc', '夺格': 'abl', '呼格': 'voc',
    '位格': 'loc', '工具格': 'ins', '离格': 'abl'
}

/* ---------------- HTTP ---------------- */

async function apiGet(params) {
    const url = new URL(API)
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
    }
    url.searchParams.set('origin', '*')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Wiktionary HTTP ${res.status}`)
    return res.json()
}

async function fetchWikitext(lemma) {
    const data = await apiGet({
        action: 'query',
        titles: lemma,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        format: 'json',
        formatversion: '2',
        redirects: '1'
    })

    const page = data?.query?.pages?.[0]
    if (!page || page.missing) return null
    return page.revisions?.[0]?.slots?.main?.content ?? null
}

async function fetchParsedHtml(lemma) {
    const data = await apiGet({
        action: 'parse',
        page: lemma,
        prop: 'text',
        format: 'json',
        formatversion: '2',
        redirects: '1',
        disableeditsection: '1'
    })
    if (data?.error) return null
    return data?.parse?.text ?? null
}

/* ---------------- wikitext 解析 ---------------- */

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractLanguageSection(wikitext, langName) {
    const startRe = new RegExp(
        `^==+\\s*${escapeRegex(langName)}\\s*==+\\s*$`,
        'im'
    )
    const m = wikitext.match(startRe)
    if (!m) return null

    const start = m.index + m[0].length
    const rest = wikitext.slice(start)

    // 找下一个 h2 级标题（== xxx ==），不匹配 h3（=== xxx ===）
    const endRe = /^==[^=]/m
    const endM = rest.match(endRe)
    const end = endM ? endM.index : rest.length

    return rest.slice(0, end)
}

function extractPosSections(langSection) {
    const re = /^(===+)\s*([^=\n]+?)\s*\1\s*$/gm
    const marks = []
    let m = re.exec(langSection)
    while (m !== null) {
        marks.push({ title: m[2].trim(), index: m.index, end: re.lastIndex })
        m = re.exec(langSection)
    }
    const out = []
    for (let i = 0; i < marks.length; i++) {
        const start = marks[i].end
        const end = i + 1 < marks.length ? marks[i + 1].index : langSection.length
        out.push({ pos: marks[i].title, content: langSection.slice(start, end).trim() })
    }
    return out
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

function parseExample(raw) {
    const cleaned = stripWikiMarkup(raw)
    if (!cleaned) return null

    let original = cleaned
    let translation = ''
    let citation = ''

    const dashSplit = cleaned.split(/\s*[—–]\s*/)
    if (dashSplit.length >= 2) {
        original = dashSplit[0].trim()
        let rest = dashSplit.slice(1).join(' — ').trim()

        const citeMatch = rest.match(/\(([^()]+)\)\s*$/)
        if (citeMatch) {
            citation = citeMatch[1].trim()
            rest = rest.slice(0, citeMatch.index).trim()
        }
        translation = rest
    }

    return { text: original, translation, citation, source: 'wiktionary' }
}

function extractMeanings(posContent) {
    const meanings = []
    const examples = []
    const lines = posContent.split('\n')
    let cur = null

    for (const line of lines) {
        const t = line.trim()

        // 释义：以 # 开头，但排除 #: / #* / #! 等子层
        if (/^#[^*:!]/.test(t)) {
            const text = stripWikiMarkup(t.replace(/^#\s*/, ''))
            if (text) {
                cur = { text, examples: [] }
                meanings.push(cur)
            }
        } else if (/^#:/.test(t) && cur) {
            const ex = parseExample(t.replace(/^#:\s*/, ''))
            if (ex) {
                examples.push(ex)
                cur.examples.push(ex)
            }
        }
    }
    return { meanings, examples }
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

/* ---------------- HTML 表格解析 ---------------- */

function normalizeHeader(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[()[\]{}:：]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function tableToParadigm(tableEl) {
    const allRows = Array.from(tableEl.querySelectorAll('tr'))
    if (allRows.length < 2) return null

    // 找表头行（前 3 行内第一个含 ≥2 个 th 的行）
    let headerRow = null
    let headerIdx = -1
    for (let i = 0; i < Math.min(3, allRows.length); i++) {
        const ths = allRows[i].querySelectorAll('th')
        if (ths.length >= 2) {
            headerRow = allRows[i]
            headerIdx = i
            break
        }
    }
    if (!headerRow) return null

    const headerCells = Array.from(headerRow.children)
    const headerTexts = headerCells.map((c) => normalizeHeader(c.textContent))

    // 判断表头第一列是不是角标（如空、或 "case"/"number"）
    const firstKey = COL_KEY_MAP[headerTexts[0]]
    const hasCorner = !firstKey
    const colOffset = hasCorner ? 1 : 0

    const colKeys = headerTexts.slice(colOffset).map((t) => COL_KEY_MAP[t] || null)
    if (colKeys.filter(Boolean).length < 1) return null

    const paradigm = {}
    const inflections = []

    for (let i = headerIdx + 1; i < allRows.length; i++) {
        const row = allRows[i]
        const cells = Array.from(row.children)
        if (cells.length === 0) continue

        let rowLabel = ''
        let dataCells = cells

        if (cells[0].tagName === 'TH') {
            rowLabel = normalizeHeader(cells[0].textContent)
            dataCells = cells.slice(1)
        }

        const rowKey = rowLabel ? ROW_KEY_MAP[rowLabel] : null

        if (rowKey) {
            const rowData = {}
            for (let j = 0; j < dataCells.length && j < colKeys.length; j++) {
                const colKey = colKeys[j]
                if (!colKey) continue
                const text = stripWikiMarkup(dataCells[j].textContent)
                if (text) rowData[colKey] = text
            }
            if (Object.keys(rowData).length) paradigm[rowKey] = rowData
        } else if (rowLabel) {
            for (let j = 0; j < dataCells.length; j++) {
                const text = stripWikiMarkup(dataCells[j].textContent)
                if (text) {
                    inflections.push({
                        group: '',
                        label: rowLabel,
                        form: text,
                        source: 'wiktionary'
                    })
                }
            }
        }
    }

    if (Object.keys(paradigm).length === 0 && inflections.length === 0) return null
    return { paradigm, inflections }
}

function getHeadingInfo(el) {
    const clone = el.cloneNode(true)
    clone.querySelectorAll('.mw-editsection, .mw-editsection-like').forEach((n) => n.remove())

    if (el.classList && el.classList.contains('mw-heading')) {
        const h = el.querySelector('h2, h3, h4, h5')
        if (h) return { level: parseInt(h.tagName[1], 10), text: clone.textContent.trim() }
    }
    if (/^H[2-5]$/.test(el.tagName)) {
        return { level: parseInt(el.tagName[1], 10), text: clone.textContent.trim() }
    }
    return null
}

function extractParadigmFromHtml(html, langName, wikiPosTitle) {
    if (!html) return null
    const doc = new DOMParser().parseFromString(html, 'text/html')

    const content = doc.querySelector('.mw-parser-output') || doc.body
    const children = Array.from(content.children)

    // 找语言 h2
    let langStart = -1
    for (let i = 0; i < children.length; i++) {
        const h = getHeadingInfo(children[i])
        if (h && h.level === 2 && h.text === langName) {
            langStart = i
            break
        }
    }
    if (langStart === -1) return null

    // 语言 section 内找词性 h3
    let posStart = -1
    for (let i = langStart + 1; i < children.length; i++) {
        const h = getHeadingInfo(children[i])
        if (h && h.level === 2) break
        if (h && h.level === 3 && h.text === wikiPosTitle) {
            posStart = i
            break
        }
    }
    if (posStart === -1) return null

    // 收集 posStart 之后、下一个 h2/h3 之前的所有 table
    const tables = []
    for (let i = posStart + 1; i < children.length; i++) {
        const h = getHeadingInfo(children[i])
        if (h && (h.level === 2 || h.level === 3)) break

        const el = children[i]
        if (el.tagName === 'TABLE') tables.push(el)
        else {
            const inner = el.querySelectorAll('table')
            for (const t of inner) tables.push(t)
        }
    }

    if (tables.length === 0) return null

    const merged = { paradigm: {}, inflections: [] }
    for (const table of tables) {
        const result = tableToParadigm(table)
        if (!result) continue
        Object.assign(merged.paradigm, result.paradigm)
        merged.inflections.push(...result.inflections)
        if (Object.keys(merged.paradigm).length > 0) break
    }

    const hasData = Object.keys(merged.paradigm).length > 0 || merged.inflections.length > 0
    return hasData ? merged : null
}

/* ---------------- 主入口 ---------------- */

export async function lookupWord(lemma, langCode) {
    const trimmed = String(lemma || '').trim()
    if (!trimmed) throw new Error('基本形态为空')

    const wikiLang = LANG_TO_WIKTIONARY[langCode]
    if (!wikiLang) throw new Error(`不支持的语言：${langCode}`)

    const [wikitext, html] = await Promise.all([
        fetchWikitext(trimmed),
        fetchParsedHtml(trimmed).catch(() => null)
    ])

    if (!wikitext) return null

    const langSection = extractLanguageSection(wikitext, wikiLang)
    if (!langSection) return null

    const posSections = extractPosSections(langSection)
    if (posSections.length === 0) return null

    const results = []
    for (const sec of posSections) {
        const pos = POS_MAP[sec.pos]
        if (!pos) continue

        const { meanings, examples } = extractMeanings(sec.content)
        if (meanings.length === 0) continue

        const templates = extractTemplates(sec.content)

        let paradigmData = null
        try {
            paradigmData = extractParadigmFromHtml(html, wikiLang, sec.pos)
        } catch (err) {
            console.warn('[wiktionary] 表格解析失败', err)
        }

        results.push({
            language: langCode,
            lemma: trimmed,
            pos,
            wikiPos: sec.pos,
            inflectionType: { label: sec.pos, grammarRef: null },
            meanings: meanings.map((m) => ({
                text: m.text, lang: 'en', source: 'wiktionary'
            })),
            examples: examples.map((e) => ({
                text: e.text, translation: e.translation,
                citation: e.citation, source: 'wiktionary'
            })),
            paradigm: paradigmData?.paradigm || {},
            inflections: paradigmData?.inflections || [],
            templates
        })
    }

    if (results.length === 0) return null
    return results
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
 *     examples,       // Word.examples 格式
 *     paradigm,       // 建议合并到 data.paradigm.main
 *     inflections,    // 建议追加到 data.inflections
 *     summary         // 提示文案
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

    let picked = results.find((r) => r.pos === preferredPos)
    if (!picked) picked = results[0]

    const meanings = (picked.meanings || []).map((m) => ({
        text: m.text,
        lang: m.lang || 'en',
        source: 'wiktionary'
    }))

    const examples = (picked.examples || []).map((e) => ({
        text: e.text,
        translation: e.translation || '',
        citation: e.citation || '',
        source: 'wiktionary'
    }))

    const paradigm = picked.paradigm || {}
    const inflections = (picked.inflections || []).map((it) => ({
        group: it.group || '',
        label: it.label || '',
        form: it.form || '',
        source: 'wiktionary'
    }))

    const parts = [`词性 ${picked.pos}`]
    if (meanings.length) parts.push(`${meanings.length} 条释义`)
    if (examples.length) parts.push(`${examples.length} 条例句`)
    if (Object.keys(paradigm).length) parts.push('含变格/变位表')
    if (inflections.length) parts.push(`${inflections.length} 条补充形式`)

    return {
        pos: picked.pos,
        meanings,
        examples,
        paradigm,
        inflections,
        summary: parts.join(' · ')
    }
}
