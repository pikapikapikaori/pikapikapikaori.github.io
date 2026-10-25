/** 设置 */

import { h, replace } from '../utils/dom.js'
import { appStore, setSettings } from '../app-state.js'
import { getSettings, saveSettings } from '../store/settings-store.js'
import { exportUser, importUser } from '../services/import-export-service.js'
import { listAll } from '../store/word-store.js'
import { deleteUser } from '../store/user-store.js'
import { toast } from '../components/toast.js'
import { confirmModal } from '../components/modal.js'
import {
    applyFont, applyLocalFontFile, applyFontSize, FONT_MODES, FONT_SIZES,
    getStoredFontMode, getStoredFontFamily, getStoredFontSize
} from '../services/font-service.js'
import { REVIEW_ORDERS } from '../services/review-service.js'
import { LS_KEYS, PAGE_SIZE_OPTIONS, THEMES } from '../config/config.js'
import { verifyGrammarFiles } from '../services/grammar-service.js'
import { openGrammarVerifyModal } from '../components/grammar-verify-modal.js'
import { applyTheme, currentTheme } from '../components/theme-toggle.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const state = appStore.get()
        const userId = state.userId
        const user = state.user

        setBreadcrumbs([
            { label: '语言选择', href: '#/languages' },
            { label: '设置' }
        ])

        let settings = await getSettings(userId)

        /* ---------- 头部 ---------- */
        const head = h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' }, '设置'),
                h('div', { class: 'page-head__sub' }, `当前用户：${user.name}`)
            )
        )

        const container = h('div', {})
        replace(main, head, container)

        /* ---------- 通用更新函数 ---------- */
        async function patchSettings(patch) {
            settings = await saveSettings(userId, patch)
            setSettings(settings)
            return settings
        }

        /* ---------- 外观 ---------- */
        container.appendChild(buildSection('外观',
            row('主题', 'auto / light / dark',
                selectControl(
                    THEMES.map((t) => ({ value: t.value, label: t.label })),
                    currentTheme(),
                    async (v) => {
                        applyTheme(v)
                        await patchSettings({ theme: v })
                    }
                )
            ),
            row('界面字体', '内置 / 系统 / 本地',
                fontControl()
            ),
            row('字号', '只影响文字，间距不变',
                selectControl(
                    FONT_SIZES.map((f) => ({ value: f.value, label: f.label })),
                    getStoredFontSize(),
                    (v) => applyFontSize(v)
                )
            )
        ))

        /* ---------- 列表 ---------- */
        container.appendChild(buildSection('列表与复习',
            row('每页卡片数', '20 - 50',
                selectControl(
                    PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: `${n} 张` })),
                    String(settings.pageSize),
                    async (v) => { await patchSettings({ pageSize: Number(v) }) }
                )
            ),
            row('复习顺序', '影响随机卡片队列',
                selectControl(
                    REVIEW_ORDERS.map((r) => ({ value: r.value, label: r.label })),
                    settings.reviewOrder,
                    async (v) => { await patchSettings({ reviewOrder: v }) }
                )
            )
        ))

        /* ---------- 数据管理 ---------- */
        container.appendChild(buildSection('数据管理',
            row('导出 JSON', '导出当前用户全部语言的全部词条与设置',
                h('button', {
                    class: 'btn btn--primary', type: 'button',
                    onclick: doExport
                }, '导出')
            ),
            row('导入 JSON', '词条按唯一键合并，不会覆盖复习记录',
                h('label', { class: 'btn', style: { cursor: 'pointer' } },
                    '选择文件',
                    h('input', {
                        type: 'file',
                        accept: '.json,application/json',
                        hidden: true,
                        onchange: doImportFile
                    })
                )
            ),
            row('清空当前用户数据', '删除本用户全部词条与设置，用户本身也会删除，不可恢复',
                h('button', {
                    class: 'btn btn--danger', type: 'button',
                    onclick: doClearUser
                }, '清空数据')
            )
        ))

        /* ---------- 语法数据 ---------- */
        container.appendChild(buildSection('语法数据',
            row('校验语法 JSON',
                '逐个检查全部语言：结构（字段 / 锚点 id / 跨字段引用）与 derive 规则（按词干生成表格后与 expect 比对）',
                h('button', {
                    class: 'btn', type: 'button',
                    onclick: (e) => doVerifyGrammar(e.currentTarget)
                }, '开始校验')
            )
        ))

        /* ---------- 关于 ---------- */
        container.appendChild(buildSection('关于',
            row('数据存储', '所有数据存放在浏览器本地 IndexedDB，不上传任何服务器', null),
            row('版本', 'v1', null)
        ))

        /* ---------- 内部实现 ---------- */

        function buildSection(title, ...rows) {
            return h('section', { class: 'settings-section' },
                h('div', { class: 'settings-section__title' }, title),
                ...rows.filter(Boolean)
            )
        }

        function row(label, desc, control) {
            return h('div', { class: 'settings-row' },
                h('div', { style: { minWidth: 0, flex: '1 1 240px' } },
                    h('div', { class: 'settings-row__label' }, label),
                    desc ? h('div', { class: 'settings-row__desc' }, desc) : null
                ),
                control
                    ? h('div', { class: 'settings-row__control' }, control)
                    : null
            )
        }

        function selectControl(options, value, onChange) {
            return h('select', {
                class: 'select',
                style: { minWidth: '140px' },
                onchange: (e) => onChange(e.target.value)
            }, ...options.map((o) => h('option', {
                value: o.value,
                selected: String(value) === String(o.value)
            }, o.label)))
        }

        /* ---------- 字体 ---------- */

        function fontControl() {
            const currentMode = getStoredFontMode()
            const currentFamily = getStoredFontFamily()

            const modeSelect = selectControl(
                FONT_MODES.map((m) => ({ value: m.value, label: m.label })),
                currentMode,
                async (v) => {
                    if (v === 'local') {
                        fileInput.click()
                        // 文件选好前不落库：避免留下一个没有字体的本地模式
                        return
                    }
                    applyFont({ mode: v })
                    await patchSettings({ fontMode: v, fontFamily: null })
                }
            )

            const fileInput = h('input', {
                type: 'file',
                accept: '.woff2,.woff,.ttf,.otf,font/*',
                hidden: true,
                onchange: async (e) => {
                    const f = e.target.files && e.target.files[0]
                    e.target.value = ''
                    if (!f) return
                    try {
                        const { name } = await applyLocalFontFile(f)
                        await patchSettings({ fontMode: 'local', fontFamily: name })
                        toast.success(`已应用本地字体：${name}`)
                    } catch (err) {
                        toast.error(`字体加载失败：${err.message}`)
                    }
                }
            })

            const wrap = h('div', { style: { display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' } },
                modeSelect,
                h('button', {
                    class: 'btn btn--sm', type: 'button',
                    title: '选择本地字体文件',
                    onclick: () => fileInput.click()
                }, '选择字体文件'),
                fileInput,
                currentMode === 'local' && currentFamily
                    ? h('span', { class: 'badge' }, currentFamily)
                    : null
            )

            return wrap
        }

        /* ---------- 数据管理实现 ---------- */

        async function doExport() {
            try {
                const words = await listAll(userId)
                const s = await getSettings(userId)
                const name = await exportUser(user, s, words)
                toast.success(`已导出 ${name}`, 3600)
            } catch (err) {
                toast.error(`导出失败：${err.message}`)
            }
        }

        async function doImportFile(e) {
            const f = e.target.files && e.target.files[0]
            e.target.value = ''
            if (!f) return

            const ok = await confirmModal({
                title: '导入 JSON',
                message: '词条按「语言 + 基本形态 + 词性」合并；已有复习记录不会被覆盖。继续？',
                confirmLabel: '导入'
            })
            if (!ok) return

            try {
                const { stats } = await importUser(f, {
                    mode: 'replace',
                    targetUserId: userId
                })
                toast.success(
                    `导入完成：新增 ${stats.created} · 合并 ${stats.merged} · 跳过 ${stats.skipped}`,
                    5000
                )
            } catch (err) {
                console.error(err)
                toast.error(`导入失败：${err.message}`, 6000)
            }
        }

        /** 校验全部语言的语法 JSON：结构 + derive，结果放浮层里 */
        async function doVerifyGrammar(btn) {
            const label = btn.textContent
            btn.disabled = true
            const started = performance.now()
            try {
                const results = await verifyGrammarFiles({
                    onProgress: (done, total, code) => {
                        btn.textContent = `校验中… ${done + 1}/${total} ${code}`
                    }
                })
                openGrammarVerifyModal({ results, elapsed: performance.now() - started })
            } catch (err) {
                console.error(err)
                toast.error(`校验失败：${err.message}`, 6000)
            } finally {
                btn.disabled = false
                btn.textContent = label
            }
        }

        async function doClearUser() {
            const ok = await confirmModal({
                title: '清空当前用户数据',
                message: `将删除「${user.name}」的全部词条与设置，用户本身也会被删除。此操作不可恢复。`,
                confirmLabel: '清空并删除',
                danger: true
            })
            if (!ok) return
            try {
                await deleteUser(userId)
                try { localStorage.removeItem(LS_KEYS.user) } catch { /* ignore */ }
                appStore.set({ user: null, userId: null, settings: null })
                location.hash = '#/welcome'
            } catch (err) {
                toast.error(`清空失败：${err.message}`)
            }
        }
    }
}
