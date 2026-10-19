import { h } from '../utils/dom.js'

/**
 * 语法表格
 * @param {object} table
 *   caption?: string
 *   headers: string[]
 *   rows: string[][]
 *   lang?: string  单元格内容所用语言
 */
export function createGrammarTable(spec) {
    if (!spec || !Array.isArray(spec.headers) || !Array.isArray(spec.rows)) {
        return null
    }
    const lang = spec.lang || null

    const table = h('table', { class: 'grammar-table' },
        spec.caption ? h('caption', {}, String(spec.caption)) : null,
        h('thead', {},
            h('tr', {},
                ...spec.headers.map((th) => h('th', { lang }, String(th ?? '')))
            )
        ),
        h('tbody', {},
            ...spec.rows.map((row) =>
                h('tr', {},
                    ...(Array.isArray(row) ? row : []).map((cell) =>
                        h('td', { lang }, String(cell ?? ''))
                    )
                )
            )
        )
    )

    // 列多时本容器横向滚动，避免整页被撑宽
    return h('div', { class: 'grammar-table-wrap' }, table)
}
