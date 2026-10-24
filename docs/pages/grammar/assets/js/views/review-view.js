import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { buildQueue, answer, createSessionStats } from '../services/review-service.js'
import { createParadigmTable } from '../components/paradigm-table.js'
import { posLabel } from '../models/word.js'
import { bdiNode } from '../utils/bdi.js'
import { toast } from '../components/toast.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import { loadGrammar, getParadigmTemplate } from '../services/grammar-service.js'

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
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: '复习' }
        ])

        /* ---------- 数据 ---------- */
        const grammarDoc = await loadGrammar(lang)
        const order = (settings && settings.reviewOrder) || 'mastery-asc'
        const queue = await buildQueue(userId, lang, { order })

        const statEl = h('div', { class: 'review-counts' })
        const headEl = h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' }, '复习'),
                h('div', { class: 'page-head__sub' },
                    bdiNode(language.native, lang), ' · ', language.name)
            ),
            statEl
        )

        /* ---------- 空状态 ---------- */
        if (queue.length === 0) {
            statEl.hidden = true
            replace(main,
                headEl,
                h('div', { class: 'review-sheet review-sheet--empty' },
                    h('div', { class: 'empty' },
                        h('div', { class: 'empty__title' }, '暂无词条可复习'),
                        h('div', { class: 'empty__desc' }, '先添加一些生词，再来复习吧。'),
                        h('button', {
                            class: 'btn btn--primary',
                            type: 'button',
                            onclick: () => location.hash = `#/lang/${lang}/words`
                        }, '返回列表')
                    )
                )
            )
            return
        }

        /* ---------- 状态 ---------- */
        const stats = createSessionStats(queue)
        const wrongWords = []
        let idx = 0

        /* ---------- DOM ---------- */
        const barEl = h('div', { class: 'review-sheet__fill', style: { width: '0%' } })
        const faceWrap = h('div', { class: 'review-face', onclick: () => toggleFace(), title: '点击翻面' })
        let showBack = false
        const actionEl = h('div', { class: 'review-actions' })
        const hintEl = h('div', { class: 'review-hint' },
            h('kbd', {}, '空格'), '翻面',
            h('span', { class: 'review-hint__sep' }, '·'),
            h('kbd', {}, '←'), '记错',
            h('span', { class: 'review-hint__sep' }, '·'),
            h('kbd', {}, '→'), '记对'
        )

        replace(main,
            headEl,
            h('div', { class: 'review-sheet' },
                h('div', { class: 'review-sheet__bar', 'aria-hidden': 'true' }, barEl),
                faceWrap,
                actionEl
            ),
            hintEl
        )

        /* ---------- 渲染函数 ---------- */

        function renderStats() {
            const left = Math.max(0, stats.total - stats.done)
            replace(statEl,
                h('span', {},
                    h('b', { class: 'num' }, String(stats.done)), ' / ', String(stats.total),
                    left > 0 ? '' : ' · 已走完'),
                h('span', {},
                    '正确率 ',
                    stats.done ? `${Math.round(stats.accuracy * 100)}%` : '—')
            )
            barEl.style.width = `${Math.round((stats.progress || 0) * 100)}%`
        }

        function renderActions() {
            replace(actionEl,
                h('button', {
                    class: 'btn',
                    type: 'button',
                    title: '记错（← 或 1）',
                    onclick: () => doAnswer(false)
                }, '← 记错'),
                h('button', {
                    class: 'btn btn--primary',
                    type: 'button',
                    title: '记对（→ 或 2）',
                    onclick: () => doAnswer(true)
                }, '记对 →')
            )
        }

        function toggleFace() {
            if (!queue[idx]) return
            showBack = !showBack
            renderFace()
        }

        /** 淡入 + 上移：像翻页，而不是转卡片 */
        function renderFace() {
            const word = queue[idx]
            if (!word) return
            faceWrap.classList.remove('review-face--in')
            replace(faceWrap, showBack ? buildBack(word) : buildFront(word))
            void faceWrap.offsetWidth
            faceWrap.classList.add('review-face--in')
        }

        function buildFront(word) {
            return h('div', { class: 'review-front' },
                h('div', { class: 'review-word', lang }, bdiNode(word.lemma, lang))
            )
        }

        function buildBack(word) {
            const source = (word.meanings || []).filter((m) => (m.text || '').trim())
            const meanings = source.filter((m) => (m.source || 'manual') === 'manual')
            const list = meanings.length ? meanings : source

            const parts = [
                h('div', { class: 'review-section' },
                    h('div', { class: 'review-section__label' }, '含义'),
                    list.length
                        ? h('div', { class: 'review-meanings' },
                            ...list.map((m) => h('div', { class: 'review-meaning' }, h('bdi', {}, m.text)))
                        )
                        : h('div', { class: 'review-empty' }, '还没有填写含义')
                )
            ]

            const tpl = getParadigmTemplate(grammarDoc, word.pos)
            const tables = []
            for (const tableTpl of tpl?.tables || []) {
                if (!word.paradigm || !word.paradigm[tableTpl.key]) continue
                const tbl = createParadigmTable(tableTpl, word.paradigm[tableTpl.key], {
                    lang,
                    mode: 'view',
                    showTitle: true
                })
                if (tbl) tables.push(tbl)
            }
            if (tables.length) {
                parts.push(h('div', { class: 'review-section review-section--table' },
                    h('div', { class: 'review-section__label' }, '变格 / 变位'),
                    ...tables
                ))
            }

            return h('div', { class: 'review-back' }, ...parts)
        }

        function renderCard() {
            if (!queue[idx]) { renderDone(); return }
            showBack = false
            hintEl.hidden = false
            renderFace()
        }

        async function doAnswer(correct) {
            const word = queue[idx]
            if (!word) return
            try {
                await answer(word.id, correct)
            } catch (err) {
                toast.error(`保存失败：${err.message}`)
                return
            }
            if (!correct) wrongWords.push(word)
            stats.record(correct)
            idx += 1
            renderStats()
            if (idx >= queue.length) renderDone()
            else renderCard()
        }

        function renderDone() {
            hintEl.hidden = true
            showBack = false
            faceWrap.classList.remove('review-face--in')
            faceWrap.removeAttribute('title')
            faceWrap.classList.add('review-face--done')
            replace(faceWrap,
                h('div', { class: 'review-done' },
                    h('div', { class: 'review-done__title' }, '本轮完成'),
                    h('div', { class: 'review-done__stats' },
                        `共 ${stats.done} 张 · 正确 ${stats.correct} · 错误 ${stats.wrong}`
                    ),
                    wrongWords.length
                        ? h('div', { class: 'review-done__wrong' },
                            h('div', { class: 'review-done__wrong-title' }, '这轮记错的词'),
                            ...wrongWords.map((w) => h('button', {
                                class: 'review-done__word',
                                type: 'button',
                                onclick: () => { location.hash = `#/lang/${lang}/words/${w.id}` }
                            },
                            h('span', { class: 'review-done__lemma', lang }, bdiNode(w.lemma, lang)),
                            h('span', { class: 'review-done__pos' }, posLabel(w.pos))
                            ))
                        )
                        : null
                )
            )
            replace(actionEl,
                h('button', {
                    class: 'btn', type: 'button',
                    onclick: () => location.hash = `#/lang/${lang}/words`
                }, '返回列表'),
                h('button', {
                    class: 'btn btn--primary', type: 'button',
                    onclick: () => location.reload()
                }, '再来一轮')
            )
        }

        /* ---------- 键盘 ---------- */

        function onKey(e) {
            const t = e.target
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
            if (e.isComposing) return

            switch (e.key) {
                case ' ':
                case 'Spacebar':
                    e.preventDefault()
                    toggleFace()
                    break
                case 'ArrowLeft':
                case '1':
                    e.preventDefault()
                    doAnswer(false)
                    break
                case 'ArrowRight':
                case '2':
                    e.preventDefault()
                    doAnswer(true)
                    break
            }
        }
        document.addEventListener('keydown', onKey)

        /* ---------- 首屏 ---------- */
        renderStats()
        renderActions()
        renderCard()

        return () => document.removeEventListener('keydown', onKey)
    }
}
