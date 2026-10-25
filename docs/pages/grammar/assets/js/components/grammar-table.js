import { h, htmlFragment } from '../utils/dom.js'
import { createTabBar } from './tabs.js'
import { applyBdi } from '../utils/bdi.js'

const EMPTY_CELL = /^\s*(?:[—–-]|)\s*$/u

/**
 * 单元格是否「没有内容」：空字符串或只有占位破折号。
 * 「—」表示该形式不存在（如 Piel 没有命令式），全空的行/列要整块隐藏。
 */
function cellText(value) {
    return value && typeof value === 'object' ? String(value.text ?? '') : String(value ?? '')
}

/** 单元格可以是字符串，也可以是 { text, disabled }（disabled 表示该形式不存在） */
function cellDisabled(value) {
    return !!(value && typeof value === 'object' && value.disabled === true)
}

function isEmptyCell(value) {
    if (cellDisabled(value)) return false
    return EMPTY_CELL.test(cellText(value))
}

/** 去掉标签、压平空白，用来比较「表名」和它周围的标题是否重复 */
function plainText(value) {
    return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/** 语法表格：caption / headers / rows / lang（单元格语言），空/— 的行与列整块隐藏 */
export function createGrammarTable(spec) {
    if (!spec || !Array.isArray(spec.headers) || !Array.isArray(spec.rows)) {
        return null
    }
    const lang = spec.lang || null
    const headers = spec.headers.map((x) => String(x ?? ''))

    // 表名与上方的条目标题 / 首列表头是同一个词时不再重复
    const captionText = plainText(spec.caption)
    const hideCaption = !captionText
        || captionText === plainText(spec.ownerTitle)
        || captionText === plainText(headers[0])

    // 首列是行标题，永远保留；其余列若每一行都是空/—就整列隐藏
    const keepCol = headers.map((_, index) => index === 0
        || spec.rows.some((row) => Array.isArray(row) && !isEmptyCell(row[index])))

    // 除了首列以外全是空/—的行整行隐藏；一张表全空就不渲染
    const rows = spec.rows.filter((row) => Array.isArray(row)
        && row.some((cell, index) => index > 0 && !isEmptyCell(cell)))
    if (!rows.length) return null

    // 首列不是短行标题（如「形式」「用法」）时，允许它折行并占一份宽度
    const wrapFirst = rows.some((row) => plainText(cellText(row[0])).length > 10)

    // 词形列平分剩余宽度：两列词形（如 ego / tū）时等分，避免短列被挤成一条缝。
    // 列更多时交给浏览器按内容分配，说明类长文本才有地方，必要时整表横向滚动。
    const formIndexes = keepCol.map((keep, index) => (keep && index > 0 ? index : -1))
        .filter((index) => index > 0)
    const formWidth = formIndexes.length && formIndexes.length <= 2 && !wrapFirst
        ? `${(99 / formIndexes.length).toFixed(2)}%`
        : null

    // 列数多，或某列是整句说明时，窄屏宁可横向滚动，也不把列压成一条缝
    const hasProse = rows.some((row) => row.some(
        (cell, index) => index > 0 && plainText(cellText(cell)).length > 24))
    const wide = keepCol.filter(Boolean).length >= 5 || hasProse

    const table = h('table', {
        class: 'grammar-table'
            + (wrapFirst ? ' grammar-table--wrap-first' : '')
            + (wide ? ' grammar-table--wide' : '')
    },
    hideCaption ? null : h('caption', {}, htmlFragment(spec.caption)),
    h('thead', {},
        h('tr', {},
            ...headers.map((th, index) => (keepCol[index]
                ? h('th', {
                    lang,
                    style: index > 0 && formWidth ? { width: formWidth } : null
                }, htmlFragment(th))
                : null)).filter(Boolean)
        )
    ),
    h('tbody', {},
        ...rows.map((row) =>
            h('tr', {},
                ...row.map((cell, index) => {
                    if (!keepCol[index]) return null
                    const off = cellDisabled(cell)
                    return h('td', {
                        lang,
                        class: off ? 'grammar-table__cell--disabled' : null
                    }, off ? (cellText(cell) || '—') : htmlFragment(cellText(cell)))
                }).filter(Boolean)
            )
        )
    )
    )

    applyBdi(table)

    // 列多时本容器横向滚动，避免整页被撑宽
    return h('div', { class: 'grammar-table-wrap' }, table)
}

/**
 * 一个条目的多张表：多张表时按表分 tab（带 group / groupLabel 时叠成两行 tab），只有一张时直接渲染。
 *
 * @param {object[]} tables 语法 JSON 里的 `item.tables`
 * @param {string}   lang   默认单元格语言（表自己带 `lang` 时优先）
 */
export function createGrammarTables(tables, lang = null, ownerTitle = '') {
    const entries = (tables || [])
        .map((spec) => ({
            spec,
            node: createGrammarTable({ ...spec, lang: spec.lang || lang, ownerTitle })
        }))
        .filter((entry) => entry.node)

    if (!entries.length) return null
    if (entries.length === 1) return entries[0].node

    const groups = []
    for (const entry of entries) {
        const key = entry.spec.group || ''
        let group = groups.find((g) => g.key === key)
        if (!group) {
            group = { key, label: entry.spec.groupLabel || '', items: [] }
            groups.push(group)
        }
        group.items.push(entry)
    }

    if (groups.length === 1 && groups[0].items.length === 1) return groups[0].items[0].node

    // 会被做成 tab 的表：标题已经在 tab 上了，表内不再重复一遍 caption
    for (const group of groups) {
        const tabbed = group.items.length > 1 && group.items.some((entry) => entry.spec.role === 'example')
        if (!tabbed) continue
        for (const entry of group.items) entry.node.querySelector('caption')?.remove()
    }

    let groupIndex = Math.max(0, groups.findIndex((g) => g.items.length))
    let tableIndex = 0

    const groupRow = h('div', { class: 'grammar-tabs__row' })
    const tableRow = h('div', { class: 'grammar-tabs__row' })
    const content = h('div', { class: 'grammar-tables' })

    function render() {
        const group = groups[groupIndex]
        // 有示例表配对时才按表分 tab；只有一堆同类表（如德语的几张变格表）仍旧按原样叠着放
        const tabbed = group.items.length > 1 && group.items.some((entry) => entry.spec.role === 'example')
        if (tableIndex >= group.items.length) tableIndex = 0

        groupRow.replaceChildren()
        if (groups.length > 1) {
            groupRow.appendChild(createTabBar({
                items: groups.map((g, index) => ({ key: String(index), label: g.label || `表 ${index + 1}` })),
                active: String(groupIndex),
                onChange: (key) => { groupIndex = Number(key); tableIndex = 0; render() },
                className: 'tab-bar--tables'
            }).el)
        }

        tableRow.replaceChildren()
        if (tabbed) {
            tableRow.appendChild(createTabBar({
                items: group.items.map((entry, index) => ({ key: String(index), label: tabLabelOf(entry.spec) })),
                active: String(tableIndex),
                onChange: (key) => { tableIndex = Number(key); render() },
                className: 'tab-bar--tables'
            }).el)
        }

        content.replaceChildren(...(tabbed ? [group.items[tableIndex].node] : group.items.map((entry) => entry.node)))
    }

    render()
    return h('div', { class: 'grammar-tabs' }, groupRow, tableRow, content)
}

/**
 * 表的 tab 名：示例表带上自己的例词（`示例表：דָּבָר`），其余叫「变化表」，
 * 表自己写了 `roleLabel` 时优先（如代词的后缀表）。
 */
function tabLabelOf(spec) {
    if (spec && spec.roleLabel) return String(spec.roleLabel)
    if (!spec || spec.role !== 'example') return '变化表'
    return spec.exampleWord ? `示例表：${spec.exampleWord}` : '示例表'
}

