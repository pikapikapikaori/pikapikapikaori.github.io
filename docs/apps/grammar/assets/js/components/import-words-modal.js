import { h } from '../utils/dom.js'
import { bdiFragment } from '../utils/bdi.js'
import { openModal } from './modal.js'
import { toast } from './toast.js'
import { createJsonInput } from './json-input.js'
import { parseWordJson, importWords, previewWords } from '../services/import-words-service.js'

/** @param {object} opts userId / lang（词形包 bdi 用）/ onDone(stats) / title */
export function openImportWordsModal({
    userId,
    lang = null,
    onDone = null,
    title = '批量导入生词'
} = {}) {

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
        previewEl
    )

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
            renderPreview(stats, previewEl, lang)
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

                    renderResult(stats, close, lang)
                    return false // 保持打开，显示结果
                }
            }
        ]
    })

    return close
}

function renderPreview(stats, container, lang = null) {
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
            renderItemList('将新增', items.created, lang),
            renderItemList('将合并', items.merged, lang),
            renderErrors(errors, lang)
        )
    )
    container.hidden = false
}

function renderItemList(title, items, lang = null) {
    if (!items || items.length === 0) return null
    return h('details', { class: 'import-list' },
        h('summary', {}, `${title}（${items.length}）`),
        h('ul', {}, ...items.map((text) => h('li', {}, bdiFragment(text, lang))))
    )
}

function renderErrors(errors, lang = null) {
    if (!errors || errors.length === 0) return null
    return h('details', { class: 'import-result__errors', open: true },
        h('summary', {}, `跳过原因（${errors.length}）`),
        h('ul', {},
            ...errors.map((err) => h('li', {},
                h('span', { class: 'import-result__lemma' },
                    `#${err.index + 1} `, bdiFragment(err.lemma, lang)),
                ' — ',
                h('span', { class: 'import-result__reason' }, err.reason)
            ))
        )
    )
}

function renderResult(stats, closeFn, lang = null) {
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
        renderErrors(errors, lang),
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
