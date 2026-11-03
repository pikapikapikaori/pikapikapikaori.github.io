/**
 * 极简 Markdown → DOM：只覆盖文档里真正用到的子集
 * （标题 / 段落 / 有序无序列表（含嵌套）/ 表格 / 围栏代码 / 引用 / 分隔线 / 行内 code 与强调与链接）。
 *
 * 全程构造 DOM 节点，不拼 innerHTML。标题 id 按 GitHub 的 slug 规则生成，
 * 这样 SCHEMA.md 里原有的 `[文字](#锚点)` 链接不用改写就能继续用。
 */

import { h } from './dom.js'

const FENCE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const LIST_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/
const QUOTE_LINE = /^\s*>\s?/

/** GitHub 风格的标题 slug：去标点、空格转连字符、保留中日韩文字 */
export function slugify(text) {
    return String(text)
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s+/g, '-')
}

/**
 * 预扫标题（不建 DOM）：目录与跨篇锚点解析都用它，和渲染时分配的 id 完全一致。
 * @returns {Array<{ level: number, id: string, text: string }>}
 */
export function scanHeadings(source) {
    const used = new Set()
    const out = []
    let fenced = false
    for (const line of String(source ?? '').replace(/\r\n?/g, '\n').split('\n')) {
        if (FENCE.test(line)) { fenced = !fenced; continue }
        if (fenced) continue
        const m = HEADING.exec(line)
        if (!m) continue
        const text = plainText(m[2])
        let id = slugify(text) || 'section'
        if (used.has(id)) {
            let n = 2
            while (used.has(`${id}-${n}`)) n += 1
            id = `${id}-${n}`
        }
        used.add(id)
        out.push({ level: m[1].length, id, text })
    }
    return out
}

/**
 * @param {string} source Markdown 原文
 * @param {{ onHeading?: (info: { level: number, id: string, text: string }) => void }} options
 * @returns {DocumentFragment}
 */
export function renderMarkdown(source, { onHeading = null } = {}) {
    const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n')
    const ctx = { headings: scanHeadings(source), next: 0, onHeading }
    const frag = document.createDocumentFragment()

    let i = 0
    while (i < lines.length) {
        i = parseBlock(lines, i, frag, ctx)
    }
    return frag
}

/* ---------------- 块级 ---------------- */

function parseBlock(lines, i, parent, ctx) {
    const line = lines[i]
    if (!line.trim()) return i + 1

    const fence = FENCE.exec(line)
    if (fence) return parseFence(lines, i, parent, fence[1])

    const heading = HEADING.exec(line)
    if (heading) {
        const level = heading[1].length
        const el = headingEl(level, heading[2], ctx)
        parent.appendChild(el)
        return i + 1
    }

    if (HR.test(line)) {
        parent.appendChild(h('hr', { class: 'doc-rule' }))
        return i + 1
    }

    if (QUOTE_LINE.test(line)) return parseQuote(lines, i, parent, ctx)

    if (isTableStart(lines, i)) return parseTable(lines, i, parent)

    if (LIST_ITEM.test(line)) return parseList(lines, i, parent, ctx)

    return parseParagraph(lines, i, parent, ctx)
}

function headingEl(level, rawText, ctx) {
    const info = ctx.headings[ctx.next] || { level, text: plainText(rawText), id: slugify(plainText(rawText)) }
    ctx.next += 1

    const tag = `h${Math.min(6, level)}`
    const el = h(tag, { id: info.id, class: 'doc-heading' }, ...inline(rawText))
    el.dataset.level = String(level)
    if (typeof ctx.onHeading === 'function') ctx.onHeading(info)
    return el
}

function parseFence(lines, i, parent, marker) {
    const lang = FENCE.exec(lines[i])[2]
    const body = []
    let j = i + 1
    while (j < lines.length && !lines[j].trim().startsWith(marker)) {
        body.push(lines[j])
        j += 1
    }
    const code = h('code', { text: body.join('\n') })
    if (lang) code.dataset.lang = lang
    parent.appendChild(h('pre', { class: 'doc-code' }, code))
    return j + 1
}

function parseQuote(lines, i, parent, ctx) {
    const inner = []
    let j = i
    while (j < lines.length && QUOTE_LINE.test(lines[j])) {
        inner.push(lines[j].replace(QUOTE_LINE, ''))
        j += 1
    }
    const box = h('blockquote', { class: 'doc-quote' })
    let k = 0
    while (k < inner.length) k = parseBlock(inner, k, box, ctx)
    parent.appendChild(box)
    return j
}

function isTableStart(lines, i) {
    return /^\s*\|/.test(lines[i] || '') && TABLE_SEP.test(lines[i + 1] || '')
}

function parseTable(lines, i, parent) {
    const header = splitRow(lines[i])
    const aligns = splitRow(lines[i + 1]).map((cell) => {
        const left = cell.startsWith(':')
        const right = cell.endsWith(':')
        if (left && right) return 'center'
        if (right) return 'right'
        if (left) return 'left'
        return null
    })

    const table = h('table', { class: 'doc-table' })
    const thead = h('thead')
    const headRow = h('tr')
    header.forEach((cell, idx) => {
        const th = h('th', { class: alignClass(aligns[idx]) }, ...inline(cell))
        headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = h('tbody')
    let j = i + 2
    while (j < lines.length && /^\s*\|/.test(lines[j])) {
        const row = h('tr')
        splitRow(lines[j]).forEach((cell, idx) => {
            row.appendChild(h('td', { class: alignClass(aligns[idx]) }, ...inline(cell)))
        })
        tbody.appendChild(row)
        j += 1
    }
    table.appendChild(tbody)
    parent.appendChild(h('div', { class: 'doc-table-wrap' }, table))
    return j
}

function splitRow(line) {
    let text = line.trim()
    if (text.startsWith('|')) text = text.slice(1)
    if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1)
    // 单元格里的 `\|` 是转义的竖线，先占位再切分
    return text
        .replace(/\\\|/g, '\u0000')
        .split('|')
        .map((cell) => cell.replace(/\u0000/g, '|').trim())
}

function alignClass(align) {
    return align && align !== 'left' ? `doc-cell--${align}` : null
}

function parseList(lines, i, parent, ctx) {
    const first = LIST_ITEM.exec(lines[i])
    const baseIndent = first[1].length
    const ordered = /\d/.test(first[2])
    const list = h(ordered ? 'ol' : 'ul', { class: 'doc-list' })

    let j = i
    while (j < lines.length) {
        const m = LIST_ITEM.exec(lines[j])
        if (!m || m[1].length !== baseIndent || /\d/.test(m[2]) !== ordered) break

        const body = [m[3]]
        j += 1
        // 续行 / 子列表：缩进比本级更深的都算这个条目里的内容
        while (j < lines.length) {
            const line = lines[j]
            if (!line.trim()) {
                const next = lines[j + 1] ?? ''
                const nextItem = LIST_ITEM.exec(next)
                const deeper = (nextItem && nextItem[1].length > baseIndent)
                    || (!nextItem && leadingSpaces(next) > baseIndent && next.trim() !== '')
                if (!deeper) break
                body.push('')
                j += 1
                continue
            }
            const ind = leadingSpaces(line)
            if (ind > baseIndent) {
                body.push(line.slice(Math.min(ind, baseIndent + 2)))
                j += 1
                continue
            }
            break
        }

        const li = h('li')
        li.replaceChildren(...inline(body[0]))
        const rest = body.slice(1)
        while (rest.length && !rest[0].trim()) rest.shift()
        if (rest.length) {
            let k = 0
            while (k < rest.length) k = parseBlock(rest, k, li, ctx)
        }
        list.appendChild(li)
    }

    parent.appendChild(list)
    return j
}

function parseParagraph(lines, i, parent, ctx) {
    const buf = []
    let j = i
    while (j < lines.length) {
        const line = lines[j]
        if (!line.trim()) break
        if (buf.length && startsBlock(lines, j)) break
        buf.push(line.trim())
        j += 1
    }
    parent.appendChild(h('p', { class: 'doc-p' }, ...inline(buf.join('\n'))))
    return j
}

function startsBlock(lines, i) {
    const line = lines[i]
    return FENCE.test(line) || HEADING.test(line) || HR.test(line)
        || QUOTE_LINE.test(line) || LIST_ITEM.test(line) || isTableStart(lines, i)
}

function leadingSpaces(line) {
    const m = /^ */.exec(line)
    return m ? m[0].length : 0
}

/* ---------------- 行内 ---------------- */

/** 行内记号：每次调用都新建正则 —— inline() 会递归，共用同一个实例会串 lastIndex */
const INLINE_SOURCE = '(`[^`\\n]+`)|(\\*\\*[^*\\n]+\\*\\*)|(\\*[^*\\n]+\\*)|(\\[[^\\]\\n]+\\]\\([^)\\s]+\\))'

function inline(text) {
    const out = []
    const source = String(text ?? '')
    const re = new RegExp(INLINE_SOURCE, 'g')
    let last = 0
    let m = null
    for (;;) {
        m = re.exec(source)
        if (!m) break
        if (m.index > last) out.push(source.slice(last, m.index))
        const token = m[0]
        if (token.startsWith('`')) {
            out.push(h('code', { class: 'doc-inline-code', text: token.slice(1, -1) }))
        } else if (token.startsWith('**')) {
            out.push(h('strong', {}, ...inline(token.slice(2, -2))))
        } else if (token.startsWith('*')) {
            out.push(h('em', {}, ...inline(token.slice(1, -1))))
        } else {
            out.push(linkEl(token))
        }
        last = m.index + token.length
    }
    if (last < source.length) out.push(source.slice(last))
    return out
}

function linkEl(token) {
    const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
    if (!m) return document.createTextNode(token)
    const label = inline(m[1])
    const href = m[2]

    // 站外链接新窗口打开；页内锚点交给视图处理（可能指向另一篇）
    if (/^https?:/i.test(href) || /^mailto:/i.test(href)) {
        return h('a', { class: 'doc-link', href, target: '_blank', rel: 'noopener noreferrer' }, ...label)
    }
    if (href.startsWith('#')) {
        return h('a', { class: 'doc-link', href, dataset: { anchor: href.slice(1) } }, ...label)
    }
    // 相对路径的文件链接在应用里没有去处：只留文字
    return h('span', { class: 'doc-link doc-link--plain' }, ...label)
}

/** 去掉行内标记，用于标题文字与 slug */
function plainText(text) {
    return String(text)
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\*\*([^*]*)\*\*/g, '$1')
        .replace(/\*([^*]*)\*/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .trim()
}
