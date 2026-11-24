import { h } from '../utils/dom.js'
import { createTabBar } from './tabs.js'
import { annotateBdi, bdiFragment, stripBdi } from '../utils/bdi.js'

const EMPTY_CELL = /^\s*(?:[—–-]|)\s*$/u

function cellText(value) {
    return value && typeof value === 'object' ? String(value.text ?? '') : String(value ?? '')
}

function cellDisabled(value) {
    return !!(value && typeof value === 'object' && value.disabled === true)
}

function isEmptyCell(value) {
    if (cellDisabled(value)) return false
    return EMPTY_CELL.test(stripBdi(cellText(value)))
}

function plainText(value) {
    return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export function createGrammarTable(spec) {
    if (!spec || !Array.isArray(spec.headers) || !Array.isArray(spec.rows)) {
        return null
    }
    const lang = spec.lang || null
    const headers = spec.headers.map((x) => String(x ?? ''))

    const captionText = plainText(spec.caption)
    const hideCaption = !captionText
        || captionText === plainText(spec.ownerTitle)
        || captionText === plainText(headers[0])

    const keepCol = headers.map((_, index) => index === 0
        || spec.rows.some((row) => Array.isArray(row) && !isEmptyCell(row[index])))

    const rows = spec.rows.filter((row) => Array.isArray(row)
        && row.some((cell, index) => index > 0 && !isEmptyCell(cell)))
    if (!rows.length) return null

    const wrapFirst = rows.some((row) => plainText(cellText(row[0])).length > 10)

    const formIndexes = keepCol.map((keep, index) => (keep && index > 0 ? index : -1))
        .filter((index) => index > 0)
    const formWidth = formIndexes.length && formIndexes.length <= 2 && !wrapFirst
        ? `${(99 / formIndexes.length).toFixed(2)}%`
        : null

    const hasProse = rows.some((row) => row.some(
        (cell, index) => index > 0 && plainText(cellText(cell)).length > 24))
    const wide = keepCol.filter(Boolean).length >= 5 || hasProse

    const table = h('table', {
        class: 'grammar-table'
            + (wrapFirst ? ' grammar-table--wrap-first' : '')
            + (wide ? ' grammar-table--wide' : '')
    },
    hideCaption ? null : h('caption', {}, bdiFragment(spec.caption, lang)),
    h('thead', {},
        h('tr', {},
            ...headers.map((th, index) => (keepCol[index]
                ? h('th', {
                    style: index > 0 && formWidth ? { width: formWidth } : null
                }, bdiFragment(th, lang))
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
                        class: off ? 'grammar-table__cell--disabled' : null
                    }, off ? (cellText(cell) || '—') : bdiFragment(cellText(cell), lang))
                }).filter(Boolean)
            )
        )
    )
    )

    annotateBdi(table, lang)

    return h('div', { class: 'grammar-table-wrap' }, table)
}

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
        const tabbed = group.items.length > 1 && group.items.some((entry) => entry.spec.role === 'example')
        if (tableIndex >= group.items.length) tableIndex = 0

        groupRow.replaceChildren()
        if (groups.length > 1) {
            groupRow.appendChild(createTabBar({
                items: groups.map((g, index) => ({ key: String(index), label: g.label || `表 ${index + 1}` })),
                active: String(groupIndex),
                onChange: (key) => { groupIndex = Number(key); tableIndex = 0; render() },
                className: 'tab-bar--tables',
                lang
            }).el)
        }

        tableRow.replaceChildren()
        if (tabbed) {
            tableRow.appendChild(createTabBar({
                items: group.items.map((entry, index) => ({ key: String(index), label: tabLabelOf(entry.spec) })),
                active: String(tableIndex),
                onChange: (key) => { tableIndex = Number(key); render() },
                className: 'tab-bar--tables',
                lang
            }).el)
        }

        content.replaceChildren(...(tabbed ? [group.items[tableIndex].node] : group.items.map((entry) => entry.node)))
    }

    render()
    return h('div', { class: 'grammar-tabs' }, groupRow, tableRow, content)
}

function tabLabelOf(spec) {
    if (spec && spec.roleLabel) return String(spec.roleLabel)
    if (!spec || spec.role !== 'example') return '变化表'
    return spec.exampleWord ? `示例表：${stripBdi(spec.exampleWord)}` : '示例表'
}

