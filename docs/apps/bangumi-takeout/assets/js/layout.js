import { state, clearCurrentUser } from './app.js'
import { applyTheme, getTheme } from './theme.js'
import { themeLabels, themeModes, themeIcons, href } from './config.js'
import { initSearch, closeSearch } from './search.js'
import { buildFooter } from './footer.js'
import { beginLoading } from './ui/loading.js'
import { navigate } from './router.js'

const headerEvents = new AbortController()
let layoutReady = false
let activeNav = 'collection'
let closeDataSource = null
let closeUserPanel = null

function buildHeader() {
    const el = document.getElementById('site-header')
    el.innerHTML = `
        <div class="header-inner">
            <a class="brand" href="${href.index}">Bangumi Takeout</a>
            <nav class="main-nav" aria-label="页面导航">
                <a class="nav-item" data-nav="collection" href="${href.index}">收藏</a>
                <span class="datasrc" id="datasrc">
                    <button type="button" class="nav-item datasrc-btn" data-nav="source"
                        id="datasrc-btn" aria-haspopup="true" aria-expanded="false">数据源</button>
                    <div class="datasrc-pop" id="datasrc-pop" hidden>
                        <button type="button" class="datasrc-item" data-href="${href.backup}">
                            <span class="datasrc-ico">☁</span>
                            <span><strong>从 Bangumi 备份</strong><span class="datasrc-desc">授权后拉取收藏</span></span>
                        </button>
                        <button type="button" class="datasrc-item" data-href="${href.import}">
                            <span class="datasrc-ico">⬆</span>
                            <span><strong>导入数据</strong><span class="datasrc-desc">拖入或选择 JSON / ZIP</span></span>
                        </button>
                        <button type="button" class="datasrc-item" data-href="${href.users}">
                            <span class="datasrc-ico">◉</span>
                            <span><strong>选择已有用户</strong><span class="datasrc-desc">查看本机缓存</span></span>
                        </button>
                    </div>
                </span>
                <a class="nav-item" data-nav="data" href="${href.data}">数据管理</a>
                <a class="nav-item" data-nav="about" href="${href.about}">关于</a>
            </nav>
            <div class="header-search">
                <input type="search" id="global-search" placeholder="搜索收藏" autocomplete="off" aria-label="搜索收藏">
                <div id="global-search-panel" class="search-panel" hidden></div>
            </div>
            <div class="header-actions">
                <button type="button" id="theme-btn" class="icon-btn" title="主题">${themeIcons.auto}</button>
                <div class="user-menu" id="user-menu" hidden>
                    <button type="button" class="user-trigger" id="user-trigger" aria-haspopup="true" aria-expanded="false">
                        <img id="user-avatar" alt="">
                        <span id="user-nickname"></span>
                        <span class="caret">▾</span>
                    </button>
                    <div class="user-panel" id="user-panel" hidden>
                        <button type="button" class="user-logout" id="user-logout">退出当前查看用户</button>
                    </div>
                </div>
            </div>
        </div>
    `

    bindThemeButton()
    bindDataSource()
    bindUserMenu()
}

function paintNav() {
    document.querySelectorAll('#site-header [data-nav]').forEach(el => {
        el.classList.toggle('is-active', el.dataset.nav === activeNav)
    })
}

// The user menu lives in the single header; route switches only repaint it.
function paintUserMenu() {
    const menu = document.getElementById('user-menu')
    if (!menu) return
    const user = state.data?.user
    menu.hidden = !user
    // Search covers the loaded collection, so it is hidden before a user is chosen.
    const search = document.querySelector('.header-search')
    if (search) search.hidden = !user
    if (!user) {
        closeSearch()
        return
    }
    const avatar = document.getElementById('user-avatar')
    const nickname = document.getElementById('user-nickname')
    if (!avatar || !nickname) return
    const src = user.avatar?.small || user.avatar?.medium || ''
    // An empty src paints a broken-image icon; hide the element instead.
    avatar.hidden = !src
    avatar.src = src
    avatar.alt = user.nickname || user.username || ''
    nickname.textContent = user.nickname || user.username || '用户'
}

function bindDataSource() {
    const host = document.getElementById('datasrc')
    const button = document.getElementById('datasrc-btn')
    const pop = document.getElementById('datasrc-pop')
    if (!host || !button || !pop) return

    let pinned = false

    // A fixed 280px popover overflows a 320px viewport near the right edge, so the
    // width is tightened and the panel shifted left.
    const place = () => {
        const margin = 12
        const hostRect = host.getBoundingClientRect()
        const width = Math.min(280, Math.max(0, window.innerWidth - margin * 2))
        let left = hostRect.left
        if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width
        if (left < margin) left = margin
        pop.style.width = width + 'px'
        pop.style.left = (left - hostRect.left) + 'px'
    }

    const open = () => {
        place()
        pop.hidden = false
        button.setAttribute('aria-expanded', 'true')
    }
    const close = () => {
        pinned = false
        pop.hidden = true
        button.setAttribute('aria-expanded', 'false')
    }
    closeDataSource = close

    // The popover is a child of the host, so the pointer stays inside it on hover.
    host.addEventListener('mouseenter', open)
    host.addEventListener('mouseleave', () => {
        if (!pinned) close()
    })

    button.addEventListener('click', () => {
        if (pinned) { close(); return }
        pinned = true
        open()
    })

    pop.querySelectorAll('.datasrc-item').forEach(item => {
        item.addEventListener('click', () => {
            close()
            const target = item.dataset.href
            // Repeating the current hash fires no render, so nothing would close the mask.
            if (target === location.hash) return
            // The page reads the stores before it paints; the mask covers that read.
            const loading = beginLoading('正在打开…', { returnFocus: button })
            navigate(target).finally(() => loading.close())
        })
    })

    document.addEventListener('click', event => {
        if (!event.target.closest('#datasrc')) close()
    }, { signal: headerEvents.signal })
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || pop.hidden) return
        event.stopPropagation()
        close()
        button.focus()
    }, { signal: headerEvents.signal })
    window.addEventListener('resize', () => {
        if (!pop.hidden) place()
    }, { signal: headerEvents.signal })
}

function bindUserMenu() {
    const trigger = document.getElementById('user-trigger')
    const panel = document.getElementById('user-panel')
    if (!trigger || !panel) return

    const closePanel = () => {
        panel.hidden = true
        trigger.setAttribute('aria-expanded', 'false')
    }
    closeUserPanel = closePanel

    trigger.addEventListener('click', event => {
        event.stopPropagation()
        const open = panel.hidden
        panel.hidden = !open
        trigger.setAttribute('aria-expanded', String(open))
    })

    panel.addEventListener('click', event => event.stopPropagation())
    document.addEventListener('click', () => {
        if (panel.hidden) return
        closePanel()
    }, { signal: headerEvents.signal })

    document.getElementById('user-logout').addEventListener('click', () => {
        // Leaving a user only clears the view selection: data and credentials
        // stay in place.
        clearCurrentUser()
        syncHeader()
        const atCollection = location.hash === href.index
        location.href = href.index
        if (atCollection) window.dispatchEvent(new Event('app:rerender'))
    })
}

function bindThemeButton() {
    const button = document.getElementById('theme-btn')
    if (!button) return
    const update = () => {
        const mode = getTheme()
        button.title = '主题：' + themeLabels[mode]
        button.innerHTML = mode === 'dark' ? themeIcons.dark : mode === 'light' ? themeIcons.light : themeIcons.auto
    }
    update()
    button.addEventListener('click', () => {
        const current = getTheme()
        const index = themeModes.indexOf(current)
        applyTheme(themeModes[(index + 1) % themeModes.length])
        update()
    })
}

export function renderLayout() {
    if (layoutReady) return
    layoutReady = true
    buildHeader()
    buildFooter()
    initSearch()
    paintNav()
    paintUserMenu()
}

export function setActiveNav(nav) {
    activeNav = nav
    paintNav()
}

export function closeHeaderPopovers() {
    closeDataSource?.()
    closeUserPanel?.()
}

export function syncHeader() {
    paintNav()
    paintUserMenu()
}
