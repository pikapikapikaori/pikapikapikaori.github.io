import { h, replace } from '../utils/dom.js'
import { appStore, setSettings, setUser } from '../app-state.js'
import { getSettings, saveSettings } from '../store/settings-store.js'
import { exportUser, importUser } from '../services/import-export-service.js'
import { listNotes } from '../store/note-store.js'
import { listAll } from '../store/word-store.js'
import { deleteUser, saveUser } from '../store/user-store.js'
import { clearHttpCache } from '../store/http-cache.js'
import { toast } from '../components/toast.js'
import { confirmModal } from '../components/modal.js'
import {
    applyFont, applyLocalFontFile, applyFontSize, FONT_MODES, FONT_SIZES,
    getStoredFontMode, getStoredFontSize
} from '../services/font-service.js'
import { REVIEW_ORDERS } from '../services/review-service.js'
import { PAGE_SIZE_OPTIONS, THEMES } from '../config/config.js'
import { LS_KEYS, remove } from '../store/local-storage.js'
import { verifyGrammarFiles } from '../services/grammar-service.js'
import { openGrammarVerifyModal } from '../components/grammar-verify-modal.js'
import { applyTheme, currentTheme } from '../components/theme-toggle.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import { NO_SPACE, watchSpaceFields } from '../utils/space-filter.js'

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const state = appStore.get()
        const userId = state.userId
        let user = state.user

        setBreadcrumbs([
            { label: '语言列表', href: '#/languages' },
            { label: '设置' }
        ])

        let settings = await getSettings(userId)

        const headSub = h('div', { class: 'page-head__sub' }, `当前用户：${user.name}`)
        const head = h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' }, '设置'),
                headSub
            )
        )

        const container = h('div', {})
        replace(main, head, container)
        watchSpaceFields(container)

        async function patchSettings(patch) {
            settings = await saveSettings(userId, patch)
            setSettings(settings)
            return settings
        }

        const nameInput = h('input', {
            class: 'input',
            style: { width: '142px' },
            dataset: { space: NO_SPACE },
            value: user.name,
            onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.blur() },
            onblur: () => { commitUserName() }
        })

        async function commitUserName() {
            const name = String(nameInput.value || '').replace(/\s+/g, '') || '未命名用户'
            nameInput.value = name
            if (name === user.name) return
            const prev = user
            user = { ...user, name }
            setUser(user)
            headSub.textContent = `当前用户：${user.name}`
            try {
                user = await saveUser(user)
                setUser(user)
            } catch (err) {
                user = prev
                setUser(user)
                headSub.textContent = `当前用户：${user.name}`
                nameInput.value = user.name
                toast.error(`改名失败：${err.message}`)
            }
        }

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
            row('字号', null,
                selectControl(
                    FONT_SIZES.map((f) => ({ value: f.value, label: f.label })),
                    getStoredFontSize(),
                    (v) => applyFontSize(v)
                )
            )
        ))

        container.appendChild(buildSection('列表与复习',
            row('每页卡片数', '20 - 50',
                selectControl(
                    PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: `${n} 张` })),
                    String(settings.pageSize),
                    async (v) => { await patchSettings({ pageSize: Number(v) }) }
                )
            ),
            row('复习顺序', null,
                selectControl(
                    REVIEW_ORDERS.map((r) => ({ value: r.value, label: r.label })),
                    settings.reviewOrder,
                    async (v) => { await patchSettings({ reviewOrder: v }) }
                )
            )
        ))

        container.appendChild(buildSection('用户设置',
            row('用户名', '不可含空格；改完失焦即保存', nameInput),
            row('导出 JSON', null,
                h('button', {
                    class: 'btn btn--primary', type: 'button',
                    onclick: doExport
                }, '导出')
            ),
            row('导入 JSON', '词按语言 + 基本形态 + 词性合并，复习记录保留；笔记按语言整份覆盖',
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
            row('清空当前用户数据', null,
                h('button', {
                    class: 'btn btn--danger', type: 'button',
                    onclick: doClearUser
                }, '清空数据')
            )
        ))

        container.appendChild(buildSection('语法数据',
            row('校验语法 JSON',
                '检查全部语言的结构与词形生成规则',
                h('button', {
                    class: 'btn', type: 'button',
                    onclick: (e) => doVerifyGrammar(e.currentTarget)
                }, '开始校验')
            )
        ))

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
                style: { width: '142px' },
                onchange: (e) => onChange(e.target.value)
            }, ...options.map((o) => h('option', {
                value: o.value,
                selected: String(value) === String(o.value)
            }, o.label)))
        }

        function fontControl() {
            function restoreMode() {
                modeSelect.value = getStoredFontMode()
            }

            function pickFile() {
                const onCancel = () => restoreMode()
                fileInput.addEventListener('cancel', onCancel, { once: true })
                const onFocus = () => {
                    setTimeout(() => {
                        window.removeEventListener('focus', onFocus)
                        fileInput.removeEventListener('cancel', onCancel)
                        if (!fileInput.files || !fileInput.files.length) restoreMode()
                    }, 0)
                }
                window.addEventListener('focus', onFocus)
                fileInput.click()
            }

            const modeSelect = selectControl(
                FONT_MODES.map((m) => ({ value: m.value, label: m.label })),
                getStoredFontMode(),
                async (v) => {
                    if (v === 'local') {
                        pickFile()
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
                    if (!f) {
                        restoreMode()
                        return
                    }
                    try {
                        const { name } = await applyLocalFontFile(f)
                        await patchSettings({ fontMode: 'local', fontFamily: name })
                        modeSelect.value = 'local'
                        toast.success(`已应用本地字体：${name}`)
                    } catch (err) {
                        toast.error(`字体加载失败：${err.message}`)
                        restoreMode()
                    }
                }
            })

            return h('span', { class: 'settings-row__inline' }, modeSelect, fileInput)
        }

        async function doExport() {
            try {
                const words = await listAll(userId)
                const s = await getSettings(userId)
                const notes = await listNotes(userId)
                const name = await exportUser(user, s, words, notes)
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
                message: '同一语言、同一基本形态与词性的生词会合并，复习记录保留；笔记会按语言整份覆盖。继续？',
                confirmLabel: '导入'
            })
            if (!ok) return

            try {
                const { stats } = await importUser(f, {
                    mode: 'replace',
                    targetUserId: userId
                })
                toast.success(
                    `导入完成：新增 ${stats.created} · 合并 ${stats.merged} · 跳过 ${stats.skipped}`
                    + (stats.notes ? ` · 笔记 ${stats.notes}` : ''),
                    5000
                )
            } catch (err) {
                toast.error(`导入失败：${err.message}`, 6000)
            }
        }

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
                toast.error(`校验失败：${err.message}`, 6000)
            } finally {
                btn.disabled = false
                btn.textContent = label
            }
        }

        async function doClearUser() {
            const ok = await confirmModal({
                title: '清空当前用户数据',
                message: `将删除「${user.name}」的全部生词与设置，用户也会被删除。此操作不可恢复。`,
                confirmLabel: '清空并删除',
                danger: true
            })
            if (!ok) return
            try {
                await deleteUser(userId)
                remove(LS_KEYS.user)
                appStore.set({ user: null, userId: null, settings: null })
                clearHttpCache().catch(() => {})
                location.hash = '#/welcome'
            } catch (err) {
                toast.error(`清空失败：${err.message}`)
            }
        }

        return () => { commitUserName() }
    }
}
