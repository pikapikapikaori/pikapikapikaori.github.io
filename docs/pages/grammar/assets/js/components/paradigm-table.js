import { h } from '../utils/dom.js'
import { applyBdi } from '../utils/bdi.js'
import { createEditableInput } from './editable-input.js'

/**
 * 通用表格渲染。
 * @param {object} tableTpl 语法 JSON 里的表模板 { key, title, columns: [{ key, label }], rows: [{ key, label, grammarRef?, principal? }] }
 * @param {object} tableData { [rowKey]: { [colKey]: string } }
 * @param {object} options lang / mode（'view' | 'edit'，edit 渲染全部行）/ showTitle / onGrammarRef / editable（{ onChange }）/ hideColumns / hideRows / isDisabledCell
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
        editable = null,
        hideColumns = [],
        hideRows = [],
        isDisabledCell = null
    } = options

    const data = tableData && typeof tableData === 'object' ? tableData : {}
    const isEdit = mode === 'edit'

    const rowDisabled = (row, colKey) => {
        if (Array.isArray(row.disabled) && row.disabled.includes(colKey)) return true
        if (typeof isDisabledCell === 'function') {
            try { return !!isDisabledCell(row, colKey) } catch { return false }
        }
        return false
    }

    const hidden = new Set(hideColumns || [])
    const hiddenRows = new Set(hideRows || [])
    const visibleRows = tableTpl.rows.filter((r) => !hiddenRows.has(r.key))

    // 所有行都标了 disabled 的列（如法语的命令式没有 1sg / 3sg / 3pl）整列不渲染
    const disabledEverywhere = (colKey) => visibleRows.length > 0
        && visibleRows.every((r) => rowDisabled(r, colKey))
    const columns = tableTpl.columns.filter((c) => !hidden.has(c.key) && !disabledEverywhere(c.key))
    if (columns.length === 0) return null

    const rows = isEdit
        ? visibleRows
        : visibleRows.filter((r) => {
            const cells = data[r.key]
            if (!cells) return false
            return columns.some((c) => {
                if (rowDisabled(r, c.key)) return false
                return String(cells[c.key] ?? '').trim()
            })
        })

    if (!isEdit && rows.length === 0) return null

    const wrap = h('div', { class: 'paradigm-block' })

    if (showTitle && tableTpl.title) {
        wrap.appendChild(h('div', { class: 'paradigm-block__title' }, tableTpl.title))
    }

    const table = h('table', { class: 'paradigm-table' })

    const thead = h('thead', {},
        h('tr', {},
            h('th', { class: 'paradigm-table__corner' }, ''),
            ...columns.map((c) =>
                h('th', { class: 'paradigm-table__col', scope: 'col' }, c.label)
            )
        )
    )
    table.appendChild(thead)

    const tbody = h('tbody', {})
    for (const row of rows) {
        const cells = data[row.key] || {}

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

        for (const col of columns) {
            const value = cells[col.key] ?? ''
            const off = rowDisabled(row, col.key)
            if (isEdit && !off) {
                tr.appendChild(h('td', {
                    class: 'paradigm-table__cell paradigm-table__cell--edit'
                },
                createEditableInput({
                    value,
                    lang,
                    className: 'input input--cell',
                    onInput: (e) => {
                        if (editable && typeof editable.onChange === 'function') {
                            editable.onChange(row.key, col.key, e.target.value)
                        }
                    }
                })
                ))
            } else {
                tr.appendChild(h('td', {
                    class: 'paradigm-table__cell'
                        + (off ? ' paradigm-table__cell--disabled' : '')
                        + (!off && !value ? ' paradigm-table__cell--empty' : ''),
                    lang: lang || undefined,
                    title: off ? '该形式不存在' : null
                }, off ? '—' : (value || '')))
            }
        }

        tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    wrap.appendChild(table)
    // 可编辑单元格本身就是 contenteditable（内容里的原文已包 bdi），只读文字再统一处理一遍
    applyBdi(wrap)
    return wrap
}
