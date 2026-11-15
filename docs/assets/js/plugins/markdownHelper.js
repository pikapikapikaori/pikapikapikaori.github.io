import { bindShortcuts } from '../utils/shortcut.js'
import { makeButtonLike } from '../utils/common.js'
import { mediaQueries, docsifyClasses } from '../utils/constants.js'
import {
    tags,
    eventNames,
    on,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    createElement,
    query,
    queryAll,
    byClass
} from '../utils/dom.js'
import { hasTocClass } from './tocPage.js'

let markdownHelperOptions = {
    enable: false,
    highlightNavMenuCurrent: false
}

function plugin(hook, vm) {
    if (!markdownHelperOptions.enable) return

    function searchInput() {
        return query(`.${docsifyClasses.sidebar} .${docsifyClasses.search} input[type="search"]`)
    }

    function openSidebar() {
        const isNarrow = window.matchMedia(mediaQueries.narrow).matches

        toggleClass(document.body, docsifyClasses.close, isNarrow)
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

        const clearButton = query(`.${docsifyClasses.sidebar} .${docsifyClasses.search} .clear-button`)

        if (clearButton && hasClass(clearButton, docsifyClasses.show)) {
            clearButton.click()
        }
        else {
            input.value = ''
            input.dispatchEvent(new Event(eventNames.input, { bubbles: true }))
        }

        input.blur()
    }

    function updateSticky() {
        const cover = query(`section.cover.${docsifyClasses.show}`)
        const threshold = cover ? cover.getBoundingClientRect().height : 0
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
        toggleClass(document.body, 'sticky', scrollTop >= threshold)
    }

    // 封面滚出视口后暂停下拉箭头动画
    let chevronObserver = null
    let chevronWatched = null

    function watchChevronVisibility() {
        if (!('IntersectionObserver' in window)) return

        const cover = query('section.cover')
        const wrap = query('.cover-page-scroll-down-chevron-div')
        if (!cover || !wrap || (chevronWatched && chevronWatched.cover === cover && chevronWatched.wrap === wrap)) return

        if (chevronObserver) chevronObserver.disconnect()

        chevronWatched = { cover: cover, wrap: wrap }
        chevronObserver = new IntersectionObserver(function (entries) {
            const onScreen = entries.some(entry => entry.isIntersecting)
            toggleClass(wrap, 'is-offscreen', !onScreen)
        }, { threshold: 0 })
        chevronObserver.observe(cover)
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
        for (const r of groupRows) removeClass(r, 'is-group-hover')
        for (const c of rowCells) removeClass(c, 'is-row-hover')
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
            addClass(r, 'is-group-hover')
            groupRows.push(r)
        }

        if ((cell.rowSpan || 1) > 1) return

        for (const c of row.cells) {
            if ((c.rowSpan || 1) > 1) continue
            addClass(c, 'is-row-hover')
            rowCells.push(c)
        }
    }

    let navObserver = null
    let navScheduled = false

    function observeNav() {
        const nav = query(`.${docsifyClasses.appNav}`)
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

        for (const list of queryAll(`.${docsifyClasses.appNav} > ul`)) {
            for (const li of list.children) {
                if (li.tagName !== 'LI') continue

                const menu = query(':scope > ul', li)
                if (!menu) continue

                if (!query(`:scope > .${docsifyClasses.appNav}-toggle`, li)) {
                    if (li.firstChild === menu || query(':scope > a', li)) continue

                    const toggle = createElement(tags.span, { className: `${docsifyClasses.appNav}-toggle` })
                    while (li.firstChild && li.firstChild !== menu) toggle.appendChild(li.firstChild)
                    li.insertBefore(toggle, menu)

                    const inner = createElement(tags.span, { className: `${docsifyClasses.appNav}-toggle-inner` })
                    while (toggle.firstChild) inner.appendChild(toggle.firstChild)
                    const ghost = inner.cloneNode(true)
                    ghost.className = `${docsifyClasses.appNav}-toggle-inner ${docsifyClasses.appNav}-toggle-ghost`
                    toggle.appendChild(inner)
                    toggle.appendChild(ghost)

                    makeButtonLike(toggle)

                    on(toggle, eventNames.click, function () {
                        toggleClass(li, 'is-open')
                    })

                    on(li, eventNames.focusout, function (e) {
                        if (!e.relatedTarget || li.contains(e.relatedTarget)) return
                        removeClass(li, 'is-open')
                    })
                }

                if (markdownHelperOptions.highlightNavMenuCurrent) {
                    toggleClass(li, 'is-current', queryAll(tags.a, menu).some(function (a) {
                        const href = (a.getAttribute('href') || '').split('?')[0].replace(/\/+$/, '')
                        return href === current
                    }))
                }
                else {
                    removeClass(li, 'is-current')
                }
            }
        }
    }

    hook.mounted(function () {
        bindShortcuts({
            Slash: focusSearch,
            Escape: { allowInInput: true, handler: leaveSearch }
        }, { when: () => !hasClass(document.body, hasTocClass) })

        on(window, eventNames.scroll, updateSticky, { passive: true })
        on(window, eventNames.resize, updateSticky, { passive: true })

        const cover = query('section.cover')
        if (cover) new MutationObserver(updateSticky).observe(cover, { attributes: true, attributeFilter: ['class'] })

        watchChevronVisibility()

        on(document, eventNames.mouseover, function (e) {
            setHover(e.target.closest(`.${docsifyClasses.markdownSection} tbody td, .${docsifyClasses.markdownSection} tbody th`))
        })

        on(document, eventNames.click, function (e) {
            for (const li of queryAll(`.${docsifyClasses.appNav} > ul > li.is-open`)) {
                if (!li.contains(e.target)) removeClass(li, 'is-open')
            }
        })

        observeNav()

        updateSticky()
    })

    hook.doneEach(function () {
        const sidebar = byClass(docsifyClasses.sidebar)
        const appName = sidebar && byClass(docsifyClasses.appName, sidebar)
        const search = sidebar && byClass(docsifyClasses.search, sidebar)

        if (appName && search) search.before(appName)

        setupNavMenus()
        watchChevronVisibility()

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
