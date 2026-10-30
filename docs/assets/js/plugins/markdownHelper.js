import { bindShortcuts } from '../utils/shortcut.js'

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

        updateSticky()
    })

    hook.doneEach(function () {
        const sidebar = document.getElementsByClassName('sidebar')[0]
        const appName = sidebar && sidebar.getElementsByClassName('app-name')[0]
        const search = sidebar && sidebar.getElementsByClassName('search')[0]

        if (appName && search) search.before(appName)

        rowSpanCache = new WeakMap()
        hoveredCell = null
        clearHover()
        updateSticky()
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
