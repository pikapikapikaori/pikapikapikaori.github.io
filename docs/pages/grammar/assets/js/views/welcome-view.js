/** 起始页：选择已有用户 / 新建空用户 / 导入 JSON */

import { h, replace } from '../utils/dom.js'
import { listUsers, getUser, deleteUser } from '../store/user-store.js'
import { getSettings } from '../store/settings-store.js'
import { listAll } from '../store/word-store.js'
import { createEmptyUser, importUser } from '../services/import-export-service.js'
import { setUser, setSettings } from '../app-state.js'
import { toast } from '../components/toast.js'
import { confirmModal, openModal } from '../components/modal.js'
import { formatDate } from '../utils/date.js'
import { LS_KEYS } from '../config/config.js'

const LS_USER_KEY = LS_KEYS.user
const LS_THEME_KEY = LS_KEYS.theme

async function enterUser(userId) {
    const u = await getUser(userId)
    if (!u) { toast.error('用户不存在'); return }
    try { localStorage.setItem(LS_USER_KEY, userId) } catch { /* ignore */ }
    setUser(u)
    const s = await getSettings(userId)
    setSettings(s)
    if (s.theme) {
        try { localStorage.setItem(LS_THEME_KEY, s.theme) } catch { /* ignore */ }
        document.documentElement.setAttribute('data-theme', s.theme)
    }
    location.hash = '#/languages'
}

async function statsOf(userId) {
    try {
        const all = await listAll(userId)
        const langSet = new Set(all.map((w) => w.language))
        return { total: all.length, langs: langSet.size }
    } catch {
        return { total: 0, langs: 0 }
    }
}

const welcomeView = {
    needsUser: false,
    layout: 'full',

    async mount(root) {
        const users = await listUsers()

        const panel = h('div', { class: 'welcome__panel' },
            h('h1', { class: 'welcome__title' }, '语言生词本'),
            h('p', { class: 'welcome__sub' }, '选择已有用户，或新建 / 导入一个用户。所有数据都保存在本地浏览器。')
        )

        /* ---------- 操作按钮 ---------- */
        const fileInput = h('input', {
            type: 'file',
            accept: 'application/json,.json',
            hidden: true,
            onchange: async (e) => {
                const f = e.target.files && e.target.files[0]
                e.target.value = ''
                if (!f) return
                await doImport(f)
            }
        })

        const actions = h('div', { class: 'welcome__actions' },
            h('button', {
                class: 'btn btn--primary btn--lg',
                type: 'button',
                onclick: doCreateEmpty
            }, '新建空用户'),
            h('label', { class: 'btn btn--lg', style: { cursor: 'pointer' } },
                '导入 JSON 文件',
                fileInput
            ),
            h('button', {
                class: 'btn btn--lg',
                type: 'button',
                onclick: doPasteImport
            }, '粘贴 JSON')
        )
        panel.appendChild(actions)

        /* ---------- 用户列表 ---------- */
        if (users.length) {
            const list = h('div', { class: 'user-list' })
            for (const u of users) {
                list.appendChild(renderUserItem(u))
            }
            panel.appendChild(h('div', { class: 'welcome__users' },
                h('h3', {}, `已有用户（${users.length}）`),
                list
            ))
        }

        replace(root, h('div', { class: 'welcome' }, panel))

        /* ---------- 内部函数 ---------- */

        function renderUserItem(user) {
            const meta = h('div', { class: 'user-item__meta' },
                `创建于 ${formatDate(user.createdAt)}`
            )
            const item = h('div', { class: 'user-item' },
                h('div', { style: { minWidth: 0 } },
                    h('div', { class: 'user-item__name' }, user.name),
                    meta
                ),
                h('div', { class: 'user-item__actions' },
                    h('button', {
                        class: 'btn btn--primary btn--sm',
                        type: 'button',
                        onclick: () => enterUser(user.id)
                    }, '进入'),
                    h('button', {
                        class: 'btn btn--danger btn--sm',
                        type: 'button',
                        onclick: () => doDeleteUser(user)
                    }, '删除')
                )
            )

            statsOf(user.id).then(({ total, langs }) => {
                meta.textContent = `创建于 ${formatDate(user.createdAt)} · ${total} 词 · ${langs} 语言`
            })

            return item
        }

        async function doCreateEmpty() {
            try {
                const name = nextUserName(users)
                const { user } = await createEmptyUser(name)
                toast.success(`已创建「${user.name}」`)
                await enterUser(user.id)
            } catch (err) {
                toast.error(`创建失败：${err.message}`)
            }
        }

        function nextUserName(list) {
            const base = '默认用户'
            const used = new Set(list.map((u) => u.name))
            if (!used.has(base)) return base
            let i = 2
            while (used.has(`${base} ${i}`)) i += 1
            return `${base} ${i}`
        }

        async function doImport(file) {
            try {
                const { user, stats } = await importUser(file, { mode: 'new' })
                toast.success(
                    `已导入「${user.name}」：新增 ${stats.created} · 合并 ${stats.merged} · 跳过 ${stats.skipped}`,
                    5000
                )
                await enterUser(user.id)
            } catch (err) {
                console.error(err)
                toast.error(`导入失败：${err.message}`, 6000)
            }
        }

        function doPasteImport() {
            const textarea = h('textarea', {
                class: 'textarea',
                placeholder: '把用户 JSON 粘贴到这里…',
                style: { minHeight: '220px', fontFamily: 'var(--ff-mono)', fontSize: 'var(--fs-sm)' }
            })

            openModal({
                title: '粘贴 JSON 导入',
                body: textarea,
                actions: [
                    { label: '取消' },
                    {
                        label: '导入',
                        className: 'btn--primary',
                        onClick: async () => {
                            const text = textarea.value.trim()
                            if (!text) {
                                toast.error('内容为空')
                                throw new Error('empty')
                            }
                            const { user, stats } = await importUser(text, { mode: 'new' })
                            toast.success(
                                `已导入「${user.name}」：新增 ${stats.created} · 合并 ${stats.merged} · 跳过 ${stats.skipped}`,
                                5000
                            )
                            await enterUser(user.id)
                        }
                    }
                ]
            })
        }

        async function doDeleteUser(user) {
            const ok = await confirmModal({
                title: '删除用户',
                message: `确定删除「${user.name}」及其全部词条？此操作不可恢复。`,
                confirmLabel: '删除',
                danger: true
            })
            if (!ok) return
            try {
                await deleteUser(user.id)
                try {
                    if (localStorage.getItem(LS_USER_KEY) === user.id) {
                        localStorage.removeItem(LS_USER_KEY)
                    }
                } catch { /* ignore */ }
                toast.success('已删除')
                await welcomeView.mount(root)
            } catch (err) {
                toast.error(`删除失败：${err.message}`)
            }
        }
    }
}

export default welcomeView
