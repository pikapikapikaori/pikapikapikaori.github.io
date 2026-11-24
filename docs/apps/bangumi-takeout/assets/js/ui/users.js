import { state, importExport, loadUser, selectUser } from '../app.js'
import { items, meta, updateMeta } from '../storage.js'
import { getExternal } from '../external.js'
import { loadFromUrl } from '../source.js'
import { getDefaultSource, href } from '../config.js'
import { escapeHtml, unique } from '../dom.js'
import { beginLoading } from './loading.js'

let busy = false
let viewToken = 0
let defaultUsername = ''
let defaultDataUrl = ''

function setStatus(message, kind = '') {
    const el = document.getElementById('users-status')
    if (!el) return
    el.textContent = message
    el.className = 'form-status' + (kind ? ' is-' + kind : '')
}

export async function renderUsers() {
    const main = document.getElementById('main')
    if (!main) return
    const token = ++viewToken

    const source = getDefaultSource()
    defaultUsername = source?.username || ''
    defaultDataUrl = source?.dataUrl || ''

    const external = getExternal()
    const [records, credentials] = await Promise.all([meta.list(), external.listCredentials()])
    const credentialNames = new Set(credentials.map(item => item.username))
    const recordNameSet = new Set(records.map(record => record.username).filter(Boolean))
    const names = unique([defaultUsername, ...recordNameSet, ...credentials.map(item => item.username)])
        .filter(Boolean)
    const counts = await Promise.all(names.map(name => items.countByOwner(name)))
    if (main.dataset.route !== 'users') return
    const current = state.data?.user?.username || ''

    main.innerHTML = `
        <div class="users-wrap">
            <h1 class="users-title">选择用户</h1>
            <div class="user-pick-list" role="listbox" aria-label="本地用户">
                ${names.map((name, index) => {
                    const count = counts[index] || 0
                    const hasCredential = credentialNames.has(name)
                    const onlyCredential = hasCredential && count === 0
                    const metaText = count > 0
                        ? '本地缓存 ' + count + ' 条' + (hasCredential ? ' · 已保存凭证' : '')
                        : hasCredential
                            ? '无本地缓存 · 已保存凭证'
                            : '无本地缓存'
                    const tags = []
                    if (name === defaultUsername) tags.push('默认')
                    if (onlyCredential) tags.push('仅有凭证')
                    return `
                        <button type="button" class="user-pick ${name === current ? 'is-current' : ''}"
                            role="option" aria-selected="${name === current}" data-user="${escapeHtml(name)}"
                            data-credential="${hasCredential ? '1' : '0'}">
                            <span class="avatar avatar-fallback">${escapeHtml(name.slice(0, 1))}</span>
                            <span>
                                <span class="user-pick-name">${escapeHtml(name)}</span>
                                <span class="user-pick-meta">${metaText}</span>
                            </span>
                            ${tags.length ? `<span class="user-pick-tag">${tags.join(' · ')}</span>` : ''}
                        </button>
                    `
                }).join('')}
            </div>
            <div class="form-status" id="users-status" role="status" aria-live="polite"></div>
        </div>
    `

    const buttons = Array.from(main.querySelectorAll('[data-user]'))
    buttons.forEach(button => {
        button.addEventListener('click', () => choose(
            button.dataset.user, buttons, button.dataset.credential === '1', main, token, button
        ))
    })
}

async function ensureEmptyUser(name) {
    await updateMeta(name, record => {
        if (record) return { record: null, value: false }
        return {
            record: {
                username: name,
                user: { username: name },
                generated_at: 0,
                updated_at: Date.now(),
                completeness: { total: 0, done: 0 },
                task: null,
            },
            value: true,
        }
    })
}

function redirectIfCurrent(main, token) {
    if (token !== viewToken || main.dataset.route !== 'users') return false
    location.href = href.index
    return true
}

async function choose(name, buttons, hasCredential, main, token, trigger) {
    if (!name || busy) return
    busy = true
    buttons.forEach(button => { button.disabled = true })
    const loading = beginLoading('正在切换到 ' + name + '…', { returnFocus: trigger || null })
    try {
        let activeName = name
        let hit = await loadUser(name)
        if ((!hit || !hit.items.length) && defaultDataUrl && name === defaultUsername) {
            loading.setLabel('正在加载默认数据…')
            try {
                const raw = await loadFromUrl(defaultDataUrl)
                await importExport(raw)
                hit = state.data
                activeName = hit?.user?.username || name
            } catch (error) {
                if (!hasCredential) throw error
                hit = null
            }
        }
        if (!hit) {
            if (hasCredential) {
                await ensureEmptyUser(name)
                const empty = await loadUser(name)
                state.data = empty || { user: { username: name }, generatedAt: 0, items: [] }
                selectUser(name)
                redirectIfCurrent(main, token)
                return
            }
            throw new Error('没有该用户的本地数据')
        }
        state.data = hit
        selectUser(activeName)
        redirectIfCurrent(main, token)
    } catch (error) {
        setStatus(error?.message || String(error), 'error')
    } finally {
        busy = false
        buttons.forEach(button => { button.disabled = false })
        loading.close()
    }
}
