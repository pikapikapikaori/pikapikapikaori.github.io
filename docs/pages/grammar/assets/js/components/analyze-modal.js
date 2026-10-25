/**
 * 形态分析浮层：输入任意词形，把各分析源的候选列成卡片；加载源与并发查询在 services/analyze-service.js。
 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'
import { openModal } from './modal.js'
import { toast } from './toast.js'
import { createGhostInput } from './ghost-input.js'
import { loadAnalyzers, analyze } from '../services/analyze-service.js'
import { setPendingLookup } from '../store/pending-lookup.js'

/** @param {{ langCode: string, langName?: string }} opts langName 只用于标题 */
export async function openAnalyzeModal({ langCode, langName = '' } = {}) {
    const sources = await loadAnalyzers(langCode)
    if (!sources.length) {
        toast.error('这门语言没有可用的形态分析源')
        return
    }

    const field = createGhostInput({
        value: '',
        lang: langCode,
        placeholder: '要分析的词形，如 λόγῳ / amāverant'
    })
    const input = field.input

    const status = h('div', { class: 'field__hint' })
    const results = h('div', { class: 'analyze-results' })

    const submitBtn = h('button', {
        class: 'btn btn--primary',
        type: 'button',
        onclick: () => run()
    }, '分析')

    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        run()
    })

    const sourceHint = sources.map((s) => s.label).join('、')
        + ' · 形态分析（只做词形分析，不提供释义）'

    const body = h('div', { class: 'analyze' },
        h('div', { class: 'analyze-query' },
            h('label', { class: 'field' },
                h('span', { class: 'field__label' }, '词形'),
                field.el
            ),
            submitBtn
        ),
        h('div', { class: 'field__hint' }, sourceHint),
        status,
        results
    )

    const close = openModal({
        title: langName ? `形态分析 · ${langName}` : '形态分析',
        body
    })

    setTimeout(() => input.focus(), 0)

    function renderEntries(entries, showSource) {
        results.replaceChildren(...entries.map((entry) => card(entry, showSource)))
    }

    function card(entry, showSource) {
        const meta = [
            entry.classLabel,
            entry.stem ? `词干 ${entry.stem}` : ''
        ].filter(Boolean).join(' · ')

        return h('div', { class: 'analyze-entry' },
            h('div', { class: 'analyze-entry__head' },
                h('span', { class: 'lookup-choice__pos' }, entry.posLabel),
                h('span', { class: 'analyze-entry__lemma' }, bdiText(entry.lemma, langCode)),
                showSource ? h('span', { class: 'lookup-choice__source' }, entry.sourceLabel) : null
            ),
            entry.analysis
                ? h('div', { class: 'analyze-entry__analysis' }, bdiText(entry.analysis, langCode))
                : null,
            meta ? h('div', { class: 'field__hint' }, bdiText(meta, langCode)) : null,
            h('button', {
                class: 'btn btn--sm',
                type: 'button',
                onclick: () => {
                    setPendingLookup({ langCode, lemma: entry.lemma, patch: entry.patch })
                    close()
                    location.hash = `#/lang/${langCode}/words/new`
                }
            }, '存为生词')
        )
    }

    async function run() {
        const word = String(input.value || '').trim()
        if (!word) {
            input.focus()
            toast.error('请先输入要分析的词形')
            return
        }

        submitBtn.disabled = true
        status.textContent = '查询中…'
        status.style.color = ''
        results.replaceChildren()

        try {
            const { entries, errors } = await analyze({ word, langCode, sources })
            renderEntries(entries, sources.length > 1)

            if (entries.length) {
                status.textContent = `找到 ${entries.length} 个候选`
                status.style.color = 'var(--c-fg-subtle)'
            } else if (errors.length === sources.length) {
                status.textContent = `查询失败：${errors[0].error.message}`
                status.style.color = 'var(--c-danger)'
            } else {
                status.textContent = '没有分析出这个词形'
                status.style.color = 'var(--c-fg-subtle)'
            }
        } finally {
            submitBtn.disabled = false
        }
    }
}
