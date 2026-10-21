/**
 * 生词列表（卡片 + 分页 + 筛选 + 排序）
 */

import { h, replace, delegate } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import {
    queryWords, SORT_FIELDS, FILTER_EMPTY, SEARCH_SCOPE,
    submitReview
} from '../services/word-service.js'
import { listByLanguage, deleteWord } from '../store/word-store.js'
import { POS_LIST, PAGE_SIZE_OPTIONS } from '../config/config.js'
import { createWordCard } from '../components/word-card.js'
import { createPagination } from '../components/pagination.js'
import { confirmModal } from '../components/modal.js'
import { toast } from '../components/toast.js'
import { loadGrammar, getParadigmTemplate, getDeriveParts } from '../services/grammar-service.js'
import { findAnchor } from '../models/grammar.js'
import { openImportWordsModal } from '../components/import-words-modal.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const { userId, settings } = appStore.get()
        const lang = ctx.params.lang
        const language = getLanguage(lang)
        if (!language) {
            replace(main, h('div', { class: 'empty' }, '未知语言：' + lang))
            return
        }

        setBreadcrumbs([
            { label: '语言选择', href: '#/languages' },
            { label: language.name }
        ])

        // 视图状态（初始来自 URL 查询）
        const state = {
            q: ctx.query.q || '',
            scope: ctx.query.scope || 'all',
            pos: ctx.query.pos || '',
            sortField: ctx.query.sort || (settings && settings.sortField) || 'addedAt',
            sortOrder: ctx.query.order || (settings && settings.sortOrder) || 'desc',
            page: Math.max(1, Number(ctx.query.page) || 1),
            pageSize: Math.min(50, Math.max(20, Number(ctx.query.size) || (settings && settings.pageSize) || 30))
        }

        /* ---------- 容器 ---------- */
        const head = h('div', { class: 'page-head' })
        const toolbar = h('div', { class: 'toolbar' })
        const listWrap = h('div', { class: 'word-list' })
        const pagWrap = h('div', {})
        const emptyWrap = h('div', {})

        replace(main, head, toolbar, emptyWrap, listWrap, pagWrap)

        /* ---------- 缓存全部词条（用于派生词解析） ---------- */
        let langWordsCache = []
        let langWordsMap = new Map()

        async function refreshCache() {
            langWordsCache = await listByLanguage(userId, lang)
            langWordsMap = new Map()
            for (const w of langWordsCache) {
                // 同 lemma 多个 pos 时保留第一个（用于派生词跳转）
                if (!langWordsMap.has(w.lemma)) langWordsMap.set(w.lemma, w)
            }
        }

        await refreshCache()

        // 加载语法模板（只一次）
        const grammarDoc = await loadGrammar(lang)

        function paradigmTplFor(pos) {
            return getParadigmTemplate(grammarDoc, pos)
        }

        /** 某个词的主要部分标签（来自它的变位 / 变格类型） */
        function partLabelsFor(word) {
            const parts = getDeriveParts(grammarDoc, word && word.inflectionType && word.inflectionType.grammarRef)
            const out = {}
            for (const part of parts) {
                if (part.key !== 'base') out[part.key] = part.label || part.key
            }
            return out
        }

        /** 词性徽章 → 对应语法章节（`{lang}-{pos}` 存在才可点） */
        function resolvePosRef(pos) {
            const id = `${lang}-${pos}`
            return findAnchor(grammarDoc, id) ? id : null
        }

        /* ---------- 头部 ---------- */
        function renderHead() {
            replace(head,
                h('div', {},
                    h('div', { class: 'page-head__title' },
                        h('bdi', { lang: lang }, language.native),
                        ' · ',
                        language.name
                    ),
                    h('div', { class: 'page-head__sub' }, '生词列表')
                ),
                h('div', { class: 'page-head__actions' },
                    language.grammar === false ? null : h('button', {
                        class: 'btn', type: 'button',
                        onclick: () => location.hash = `#/grammar/${lang}`
                    }, '语法'),
                    h('button', {
                        class: 'btn', type: 'button',
                        onclick: () => location.hash = `#/lang/${lang}/review`
                    }, '复习'),
                    h('button', {
                        class: 'btn btn--primary', type: 'button',
                        onclick: () => location.hash = `#/lang/${lang}/words/new`
                    }, '＋ 添加生词'),
                    h('button', {
                        class: 'btn btn--primary', type: 'button',
                        onclick: () => doImport()
                    }, '＋ 导入生词')
                )
            )
        }

        function doImport() {
            openImportWordsModal({
                userId,
                defaultLanguage: lang,
                grammarDoc,
                title: `导入生词 · ${language.name}`,
                onDone: async (stats) => {
                    if (stats.created > 0 || stats.merged > 0) {
                        await refreshCache()
                        await refresh()
                    }
                }
            })
        }

        /* ---------- 工具栏 ---------- */
        function renderToolbar() {
            const searchInput = h('input', {
                class: 'input',
                type: 'search',
                placeholder: '在本语言内检索…',
                value: state.q,
                oninput: debounce((e) => {
                    state.q = e.target.value
                    state.page = 1
                    refresh()
                }, 180)
            })

            const scopeSelect = h('select', {
                class: 'select',
                style: { width: '120px' },
                onchange: (e) => {
                    state.scope = e.target.value
                    state.page = 1
                    refresh()
                }
            }, ...SEARCH_SCOPE.map((s) => h('option', {
                value: s.value,
                selected: state.scope === s.value
            }, s.label)))

            const posSelect = h('select', {
                class: 'select',
                style: { width: '140px' },
                onchange: (e) => {
                    state.pos = e.target.value
                    state.page = 1
                    refresh()
                }
            },
            h('option', { value: '' }, '全部词性'),
            ...POS_LIST.map((p) => h('option', {
                value: p.value,
                selected: state.pos === p.value
            }, p.label))
            )

            const sortSelect = h('select', {
                class: 'select',
                style: { width: '140px' },
                onchange: (e) => {
                    state.sortField = e.target.value
                    state.page = 1
                    refresh()
                }
            },
            ...SORT_FIELDS.map((s) => h('option', {
                value: s.value,
                selected: state.sortField === s.value
            }, s.label))
            )

            const orderBtn = h('button', {
                class: 'btn',
                type: 'button',
                title: '切换排序方向',
                onclick: () => {
                    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
                    state.page = 1
                    refresh()
                }
            }, state.sortOrder === 'asc' ? '↑ 升序' : '↓ 降序')

            const sizeSelect = h('select', {
                class: 'select',
                style: { width: '110px' },
                onchange: (e) => {
                    state.pageSize = Number(e.target.value)
                    state.page = 1
                    refresh()
                }
            },
            ...PAGE_SIZE_OPTIONS.map((n) => h('option', {
                value: String(n),
                selected: state.pageSize === n
            }, `${n} / 页`))
            )

            const resetBtn = h('button', {
                class: 'btn btn--ghost',
                type: 'button',
                onclick: () => {
                    state.q = ''
                    state.scope = 'all'
                    state.pos = ''
                    state.sortField = 'addedAt'
                    state.sortOrder = 'desc'
                    state.page = 1
                    refresh()
                }
            }, '重置')

            replace(toolbar,
                scopeSelect,
                posSelect,
                h('div', { class: 'toolbar__grow' }, searchInput),
                sortSelect,
                orderBtn,
                sizeSelect,
                resetBtn
            )
        }

        /* ---------- 列表 ---------- */
        let currentPageIds = []

        function renderList(result) {
            replace(listWrap)
            emptyWrap.replaceChildren()
            currentPageIds = result.items.map((w) => w.id)

            if (result.items.length === 0) {
                replace(emptyWrap, h('div', { class: 'empty' },
                    h('div', { class: 'empty__title' }, result.total === 0 && !state.q && !state.pos
                        ? '还没有词条'
                        : '没有匹配的词条'),
                    h('div', { class: 'empty__desc' },
                        result.total === 0 && !state.q && !state.pos
                            ? '点击「添加生词」开始记录。'
                            : '试试调整筛选或搜索条件。'
                    ),
                    result.total === 0 && !state.q && !state.pos
                        ? h('button', {
                            class: 'btn btn--primary',
                            type: 'button',
                            onclick: () => location.hash = `#/lang/${lang}/words/new`
                        }, '添加第一个生词')
                        : null
                ))
                return
            }

            const frag = document.createDocumentFragment()
            for (const w of result.items) {
                frag.appendChild(createWordCard(w, {
                    language: lang,
                    paradigmTpl: paradigmTplFor(w.pos),
                    partLabels: partLabelsFor(w),
                    resolvePosRef,
                    resolveDerivative: (lemma) => langWordsMap.get(lemma) || null,
                    onDerivativeClick: (target) => {
                        location.hash = `#/lang/${lang}/words/${target.id}`
                    },
                    onEdit: (word) => {
                        location.hash = `#/lang/${lang}/words/${word.id}`
                    },
                    onDelete: async (word) => {
                        const ok = await confirmModal({
                            title: '删除词条',
                            message: `确定删除「${word.lemma}」？`,
                            confirmLabel: '删除',
                            danger: true
                        })
                        if (!ok) return
                        await deleteWord(word.id)
                        toast.success('已删除')
                        await refreshCache()
                        refresh()
                    },
                    onGrammarRef: (ref) => {
                        location.hash = `#/grammar/${lang}#${ref}`
                    }
                }))
            }
            listWrap.appendChild(frag)
        }

        /* ---------- 分页 ---------- */
        function renderPagination(result) {
            replace(pagWrap, createPagination({
                page: result.page,
                totalPages: result.totalPages,
                total: result.total,
                pageSize: result.pageSize,
                onChange: (p) => {
                    state.page = p
                    refresh()
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                }
            }))
        }

        /* ---------- 主刷新 ---------- */
        async function refresh() {
            const result = await queryWords(userId, lang, {
                ...state,
                filter: { ...FILTER_EMPTY, pos: state.pos }
            })
            renderList(result)
            renderPagination(result)
            syncUrl()
        }

        function syncUrl() {
            const params = new URLSearchParams()
            if (state.q) params.set('q', state.q)
            if (state.scope && state.scope !== 'all') params.set('scope', state.scope)
            if (state.pos) params.set('pos', state.pos)
            if (state.sortField !== 'addedAt') params.set('sort', state.sortField)
            if (state.sortOrder !== 'desc') params.set('order', state.sortOrder)
            if (state.page > 1) params.set('page', String(state.page))
            if (state.pageSize !== 30) params.set('size', String(state.pageSize))
            const qs = params.toString()
            const hash = `#/lang/${lang}/words${qs ? '?' + qs : ''}`
            if (location.hash !== hash) {
                history.replaceState(null, '', hash)
            }
        }

        /* ---------- 首次渲染 ---------- */
        renderHead()
        renderToolbar()
        await refresh()

        /* ---------- 快捷键 ---------- */
        const onKey = (e) => {
            const target = e.target
            const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                const input = toolbar.querySelector('input[type="search"]')
                if (input) input.focus()
                return
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault()
                location.hash = `#/lang/${lang}/words/new`
                return
            }
            if (typing) return
            // 左右方向键交给分页按钮，这里不处理
        }
        document.addEventListener('keydown', onKey)

        // 卸载时清理
        return () => {
            document.removeEventListener('keydown', onKey)
        }
    }
}

function debounce(fn, wait) {
    let t = null
    return function (...args) {
        if (t) clearTimeout(t)
        t = setTimeout(() => { t = null; fn.apply(this, args) }, wait)
    }
}
