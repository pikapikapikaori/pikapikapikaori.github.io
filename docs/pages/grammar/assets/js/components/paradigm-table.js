import { h } from '../utils/dom.js'

/**
 * 通用表格渲染
 *
 * @param {object} tableTpl  语法 JSON 中的表模板：
 *   { key, title, columns: [{key,label}], rows: [{key,label,grammarRef?,principal?}] }
 * @param {object} tableData 词条里的数据：{ [rowKey]: { [colKey]: string } }
 * @param {object} options
 *   lang        语言 code（用于字体）
 *   mode        'view' | 'edit'（edit 时渲染全部行）
 *   showTitle   是否显示表标题（默认 true）
 *   onGrammarRef(grammarRef)
 *   editable    { onChange(rowKey, colKey, value) }  仅 mode='edit' 时使用
 *   rowEditable 仅在这些行上允许编辑（可选，默认全部）
 *
 * @returns {HTMLElement|null}
 */
export function createParadigmTable(tableTpl, tableData, options = {}) {
    if (!tableTpl || !Array.isArray(tableTpl.columns) || !Array.isArray(tableTpl.rows)) {
        return null
    }

    const {
        lang = null,
        mode = 'view',
        showTitle = true,
        onGrammarRef = null,
        editable = null
    } = options

    const data = tableData && typeof tableData === 'object' ? tableData : {}
    const isEdit = mode === 'edit'

    // 视图模式：只保留有内容的行
    const rows = isEdit
        ? tableTpl.rows
        : tableTpl.rows.filter((r) => {
            const cells = data[r.key]
            if (!cells) return false
            return Object.values(cells).some((v) => String(v ?? '').trim())
        })

    if (!isEdit && rows.length === 0) return null

    const wrap = h('div', { class: 'paradigm-block' })

    if (showTitle && tableTpl.title) {
        wrap.appendChild(h('div', { class: 'paradigm-block__title' }, tableTpl.title))
    }

    const table = h('table', { class: 'paradigm-table' })

    // 表头
    const thead = h('thead', {},
        h('tr', {},
            h('th', { class: 'paradigm-table__corner' }, ''),
            ...tableTpl.columns.map((c) =>
                h('th', { class: 'paradigm-table__col', scope: 'col' }, c.label)
            )
        )
    )
    table.appendChild(thead)

    // 表体
    const tbody = h('tbody', {})
    for (const row of rows) {
        const cells = data[row.key] || {}

        // 行标题
        const rowHeadChildren = [
            h('span', { class: 'paradigm-table__row-label' }, row.label)
        ]
        if (row.grammarRef && onGrammarRef) {
            rowHeadChildren.push(
                h('button', {
                    class: 'paradigm-table__ref',
                    type: 'button',
                    title: '查看语法',
                    onclick: (e) => {
                        e.stopPropagation()
                        onGrammarRef(row.grammarRef)
                    }
                }, '语法')
            )
        }

        const tr = h('tr', { dataset: { row: row.key } },
            h('th', {
                class: 'paradigm-table__row-head',
                scope: 'row',
                lang: lang || undefined
            }, ...rowHeadChildren)
        )

        for (const col of tableTpl.columns) {
            const value = cells[col.key] ?? ''
            if (isEdit) {
                tr.appendChild(h('td', { class: 'paradigm-table__cell paradigm-table__cell--edit' },
                    h('input', {
                        class: 'input input--cell',
                        type: 'text',
                        value,
                        lang: lang || undefined,
                        placeholder: '',
                        oninput: (e) => {
                            if (editable && typeof editable.onChange === 'function') {
                                editable.onChange(row.key, col.key, e.target.value)
                            }
                        }
                    })
                ))
            } else {
                tr.appendChild(h('td', {
                    class: 'paradigm-table__cell',
                    lang: lang || undefined
                }, value || ''))
            }
        }

        tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    wrap.appendChild(table)
    return wrap
}
