/**
 * 语言选择
 */

import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { listAll } from '../store/word-store.js'
import { getSettings, saveSettings } from '../store/settings-store.js'
import { LANGUAGES } from '../data/languages.js'
import { formatRelative } from '../utils/date.js'
import { toast } from '../components/toast.js'
import { confirmModal } from '../components/modal.js'
import { createThemeToggle } from '../components/theme-toggle.js'
import { exportUser } from '../services/import-export-service.js'
import { openImportWordsModal } from '../components/import-words-modal.js'

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const { userId, user } = appStore.get()
        if (!userId || !user) return

        // 拉一次全部词条，按语言聚合
        const all = await listAll(userId)
        const byLang = new Map()
        for (const w of all) {
            let bucket = byLang.get(w.language)
            if (!bucket) { bucket = { count: 0, encounters: 0, last: null }; byLang.set(w.language, bucket) }
            bucket.count += 1
            bucket.encounters += w.encounterCount || 0
            if (!bucket.last || String(w.addedAt) > String(bucket.last)) bucket.last = w.addedAt
        }

        const settings = appStore.get().settings

        // 顶部操作
        const head = h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' }, `你好，${user.name}`),
                h('div', { class: 'page-head__sub' }, `共 ${all.length} 条词 · ${byLang.size} 个语言`)
            ),
            h('div', { class: 'page-head__actions' },
                h('button', {
                    class: 'btn btn--primary',
                    type: 'button',
                    onclick: () => doImport()
                }, '＋ 导入生词'),
                h('button', {
                    class: 'btn',
                    type: 'button',
                    onclick: () => doExport()
                }, '导出 JSON'),
                h('button', {
                    class: 'btn btn--danger',
                    type: 'button',
                    onclick: () => doClearAll()
                }, '清空数据'),
                createThemeToggle({
                    onChange: async (t) => {
                        await saveSettings(userId, { theme: t })
                        const s = await getSettings(userId)
                        appStore.set({ settings: s })
                    }
                })
            )
        )

        // 语言网格
        const grid = h('div', { class: 'lang-grid' })
        for (const lang of LANGUAGES) {
            const bucket = byLang.get(lang.code) || { count: 0, encounters: 0, last: null }
            grid.appendChild(renderLangCard(lang, bucket))
        }

        replace(main, head, grid)

        /* ---------- 内部函数 ---------- */

        function renderLangCard(lang, bucket) {
            const rtl = lang.rtl ? { direction: 'rtl' } : {}
            const card = h('div', {
                class: 'lang-card',
                role: 'button',
                tabindex: '0',
                onclick: () => location.hash = `#/lang/${lang.code}/words`,
                onkeydown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        location.hash = `#/lang/${lang.code}/words`
                    }
                }
            },
            h('div', { class: 'lang-card__native', lang: lang.code, style: rtl }, lang.native),
            h('div', { class: 'lang-card__name' }, lang.name),
            h('div', { class: 'lang-card__stats' },
                h('span', { class: 'lang-card__stat' },
                    h('span', { class: 'num' }, String(bucket.count)),
                    ' 词'
                ),
                h('span', { class: 'lang-card__stat' },
                    '累计 ',
                    h('span', { class: 'num' }, String(bucket.encounters))
                ),
                bucket.last
                    ? h('span', { class: 'lang-card__stat' }, `最近 ${formatRelative(bucket.last)}`)
                    : h('span', { class: 'lang-card__stat' }, '暂无')
            )
            )
            return card
        }

        function doImport() {
            openImportWordsModal({
                userId,
                defaultLanguage: '',      // 语言选择页没有默认语言，禁用提示词下载
                grammarDoc: null,
                title: '导入生词',
                onDone: async (stats) => {
                    if (stats.created > 0 || stats.merged > 0) {
                        // 有数据变化，刷新统计
                        setTimeout(() => location.reload(), 800)
                    }
                }
            })
        }

        async function doExport() {
            try {
                const fresh = await listAll(userId)
                const s = await getSettings(userId)
                const name = await exportUser(user, s, fresh)
                toast.success(`已导出 ${name}`, 3600)
            } catch (err) {
                toast.error(`导出失败：${err.message}`)
            }
        }

        async function doClearAll() {
            const ok = await confirmModal({
                title: '清空数据',
                message: '将删除该用户全部词条与设置，用户本身也会被删除。此操作不可恢复。',
                confirmLabel: '清空并删除',
                danger: true
            })
            if (!ok) return
            try {
                const { deleteUser } = await import('../store/user-store.js')
                await deleteUser(userId)
                try { localStorage.removeItem('ln.currentUser') } catch { /* ignore */ }
                appStore.set({ user: null, userId: null, settings: null })
                location.hash = '#/welcome'
            } catch (err) {
                toast.error(`清空失败：${err.message}`)
            }
        }
    }
}
