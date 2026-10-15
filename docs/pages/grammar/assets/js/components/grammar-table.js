import { h } from '../utils/dom.js'

/**
 * 语法表格
 * @param {object} table
 *   caption?: string
 *   headers: string[]
 *   rows: string[][]
 *   lang?: string  单元格内容所用语言
 */
export function createGrammarTable(table) {
    if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) {
        return null
    }
    const lang = table.lang || null

    return h('table', { class: 'grammar-table' },
        table.caption ? h('caption', {}, String(table.caption)) : null,
        h('thead', {},
            h('tr', {},
                ...table.headers.map((th) => h('th', { lang }, String(th ?? '')))
            )
        ),
        h('tbody', {},
            ...table.rows.map((row) =>
                h('tr', {},
                    ...(Array.isArray(row) ? row : []).map((cell) =>
                        h('td', { lang }, String(cell ?? ''))
                    )
                )
            )
        )
    )
}
