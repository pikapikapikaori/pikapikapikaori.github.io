/** 笔记的单行 Markdown 与少量 HTML。块就是行；表格与引用由相邻几行组合。 */

import { h, htmlFragment } from './dom.js'
import { annotateBdi } from './bdi.js'
import { checkMarkIcon } from '../components/icons.js'
import { splitRow } from './markdown.js'

const HEADING = /^(#{1,6})\s+(.*)$/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const CHECK = /^[-*+]\s+\[([ xX])\]\s*(.*)$/
const BULLET = /^[-*+]\s+(.*)$/
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
const IMAGE_ONLY = /^!\[([^\]]*)\]\(([^)\s]+)\)$/
const DETAILS_LINE = /^<(details|summary)\b/i

const PIPE_START = /^\s*\|/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/

/** 一级缩进几个空格 */
export const INDENT_WIDTH = 2

/** 行首缩进，原样取（可能含制表符） */
export function leadingIndent(source) {
    const m = /^[ \t]*/.exec(String(source ?? ''))
    return m ? m[0] : ''
}

/** 第几级缩进：制表符按两个空格算 */
export function indentLevel(source) {
    return Math.floor(leadingIndent(source).replace(/\t/g, '  ').length / INDENT_WIDTH)
}

/** 这一行是什么块，以及它在第几级缩进里 */
export function lineInfo(source) {
    const raw = String(source ?? '')
    const level = indentLevel(raw)
    const text = raw.slice(leadingIndent(raw).length).trim()
    if (CHECK.test(text)) return { kind: 'todo', level }
    if (BULLET.test(text)) return { kind: 'ul', level }
    if (NUMBERED.test(text)) return { kind: 'ol', level }
    return { kind: 'none', level }
}

export function isPipeLine(source) {
    return PIPE_START.test(String(source ?? ''))
}

export function isTableSeparator(source) {
    const text = String(source ?? '').trim()
    return text.startsWith('|') && TABLE_SEP.test(text)
}

export function isQuoteLine(source) {
    return QUOTE.test(String(source ?? '').replace(/^[ \t]+/, ''))
}

/** 只放行能安全显示的地址：网页、内嵌图片、相对路径。其它协议一律当作普通文字 */
function safeUrl(raw) {
    const url = String(raw ?? '').trim()
    if (!url) return null
    if (/^https?:\/\//i.test(url)) return url
    if (/^data:image\//i.test(url)) return url
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null
    if (/^[\\/]{2}/.test(url)) return null
    return url
}

/** 行内记号。每次调用新建正则：inline() 会递归，共用实例会串 lastIndex */
const INLINE_SOURCE = [
    '(<bdi[^>]*>[^<]*<\\/bdi>)',
    '(<kbd>[^<]*<\\/kbd>)',
    '(<u>[^<]*<\\/u>)',
    '(<s>[^<]*<\\/s>)',
    '(<del>[^<]*<\\/del>)',
    '(<ins>[^<]*<\\/ins>)',
    '(<mark>[^<]*<\\/mark>)',
    '(<br\\s*\\/?>)',
    '(`[^`\\n]+`)',
    '(!\\[[^\\]\\n]*\\]\\([^)\\s]+\\))',
    '(\\[[^\\]\\n]+\\]\\([^)\\s]+\\))',
    '(\\*\\*[^*\\n]+\\*\\*)',
    '(~~[^~\\n]+~~)',
    '(\\*[^*\\n]+\\*)',
    '((?<![\\p{L}\\p{N}])_[^_\\n]+_(?![\\p{L}\\p{N}]))'
].join('|')

/**
 * 渲染一行。
 * @param {string} source 这一行的原文
 * @param {object} [opts]
 * @param {string} [opts.lang] 笔记的语言，用来给 <bdi> 补 lang 与 dir
 * @param {string} [opts.placeholder] 空行时显示的灰字
 * @param {{ label: string } | null} [opts.marker] 列表序号的文字，由视图算好传进来
 * @returns {Element}
 */
export function renderNoteLine(source, { lang = null, placeholder = '', marker = null } = {}) {
    const raw = String(source ?? '')
    const level = indentLevel(raw)
    const text = raw.slice(leadingIndent(raw).length).trim()

    const el = (!text && !marker)
        ? blankLine(placeholder)
        : buildLine(text, level, marker)

    annotateBdi(el, lang)
    return el
}

function blankLine(placeholder) {
    const blank = h('div', { class: 'note-line note-line--blank' })
    if (placeholder) blank.appendChild(h('span', { class: 'note-line__hint' }, placeholder))
    return blank
}

function buildLine(text, level, marker) {
    if (!text) return h('div', { class: 'note-line note-line--blank' })

    if (RULE.test(text)) return h('hr', { class: 'note-line note-rule' })

    const heading = HEADING.exec(text)
    if (heading) {
        const size = Math.min(6, heading[1].length)
        return h(`h${size}`, {
            class: 'note-line note-h',
            dataset: { level: String(size) }
        }, ...inline(heading[2]))
    }

    if (DETAILS_LINE.test(text)) {
        return h('div', { class: 'note-line note-details' }, htmlFragment(text))
    }

    const image = IMAGE_ONLY.exec(text)
    if (image) {
        const src = safeUrl(image[2])
        if (src) {
            return h('figure', { class: 'note-line note-figure' },
                h('img', { src, alt: image[1], loading: 'lazy' }),
                image[1] ? h('figcaption', {}, ...inline(image[1])) : null
            )
        }
    }

    const check = CHECK.exec(text)
    if (check) {
        const done = check[1] !== ' '
        return itemNode('todo', level, null, check[2], { done })
    }

    const quote = QUOTE.exec(text)
    if (quote) return h('blockquote', { class: 'note-line note-quote' }, ...inline(quote[1]))

    const bullet = BULLET.exec(text)
    if (bullet) return itemNode('ul', level, marker ? marker.label : '•', bullet[1])

    const numbered = NUMBERED.exec(text)
    if (numbered) {
        const label = marker ? marker.label : '1.'
        return itemNode('ol', level, label, numbered[1])
    }

    return h('p', { class: 'note-line note-p' }, ...inline(text))
}

function itemNode(kind, level, label, content, { done = false } = {}) {
    const el = h('div', {
        class: `note-line note-item note-item--${kind}`,
        dataset: { level: String(level) },
        style: level ? { paddingLeft: `${level * 1.6}em` } : null
    })

    if (kind === 'todo') {
        el.dataset.done = done ? 'true' : 'false'
        el.append(
            h('button', {
                class: 'note-check',
                type: 'button',
                role: 'checkbox',
                'aria-checked': done ? 'true' : 'false',
                'aria-label': content || '待办'
            }, done ? checkMarkIcon() : null),
            h('span', { class: 'note-item__text' }, ...inline(content))
        )
        return el
    }

    el.append(
        h('span', { class: 'note-item__mark' }, label),
        h('span', { class: 'note-item__text' }, ...inline(content))
    )
    return el
}

/**
 * 把连续的引用行合成段落：行尾写 `\` 表示下一行接着这一行。
 * @returns {string[]}
 */
export function renderNoteQuote(lines) {
    const out = []
    let open = false
    for (const line of lines) {
        const body = String(line ?? '').replace(/^[ \t]*>\s?/, '')
        const joined = /\\\s*$/.test(body)
        const clean = body.replace(/\\\s*$/, '')
        if (open && out.length) out[out.length - 1] += `\n${clean}`
        else out.push(clean)
        open = joined
    }
    return out
}

/**
 * 把连续的竖线行合成一张表。第一行是表头，第二行是对齐行。
 * @param {Array<{ id: string, source: string }>} blocks
 */
export function renderNoteTable(blocks, { lang = null } = {}) {
    const lines = blocks.map((block) => String(block.source ?? ''))
    const ids = blocks.map((block) => block.id || '')
    const header = splitRow(lines[0] || '')
    const aligns = splitRow(lines[1] || '').map((cell) => {
        const left = cell.startsWith(':')
        const right = cell.endsWith(':')
        if (left && right) return 'center'
        if (right) return 'right'
        if (left) return 'left'
        return null
    })

    const table = h('table', { class: 'note-table doc-table' })
    const headRow = h('tr', { dataset: { id: ids[0] } })
    header.forEach((cell, i) => {
        headRow.appendChild(h('th', { class: alignClass(aligns[i]) }, ...inline(cell)))
    })
    table.appendChild(h('thead', {}, headRow))

    const tbody = h('tbody')
    for (let i = 2; i < lines.length; i++) {
        const cells = splitRow(lines[i])
        const tr = h('tr', { dataset: { id: ids[i] } })
        header.forEach((_, c) => {
            tr.appendChild(h('td', { class: alignClass(aligns[c]) }, ...inline(cells[c] ?? '')))
        })
        tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    const wrap = h('div', { class: 'doc-table-wrap' }, table)
    annotateBdi(wrap, lang)
    return wrap
}

function alignClass(align) {
    return align && align !== 'left' ? `doc-cell--${align}` : null
}

function inline(text) {
    const out = []
    const source = String(text ?? '')
    const re = new RegExp(INLINE_SOURCE, 'gu')
    let last = 0
    for (;;) {
        const m = re.exec(source)
        if (!m) break
        if (m.index > last) out.push(source.slice(last, m.index))
        out.push(tokenNode(m[0]))
        last = m.index + m[0].length
    }
    if (last < source.length) out.push(source.slice(last))
    return out
}

function tokenNode(token) {
    if (token.startsWith('<bdi')) return bdiNode(token)
    if (token.startsWith('<kbd>')) return h('kbd', { text: token.slice(5, -6) })
    if (token.startsWith('<u>')) return h('u', {}, ...inline(token.slice(3, -4)))
    if (token.startsWith('<s>')) return h('s', {}, ...inline(token.slice(3, -4)))
    if (token.startsWith('<del>')) return h('del', {}, ...inline(token.slice(5, -6)))
    if (token.startsWith('<ins>')) return h('ins', {}, ...inline(token.slice(5, -6)))
    if (token.startsWith('<mark>')) return h('mark', {}, ...inline(token.slice(6, -7)))
    if (/^<br/i.test(token)) return h('br')
    if (token.startsWith('`')) return h('code', { class: 'note-code' }, token.slice(1, -1))
    if (token.startsWith('![')) return imageNode(token)
    if (token.startsWith('[')) return linkNode(token)
    if (token.startsWith('**')) return h('strong', {}, ...inline(token.slice(2, -2)))
    if (token.startsWith('~~')) return h('s', {}, ...inline(token.slice(2, -2)))
    if (token.startsWith('*') || token.startsWith('_')) {
        return h('em', {}, ...inline(token.slice(1, -1)))
    }
    return document.createTextNode(token)
}

/** `<bdi lang="sa" dir="rtl">原文</bdi>`：没写属性的由 annotateBdi 按文字补 */
function bdiNode(token) {
    const m = /^<bdi([^>]*)>([\s\S]*)<\/bdi>$/u.exec(token)
    if (!m) return document.createTextNode(token)
    const lang = (/lang="([^"]*)"/.exec(m[1]) || [])[1] || undefined
    const dir = (/dir="([^"]*)"/.exec(m[1]) || [])[1] || undefined
    return h('bdi', { lang, dir }, m[2])
}

function imageNode(token) {
    const m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(token)
    const src = m && safeUrl(m[2])
    if (!src) return document.createTextNode(token)
    return h('img', { class: 'note-img', src, alt: m[1], loading: 'lazy' })
}

function linkNode(token) {
    const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
    if (!m) return document.createTextNode(token)
    const label = inline(m[1])
    const href = m[2]
    if (/^https?:/i.test(href) || /^mailto:/i.test(href)) {
        return h('a', { class: 'note-link', href, target: '_blank', rel: 'noopener noreferrer' }, ...label)
    }
    if (href.startsWith('#') || href.startsWith('.')) {
        return h('a', { class: 'note-link', href }, ...label)
    }
    return h('span', { class: 'note-link note-link--plain' }, ...label)
}
