import { state } from './app.js';
import { cache } from './storage.js';
import { applyTheme, getTheme } from './theme.js';
import {
    THEME_LABELS, THEME_MODES,
    COPYRIGHT_START_YEAR, COPYRIGHT_HOLDER,
    CATEGORIES,
} from './config.js';
import { forceBootstrap, notifyDataChanged } from './bootstrap.js';
import { initSearch } from './search.js';

// ---------- Header ----------
function buildHeader() {
    const el = document.getElementById('site-header');
    el.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="./index.html">收藏</a>
      <nav class="main-nav">
        ${CATEGORIES.map(c => `
          <a href="./index.html#${c.key}" data-cat="${c.key}">${c.label}</a>
        `).join('')}
        <a href="./about.html">关于</a>
      </nav>
      <div class="header-search">
        <input type="search" id="global-search" placeholder="搜索标题 / 原名 / 简介…" autocomplete="off">
        <div id="global-search-panel" class="search-panel" hidden></div>
      </div>
      <div class="header-actions">
        <button type="button" id="theme-btn" class="icon-btn" title="主题">🌓</button>
        <div class="user-menu" id="user-menu">
          <button type="button" class="user-trigger" id="user-trigger" aria-haspopup="true" aria-expanded="false">
            <img id="user-avatar" alt="">
            <span id="user-nickname"></span>
            <span class="caret">▾</span>
          </button>
          <div class="user-panel" id="user-panel" hidden></div>
        </div>
      </div>
    </div>
  `;

    renderUserTrigger();
    bindThemeButton();
    bindUserMenu();
}

function renderUserTrigger() {
    const u = state.data?.user || {};
    const av = document.getElementById('user-avatar');
    const nick = document.getElementById('user-nickname');
    av.src = u.avatar?.small || u.avatar?.medium || '';
    av.alt = u.nickname || u.username || '';
    nick.textContent = u.nickname || u.username || '用户';
}

async function renderUserPanel() {
    const panel = document.getElementById('user-panel');
    const current = state.data?.user?.id;
    const all = await cache.listAll();
    const users = all.map(x => x.value?.user).filter(Boolean);
    users.sort((a, b) => (b.id === current) - (a.id === current));

    panel.innerHTML = `
    <div class="user-panel-title">切换账号</div>
    <ul class="user-list">
      ${users.map(u => `
        <li>
          <button type="button" class="user-item ${u.id === current ? 'is-current' : ''}" data-uid="${u.id}">
            <img src="${u.avatar?.small || u.avatar?.medium || FALLBACK_AVATAR}" alt="">
            <span class="user-item-name">${escapeHtml(u.nickname || u.username)}</span>
            <span class="user-item-id">#${u.id}</span>
          </button>
        </li>`).join('') || '<li class="user-empty">暂无其它账号</li>'}
    </ul>
    <button type="button" class="user-logout" id="user-logout">登出</button>
    <button type="button" class="user-danger" id="user-clear-all">清除全部缓存</button>
  `;

    panel.querySelectorAll('.user-item').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = Number(btn.dataset.uid);
            if (uid === current) { closeUserPanel(); return; }
            const hit = await cache.get(uid);
            if (!hit) return;
            state.data = hit;
            closeUserPanel();
            renderUserTrigger();
            notifyDataChanged();
        });
    });

    // 登出：不清任何缓存，只回引导界面
    panel.querySelector('#user-logout').addEventListener('click', () => {
        state.data = null;
        forceBootstrap();
        location.href = './index.html';
    });

    // 全局清缓存：清掉所有用户的全部缓存，然后回引导界面
    panel.querySelector('#user-clear-all').addEventListener('click', async () => {
        if (!confirm('确定清除所有用户的全部缓存吗？此操作不可撤销。')) return;
        await cache.clearAll();
        state.data = null;
        forceBootstrap();
        location.href = './index.html';
    });
}

function bindUserMenu() {
    const trigger = document.getElementById('user-trigger');
    const panel = document.getElementById('user-panel');
    trigger.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (panel.hidden) {
            await renderUserPanel();
            panel.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
        } else {
            closeUserPanel();
        }
    });
    document.addEventListener('click', closeUserPanel);
    panel.addEventListener('click', e => e.stopPropagation());
}

function closeUserPanel() {
    const panel = document.getElementById('user-panel');
    const trigger = document.getElementById('user-trigger');
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
}

function bindThemeButton() {
    const btn = document.getElementById('theme-btn');
    const update = () => {
        const mode = getTheme();
        btn.title = '主题：' + THEME_LABELS[mode];
        btn.textContent = mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '🌓';
    };
    update();
    btn.addEventListener('click', () => {
        const cur = getTheme();
        const idx = THEME_MODES.indexOf(cur);
        const next = THEME_MODES[(idx + 1) % THEME_MODES.length];
        applyTheme(next);
        update();
    });
}

// ---------- Footer ----------
function buildFooter() {
    const year = new Date().getFullYear();
    const range = year <= COPYRIGHT_START_YEAR
        ? `${COPYRIGHT_START_YEAR}`
        : `${COPYRIGHT_START_YEAR} - ${year}`;
    document.getElementById('site-footer').innerHTML = `
    <div class="footer-inner">
      <div class="copyright">&copy; ${range} ${COPYRIGHT_HOLDER} - All rights reserved.</div>
    </div>
  `;
}

// ---------- 入口 ----------
export function renderLayout() {
    buildHeader();
    buildFooter();
    initSearch();
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
