/**
 * 语法数据校验结果浮层
 *
 * 结果分两段：**结构校验**（`validateGrammarDoc`）与 **derive 自检**（`verifyGrammarDoc`）。
 * 无论有没有问题都会弹 —— 没有问题时也是一次明确确认。
 */

import { h } from '../utils/dom.js'
import { openModal } from './modal.js'

function formatMs(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}

function countLine(label, errors, warnings) {
    return h('div', { class: 'verify-part__title' },
        h('span', {}, label),
        h('span', { class: 'verify-part__count' + (errors ? ' verify-part__count--error' : '') },
            `${errors} 错误 · ${warnings} 警告`)
    )
}

function problemList(errors, warnings) {
    if (!errors.length && !warnings.length) return null
    return h('div', { class: 'verify-problems' },
        ...errors.map((t) => h('div', { class: 'verify-problems__item' }, t)),
        ...warnings.map((t) => h('div', { class: 'verify-problems__item verify-problems__item--warn' }, t))
    )
}

function buildStructure(results) {
    const errors = results.reduce((n, r) => n + r.structure.errors.length, 0)
    const warnings = results.reduce((n, r) => n + r.structure.warnings.length, 0)
    const bad = results.filter((r) => r.structure.errors.length || r.structure.warnings.length)

    const body = []
    if (!bad.length) {
        body.push(h('div', { class: 'field__hint' }, `${results.length} 个语言全部通过`))
    } else {
        if (bad.length < results.length) {
            body.push(h('div', { class: 'field__hint' }, `其余 ${results.length - bad.length} 个语言通过`))
        }
        for (const r of bad) {
            const errs = r.structure.errors
            const warns = r.structure.warnings
            body.push(h('div', { class: 'verify-card' },
                h('div', { class: 'verify-card__head' },
                    h('span', { class: 'verify-card__code' }, r.code),
                    r.name ? h('span', { class: 'verify-card__name' }, r.name) : null,
                    h('span', { class: 'verify-card__meta' + (errs.length ? ' verify-card__meta--error' : '') },
                        `${errs.length} 错误 · ${warns.length} 警告`)
                ),
                problemList(errs, warns)
            ))
        }
    }

    return h('div', { class: 'verify-part' },
        countLine('结构校验', errors, warnings),
        h('div', { class: 'verify-list' }, ...body)
    )
}

function buildDerive(results) {
    const errors = results.reduce((n, r) => n + r.derive.errors.length, 0)
    const warnings = results.reduce((n, r) => n + r.derive.warnings.length, 0)

    const lines = results.map((r) => {
        const d = r.derive
        const bad = d.errors.length || d.warnings.length
        const result = d.skipped
            ? '跳过'
            : bad ? `${d.errors.length} 错误 · ${d.warnings.length} 警告` : '通过'
        return h('div', {},
            h('div', { class: 'verify-line' },
                h('span', { class: 'verify-line__code' }, r.code),
                h('span', { class: 'verify-line__text' },
                    d.skipped ? d.skipped : `${d.specs} 规格 / ${d.checked} 核对`),
                h('span', { class: 'verify-line__result' + (d.errors.length ? ' verify-line__result--error' : '') },
                    result)
            ),
            problemList(d.errors, d.warnings)
        )
    })

    return h('div', { class: 'verify-part' },
        countLine('derive 自检', errors, warnings),
        h('div', { class: 'verify-list' }, ...lines)
    )
}

/**
 * @param {object} opts
 *   results  `verifyGrammarFiles()` 的返回值
 *   elapsed  用时（ms）
 */
export function openGrammarVerifyModal({ results = [], elapsed = 0 } = {}) {
    const body = h('div', { class: 'verify' },
        h('div', { class: 'field__hint' }, `${results.length} 个语言 · 用时 ${formatMs(elapsed)}`),
        h('div', { class: 'verify-body' },
            buildStructure(results),
            buildDerive(results)
        )
    )

    openModal({
        title: '语法数据校验',
        body,
        actions: [{ label: '关闭', className: 'btn--primary' }]
    })
}
