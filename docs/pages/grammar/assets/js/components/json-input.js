/**
 * JSON 输入区：拖拽 / 选择文件 / 粘贴文本，下面一行识别提示。右侧可插入动作按钮。
 * 「从 JSON 导入生词」与 welcome 的「导入用户 JSON」共用它，保证两处结构一致。
 */

import { h, svg } from '../utils/dom.js'
import { toast } from './toast.js'

/**
 * @param {object} options
 * @param {string} options.label       左上角标题，默认「上传或粘贴 JSON」
 * @param {string} options.placeholder textarea 占位文字
 * @param {Node[]} options.actions     标题行右侧的按钮
 * @param {(text: string) => { message?: string, error?: string }} [options.validate]
 * @param {() => void} [options.onChange] 内容变化时调用（用来作废旧的预览结果）
 * @returns {{ el: HTMLElement, textarea: HTMLTextAreaElement, getValue: () => string }}
 */
export function createJsonInput({
    label = '上传或粘贴 JSON',
    placeholder = '把 JSON 粘贴到这里…',
    actions = [],
    validate = null,
    onChange = null
} = {}) {
    const textarea = h('textarea', {
        class: 'textarea',
        placeholder,
        style: { minHeight: '220px', fontSize: 'var(--fs-sm)' }
    })

    const countEl = h('div', { class: 'field__hint' }, '')

    async function loadFile(file) {
        try {
            textarea.value = await file.text()
            update()
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
            const file = e.target.files && e.target.files[0]
            e.target.value = ''
            if (file) await loadFile(file)
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
            if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('dropzone--active')
        },
        ondrop: async (e) => {
            e.preventDefault()
            dropzone.classList.remove('dropzone--active')
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
            if (file) await loadFile(file)
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

    function update() {
        if (typeof onChange === 'function') onChange()
        const text = textarea.value
        if (!text.trim()) {
            countEl.textContent = ''
            countEl.style.color = ''
            return
        }
        if (typeof validate !== 'function') {
            countEl.textContent = ''
            countEl.style.color = ''
            return
        }
        const result = validate(text) || {}
        if (result.error) {
            countEl.textContent = `⚠ ${result.error}`
            countEl.style.color = 'var(--c-danger)'
            return
        }
        countEl.textContent = result.message || ''
        countEl.style.color = result.messageColor || ''
    }

    textarea.addEventListener('input', update)

    const el = h('div', { class: 'field import-words-field' },
        h('div', { class: 'import-words-head' },
            h('span', { class: 'field__label' }, label),
            h('div', { class: 'import-words-head__actions' }, ...actions)
        ),
        dropzone,
        fileInput,
        textarea,
        countEl
    )

    return {
        el,
        textarea,
        getValue: () => textarea.value.trim()
    }
}
