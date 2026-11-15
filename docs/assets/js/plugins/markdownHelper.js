import { bindShortcuts } from '../utils/shortcut.js'
import { makeButtonLike } from '../utils/common.js'
import { mediaQueries, docsifyClasses, elementStatus } from '../utils/constants.js'
import {
    onListen,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    createEl,
    getEl,
    getAllEls,
    getElByClass
} from '../utils/dom.js'
import { hasTocClass } from './tocPage.js'

let markdownHelperOptions = {
    enable: false,
    highlightNavMenuCurrent: false
}

const appNavToggleClass = 'app-nav-toggle'
const appNavToggleInnerClass = 'app-nav-toggle-inner'
const appNavToggleGhostClass = 'app-nav-toggle-ghost'

function plugin(hook, vm) {
    if (!markdownHelperOptions.enable) return

    function searchInput() {
        return getEl(`.${docsifyClasses.sidebar} .${docsifyClasses.search} input[type="search"]`)
    }

    function openSidebar() {
        const isNarrow = window.matchMedia(mediaQueries.narrow).matches

        toggleClass(document.body, elementStatus.close, isNarrow)
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

        const clearButton = getEl(`.${docsifyClasses.sidebar} .${docsifyClasses.search} .${docsifyClasses.clearButton}`)

        if (clearButton && hasClass(clearButton, elementStatus.show)) {
            clearButton.click()
        }
        else {
            input.value = ''
            input.dispatchEvent(new Event('input', { bubbles: true }))
        }

        input.blur()
    }

    function updateSticky() {
        const cover = getEl(`section.${docsifyClasses.cover}.${elementStatus.show}`)
        const threshold = cover ? cover.getBoundingClientRect().height : 0
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
        toggleClass(document.body, elementStatus.sticky, scrollTop >= threshold)
    }

    // 封面滚出视口后暂停下拉箭头动画
    let chevronObserver = null
    let chevronWatched = null

    function watchChevronVisibility() {
        if (!('IntersectionObserver' in window)) return

        const cover = getEl(`section.${docsifyClasses.cover}`)
        const wrap = getEl('.cover-page-scroll-down-chevron-div')
        if (!cover || !wrap || (chevronWatched && chevronWatched.cover === cover && chevronWatched.wrap === wrap)) return

        if (chevronObserver) chevronObserver.disconnect()

        chevronWatched = { cover: cover, wrap: wrap }
        chevronObserver = new IntersectionObserver(function (entries) {
            const onScreen = entries.some(entry => entry.isIntersecting)
            toggleClass(wrap, elementStatus.isOffscreen, !onScreen)
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
        for (const r of groupRows) removeClass(r, elementStatus.isGroupHover)
        for (const c of rowCells) removeClass(c, elementStatus.isRowHover)
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
            addClass(r, elementStatus.isGroupHover)
            groupRows.push(r)
        }

        if ((cell.rowSpan || 1) > 1) return

        for (const c of row.cells) {
            if ((c.rowSpan || 1) > 1) continue
            addClass(c, elementStatus.isRowHover)
            rowCells.push(c)
        }
    }

    let navObserver = null
    let navScheduled = false

    function observeNav() {
        const nav = getEl(`.${docsifyClasses.appNav}`)
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

        for (const list of getAllEls(`.${docsifyClasses.appNav} > ul`)) {
            for (const li of list.children) {
                if (li.tagName !== 'LI') continue

                const menu = getEl(':scope > ul', li)
                if (!menu) continue

                if (!getEl(`:scope > .${appNavToggleClass}`, li)) {
                    if (li.firstChild === menu || getEl(':scope > a', li)) continue

                    const toggle = createEl('span', { className: appNavToggleClass })
                    while (li.firstChild && li.firstChild !== menu) toggle.appendChild(li.firstChild)
                    li.insertBefore(toggle, menu)

                    const inner = createEl('span', { className: appNavToggleInnerClass })
                    while (toggle.firstChild) inner.appendChild(toggle.firstChild)
                    const ghost = inner.cloneNode(true)
                    ghost.className = `${appNavToggleInnerClass} ${appNavToggleGhostClass}`
                    toggle.appendChild(inner)
                    toggle.appendChild(ghost)

                    makeButtonLike(toggle)

                    onListen(toggle, 'click', function () {
                        toggleClass(li, elementStatus.isOpen)
                    })

                    onListen(li, 'focusout', function (e) {
                        if (!e.relatedTarget || li.contains(e.relatedTarget)) return
                        removeClass(li, elementStatus.isOpen)
                    })
                }

                if (markdownHelperOptions.highlightNavMenuCurrent) {
                    toggleClass(li, elementStatus.isCurrent, getAllEls('a', menu).some(function (a) {
                        const href = (a.getAttribute('href') || '').split('?')[0].replace(/\/+$/, '')
                        return href === current
                    }))
                }
                else {
                    removeClass(li, elementStatus.isCurrent)
                }
            }
        }
    }

    hook.mounted(function () {
        bindShortcuts({
            Slash: focusSearch,
            Escape: { allowInInput: true, handler: leaveSearch }
        }, { when: () => !hasClass(document.body, hasTocClass) })

        onListen(window, 'scroll', updateSticky, { passive: true })
        onListen(window, 'resize', updateSticky, { passive: true })

        const cover = getEl(`section.${docsifyClasses.cover}`)
        if (cover) new MutationObserver(updateSticky).observe(cover, { attributes: true, attributeFilter: ['class'] })

        watchChevronVisibility()

        onListen(document, 'mouseover', function (e) {
            setHover(e.target.closest(`.${docsifyClasses.markdownSection} tbody td, .${docsifyClasses.markdownSection} tbody th`))
        })

        onListen(document, 'click', function (e) {
            for (const li of getAllEls(`.${docsifyClasses.appNav} > ul > li.${elementStatus.isOpen}`)) {
                if (!li.contains(e.target)) removeClass(li, elementStatus.isOpen)
            }
        })

        observeNav()

        updateSticky()
    })

    hook.doneEach(function () {
        const sidebar = getElByClass(docsifyClasses.sidebar)
        const appName = sidebar && getElByClass(docsifyClasses.appName, sidebar)
        const search = sidebar && getElByClass(docsifyClasses.search, sidebar)

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
