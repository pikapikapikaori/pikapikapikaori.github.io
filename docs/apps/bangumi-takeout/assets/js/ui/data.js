import { clearCurrentUser, state } from '../app.js'
import { clearCachedData, items, meta } from '../storage.js'
import { exportUserData, downloadBlob } from '../backup/exporter.js'
import { listCredentials, removeCredential } from '../backup/auth.js'
import { makeMenuButton, paintMenuButton } from '../dom.js'
import { syncHeader } from '../layout.js'
import { closeMenu, openMenu } from './menu.js'

let exportTarget = ''
let credentialTarget = ''
let busy = false

function setStatus(message, kind = '') {
    const el = document.getElementById('data-status')
    if (!el) return
    el.textContent = message
    el.className = 'form-status' + (kind ? ' is-' + kind : '')
}

export async function renderData() {
    const main = document.getElementById('main')
    if (!main) return
    // Async handlers may finish after the route changed.
    if (main.dataset.route !== 'data') return
    closeMenu()

    const [records, credentials] = await Promise.all([meta.list(), listCredentials()])
    const recordNames = records.map(record => record.username).filter(Boolean)
    const counts = await Promise.all(recordNames.map(name => items.countByOwner(name)))
    // The route may have changed while the stores were read.
    if (main.dataset.route !== 'data') return
    const cache = new Map()
    recordNames.forEach((name, index) => {
        if (counts[index] > 0) cache.set(name, counts[index])
    })
    const cacheNames = Array.from(cache.keys())
    const totalItems = cacheNames.reduce((sum, name) => sum + cache.get(name), 0)
    const credentialNames = credentials.map(item => item.username)

    if (!cache.has(exportTarget)) {
        const viewUser = state.data?.user?.username
        exportTarget = cache.has(viewUser) ? viewUser : (cacheNames[0] || '')
    }
    if (!credentialNames.includes(credentialTarget)) {
        credentialTarget = credentialNames.includes(state.data?.user?.username)
            ? state.data.user.username
            : (credentialNames[0] || '')
    }

    const exportCount = cache.get(exportTarget) || 0

    main.innerHTML = `
        <div class="data-wrap">
            <h1 class="data-title">数据管理</h1>

            <section class="data-card">
                <h2>导出备份</h2>
                <div class="data-row">
                    <span class="data-key">导出目标</span>
                    <span id="export-target-slot"></span>
                </div>
                <div class="data-action-row">
                    <h3>该账号缓存条目</h3>
                    <button type="button" class="btn btn-primary" id="export-now"
                        ${exportTarget && !busy ? '' : 'disabled'}>导出备份</button>
                </div>
                <div class="data-subline" id="export-count">${exportCount} 条</div>
            </section>

            <section class="data-card">
                <h2>清除缓存</h2>
                <div class="data-action-row">
                    <h3>缓存数据</h3>
                    <button type="button" class="btn" id="clear-cache" ${cacheNames.length && !busy ? '' : 'disabled'}>清除缓存</button>
                </div>
                <div class="data-subline">有缓存账号 ${cacheNames.length} 个 · ${totalItems} 条 · 本地凭证 ${credentialNames.length} 个</div>
            </section>

            <section class="data-card">
                <h2>凭证管理</h2>
                <div class="data-row">
                    <span class="data-key">账号</span>
                    <span id="credential-target-slot"></span>
                </div>
                <div class="data-action-row">
                    <h3>本机凭证</h3>
                    <button type="button" class="btn" id="remove-credential"
                        ${credentialTarget && !busy ? '' : 'disabled'}>移除本地凭证</button>
                </div>
                <div class="data-subline">只删除该账号在本机的登录凭证，收藏缓存保留。</div>
            </section>

            <div class="form-status" id="data-status" role="status" aria-live="polite"></div>
        </div>
    `

    const exportSlot = main.querySelector('#export-target-slot')
    const exportButton = makeMenuButton(
        exportTarget ? exportTarget : '无可导出账号',
        { disabled: !cacheNames.length || busy }
    )
    exportSlot.appendChild(exportButton)
    exportButton.addEventListener('click', () => {
        if (exportButton.disabled) return
        openMenu({
            anchor: exportButton,
            items: cacheNames.map(name => ({
                value: name,
                label: name,
                tag: cache.get(name) + ' 条',
            })),
            current: exportTarget,
            emptyText: '没有可导出的账号',
            onPick: value => {
                exportTarget = value
                paintMenuButton(exportButton, value)
                const countEl = main.querySelector('#export-count')
                if (countEl) countEl.textContent = (cache.get(value) || 0) + ' 条'
                const exportNow = main.querySelector('#export-now')
                if (exportNow) exportNow.disabled = busy
            },
        })
    })

    main.querySelector('#export-now').addEventListener('click', async () => {
        if (!exportTarget || busy) return
        busy = true
        main.querySelector('#export-now').disabled = true
        setStatus('正在导出…')
        try {
            const result = await exportUserData(exportTarget)
            downloadBlob(result.blob, result.filename)
            setStatus(`已导出 ${result.count} 条`)
        } catch (error) {
            setStatus(error?.message || String(error), 'error')
        } finally {
            busy = false
            const button = main.querySelector('#export-now')
            if (button) button.disabled = false
        }
    })

    main.querySelector('#clear-cache').addEventListener('click', async () => {
        if (busy) return
        if (!window.confirm('确定清除所有本地收藏缓存与断点吗？已保存凭证的账号会保留账号记录与凭证。')) return
        busy = true
        setStatus('正在清除缓存…')
        try {
            await clearCachedData()
            clearCurrentUser()
            exportTarget = ''
            credentialTarget = ''
            busy = false
            syncHeader()
            await renderData()
            setStatus('已清除缓存；已保存凭证的账号记录与凭证仍保留')
        } catch (error) {
            busy = false
            setStatus(error?.message || String(error), 'error')
        }
    })

    const credentialSlot = main.querySelector('#credential-target-slot')
    const credentialButton = makeMenuButton(
        credentialTarget || '暂无账号',
        { disabled: !credentialNames.length || busy }
    )
    credentialSlot.appendChild(credentialButton)
    credentialButton.addEventListener('click', () => {
        if (credentialButton.disabled) return
        openMenu({
            anchor: credentialButton,
            items: credentialNames.map(name => ({ value: name, label: name })),
            current: credentialTarget,
            emptyText: '暂无已保存凭证',
            onPick: value => {
                credentialTarget = value
                paintMenuButton(credentialButton, value)
                const remove = main.querySelector('#remove-credential')
                if (remove) remove.disabled = busy
            },
        })
    })

    main.querySelector('#remove-credential').addEventListener('click', async () => {
        if (!credentialTarget || busy) return
        const name = credentialTarget
        busy = true
        setStatus('正在移除凭证…')
        try {
            await removeCredential(name)
            credentialTarget = ''
            busy = false
            await renderData()
            setStatus(`已移除 ${name} 的本地凭证；数据保留`)
        } catch (error) {
            busy = false
            setStatus(error?.message || String(error), 'error')
        }
    })
}
