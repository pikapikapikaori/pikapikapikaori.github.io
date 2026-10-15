/**
 * 检索视图（仅当前语言内）
 */

import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { search, SEARCH_SCOPE } from '../services/search-service.js'
import { posLabel, sourceLabel } from '../models/word.js'

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const { userId } = appStore.get()
        const lang = ctx.params.lang
        const language = getLanguage(lang)
        if (!language) {
            replace(main, h('div', { class: 'empty' }, '未知语言：' + lang))
            return
        }

        const state = {
            q: ctx.query.q || '',
            scope: ctx.query.scope || 'all'
        }

        /* ---------- 顶栏 ---------- */
        const head = h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' }, '检索'),
                h('div', { class: 'page-head__sub' },
                    h('span', { lang: lang }, language.native),
                    ' · ', language.name
                )
            ),
            h('button', {
                class: 'btn', type: 'button',
                onclick: () => location.hash = `#/lang/${lang}/words`
            }, '返回列表')
        )

        /* ---------- 工具栏 ---------- */
        const searchInput = h('input', {
            class: 'input',
            type: 'search',
            placeholder: '检索基本形态、含义、例句、固定搭配…',
            value: state.q
        })

        const scopeSelect = h('select', {
            class: 'select',
            style: { width: '150px' },
            onchange: (e) => {
                state.scope = e.target.value
                runSearch()
            }
        }, ...SEARCH_SCOPE.map((s) => h('option', {
            value: s.value,
            selected: state.scope === s.value
        }, s.label)))

        const toolbar = h('div', { class: 'toolbar' },
            h('div', { class: 'toolbar__grow' }, searchInput),
            scopeSelect
        )

        const infoEl = h('div', { class: 'page-head__sub', style: { marginBottom: 'var(--sp-3)' } })
        const resultsEl = h('div', { class: 'search-results' })

        replace(main, head, toolbar, infoEl, resultsEl)

        /* ---------- 逻辑 ---------- */

        const runSearch = debounce(async () => {
            const q = state.q.trim()
            if (!q) {
                infoEl.textContent = '输入关键词开始检索（检索范围为当前语言）。'
                replace(resultsEl)
                return
            }
            try {
                const res = await search(userId, lang, q, { scope: state.scope })
                renderResults(res)
            } catch (err) {
                infoEl.textContent = `检索失败：${err.message}`
                replace(resultsEl)
            }
        }, 180)

        searchInput.addEventListener('input', (e) => {
            state.q = e.target.value
            runSearch()
        })

        function renderResults({ query, hits, total }) {
            if (hits.length === 0) {
                infoEl.textContent = `未找到匹配「${query}」的词条。`
                replace(resultsEl)
                return
            }
            infoEl.textContent = `找到 ${total} 条结果。`
            const frag = document.createDocumentFragment()
            for (const hit of hits) frag.appendChild(renderHit(hit))
            replace(resultsEl, frag)
        }

        function renderHit({ word, matches }) {
            const head = h('div', { class: 'search-hit__head' },
                h('span', { class: 'search-hit__lemma', lang: lang }, word.lemma),
                h('span', { class: 'badge' }, posLabel(word.pos)),
                h('span', { class: 'badge num' }, `×${word.encounterCount || 0}`)
            )

            const snippets = h('div', {})
            for (const m of matches) {
                const line = h('div', { class: 'search-hit__snippet' })
                line.appendChild(h('span', { class: 'badge' }, m.label))
                line.appendChild(document.createTextNode(' '))
                line.appendChild(m.highlight())
                if (m.source && m.source !== 'manual') {
                    line.appendChild(document.createTextNode(' '))
                    line.appendChild(h('span', {
                        class: 'badge badge--source',
                        dataset: { source: m.source }
                    }, sourceLabel(m.source)))
                }
                snippets.appendChild(line)
            }

            return h('div', {
                class: 'search-hit',
                role: 'button',
                tabindex: '0',
                onclick: () => location.hash = `#/lang/${lang}/words/${word.id}`,
                onkeydown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        location.hash = `#/lang/${lang}/words/${word.id}`
                    }
                }
            }, head, snippets)
        }

        /* ---------- 快捷键 ---------- */

        function onKey(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                searchInput.focus()
                searchInput.select()
                return
            }
            if (e.key === 'Escape') {
                location.hash = `#/lang/${lang}/words`
            }
        }
        document.addEventListener('keydown', onKey)

        /* ---------- 首次 ---------- */
        setTimeout(() => searchInput.focus(), 0)
        await runSearch()

        return () => document.removeEventListener('keydown', onKey)
    }
}

function debounce(fn, wait) {
    let t = null
    return function (...args) {
        if (t) clearTimeout(t)
        t = setTimeout(() => { t = null; fn.apply(this, args) }, wait)
    }
}
