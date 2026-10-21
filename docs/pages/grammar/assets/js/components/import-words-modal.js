/**
 * 批量导入生词模态框
 */

import { h, svg } from '../utils/dom.js'
import { openModal } from './modal.js'
import { toast } from './toast.js'
import {
    parseWordJson, importWords, downloadPrompt
} from '../services/import-words-service.js'

/**
 * @param {object} opts
 *   userId             当前用户
 *   defaultLanguage    默认语言 code（用于生成提示词；为空时禁用下载按钮）
 *   grammarDoc         当前语言的语法 JSON（可为 null）
 *   onDone             (stats) => void
 *   title              模态框标题
 */
export function openImportWordsModal({
    userId,
    defaultLanguage = '',
    grammarDoc = null,
    onDone = null,
    title = '批量导入生词'
} = {}) {

    /* ---------- 表单 ---------- */

    const textarea = h('textarea', {
        class: 'textarea',
        placeholder: '把 JSON 粘贴到这里…',
        style: {
            minHeight: '220px',
            fontFamily: 'var(--ff-mono)',
            fontSize: 'var(--fs-sm)'
        }
    })

    async function loadFile(file) {
        try {
            const text = await file.text()
            textarea.value = text
            updateCount()
            toast.success(`已载入 ${file.name}`, 2400)
        } catch (err) {
            toast.error(`读取文件失败：${err.message}`)
        }
    }

    const fileInput = h('input', {
        type: 'file',
        accept: '.json,application/json',
        hidden: true,
        onchange: async (e) => {
            const f = e.target.files && e.target.files[0]
            e.target.value = ''
            if (f) await loadFile(f)
        }
    })

    const dropzone = h('div', {
        class: 'dropzone',
        role: 'button',
        tabindex: '0',
        title: '点击选择文件，或把 JSON 文件拖到这里',
        onclick: () => fileInput.click(),
        onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInput.click()
            }
        },
        ondragenter: (e) => {
            e.preventDefault()
            dropzone.classList.add('dropzone--active')
        },
        ondragover: (e) => {
            e.preventDefault()
            dropzone.classList.add('dropzone--active')
        },
        ondragleave: (e) => {
            if (!dropzone.contains(e.relatedTarget)) {
                dropzone.classList.remove('dropzone--active')
            }
        },
        ondrop: async (e) => {
            e.preventDefault()
            dropzone.classList.remove('dropzone--active')
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
            if (f) await loadFile(f)
        }
    },
    h('span', { class: 'dropzone__icon' },
        svg('svg', {
            viewBox: '0 0 24 24',
            width: '28',
            height: '28',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.6',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': 'true'
        },
        svg('path', { d: 'M12 16V4' }),
        svg('path', { d: 'm7 9 5-5 5 5' }),
        svg('path', { d: 'M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' })
        )
    ),
    h('span', { class: 'dropzone__title' }, '拖拽 JSON 文件到这里'),
    h('span', { class: 'dropzone__hint' }, '或点击选择文件 · 支持 .json')
    )

    const countEl = h('div', { class: 'field__hint' }, '')

    function updateCount() {
        const v = textarea.value
        if (!v.trim()) {
            countEl.textContent = ''
            countEl.style.color = ''
            return
        }
        const { words, error } = parseWordJson(v)
        if (error) {
            countEl.textContent = `⚠ ${error}`
            countEl.style.color = 'var(--c-danger)'
            return
        }
        countEl.textContent = `已识别 ${words.length} 条`
        countEl.style.color = ''
    }

    textarea.addEventListener('input', updateCount)

    const downloadBtn = h('button', {
        class: 'btn btn--sm',
        type: 'button',
        disabled: !defaultLanguage,
        title: defaultLanguage ? '下载提示词' : '请先进入具体语言再下载提示词',
        onclick: () => {
            if (!defaultLanguage) return
            try {
                const name = downloadPrompt(defaultLanguage, grammarDoc)
                toast.success(`已下载 ${name}`, 3000)
            } catch (err) {
                toast.error(`生成提示词失败：${err.message}`)
            }
        }
    }, '下载提示词')

    const headActions = h('div', { class: 'import-words-head__actions' }, downloadBtn)

    const body = h('div', { class: 'import-words-body' },
        h('div', { class: 'field import-words-field' },
            h('div', { class: 'import-words-head' },
                h('span', { class: 'field__label' }, '上传或粘贴 JSON'),
                headActions
            ),
            dropzone,
            fileInput,
            textarea,
            countEl
        ),
        h('div', { class: 'field__hint' },
            '支持「单对象 / 数组 / { words: [...] }」三种格式。',
            '每条记录需包含 language、lemma、pos 字段。',
            '同语言下 lemma + pos 相同的词条会自动合并，记录次数 +1。'
        )
    )

    /* ---------- 打开 ---------- */

    const close = openModal({
        title,
        body,
        actions: [
            { label: '取消' },
            {
                label: '导入',
                className: 'btn--primary',
                onClick: async () => {
                    const text = textarea.value.trim()
                    if (!text) {
                        toast.error('内容为空')
                        return false
                    }
                    const { words, error } = parseWordJson(text)
                    if (error) {
                        toast.error(error, 5000)
                        return false
                    }
                    if (words.length === 0) {
                        toast.error('没有可导入的记录')
                        return false
                    }

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
        errors.length > 0
            ? h('details', { class: 'import-result__errors', open: true },
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
            : null,
        h('div', { class: 'import-result__actions' },
            h('button', {
                class: 'btn',
                type: 'button',
                onclick: () => {
                    if (closeFn) closeFn()
                    // 重新打开，方便连续导入
                    // 由调用方通过 onDone 重新触发
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
