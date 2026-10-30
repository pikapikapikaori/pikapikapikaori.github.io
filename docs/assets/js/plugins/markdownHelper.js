import { bindShortcuts } from '../utils/shortcut.js'
import { makeButtonLike } from '../utils/common.js'

let markdownHelperOptions = {
    highlightNavMenuCurrent: false
}

function plugin(hook, vm) {
    function searchInput() {
        return document.querySelector('.sidebar .search input[type="search"]')
    }

    function openSidebar() {
        const isNarrow = window.matchMedia('screen and (max-width: 768px)').matches

        document.body.classList.toggle('close', isNarrow)
    }

    function focusSearch() {
        const input = searchInput()
        if (!input) return

        openSidebar()
        input.focus()
    }

    function leaveSearch() {
        const input = searchInput()
        if (!input || document.activeElement !== input) return

        const clearButton = document.querySelector('.sidebar .search .clear-button')

        if (clearButton && clearButton.classList.contains('show')) {
            clearButton.click()
        }
        else {
            input.value = ''
            input.dispatchEvent(new Event('input', { bubbles: true }))
        }

        input.blur()
    }

    function updateSticky() {
        const cover = document.querySelector('section.cover.show')
        const threshold = cover ? cover.getBoundingClientRect().height : 0
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
        document.body.classList.toggle('sticky', scrollTop >= threshold)
    }

    let rowSpanCache = new WeakMap()
    let hoveredCell = null
    let groupRows = []
    let rowCells = []

    function rowSpanCoverage(table) {
        let coverage = rowSpanCache.get(table)
        if (coverage) return coverage

        const rows = [...table.rows]
        coverage = rows.map(function () { return new Set() })

        rows.forEach(function (row, r) {
            for (const cell of row.cells) {
                const span = Math.min(cell.rowSpan || 1, rows.length - r)
                for (let i = r; i < r + span; i++) {
                    for (let j = r; j < r + span; j++) coverage[i].add(j)
                }
            }
        })

        rowSpanCache.set(table, coverage)
        return coverage
    }

    function clearHover() {
        for (const r of groupRows) r.classList.remove('is-group-hover')
        for (const c of rowCells) c.classList.remove('is-row-hover')
        groupRows = []
        rowCells = []
    }

    function setHover(cell) {
        if (cell === hoveredCell) return
        hoveredCell = cell
        clearHover()

        if (!cell) return

        const row = cell.closest('tr')
        const table = row && row.closest('table')
        if (!table) return

        for (const index of rowSpanCoverage(table)[row.rowIndex]) {
            const r = table.rows[index]
            if (!r) continue
            r.classList.add('is-group-hover')
            groupRows.push(r)
        }

        if ((cell.rowSpan || 1) > 1) return

        for (const c of row.cells) {
            if ((c.rowSpan || 1) > 1) continue
            c.classList.add('is-row-hover')
            rowCells.push(c)
        }
    }

    let navObserver = null
    let navScheduled = false

    function observeNav() {
        const nav = document.querySelector('.app-nav')
        if (!nav || navObserver) return

        navObserver = new MutationObserver(function () {
            if (navScheduled) return
            navScheduled = true
            setTimeout(function () {
                navScheduled = false
                setupNavMenus()
            }, 0)
        })
        navObserver.observe(nav, { childList: true, subtree: true })
    }

    function setupNavMenus() {
        const current = (location.hash || '#/').split('?')[0].replace(/\/+$/, '')

        for (const list of document.querySelectorAll('.app-nav > ul')) {
            for (const li of list.children) {
                if (li.tagName !== 'LI') continue

                const menu = li.querySelector(':scope > ul')
                if (!menu) continue

                if (!li.querySelector(':scope > .app-nav-toggle')) {
                    if (li.firstChild === menu || li.querySelector(':scope > a')) continue

                    const toggle = document.createElement('span')
                    toggle.className = 'app-nav-toggle'
                    while (li.firstChild && li.firstChild !== menu) toggle.appendChild(li.firstChild)
                    li.insertBefore(toggle, menu)

                    const inner = document.createElement('span')
                    inner.className = 'app-nav-toggle-inner'
                    while (toggle.firstChild) inner.appendChild(toggle.firstChild)
                    const ghost = inner.cloneNode(true)
                    ghost.className = 'app-nav-toggle-inner app-nav-toggle-ghost'
                    toggle.appendChild(inner)
                    toggle.appendChild(ghost)

                    makeButtonLike(toggle)

                    toggle.addEventListener('click', function () {
                        li.classList.toggle('is-open')
                    })

                    li.addEventListener('focusout', function (e) {
                        if (!e.relatedTarget || li.contains(e.relatedTarget)) return
                        li.classList.remove('is-open')
                    })
                }

                if (markdownHelperOptions.highlightNavMenuCurrent) {
                    li.classList.toggle('is-current', [...menu.querySelectorAll('a')].some(function (a) {
                        const href = (a.getAttribute('href') || '').split('?')[0].replace(/\/+$/, '')
                        return href === current
                    }))
                }
                else {
                    li.classList.remove('is-current')
                }
            }
        }
    }

    hook.mounted(function () {
        bindShortcuts({
            Slash: focusSearch,
            Escape: { allowInInput: true, handler: leaveSearch }
        }, { when: () => !document.body.classList.contains('has-toc') })

        window.addEventListener('scroll', updateSticky, { passive: true })
        window.addEventListener('resize', updateSticky, { passive: true })

        const cover = document.querySelector('section.cover')
        if (cover) new MutationObserver(updateSticky).observe(cover, { attributes: true, attributeFilter: ['class'] })

        document.addEventListener('mouseover', function (e) {
            setHover(e.target.closest('.markdown-section tbody td, .markdown-section tbody th'))
        })

        document.addEventListener('click', function (e) {
            for (const li of document.querySelectorAll('.app-nav > ul > li.is-open')) {
                if (!li.contains(e.target)) li.classList.remove('is-open')
            }
        })

        observeNav()

        updateSticky()
    })

    hook.doneEach(function () {
        const sidebar = document.getElementsByClassName('sidebar')[0]
        const appName = sidebar && sidebar.getElementsByClassName('app-name')[0]
        const search = sidebar && sidebar.getElementsByClassName('search')[0]

        if (appName && search) search.before(appName)

        setupNavMenus()

        rowSpanCache = new WeakMap()
        hoveredCell = null
        clearHover()
        updateSticky()
    })
}

window.$docsify['markdownHelper'] = Object.assign(
    markdownHelperOptions,
    window.$docsify['markdownHelper']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
