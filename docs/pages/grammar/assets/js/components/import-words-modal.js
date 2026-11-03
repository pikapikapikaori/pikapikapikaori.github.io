/** 批量导入生词模态框 */

import { h } from '../utils/dom.js'
import { openModal } from './modal.js'
import { toast } from './toast.js'
import { createJsonInput } from './json-input.js'
import { parseWordJson, importWords, previewWords } from '../services/import-words-service.js'

/** @param {object} opts userId / onDone(stats) / title */
export function openImportWordsModal({
    userId,
    onDone = null,
    title = '批量导入生词'
} = {}) {

    /* ---------- 表单 ---------- */

    const previewEl = h('div', { class: 'import-preview', hidden: true })

    const schemaBtn = h('button', {
        class: 'btn btn--sm',
        type: 'button',
        title: '查看 JSON 的数据格式',
        onclick: () => {
            close()
            location.hash = '#/schema/word'
        }
    }, '数据格式')

    const input = createJsonInput({
        placeholder: '把 JSON 粘贴到这里…',
        actions: [schemaBtn],
        validate: (text) => {
            const { words, error } = parseWordJson(text)
            return error ? { error } : { message: `已识别 ${words.length} 条` }
        },
        // 内容变了，之前的预览结果就作废
        onChange: () => {
            previewEl.hidden = true
            previewEl.replaceChildren()
        }
    })

    const body = h('div', { class: 'import-words-body' },
        input.el,
        previewEl,
        h('div', { class: 'field__hint' },
            '支持「单对象 / 数组 / { words: [...] }」三种格式。',
            '每条记录需包含 language、lemma、pos 字段。',
            '同语言下 lemma + pos 相同的词条会自动合并，记录次数 +1。',
            '可先点「预览」查看新增 / 合并 / 跳过三类计数。'
        )
    )

    /* ---------- 打开 ---------- */

    let previewing = false

    function readWords() {
        const { words, error } = parseWordJson(input.getValue())
        if (error) {
            toast.error(error, 5000)
            return null
        }
        if (words.length === 0) {
            toast.error('没有可导入的记录')
            return null
        }
        return words
    }

    async function doPreview() {
        if (previewing) return
        const words = readWords()
        if (!words) return
        previewing = true
        try {
            const stats = await previewWords(userId, words)
            renderPreview(stats, previewEl)
            previewEl.scrollIntoView({ block: 'nearest' })
        } catch (err) {
            toast.error(`预览失败：${err.message}`, 5000)
        } finally {
            previewing = false
        }
    }

    const close = openModal({
        title,
        body,
        actions: [
            { label: '取消' },
            {
                label: '预览',
                // 必须同步返回 false，模态框才会保持打开
                onClick: () => {
                    doPreview()
                    return false
                }
            },
            {
                label: '导入',
                className: 'btn--primary',
                onClick: async () => {
                    const words = readWords()
                    if (!words) return false

                    let stats
                    try {
                        stats = await importWords(userId, words)
                    } catch (err) {
                        toast.error(`导入失败：${err.message}`, 5000)
                        return false
                    }

                    if (typeof onDone === 'function') {
                        try { onDone(stats) } catch (e) { console.warn(e) }
                    }

                    renderResult(stats, close)
                    return false // 保持打开，显示结果
                }
            }
        ]
    })

    return close
}

/* ---------------- 导入前预览 ---------------- */

function renderPreview(stats, container) {
    const { created, merged, skipped, total, errors, items } = stats

    container.replaceChildren(
        h('div', { class: 'import-result import-result--preview' },
            h('div', { class: 'import-result__title' }, '导入预览'),
            h('div', { class: 'field__hint' },
                '以下为模拟结果，尚未写入任何数据；确认无误后点「导入」。'),
            h('div', { class: 'import-result__stats' },
                h('span', { class: 'badge badge--success' }, `新增 ${created}`),
                h('span', { class: 'badge' }, `合并 ${merged}`),
                skipped > 0
                    ? h('span', { class: 'badge badge--danger' }, `跳过 ${skipped}`)
                    : null,
                h('span', { class: 'badge' }, `共 ${total}`)
            ),
            renderItemList('将新增', items.created),
            renderItemList('将合并', items.merged),
            renderErrors(errors)
        )
    )
    container.hidden = false
}

function renderItemList(title, items) {
    if (!items || items.length === 0) return null
    return h('details', { class: 'import-list' },
        h('summary', {}, `${title}（${items.length}）`),
        h('ul', {}, ...items.map((text) => h('li', {}, text)))
    )
}

function renderErrors(errors) {
    if (!errors || errors.length === 0) return null
    return h('details', { class: 'import-result__errors', open: true },
        h('summary', {}, `跳过原因（${errors.length}）`),
        h('ul', {},
            ...errors.map((err) => h('li', {},
                h('span', { class: 'import-result__lemma' },
                    `#${err.index + 1} ${err.lemma}`),
                ' — ',
                h('span', { class: 'import-result__reason' }, err.reason)
            ))
        )
    )
}

/* ---------------- 结果面板 ---------------- */

function renderResult(stats, closeFn) {
    const { created, merged, skipped, total, errors } = stats

    const resultEl = h('div', { class: 'import-result' },
        h('div', { class: 'import-result__title' }, '导入完成'),
        h('div', { class: 'import-result__stats' },
            h('span', { class: 'badge badge--success' }, `新增 ${created}`),
            h('span', { class: 'badge' }, `合并 ${merged}`),
            skipped > 0
                ? h('span', { class: 'badge badge--danger' }, `跳过 ${skipped}`)
                : null,
            h('span', { class: 'badge' }, `共 ${total}`)
        ),
        renderErrors(errors),
        h('div', { class: 'import-result__actions' },
            h('button', {
                class: 'btn',
                type: 'button',
                onclick: () => {
                    if (closeFn) closeFn()
                }
            }, '关闭')
        )
    )

    const bodyEl = document.querySelector('.modal__body')
    if (bodyEl) bodyEl.replaceChildren(resultEl)

    const footEl = document.querySelector('.modal__foot')
    if (footEl) footEl.replaceChildren()

    toast.success(
        `导入完成：新增 ${created} · 合并 ${merged} · 跳过 ${skipped}`,
        4000
    )
}
