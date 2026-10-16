import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { buildQueue, answer, createSessionStats } from '../services/review-service.js'
import { listByLanguage } from '../store/word-store.js'
import { createWordCard } from '../components/word-card.js'
import { toast } from '../components/toast.js'
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
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: '复习' }
        ])

        /* ---------- 数据 ---------- */
        const allWords = await listByLanguage(userId, lang)
        const lemmaMap = new Map()
        for (const w of allWords) {
            if (!lemmaMap.has(w.lemma)) lemmaMap.set(w.lemma, w)
        }

        const order = (settings && settings.reviewOrder) || 'mastery-asc'
        const queue = await buildQueue(userId, lang, { order })

        /* ---------- 空状态 ---------- */
        if (queue.length === 0) {
            replace(main,
                h('div', { class: 'review-stage' },
                    h('div', { class: 'review-card-wrap' },
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
            )
            return
        }

        /* ---------- 状态 ---------- */
        const stats = createSessionStats(queue)
        let idx = 0
        let card = null

        /* ---------- DOM ---------- */
        const statEl = h('div', { class: 'review-stats' })
        const barEl = h('div', { class: 'progress__bar', style: { width: '0%' } })
        const progressEl = h('div', { class: 'progress', 'aria-label': '进度' }, barEl)
        const cardWrap = h('div', { class: 'review-card-wrap' })
        const actionEl = h('div', { class: 'review-actions' })

        replace(main,
            h('div', { class: 'review-stage' },
                statEl,
                progressEl,
                cardWrap,
                actionEl
            )
        )

        /* ---------- 渲染函数 ---------- */

        function renderStats() {
            replace(statEl,
                h('span', {}, '剩余 ', h('b', { class: 'num' },
                    String(Math.max(0, stats.total - stats.done)))),
                h('span', {}, '进度 ', h('b', { class: 'num' },
                    `${stats.done}/${stats.total}`)),
                h('span', {}, '正确率 ', h('b', { class: 'num' },
                    stats.done ? `${Math.round(stats.accuracy * 100)}%` : '—'))
            )
            barEl.style.width = `${Math.round((stats.progress || 0) * 100)}%`
        }

        function renderActions() {
            replace(actionEl,
                h('button', {
                    class: 'btn btn--danger',
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

        function renderCard() {
            const word = queue[idx]
            if (!word) { renderDone(); return }

            card = createWordCard(word, {
                language: lang,
                showSourceTabs: false,
                resolveDerivative: (lemma) => lemmaMap.get(lemma) || null,
                onDerivativeClick: (target) => {
                    toast.info(`派生词：${target.lemma}`)
                },
                onGrammarRef: (ref) => {
                    location.hash = `#/grammar/${lang}#${ref}`
                }
            })
            replace(cardWrap, card)
            card.setFlipped(false)
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
            stats.record(correct)
            idx += 1
            renderStats()
            if (idx >= queue.length) renderDone()
            else renderCard()
        }

        function renderDone() {
            replace(cardWrap,
                h('div', { class: 'review-done-card' },
                    h('div', { class: 'review-done-card__title' }, '本轮完成'),
                    h('div', { class: 'review-done-card__stats' },
                        `共 ${stats.done} 张 · 正确 ${stats.correct} · 错误 ${stats.wrong}`
                    )
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
                    if (card) card.flip()
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
