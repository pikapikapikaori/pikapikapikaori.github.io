import { state } from '../app.js';

const CAT_LABELS = { anime: '动画', book: '书籍', game: '游戏', music: '音乐', real: '三次元' };
const STATUS_LABELS = {
    anime: { doing: '在看', done: '已看', wish: '想看' },
    real: { doing: '在看', done: '已看', wish: '想看' },
    book: { doing: '在读', done: '已读', wish: '想读' },
    game: { doing: '在玩', done: '已玩', wish: '想玩' },
    music: { doing: '在听', done: '已听', wish: '想听' },
};

export function renderDetail() {
    const main = document.getElementById('main');
    if (!state.data) return;

    const id = Number(new URLSearchParams(location.search).get('id'));
    if (!id) { location.replace('./index.html'); return; }

    const item = state.data.items.find(it => it.id === id);
    if (!item) {
        main.innerHTML = `<div class="empty">未找到该条目。<a href="./index.html">返回总览</a></div>`;
        return;
    }

    const catLabel = CAT_LABELS[item.cat] || item.cat;
    const statusLabel = item.status === 'onhold' ? '搁置'
        : item.status === 'dropped' ? '抛弃'
            : STATUS_LABELS[item.cat]?.[item.status] || item.status;

    main.innerHTML = `
        <a class="back-link" href="./index.html">← 返回总览</a>
        <div class="detail">
            <aside>
                <div class="detail-cover">
                ${item.images?.large || item.images?.common
                    ? `<img src="${item.images.large || item.images.common}" alt="">`
                    : ''}
                </div>
            </aside>

            <div class="detail-main">
                <h1 class="detail-title">${esc(item.nameCn || item.name)}</h1>
                ${item.nameCn && item.name !== item.nameCn
                    ? `<div class="detail-subtitle">${esc(item.name)}</div>` : ''}

                <div class="detail-meta">
                <span>${catLabel}</span>
                ${item.date ? `<span class="sep">·</span><span>${esc(item.date)}</span>` : ''}
                ${item.eps ? `<span class="sep">·</span><span>${item.eps} 集</span>` : ''}
                ${item.publicScore != null ? `<span class="sep">·</span><span>大众评分 ${item.publicScore.toFixed(1)}</span>` : ''}
                ${item.rank ? `<span class="sep">·</span><span>Rank #${item.rank}</span>` : ''}
                </div>

                <section class="detail-section">
                <div class="detail-section-title">我的收藏</div>
                <div class="my-grid">
                    <div class="my-item">
                    <div class="my-item-label">状态</div>
                    <div class="my-item-value">${esc(statusLabel)}</div>
                    </div>
                    <div class="my-item">
                    <div class="my-item-label">我的评分</div>
                    <div class="my-item-value">
                        <span class="stars stars-lg">${stars(item.rate)}</span>
                        ${item.rate > 0 ? `<span class="dim"> ${item.rate} / 10</span>` : ''}
                    </div>
                    </div>
                    ${item.epStatus ? `
                    <div class="my-item">
                        <div class="my-item-label">进度</div>
                        <div class="my-item-value">${item.epStatus}${item.eps ? ' / ' + item.eps : ''} 集</div>
                    </div>` : ''}
                    ${item.volStatus ? `
                    <div class="my-item">
                        <div class="my-item-label">卷进度</div>
                        <div class="my-item-value">${item.volStatus}${item.volumes ? ' / ' + item.volumes : ''} 卷</div>
                    </div>` : ''}
                    <div class="my-item">
                    <div class="my-item-label">最后更新</div>
                    <div class="my-item-value">${esc((item.updatedAt || '').slice(0, 10))}</div>
                    </div>
                </div>
                ${item.myTags.length ? `
                    <div style="margin-top:var(--space-3)">
                    <div class="my-item-label">我的标签</div>
                    <div class="tag-list" style="margin-top:4px">
                        ${item.myTags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
                    </div>
                    </div>` : ''}
                ${item.comment ? `
                    <div style="margin-top:var(--space-3)">
                    <div class="my-item-label">我的评论</div>
                    <div class="detail-summary" style="margin-top:4px">${esc(item.comment)}</div>
                    </div>` : ''}
                </section>

                <section class="detail-section">
                <div class="detail-section-title">简介</div>
                <div class="detail-summary">${esc(item.summary || '暂无简介')}</div>
                </section>

                ${item.scoreDetails ? renderScoreHistogram(item.scoreDetails) : ''}
                ${item.favorite ? renderFavorite(item.favorite) : ''}
                ${item.episodes?.length ? renderEpisodes(item.episodes) : ''}
                ${item.subjectTags?.length ? renderSubjectTags(item.subjectTags) : ''}
                ${item.infobox ? renderInfobox(item.infobox) : ''}
            </div>
        </div>
    `;

    bindEpisodeToggles(main);
}

function renderScoreHistogram(details) {
    const keys = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'];
    const max = Math.max(...keys.map(k => details[k] || 0));
    if (!max) return '';
    return `
        <section class="detail-section">
            <div class="detail-section-title">评分分布</div>
            ${keys.map(k => {
                const count = details[k] || 0;
                const pct = max ? (count / max) * 100 : 0;
                return `<div class="score-bar">
                <span class="score-bar-label">${k}</span>
                <span class="score-bar-fill"><span style="width:${pct}%"></span></span>
                <span class="score-bar-count">${count}</span>
                </div>`;
            }).join('')}
        </section>
    `;
}

function renderFavorite(f) {
    const labels = {
        doing: '在看 / 读 / 玩 / 听',
        done: '已看 / 读 / 玩 / 听',
        wish: '想看 / 读 / 玩 / 听',
        on_hold: '搁置',
        dropped: '抛弃',
    };
    return `
        <section class="detail-section">
            <div class="detail-section-title">大众收藏分布</div>
            <div class="my-grid">
                ${['doing', 'done', 'wish', 'on_hold', 'dropped'].map(k => `
                <div class="my-item">
                    <div class="my-item-label">${labels[k]}</div>
                    <div class="my-item-value">${f[k] || 0}</div>
                </div>
                `).join('')}
            </div>
        </section>
    `;
}

function renderEpisodes(eps) {
    return `
        <section class="detail-section">
            <div class="detail-section-title">分集 · 共 ${eps.length} 集</div>
            <ul class="ep-list">
                ${eps.map(ep => `
                <li class="ep-item">
                    <div class="ep-no">${ep.ep}</div>
                    <div class="ep-body">
                    <div class="ep-title">
                        ${esc(ep.name || '（未命名）')}
                        ${ep.watched ? '<span class="ep-watched">✓ 已看</span>' : ''}
                    </div>
                    ${ep.nameCn ? `<div class="ep-title-cn">${esc(ep.nameCn)}</div>` : ''}
                    <div class="ep-date">${esc(ep.airdate || '')}${ep.duration ? ' · ' + esc(ep.duration) : ''}</div>
                    ${ep.desc ? `<div class="ep-desc">${esc(ep.desc)}</div>` : ''}
                    </div>
                    <div>${ep.desc ? '<button type="button" class="ep-toggle icon-btn" title="展开/收起">▾</button>' : ''}</div>
                </li>
                `).join('')}
            </ul>
        </section>
    `;
}

function bindEpisodeToggles(root) {
    root.querySelectorAll('.ep-item').forEach(li => {
        const btn = li.querySelector('.ep-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const on = li.classList.toggle('is-expanded');
            btn.textContent = on ? '▴' : '▾';
        });
    });
}

function renderSubjectTags(tags) {
    return `
        <section class="detail-section">
            <div class="detail-section-title">作品标签</div>
            <div class="tag-list">
                ${tags.slice(0, 60).map(t => `
                <span class="tag">${esc(t.name)}${t.count != null ? ` <span class="faint">${t.count}</span>` : ''}</span>
                `).join('')}
            </div>
        </section>
    `;
}

function renderInfobox(text) {
    return `
        <section class="detail-section">
            <details class="info-details">
                <summary>原始 infobox（点开查看）</summary>
                <pre>${esc(text)}</pre>
            </details>
        </section>
    `;
}

function stars(n) {
    n = Math.max(0, Math.min(10, n || 0));
    let out = '';
    for (let i = 1; i <= 10; i++) {
        out += `<span class="star ${i <= n ? '' : 'is-empty'}">★</span>`;
    }
    return out;
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
