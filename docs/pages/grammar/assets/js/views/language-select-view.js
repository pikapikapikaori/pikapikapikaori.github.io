/**
 * 语言选择
 * - 按 classical 分组
 * - 组内可拖动调整顺序，顺序保存在 settings.languageOrder
 */

import { h, replace } from '../utils/dom.js'
import { applyBdi, bdiNode } from '../utils/bdi.js'
import { appStore } from '../app-state.js'
import { listAll } from '../store/word-store.js'
import { getSettings, saveSettings } from '../store/settings-store.js'
import { LANGUAGES, LANGUAGE_MAP } from '../data/languages.js'
import { formatRelative } from '../utils/date.js'
import { toast } from '../components/toast.js'
import { confirmModal } from '../components/modal.js'
import { exportUser } from '../services/import-export-service.js'
import { LS_KEYS } from '../config/config.js'

const GROUP_DEFS = {
    classical: { key: 'classical', title: '古典语言', match: (l) => !!l.classical },
    modern: { key: 'modern',    title: '现代语言', match: (l) => !l.classical }
}
const DEFAULT_GROUP_ORDER = ['classical', 'modern']

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const state = appStore.get()
        const { userId, user } = state
        if (!userId || !user) return

        let settings = await getSettings(userId)

        const all = await listAll(userId)
        const byLang = new Map()
        for (const w of all) {
            let bucket = byLang.get(w.language)
            if (!bucket) {
                bucket = { count: 0, encounters: 0, last: null }
                byLang.set(w.language, bucket)
            }
            bucket.count += 1
            bucket.encounters += w.encounterCount || 0
            if (!bucket.last || String(w.addedAt) > String(bucket.last)) {
                bucket.last = w.addedAt
            }
        }

        /* ---------- DOM 容器 ---------- */
        const head = h('div', { class: 'page-head page-head--display' })
        const groupsEl = h('div', {})

        replace(main, head, groupsEl)

        /* ---------- 头部 ---------- */
        function renderHead() {
            replace(head,
                h('div', {},
                    h('h1', { class: 'page-head__title' }, '语言列表'),
                    h('div', { class: 'page-head__sub' },
                        `${user.name} · 共 ${all.length} 条词 · ${byLang.size} 个语言`
                    )
                ),
                h('div', { class: 'page-head__actions' },
                    h('button', {
                        class: 'btn', type: 'button',
                        onclick: () => doExport()
                    }, '导出 JSON'),
                    h('button', {
                        class: 'btn btn--danger-quiet', type: 'button',
                        onclick: () => doClearAll()
                    }, '清空数据')
                )
            )
        }

        /* ---------- 分组渲染 ---------- */
        function renderGroups() {
            const ordered = orderedLanguages(settings.languageOrder)
            const groupOrder = Array.isArray(settings.groupOrder) && settings.groupOrder.length
                ? settings.groupOrder
                : DEFAULT_GROUP_ORDER

            const sections = []
            for (const key of groupOrder) {
                const def = GROUP_DEFS[key]
                if (!def) continue
                const list = ordered.filter(def.match)
                const section = buildGroup(def.title, list, key)
                if (section) sections.push(section)
            }
            replace(groupsEl, ...sections)
        }

        function buildGroup(title, list, groupKey) {
            if (list.length === 0) return null

            const grid = h('div', { class: 'lang-grid' })
            for (const lang of list) {
                grid.appendChild(renderLangCard(lang, groupKey))
            }

            const header = h('div', {
                class: 'lang-group__title',
                draggable: 'true',
                dataset: { groupKey },
                title: '拖动调整组的顺序'
            },
            h('span', { class: 'lang-group__label' }, title),
            h('span', { class: 'lang-group__count' }, `${list.length}`),
            h('span', { class: 'lang-group__handle', 'aria-hidden': 'true' }, '⋮⋮')
            )

            attachGroupDragHandlers(header, groupKey)

            return h('section', {
                class: 'lang-group',
                dataset: { group: groupKey }
            }, header, grid)
        }

        function renderLangCard(lang, groupKey) {
            const bucket = byLang.get(lang.code) || { count: 0, encounters: 0, last: null }
            const isRtlNative = lang.rtl

            const card = h('div', {
                class: 'lang-card',
                role: 'button',
                tabindex: '0',
                draggable: 'true',
                dataset: { code: lang.code, group: groupKey },
                onclick: () => {
                    location.hash = `#/lang/${lang.code}/words`
                },
                onkeydown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        location.hash = `#/lang/${lang.code}/words`
                    }
                }
            },
            h('div', { class: 'lang-card__title' },
                h('span', {
                    class: 'lang-card__native',
                    lang: lang.code,
                    style: isRtlNative ? { direction: 'rtl' } : {}
                }, bdiNode(lang.native, lang.code)),
                h('span', { class: 'lang-card__name' }, lang.name)
            ),
            h('div', { class: 'lang-card__stats' },
                bucket.count
                    ? [
                        h('span', { class: 'lang-card__stat' },
                            h('span', { class: 'num' }, String(bucket.count)), ' 词'),
                        h('span', { class: 'lang-card__stat lang-card__stat--extra' },
                            '累计 ', h('span', { class: 'num' }, String(bucket.encounters))),
                        bucket.last
                            ? h('span', { class: 'lang-card__stat lang-card__stat--extra' },
                                formatRelative(bucket.last))
                            : null
                    ]
                    : h('span', { class: 'lang-card__stat lang-card__stat--empty' }, '暂无词条')
            )
            )

            attachDragHandlers(card, lang, groupKey)
            return card
        }

        /* ---------- 拖动 ---------- */
        let dragCode = null

        /* ---------- 组拖动 ---------- */
        let dragGroupKey = null

        function attachGroupDragHandlers(header, groupKey) {
            header.addEventListener('dragstart', (e) => {
                dragGroupKey = groupKey
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', groupKey)
                header.classList.add('lang-group__title--dragging')
            })

            header.addEventListener('dragend', () => {
                dragGroupKey = null
                clearGroupDragClasses()
            })

            header.addEventListener('dragover', (e) => {
                if (!dragGroupKey || dragGroupKey === groupKey) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                clearGroupDropTargets()
                header.classList.add('lang-group__title--drop-target')
            })

            header.addEventListener('dragleave', () => {
                header.classList.remove('lang-group__title--drop-target')
            })

            header.addEventListener('drop', async (e) => {
                e.preventDefault()
                header.classList.remove('lang-group__title--drop-target')
                if (!dragGroupKey || dragGroupKey === groupKey) return
                await reorderGroup(dragGroupKey, groupKey)
                dragGroupKey = null
            })
        }

        function clearGroupDragClasses() {
            document.querySelectorAll('.lang-group__title--dragging').forEach((el) => {
                el.classList.remove('lang-group__title--dragging')
            })
            clearGroupDropTargets()
        }

        function clearGroupDropTargets() {
            document.querySelectorAll('.lang-group__title--drop-target').forEach((el) => {
                el.classList.remove('lang-group__title--drop-target')
            })
        }

        async function reorderGroup(fromKey, toKey) {
            const cur = Array.isArray(settings.groupOrder) && settings.groupOrder.length
                ? [...settings.groupOrder]
                : [...DEFAULT_GROUP_ORDER]

            const fromIdx = cur.indexOf(fromKey)
            const toIdx = cur.indexOf(toKey)
            if (fromIdx === -1 || toIdx === -1) return

            cur.splice(fromIdx, 1)
            const newToIdx = cur.indexOf(toKey)
            cur.splice(newToIdx, 0, fromKey)

            settings = await saveSettings(userId, { groupOrder: cur })
            appStore.set({ settings })
            renderGroups()
        }

        function attachDragHandlers(card, lang, groupKey) {
            card.addEventListener('dragstart', (e) => {
                dragCode = lang.code
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', lang.code)
                card.classList.add('lang-card--dragging')
            })

            card.addEventListener('dragend', () => {
                dragCode = null
                clearDragClasses()
            })

            card.addEventListener('dragover', (e) => {
                if (dragGroupKey) return   
                if (!dragCode || dragCode === lang.code) return
                const dragMeta = LANGUAGE_MAP[dragCode]
                if (!dragMeta) return
                // 只允许同组
                if (Boolean(dragMeta.classical) !== Boolean(lang.classical)) {
                    e.dataTransfer.dropEffect = 'none'
                    return
                }
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                clearDropTargets()
                card.classList.add('lang-card--drop-target')
            })

            card.addEventListener('dragleave', () => {
                card.classList.remove('lang-card--drop-target')
            })

            card.addEventListener('drop', async (e) => {
                e.preventDefault()
                card.classList.remove('lang-card--drop-target')
                if (dragGroupKey) return 
                if (!dragCode || dragCode === lang.code) return

                const dragMeta = LANGUAGE_MAP[dragCode]
                if (!dragMeta) return
                if (Boolean(dragMeta.classical) !== Boolean(lang.classical)) return

                await reorderLanguage(dragCode, lang.code)
                dragCode = null
            })
        }

        function clearDragClasses() {
            document.querySelectorAll('.lang-card--dragging').forEach((el) => {
                el.classList.remove('lang-card--dragging')
            })
            clearDropTargets()
        }

        function clearDropTargets() {
            document.querySelectorAll('.lang-card--drop-target').forEach((el) => {
                el.classList.remove('lang-card--drop-target')
            })
        }

        async function reorderLanguage(fromCode, toCode) {
            const order = buildFullOrder(settings.languageOrder)

            const fromIdx = order.indexOf(fromCode)
            const toIdx = order.indexOf(toCode)
            if (fromIdx === -1 || toIdx === -1) return

            // 从数组移除 from，再插到 to 的当前索引
            order.splice(fromIdx, 1)
            const newToIdx = order.indexOf(toCode)
            order.splice(newToIdx, 0, fromCode)

            settings = await saveSettings(userId, { languageOrder: order })
            appStore.set({ settings })
            renderGroups()
        }

        /* ---------- 数据操作（沿用旧实现） ---------- */

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

        function doImport() {
            import('../components/import-words-modal.js').then(({ openImportWordsModal }) => {
                openImportWordsModal({
                    userId,
                    defaultLanguage: '',
                    grammarDoc: null,
                    title: '导入生词',
                    onDone: async (stats) => {
                        if (stats.created > 0 || stats.merged > 0) {
                            setTimeout(() => location.reload(), 800)
                        }
                    }
                })
            })
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
                try { localStorage.removeItem(LS_KEYS.user) } catch { /* ignore */ }
                appStore.set({ user: null, userId: null, settings: null })
                location.hash = '#/welcome'
            } catch (err) {
                toast.error(`清空失败：${err.message}`)
            }
        }

        /* ---------- 首次渲染 ---------- */
        renderHead()
        renderGroups()
    }
}

/* ---------------- 工具 ---------------- */

/**
 * 按 settings.languageOrder 排序，未在 order 中的按 LANGUAGES 原顺序追加。
 */
function orderedLanguages(order) {
    const arr = Array.isArray(order) ? order : []
    const posMap = new Map(arr.map((c, i) => [c, i]))

    return [...LANGUAGES].sort((a, b) => {
        const ai = posMap.has(a.code) ? posMap.get(a.code) : Infinity
        const bi = posMap.has(b.code) ? posMap.get(b.code) : Infinity
        if (ai !== bi) return ai - bi
        return LANGUAGES.indexOf(a) - LANGUAGES.indexOf(b)
    })
}

/**
 * 补齐所有语言 code，返回完整顺序数组。
 * 保证 reorder 时拿到的是全量列表，不受 settings 里存的子集影响。
 */
function buildFullOrder(order) {
    const arr = Array.isArray(order) ? [...order] : []
    const seen = new Set(arr)
    for (const l of LANGUAGES) {
        if (!seen.has(l.code)) {
            arr.push(l.code)
            seen.add(l.code)
        }
    }
    return arr
}
