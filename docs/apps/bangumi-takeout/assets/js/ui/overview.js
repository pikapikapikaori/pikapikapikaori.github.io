import { state } from '../app.js'
import {
    categories, statusOrder, sortOptions, defaultSort,
    sortDirectionLabels, defaultSortDirection, sortDirectionIcons,
    rateFilterOptions, defaultRateFilter, defaultTagFilter,
    statusLabels, commonStatusLabels,
    pageSizeOptions, defaultPageSize,
    stateKey, href,
} from '../config.js'
import { sortItems, filterByRate, filterByTag, countByCategory } from '../model.js'
import { escapeHtml, makeMenuButton } from '../dom.js'
import { closeMenu, openMenu } from './menu.js'

let currentCat = 'anime'
let currentStatus = 'doing'
let currentSort = defaultSort
let currentOrder = defaultSortDirection
let currentRateFilter = defaultRateFilter
let currentTagFilter = defaultTagFilter
let currentPage = 1
let pageSize = defaultPageSize
let initialized = false
let activeUser = ''

function resetViewState() {
    currentCat = 'anime'
    currentStatus = 'doing'
    currentSort = defaultSort
    currentOrder = defaultSortDirection
    currentRateFilter = defaultRateFilter
    currentTagFilter = defaultTagFilter
    currentPage = 1
    pageSize = defaultPageSize
}

function resetPage() { currentPage = 1 }

function getStateKey() {
    const username = state.data?.user?.username
    return username ? `${stateKey}:${username}` : stateKey
}

function readSort(value, order) {
    const raw = String(value ?? '')
    currentSort = sortOptions.some(o => o.key === raw) ? raw : defaultSort
    currentOrder = order === 'asc' ? 'asc' : defaultSortDirection
}

function initState() {
    try {
        const raw = localStorage.getItem(getStateKey())
        if (raw) {
            const s = JSON.parse(raw)
            if (s.cat && categories.some(c => c.key === s.cat)) currentCat = s.cat
            if (s.status && statusOrder.includes(s.status)) currentStatus = s.status
            if (s.sort) readSort(s.sort, s.order)
            if (rateFilterOptions.some(o => o.key === s.rate)) currentRateFilter = s.rate
            if (typeof s.tag === 'string') currentTagFilter = s.tag
            if (s.pageSize && pageSizeOptions.includes(Number(s.pageSize))) {
                pageSize = Number(s.pageSize)
            }
            const page = Number(s.page)
            if (Number.isInteger(page) && page > 0) currentPage = page
        }
    } catch {}
}

function saveState() {
    try {
        localStorage.setItem(getStateKey(), JSON.stringify({
            cat: currentCat,
            status: currentStatus,
            sort: currentSort,
            order: currentOrder,
            rate: currentRateFilter,
            tag: currentTagFilter,
            page: currentPage,
            pageSize,
        }))
    } catch {}
}

function renderWelcome(main) {
    main.innerHTML = `
        <div class="welcome">
            <div class="welcome-card">
                <div class="welcome-head">
                    <h1 class="welcome-title">Bangumi 收藏备份与浏览</h1>
                </div>
                <div class="welcome-actions">
                    <a class="welcome-entry is-primary" href="${href.backup}">
                        <span class="entry-label">前往备份</span>
                        <span class="entry-note">从 Bangumi 拉取收藏</span>
                    </a>
                    <a class="welcome-entry" href="${href.import}">
                        <span class="entry-label">导入数据</span>
                        <span class="entry-note">JSON 或 ZIP 文件</span>
                    </a>
                    <a class="welcome-entry" href="${href.users}">
                        <span class="entry-label">选择用户</span>
                        <span class="entry-note">查看本机缓存</span>
                    </a>
                </div>
            </div>
        </div>
    `
}

export function renderOverview() {
    const main = document.getElementById('main')
    if (!main) return
    closeMenu()
    if (!state.data) {
        renderWelcome(main)
        return
    }
    const username = state.data?.user?.username || ''
    if (!initialized || username !== activeUser) {
        resetViewState()
        activeUser = username
        initState()
        initialized = true
    }
    const items = state.data.items || []
    const counts = countByCategory(items)
    const catCount = counts[currentCat] || { total: 0, byStatus: {} }

    const catStatuses = statusOrder.map(k => ({
        key: k,
        label: statusLabels[currentCat]?.[k] || commonStatusLabels[k] || k,
    }))

    main.innerHTML = `
        <div class="tabs" id="cat-tabs">
            ${categories.map(c => `
                <button type="button" class="tab ${c.key === currentCat ? 'is-active' : ''}" data-cat="${c.key}">
                ${c.label}<span class="tab-count">${counts[c.key]?.total || 0}</span>
                </button>
            `).join('')}
        </div>

        <div class="overview-header">
            <div class="subtabs" id="status-tabs">
                ${catStatuses.map(s => `
                <button type="button" class="subtab ${s.key === currentStatus ? 'is-active' : ''}" data-status="${s.key}">
                    ${s.label}<span class="subtab-count">${catCount.byStatus[s.key] || 0}</span>
                </button>
                `).join('')}
            </div>

            <div class="overview-controls">
                <div class="control">排序
                <span class="menu-slot" id="sort-slot"></span>
                <button type="button" class="menu-btn order-btn" id="sort-order-btn"></button>
                </div>
                <div class="control">评分
                <span class="menu-slot" id="rate-slot"></span>
                </div>
                <label class="control">标签
                <input
                    id="tag-input"
                    type="search"
                    placeholder="输入完整标签"
                    value="${escapeHtml(currentTagFilter)}"
                >
                </label>
                <div class="control">每页
                <span class="menu-slot" id="page-size-slot"></span>
                </div>
                <div class="overview-stats">
                <span>共 <strong id="result-total">${items.length}</strong> 条</span>
                ${state.data.report?.filtered ? `<span>导入过滤 ${state.data.report.filtered} 条</span>` : ''}
                </div>
            </div>
        </div>

        <div id="grid-container"></div>
        <div id="pagination-container"></div>
    `

    const sortButton = makeMenuButton(sortOptions.find(o => o.key === currentSort)?.label || '')
    sortButton.id = 'sort-select-btn'
    main.querySelector('#sort-slot').appendChild(sortButton)

    const rateButton = makeMenuButton(
        rateFilterOptions.find(o => o.key === currentRateFilter)?.label || ''
    )
    rateButton.id = 'rate-select-btn'
    main.querySelector('#rate-slot').appendChild(rateButton)

    const pageSizeButton = makeMenuButton(String(pageSize))
    pageSizeButton.id = 'page-size-select-btn'
    main.querySelector('#page-size-slot').appendChild(pageSizeButton)

    const orderButton = main.querySelector('#sort-order-btn')
    paintOrderButton(orderButton)

    main.querySelectorAll('#cat-tabs .tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCat = btn.dataset.cat
            resetPage()
            renderOverview()
        })
    })
    main.querySelectorAll('#status-tabs .subtab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentStatus = btn.dataset.status
            resetPage()
            renderOverview()
        })
    })
    sortButton.addEventListener('click', () => {
        openMenu({
            anchor: sortButton,
            items: sortOptions.map(o => ({ value: o.key, label: o.label })),
            current: currentSort,
            onPick: value => {
                currentSort = value
                resetPage()
                renderOverview()
            },
        })
    })
    orderButton.addEventListener('click', () => {
        currentOrder = currentOrder === 'desc' ? 'asc' : 'desc'
        resetPage()
        saveState()
        paintOrderButton(orderButton)
        renderGrid()
    })
    rateButton.addEventListener('click', () => {
        openMenu({
            anchor: rateButton,
            items: rateFilterOptions.map(o => ({ value: o.key, label: o.label })),
            current: currentRateFilter,
            onPick: value => {
                currentRateFilter = value
                resetPage()
                renderOverview()
            },
        })
    })
    main.querySelector('#tag-input').addEventListener('input', e => {
        currentTagFilter = e.target.value
        resetPage()
        saveState()
        renderGrid()
    })
    pageSizeButton.addEventListener('click', () => {
        openMenu({
            anchor: pageSizeButton,
            items: pageSizeOptions.map(n => ({ value: String(n), label: String(n) })),
            current: String(pageSize),
            onPick: value => {
                pageSize = Number(value)
                resetPage()
                renderOverview()
            },
        })
    })

    renderGrid()
    saveState()
}

function paintOrderButton(button) {
    const next = currentOrder === 'desc' ? 'asc' : 'desc'
    const label = `排序方向：${sortDirectionLabels[currentOrder]}（点击切换为${sortDirectionLabels[next]}）`
    button.innerHTML = sortDirectionIcons[currentOrder]
    button.setAttribute('aria-label', label)
    button.title = label
}

function renderGrid() {
    const container = document.getElementById('grid-container')
    const pager = document.getElementById('pagination-container')
    if (!container || !pager) return

    let list = (state.data.items || []).filter(
        it => it.cat === currentCat && it.status === currentStatus
    )
    list = filterByRate(list, currentRateFilter)
    list = filterByTag(list, currentTagFilter)
    list = sortItems(list, currentSort, currentOrder)

    const total = list.length
    const stat = document.getElementById('result-total')
    if (stat) stat.textContent = String(total)

    if (!total) {
        container.innerHTML = '<div class="empty">没有符合条件的条目</div>'
        pager.innerHTML = ''
        return
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    if (currentPage > totalPages) currentPage = totalPages
    const start = (currentPage - 1) * pageSize
    const slice = list.slice(start, start + pageSize)

    container.innerHTML = `<div class="grid">
        ${slice.map(it => {
            const cover = it.images?.common || it.images?.medium || it.images?.grid || ''
            return `
                <a class="card" href="${href.detail}?id=${it.id}">
                    <div class="card-cover">
                        ${cover ? `<img loading="lazy" src="${cover}" alt="">` : ''}
                    </div>
                    <div class="card-body">
                        <div class="card-name">${escapeHtml(it.nameCn || it.name)}</div>
                        <div class="card-meta">
                        <span class="card-rate">${it.rate > 0 ? '我 ' + it.rate : '—'}</span>
                        <span class="card-score">${it.publicScore != null ? '均 ' + it.publicScore.toFixed(1) : ''}</span>
                        </div>
                    </div>
                </a>
            `
        }).join('')}
        </div>`

    pager.innerHTML = pagerHtml(currentPage, totalPages, total)

    const goToPage = (p) => {
        if (!Number.isInteger(p) || p < 1 || p > totalPages || p === currentPage) return
        currentPage = p
        saveState()
        renderGrid()
        container.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    pager.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => goToPage(Number(btn.dataset.page)))
    })

    const jump = pager.querySelector('.pager-input')
    if (jump) {
        jump.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault()
                jump.blur()
            }
        })
        jump.addEventListener('blur', () => {
            const p = Number(jump.value)
            if (!Number.isInteger(p) || p < 1 || p > totalPages) {
                jump.value = currentPage
                return
            }
            goToPage(p)
        })
    }
}

function pagerHtml(current, totalPages, total) {
    if (totalPages <= 1) {
        return `<nav class="pager"><span class="pager-info">共 ${total} 条</span></nav>`
    }
    const pages = []
    const range = (a, b) => { for (let i = a; i <= b; i++) pages.push(i) }

    if (totalPages <= 7) {
        range(1, totalPages)
    } else {
        pages.push(1)
        if (current > 3) pages.push('...')
        const from = Math.max(2, current - 1)
        const to = Math.min(totalPages - 1, current + 1)
        range(from, to)
        if (current < totalPages - 2) pages.push('...')
        pages.push(totalPages)
    }

    return `
        <nav class="pager">
            <button type="button" class="pager-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>‹ 上一页</button>
            ${pages.map(p => p === '...'
                ? '<span class="pager-ellipsis">…</span>'
                : `<button type="button" class="pager-btn ${p === current ? 'is-active' : ''}" data-page="${p}">${p}</button>`
            ).join('')}
            <button type="button" class="pager-btn" data-page="${current + 1}" ${current === totalPages ? 'disabled' : ''}>下一页 ›</button>
            <span class="pager-jump">
                跳至
                <input type="number" class="pager-input" min="1" max="${totalPages}"
                    value="${current}" inputmode="numeric" aria-label="跳转到指定页">
                页
            </span>
            <span class="pager-info">第 ${current} / ${totalPages} 页 · 共 ${total} 条</span>
        </nav>
    `
}
