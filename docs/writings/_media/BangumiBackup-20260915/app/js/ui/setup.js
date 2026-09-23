import { loadFromFile, loadFromUrl } from '../source.js';
import { cache } from '../storage.js';
import { DEFAULT_DATA_URL, BANGUMI_EXPORT_URL, CURRENT_USER_KEY, } from '../config.js';
import { buildFooter } from '../footer.js';

export async function renderSetup(container, onReady) {
    container.hidden = false;
    container.innerHTML = `
        <div class="setup-card">
            <div class="loading"><div class="spinner"></div><div>正在检查本地缓存…</div></div>
        </div>
    `;

    // 1. 先查缓存，拿到所有已缓存用户
    let cachedUsers = [];
    try {
        const all = await cache.listAll();
        cachedUsers = all
            .map(x => x.value)
            .filter(v => v && v.user && v.user.id)
            .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    } catch (err) {
        console.error('[setup] 读取缓存失败：', err);
    }
    console.log('[setup] 缓存中的账号数：', cachedUsers.length, cachedUsers);

    // 2. 根据是否有缓存，一次性生成完整 HTML
    container.innerHTML = `
        <div class="setup-card">
            <div class="setup-brand">
                <div class="setup-title">我的收藏</div>
                <div class="setup-sub">请先提供你的收藏数据</div>
            </div>

            ${cachedUsers.length > 0 ? `
                <section class="setup-section">
                <div class="setup-section-title">继续使用已缓存的账号</div>
                <ul class="setup-cached-list" id="setup-cached-list"></ul>
                </section>
            ` : ''}

            <section class="setup-section">
                <div class="setup-section-title">上传文件</div>
                <label class="setup-drop" id="setup-drop">
                <input type="file" id="setup-file" accept=".json,.zip,application/json,application/zip" hidden>
                <div class="setup-drop-icon">⬆</div>
                <div class="setup-drop-text">点击选择，或把 .json / .zip 拖到这里</div>
                </label>
            </section>

            <section class="setup-section">
                <div class="setup-section-title">或填写 JSON / ZIP 地址</div>
                <div class="setup-url-row">
                <input type="url" id="setup-url" placeholder="https://example.com/takeout.json" autocomplete="off">
                <button type="button" id="setup-url-btn" class="btn btn-primary">加载</button>
                </div>
            </section>

            ${DEFAULT_DATA_URL ? `
            <section class="setup-section">
                <div class="setup-section-title">或使用默认数据源</div>
                <button type="button" id="setup-default-btn" class="btn">使用默认数据源</button>
            </section>
            ` : ''}

            <section class="setup-section setup-guide">
                <div class="setup-section-title">还没有导出数据？</div>
                <p class="setup-guide-text">
                本站需要导出的 Bangumi 收藏数据（<code>json</code> 或 <code>zip</code> 格式）才能正常展示。请先前往<a class="setup-guide-link" href="${BANGUMI_EXPORT_URL}" target="_blank" rel="noopener noreferrer">Bangumi 收藏导出页</a>导出，再回到这里导入数据。
                </p>
                <a class="btn btn-ghost setup-guide-btn" href="${BANGUMI_EXPORT_URL}" target="_blank" rel="noopener noreferrer">
                前往 Bangumi 收藏导出页
                </a>
            </section>

            <div class="setup-status" id="setup-status"></div>

            <footer class="site-footer" id="setup-site-footer"></footer>
            </div>

            <div class="setup-overlay" id="setup-overlay" hidden>
            <div class="setup-spinner"></div>
            <div class="setup-overlay-text" id="setup-overlay-text">加载中…</div>
        </div>
    `;

    // 3. 填充缓存账号列表
    if (cachedUsers.length > 0) {
        const list = container.querySelector('#setup-cached-list');
        list.innerHTML = cachedUsers.map(v => `
            <li>
                <button type="button" class="setup-cached-item" data-uid="${v.user.id}">
                <img src="${v.user.avatar?.small || v.user.avatar?.medium || ''}" alt="">
                <div class="setup-cached-body">
                    <div class="setup-cached-name">${escapeHtml(v.user.nickname || v.user.username)}</div>
                    <div class="setup-cached-meta">#${v.user.id} · ${v.items?.length || 0} 条</div>
                </div>
                </button>
            </li>
        `).join('');

        list.querySelectorAll('.setup-cached-item').forEach(btn => {
            btn.addEventListener('click', async () => {
                const uid = Number(btn.dataset.uid);
                const hit = await cache.get(uid);
                if (hit) {
                    localStorage.setItem(CURRENT_USER_KEY, String(uid));
                    await onReady(hit, true)
                };
            });
        });
    }

    // 4. 渲染底部版权
    buildFooter('setup-site-footer');

    // 5. 其余交互
    const statusEl = container.querySelector('#setup-status');
    const overlay = container.querySelector('#setup-overlay');
    const overlayText = container.querySelector('#setup-overlay-text');
    const fileInput = container.querySelector('#setup-file');
    const drop = container.querySelector('#setup-drop');
    const urlInput = container.querySelector('#setup-url');
    const urlBtn = container.querySelector('#setup-url-btn');
    const defaultBtn = container.querySelector('#setup-default-btn');

    function setStatus(msg, kind = '') {
        statusEl.textContent = msg || '';
        statusEl.className = 'setup-status' + (kind ? ' is-' + kind : '');
    }
    function showOverlay(text = '加载中…') {
        overlayText.textContent = text;
        overlay.hidden = false;
    }
    function hideOverlay() { overlay.hidden = true; }

    async function handleRaw(getRaw, label) {
        setStatus('');
        showOverlay(label);
        try {
            const raw = await getRaw();
            await onReady(raw);
        } catch (e) {
            hideOverlay();
            setStatus(e.message || String(e), 'error');
        }
    }

    fileInput.addEventListener('change', () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        handleRaw(() => loadFromFile(f), '正在解析文件…');
    });

    ['dragover', 'dragenter'].forEach(evt => {
        drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
        drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.remove('is-drag'); });
    });
    drop.addEventListener('drop', e => {
        const f = e.dataTransfer?.files?.[0];
        if (!f) return;
        handleRaw(() => loadFromFile(f), '正在解析文件…');
    });

    urlBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) { setStatus('请输入地址', 'error'); return; }
        handleRaw(() => loadFromUrl(url), '正在下载并解析…');
    });
    urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') urlBtn.click();
    });

    if (defaultBtn) {
        defaultBtn.addEventListener('click', () => {
            handleRaw(
                () => loadFromUrl(new URL(DEFAULT_DATA_URL, location.href).href),
                '正在加载默认数据源…'
            );
        });
    }
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
