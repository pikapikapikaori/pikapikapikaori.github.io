import { h } from '../utils/dom.js'

/** 分页控件：page / totalPages / total / pageSize / onChange(page) */
export function createPagination({ page, totalPages, total, pageSize, onChange }) {
    const wrap = h('nav', { class: 'pagination', 'aria-label': '分页' })
    if (!total || totalPages <= 0) return wrap

    const go = (p) => {
        const next = Math.max(1, Math.min(totalPages, p))
        if (next === page) return
        onChange(next)
    }

    wrap.appendChild(h('button', {
        class: 'btn btn--sm', type: 'button',
        disabled: page <= 1,
        onclick: () => go(page - 1)
    }, '上一页'))

    for (const p of pageNumbers(page, totalPages)) {
        if (p === '...') {
            wrap.appendChild(h('span', { class: 'pagination__ellipsis' }, '…'))
        } else {
            wrap.appendChild(h('button', {
                class: 'btn btn--sm' + (p === page ? ' btn--primary' : ''),
                type: 'button',
                'aria-current': p === page ? 'page' : null,
                onclick: () => go(p)
            }, String(p)))
        }
    }

    wrap.appendChild(h('button', {
        class: 'btn btn--sm', type: 'button',
        disabled: page >= totalPages,
        onclick: () => go(page + 1)
    }, '下一页'))

    const from = total === 0 ? 0 : (page - 1) * pageSize + 1
    const to = Math.min(total, page * pageSize)
    wrap.appendChild(h('div', { class: 'pagination__info num' }, `${from}–${to} / ${total}`))

    return wrap
}

function pageNumbers(cur, total, span = 2) {
    if (total <= 1) return []
    const out = []
    const push = (v) => { if (!out.includes(v)) out.push(v) }
    const lo = Math.max(1, cur - span)
    const hi = Math.min(total, cur + span)
    if (lo > 1) { push(1); if (lo > 2) push('...') }
    for (let i = lo; i <= hi; i++) push(i)
    if (hi < total) { if (hi < total - 1) push('...'); push(total) }
    return out
}
