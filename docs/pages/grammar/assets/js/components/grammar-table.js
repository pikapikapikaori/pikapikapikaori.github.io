import { h, htmlFragment } from '../utils/dom.js'

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

    // 列多时本容器横向滚动，避免整页被撑宽
    return h('div', { class: 'grammar-table-wrap' }, table)
}
