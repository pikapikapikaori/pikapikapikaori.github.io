import { state } from './app.js';
import { matchQuery } from './model.js';

let _inited = false;

export function initSearch() {
    if (_inited) return;
    _inited = true;
    const input = document.getElementById('global-search');
    const panel = document.getElementById('global-search-panel');
    if (!input || !panel) return;

    const close = () => { panel.hidden = true; panel.innerHTML = ''; };

    input.addEventListener('input', () => {
        const q = input.value.trim();
        if (!q) { close(); return; }
        const items = state.data?.items || [];
        const hits = [];
        for (const it of items) {
            if (matchQuery(it, q)) {
                hits.push(it);
                if (hits.length >= 12) break;
            }
        }
        if (!hits.length) {
            panel.hidden = false;
            panel.innerHTML = '<div class="search-empty">无匹配结果</div>';
            return;
        }
        panel.hidden = false;
        panel.innerHTML = hits.map(it => `
            <a class="search-hit" href="./detail.html?id=${it.id}">
                <img src="${it.images?.grid || it.images?.small || ''}" alt="">
                <div class="search-hit-body">
                <div class="search-hit-name">${escapeHtml(it.nameCn || it.name)}</div>
                <div class="search-hit-sub">${escapeHtml(it.name)}</div>
                </div>
            </a>
        `).join('');
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { close(); input.blur(); return; }
        if (e.key === 'Enter') {
            const first = panel.querySelector('a.search-hit');
            if (first) { e.preventDefault(); first.click(); }
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-search')) close();
    });
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
