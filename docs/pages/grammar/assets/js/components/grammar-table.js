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
 * 一个条目的多张表：有「变化表 + 示例表」配对时用 tab 切换
 *
 * - 只有一组：一行 tab（变化表 / 示例表）
 * - 多组（表对象带 `group` / `groupLabel`）：两行 tab，先选组再选变化 / 示例
 * - 没有配对关系（只有变化表或只有示例表）：按原顺序堆叠
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
            group = { key, label: entry.spec.groupLabel || '', pattern: [], example: [] }
            groups.push(group)
        }
        if (entry.spec.role === 'example') group.example.push(entry.node)
        else group.pattern.push(entry.node)
    }

    const paired = groups.some((g) => g.pattern.length && g.example.length)
    // 多组时始终用组 tab（组里只有一类表时，第二行「变化表 / 示例表」不显示）
    if (groups.length <= 1 && !paired) {
        return h('div', { class: 'grammar-tables' }, ...entries.map((entry) => entry.node))
    }

    const ROLE_LABEL = { pattern: '变化表', example: '示例表' }
    let groupIndex = Math.max(0, groups.findIndex((g) => g.pattern.length || g.example.length))
    let role = groups[groupIndex].pattern.length ? 'pattern' : 'example'

    const groupRow = h('div', { class: 'grammar-tabs__row' })
    const roleRow = h('div', { class: 'grammar-tabs__row' })
    const content = h('div', { class: 'grammar-tables' })

    function render() {
        const group = groups[groupIndex]
        const available = ['pattern', 'example'].filter((key) => group[key].length)
        if (!available.includes(role)) role = available[0]

        groupRow.replaceChildren()
        if (groups.length > 1) {
            groupRow.appendChild(createTabBar({
                items: groups.map((g, index) => ({ key: String(index), label: g.label || `表 ${index + 1}` })),
                active: String(groupIndex),
                onChange: (key) => { groupIndex = Number(key); render() },
                className: 'tab-bar--tables'
            }).el)
        }

        roleRow.replaceChildren()
        if (available.length > 1) {
            roleRow.appendChild(createTabBar({
                items: available.map((key) => ({ key, label: ROLE_LABEL[key] })),
                active: role,
                onChange: (key) => { role = key; render() },
                className: 'tab-bar--tables'
            }).el)
        }

        content.replaceChildren(...group[role])
    }

    render()
    return h('div', { class: 'grammar-tabs' }, groupRow, roleRow, content)
}
