import { state } from '../app.js'
import { items } from '../storage.js'
import { toDetailItem } from '../model.js'
import {
    categories,
    statusLabels,
    href,
} from '../config.js'
import { escapeHtml } from '../dom.js'

export async function renderDetail(id, { goBack, isCurrent } = {}) {
    const main = document.getElementById('main')
    if (!main) return
    if (!state.data) {
        renderEmpty(main, '尚无本地数据，请先备份或导入。', goBack)
        return null
    }
    if (!Number.isInteger(id)) {
        renderEmpty(main, '条目编号无效。', goBack)
        return null
    }

    const username = state.data.user.username
    const listed = state.data.items.find(it => it.id === id)
    if (!listed) {
        renderEmpty(main, '未找到该条目。', goBack)
        return null
    }

    // The list holds only display fields, so this item's detail record is read here.
    // The read is asynchronous, so the route token decides whether it still applies.
    const stale = () => main.dataset.route !== 'detail'
        || (isCurrent && !isCurrent())
        || state.data?.user?.username !== username
    const { record, hasDetail } = await items.getWithDetail(username, id)
    if (stale()) return null

    if (!record) {
        renderEmpty(main, '未找到该条目。', goBack)
        return null
    }
    if (!hasDetail) {
        // Without its detail half the entry shows no progress, and the list stamp would keep
        // the next incremental run from asking again (see storage.js).
        let message = '详情数据未取得，下次备份时补全。'
        try {
            await items.clearProgressValidity(username, id)
        } catch {
            // The empty state answers this page; a failed cleanup only weakens
            // the next backup and must not replace it with an error page.
            message = '详情数据未取得，下次备份时补全；清除进度有效期失败，下次备份可能仍跳过该条目。'
        }
        if (stale()) return null
        renderEmpty(main, message, goBack)
        return listed.nameCn || listed.name
    }
    const item = toDetailItem(record)
    if (!item) {
        renderEmpty(main, '未找到该条目。', goBack)
        return null
    }

    const displayName = item.nameCn || item.name
    const catLabel = categories.find(c => c.key === item.cat)?.label || item.cat
    const statusLabel = item.status === 'onhold' ? '搁置'
        : item.status === 'dropped' ? '抛弃'
            : statusLabels[item.cat]?.[item.status] || item.status
    // Imported JSON is untrusted: numbers go through Number(), strings through
    // escapeHtml(); the cover URL is assigned as a DOM property below.
    const eps = toNumber(item.eps)
    const volumes = toNumber(item.volumes)
    const volStatus = toNumber(item.volStatus)
    const watchedEps = toNumber(item.epStatus) || toNumber(item.watchedCount)
    const rate = toNumber(item.rate)
    const rank = toNumber(item.rank)
    const score = item.publicScore == null ? null : toNumber(item.publicScore, null)
    const coverUrl = item.images?.large || item.images?.common || ''
    const progressText = !item.progressFetched ? '未取得'
        : !item.hasWatchRecords ? '未观看'
            : watchedEps > 0 ? `${watchedEps}${eps ? ' / ' + eps : ''} 集`
                : `${volStatus}${volumes ? ' / ' + volumes : ''} 卷`

    main.innerHTML = `
        <a class="back-link" href="${href.index}" id="detail-back">← 返回总览</a>
        <div class="detail">
            <aside>
                <div class="detail-cover"></div>
            </aside>

            <div class="detail-main">
                <h1 class="detail-title">${escapeHtml(displayName)}</h1>
                ${item.nameCn && item.name !== item.nameCn
                    ? `<div class="detail-subtitle">${escapeHtml(item.name)}</div>` : ''}

                <div class="detail-meta">
                <span>${escapeHtml(catLabel)}</span>
                ${item.date ? `<span class="sep">·</span><span>${escapeHtml(item.date)}</span>` : ''}
                ${eps ? `<span class="sep">·</span><span>${eps} 集</span>` : ''}
                ${score != null ? `<span class="sep">·</span><span>大众评分 ${score.toFixed(1)}</span>` : ''}
                ${rank ? `<span class="sep">·</span><span>Rank #${rank}</span>` : ''}
                </div>

                <section class="detail-section">
                <div class="detail-section-title">我的收藏</div>
                <div class="my-grid">
                    <div class="my-item">
                    <div class="my-item-label">状态</div>
                    <div class="my-item-value">${escapeHtml(statusLabel)}</div>
                    </div>
                    <div class="my-item">
                    <div class="my-item-label">我的评分</div>
                    <div class="my-item-value">
                        <span class="stars stars-lg">${stars(rate)}</span>
                        ${rate > 0 ? `<span class="dim"> ${rate} / 10</span>` : ''}
                    </div>
                    </div>
                    <div class="my-item">
                    <div class="my-item-label">进度</div>
                    <div class="my-item-value">${progressText}</div>
                    </div>
                    ${item.progressFetched && watchedEps > 0 && volStatus ? `
                    <div class="my-item">
                        <div class="my-item-label">卷进度</div>
                        <div class="my-item-value">${volStatus}${volumes ? ' / ' + volumes : ''} 卷</div>
                    </div>` : ''}
                    <div class="my-item">
                    <div class="my-item-label">最后更新</div>
                    <div class="my-item-value">${escapeHtml((item.updatedAt || '').slice(0, 10))}</div>
                    </div>
                </div>
                ${item.myTags.length ? `
                    <div style="margin-top:var(--space-3)">
                    <div class="my-item-label">我的标签</div>
                    <div class="tag-list" style="margin-top:4px">
                        ${item.myTags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                    </div>
                    </div>` : ''}
                ${item.comment ? `
                    <div style="margin-top:var(--space-3)">
                    <div class="my-item-label">我的评论</div>
                    <div class="detail-summary" style="margin-top:4px">${escapeHtml(item.comment)}</div>
                    </div>` : ''}
                </section>

                <section class="detail-section">
                <div class="detail-section-title">简介</div>
                <div class="detail-summary">${escapeHtml(item.summary || '暂无简介')}</div>
                </section>

                ${item.scoreDetails ? renderScoreHistogram(item.scoreDetails) : ''}
                ${item.favorite ? renderFavorite(item.favorite) : ''}
                ${item.episodes?.length ? renderEpisodes(item.episodes, item.progressFetched) : ''}
                ${item.subjectTags?.length ? renderSubjectTags(item.subjectTags) : ''}
                ${item.infobox ? renderInfobox(item.infobox) : ''}
            </div>
        </div>
    `

    paintCover(main, coverUrl)
    bindEpisodeToggles(main)
    bindBack(main, goBack)
    // The page title uses this name, so the display-name rule stays here.
    return displayName
}

function renderEmpty(main, message, goBack) {
    main.innerHTML = `
        <a class="back-link" href="${href.index}" id="detail-back">← 返回总览</a>
        <div class="empty">${escapeHtml(message)}</div>
    `
    bindBack(main, goBack)
}

function bindBack(main, goBack) {
    const back = main.querySelector('#detail-back')
    if (!back || !goBack) return
    // Prefer a real history entry so the collection keeps its scroll position;
    // the router falls back to the collection route when there is none.
    back.addEventListener('click', event => {
        event.preventDefault()
        goBack()
    })
}

function paintCover(main, url) {
    if (!url) return
    const host = main.querySelector('.detail-cover')
    if (!host) return
    const img = document.createElement('img')
    img.alt = ''
    img.src = String(url)
    host.appendChild(img)
}

function renderScoreHistogram(details) {
    const keys = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
    const counts = keys.map(k => toNumber(details?.[k]))
    const max = Math.max(...counts)
    if (!max) return ''
    return `
        <section class="detail-section">
            <div class="detail-section-title">评分分布</div>
            ${keys.map((k, index) => {
                const count = counts[index]
                const pct = max ? (count / max) * 100 : 0
                return `<div class="score-bar">
                <span class="score-bar-label">${k}</span>
                <span class="score-bar-fill"><span style="width:${pct}%"></span></span>
                <span class="score-bar-count">${count}</span>
                </div>`
            }).join('')}
        </section>
    `
}

function renderFavorite(f) {
    const labels = {
        doing: '在看 / 读 / 玩 / 听',
        done: '已看 / 读 / 玩 / 听',
        wish: '想看 / 读 / 玩 / 听',
        on_hold: '搁置',
        dropped: '抛弃',
    }
    return `
        <section class="detail-section">
            <div class="detail-section-title">大众收藏分布</div>
            <div class="my-grid">
                ${['doing', 'done', 'wish', 'on_hold', 'dropped'].map(k => `
                <div class="my-item">
                    <div class="my-item-label">${labels[k]}</div>
                    <div class="my-item-value">${toNumber(f[k])}</div>
                </div>
                `).join('')}
            </div>
        </section>
    `
}

function renderEpisodes(eps, progressFetched) {
    return `
        <section class="detail-section">
            <div class="detail-section-title">分集 · 共 ${eps.length} 集${progressFetched ? '' : ' · 进度未取得'}</div>
            <ul class="ep-list">
                ${eps.map((ep, index) => {
                    const epNo = ep.ep == null ? index + 1 : toNumber(ep.ep, index + 1)
                    return `
                <li class="ep-item">
                    <div class="ep-no">${epNo}</div>
                    <div class="ep-body">
                    <div class="ep-title">
                        ${escapeHtml(ep.name || '（未命名）')}
                        ${ep.watched ? '<span class="ep-watched">✓ 已看</span>' : ''}
                    </div>
                    ${ep.nameCn ? `<div class="ep-title-cn">${escapeHtml(ep.nameCn)}</div>` : ''}
                    <div class="ep-date">${escapeHtml(ep.airdate || '')}${ep.duration ? ' · ' + escapeHtml(ep.duration) : ''}</div>
                    ${ep.desc ? `<div class="ep-desc">${escapeHtml(ep.desc)}</div>` : ''}
                    </div>
                    <div>${ep.desc ? '<button type="button" class="ep-toggle icon-btn" title="展开/收起">▾</button>' : ''}</div>
                </li>
                `
                }).join('')}
            </ul>
        </section>
    `
}

function bindEpisodeToggles(root) {
    root.querySelectorAll('.ep-item').forEach(li => {
        const btn = li.querySelector('.ep-toggle')
        if (!btn) return
        btn.addEventListener('click', () => {
            const on = li.classList.toggle('is-expanded')
            btn.textContent = on ? '▴' : '▾'
        })
    })
}

function renderSubjectTags(tags) {
    return `
        <section class="detail-section">
            <div class="detail-section-title">作品标签</div>
            <div class="tag-list">
                ${tags.slice(0, 60).map(t => {
                    const count = t?.count == null ? null : toNumber(t.count, null)
                    return `
                <span class="tag">${escapeHtml(t?.name)}${count != null ? ` <span class="faint">${count}</span>` : ''}</span>
                `
                }).join('')}
            </div>
        </section>
    `
}

function renderInfobox(text) {
    return `
        <section class="detail-section">
            <details class="info-details">
                <summary>原始 infobox</summary>
                <pre>${escapeHtml(text)}</pre>
            </details>
        </section>
    `
}

function toNumber(value, fallback = 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

function stars(value) {
    const n = Math.max(0, Math.min(10, toNumber(value)))
    let out = ''
    for (let i = 1; i <= 10; i++) {
        out += `<span class="star ${i <= n ? '' : 'is-empty'}">★</span>`
    }
    return out
}
