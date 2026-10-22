import { h, htmlFragment } from '../utils/dom.js'
import { createTabBar } from './tabs.js'
import { applyBdi } from '../utils/bdi.js'

/**
 * 语法表格
 * @param {object} table
 *   caption?: string
 *   headers: string[]
 *   rows: string[][]
 *   lang?: string  单元格内容所用语言
 */
const EMPTY_CELL = /^\s*(?:[—–-]|)\s*$/u

/**
 * 单元格是否「没有内容」：空字符串或只有占位破折号。
 * 「—」表示该形式不存在（如 Piel 没有命令式），全空的行/列要整块隐藏。
 */
function isEmptyCell(value) {
    return EMPTY_CELL.test(String(value ?? ''))
}

export function createGrammarTable(spec) {
    if (!spec || !Array.isArray(spec.headers) || !Array.isArray(spec.rows)) {
        return null
    }
    const lang = spec.lang || null
    const headers = spec.headers.map((x) => String(x ?? ''))

    // 首列是行标题，永远保留；其余列若每一行都是空/—就整列隐藏
    const keepCol = headers.map((_, index) => index === 0
        || spec.rows.some((row) => Array.isArray(row) && !isEmptyCell(row[index])))

    // 除了首列以外全是空/—的行整行隐藏；一张表全空就不渲染
    const rows = spec.rows.filter((row) => Array.isArray(row)
        && row.some((cell, index) => index > 0 && !isEmptyCell(cell)))
    if (!rows.length) return null

    const table = h('table', { class: 'grammar-table' },
        spec.caption ? h('caption', {}, htmlFragment(spec.caption)) : null,
        h('thead', {},
            h('tr', {},
                ...headers.map((th, index) => (keepCol[index]
                    ? h('th', { lang }, htmlFragment(th))
                    : null)).filter(Boolean)
            )
        ),
        h('tbody', {},
            ...rows.map((row) =>
                h('tr', {},
                    ...row.map((cell, index) => (keepCol[index]
                        ? h('td', { lang }, htmlFragment(cell ?? ''))
                        : null)).filter(Boolean)
                )
            )
        )
    )

    // 书写方向不同的文字（满文 / 希伯来文）按字符范围包进 <bdi>
    applyBdi(table)

    // 列多时本容器横向滚动，避免整页被撑宽
    return h('div', { class: 'grammar-table-wrap' }, table)
}

/**
 * 一个条目的多张表：用 tab 切换
 *
 * - 同一组里有多张表：一张表一个 tab（`示例表：<词>` / `变化表` / 表自己的 `roleLabel`）
 * - 多组（表对象带 `group` / `groupLabel`）：两行 tab，先选组再选表
 * - 只有一张表：直接渲染，不画 tab
 *
 * @param {object[]} tables  语法 JSON 里的 `item.tables`
 * @param {string}   lang    默认单元格语言（表自己带 `lang` 时优先）
 */
export function createGrammarTables(tables, lang = null) {
    const entries = (tables || [])
        .map((spec) => ({ spec, node: createGrammarTable({ ...spec, lang: spec.lang || lang }) }))
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

    // 只有一组、且组里只有一张表：不用 tab
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

