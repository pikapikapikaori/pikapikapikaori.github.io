import { state } from '../app.js';
import {
    CATEGORIES, STATUS_ORDER, SORT_OPTIONS, DEFAULT_SORT,
    RATE_FILTER_OPTIONS, DEFAULT_RATE_FILTER,
    STATUS_LABELS, COMMON_STATUS_LABELS,
    PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE,
} from '../config.js';
import { sortItems, filterByRate, countByCategory } from '../model.js';

let currentCat = 'anime';
let currentStatus = 'doing';
let currentSort = DEFAULT_SORT;
let currentRateFilter = DEFAULT_RATE_FILTER;
let currentPage = 1;
let pageSize = DEFAULT_PAGE_SIZE;

function readCatFromHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (CATEGORIES.some(c => c.key === h)) currentCat = h;
}
function resetPage() { currentPage = 1; }

export function renderOverview() {
    const main = document.getElementById('main');
    if (!state.data) return;
    readCatFromHash();

    const items = state.data.items || [];
    const counts = countByCategory(items);
    const catCount = counts[currentCat] || { total: 0, byStatus: {} };

    const catStatuses = STATUS_ORDER.map(k => ({
        key: k,
        label: STATUS_LABELS[currentCat]?.[k] || COMMON_STATUS_LABELS[k] || k,
    }));

    main.innerHTML = `
        <div class="tabs" id="cat-tabs">
            ${CATEGORIES.map(c => `
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
                <label class="control">排序
                <select id="sort-select">
                    ${SORT_OPTIONS.map(o => `<option value="${o.key}" ${o.key === currentSort ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
                </label>
                <label class="control">评分
                <select id="rate-select">
                    ${RATE_FILTER_OPTIONS.map(o => `<option value="${o.key}" ${o.key === currentRateFilter ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
                </label>
                <label class="control">每页
                <select id="page-size-select">
                    ${PAGE_SIZE_OPTIONS.map(n => `<option value="${n}" ${n === pageSize ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
                </label>
                <div class="overview-stats">
                <span>共 <strong>${items.length}</strong> 条</span>
                </div>
            </div>
        </div>

        <div id="grid-container"></div>
        <div id="pagination-container"></div>
    `;

    main.querySelectorAll('#cat-tabs .tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCat = btn.dataset.cat;
            resetPage();
            history.replaceState(null, '', `#${currentCat}`);
            renderOverview();
        });
    });
    main.querySelectorAll('#status-tabs .subtab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentStatus = btn.dataset.status;
            resetPage();
            renderOverview();
        });
    });
    main.querySelector('#sort-select').addEventListener('change', e => {
        currentSort = e.target.value;
        resetPage();
        renderOverview();
    });
    main.querySelector('#rate-select').addEventListener('change', e => {
        currentRateFilter = e.target.value;
        resetPage();
        renderOverview();
    });
    main.querySelector('#page-size-select').addEventListener('change', e => {
        pageSize = Number(e.target.value);
        resetPage();
        renderOverview();
    });

    renderGrid();
}

function renderGrid() {
    const container = document.getElementById('grid-container');
    const pager = document.getElementById('pagination-container');
    if (!container || !pager) return;

    let list = (state.data.items || []).filter(
        it => it.cat === currentCat && it.status === currentStatus
    );
    list = filterByRate(list, currentRateFilter);
    list = sortItems(list, currentSort);

    if (!list.length) {
        container.innerHTML = `<div class="empty">没有符合条件的条目</div>`;
        pager.innerHTML = '';
        return;
    }

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);

    container.innerHTML = `<div class="grid">
        ${slice.map(it => {
            const cover = it.images?.common || it.images?.medium || it.images?.grid || '';
            return `
                <a class="card" href="./detail.html?id=${it.id}">
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
            `;
            }).join('')}
        </div>`;

    pager.innerHTML = pagerHtml(currentPage, totalPages, total);

    const goToPage = (p) => {
        if (!Number.isInteger(p) || p < 1 || p > totalPages || p === currentPage) return;
        currentPage = p;
        renderGrid();
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // 原来的页码 / 上一页 / 下一页按钮
    pager.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => goToPage(Number(btn.dataset.page)));
    });

    // 新增：跳页输入框
    const jump = pager.querySelector('.pager-input');
    if (jump) {
        jump.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                jump.blur();          // 统一交给 blur 处理，避免重复跳转
            }
        });
        jump.addEventListener('blur', () => {
            const p = Number(jump.value);
            if (!Number.isInteger(p) || p < 1 || p > totalPages) {
                jump.value = currentPage;   // 非法值还原成当前页
                return;
            }
            goToPage(p);
        });
    }
}

function pagerHtml(current, totalPages, total) {
    if (totalPages <= 1) return '';
    const pages = [];
    const range = (a, b) => { for (let i = a; i <= b; i++) pages.push(i); };

    if (totalPages <= 7) {
        range(1, totalPages);
    } else {
        pages.push(1);
        if (current > 3) pages.push('...');
        const from = Math.max(2, current - 1);
        const to = Math.min(totalPages - 1, current + 1);
        range(from, to);
        if (current < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }

    return `
        <nav class="pager">
            <button type="button" class="pager-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>‹ 上一页</button>
            ${pages.map(p => p === '...'
                ? `<span class="pager-ellipsis">…</span>`
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
    `;
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
