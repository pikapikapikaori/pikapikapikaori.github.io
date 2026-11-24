import { state } from './app.js'
import { matchQuery } from './model.js'
import { href } from './config.js'
import { escapeHtml } from './dom.js'

let _controller = null

export function closeSearch() {
    const panel = document.getElementById('global-search-panel')
    if (!panel) return
    panel.hidden = true
    panel.innerHTML = ''
}

export function initSearch() {
    const input = document.getElementById('global-search')
    const panel = document.getElementById('global-search-panel')
    if (!input || !panel) return
    _controller?.abort()
    _controller = new AbortController()
    const { signal } = _controller

    input.addEventListener('input', () => {
        const q = input.value.trim()
        if (!q) { closeSearch(); return }
        const items = state.data?.items || []
        const hits = []
        for (const it of items) {
            if (matchQuery(it, q)) {
                hits.push(it)
                if (hits.length >= 12) break
            }
        }
        if (!hits.length) {
            panel.hidden = false
            panel.innerHTML = '<div class="search-empty">无匹配结果</div>'
            return
        }
        panel.hidden = false
        panel.innerHTML = hits.map(it => `
            <a class="search-hit" href="${href.detail}?id=${it.id}">
                <img src="${it.images?.grid || it.images?.small || ''}" alt="">
                <div class="search-hit-body">
                <div class="search-hit-name">${escapeHtml(it.nameCn || it.name)}</div>
                <div class="search-hit-sub">${escapeHtml(it.name)}</div>
                </div>
            </a>
        `).join('')
    })

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeSearch(); input.blur(); return }
        if (e.key === 'Enter') {
            const first = panel.querySelector('a.search-hit')
            if (first) { e.preventDefault(); first.click() }
        }
    })

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-search')) closeSearch()
    }, { signal })
}
