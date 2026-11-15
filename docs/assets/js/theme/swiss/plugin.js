import {
    widgetsContainerId,
    widgetsRowClass,
    widgetItemClass,
    widgetPopupClass,
    widgetHiddenClass,
    progressWidgetId
} from '../../plugins/widgets.js'
import { tocPageDivClass } from '../../plugins/tocPage.js'
import { breadcrumbClass } from '../../plugins/breadcrumb.js'
import { countWordsBlockId } from '../../plugins/countWords.js'
import { docsifyClasses, elementStatus } from '../../utils/constants.js'
import { arrow } from '../../utils/icons.js'
import {
    onListen,
    addClass,
    toggleClass,
    hasClass,
    createEl,
    getEl,
    getAllEls,
    getElById,
    getElByClass
} from '../../utils/dom.js'

const doubleUpArrow = arrow.doubleUpArrow

function eagerTocPageImages(root) {
    getAllEls(`.${tocPageDivClass} img`, root).forEach((img, index) => {
        if (index < 6) img.loading = 'eager'
    })
}

function setupWidgetsRow() {
    const container = getElById(widgetsContainerId)
    if (!container) return null

    const rowSelector = `:scope > .${widgetsRowClass}`
    const hiddenSelector = `.${widgetHiddenClass}`

    let row = getEl(rowSelector, container)
    if (!row) {
        row = createEl('div', { className: widgetsRowClass })
        container.insertBefore(row, container.firstChild)
    }

    for (const el of getAllEls(`:scope > .${widgetItemClass}, :scope > .${widgetPopupClass}`, container)) {
        row.appendChild(el)
    }

    let hidden = getAllEls(hiddenSelector, row).length

    const anchor = new MutationObserver(() => {
        const now = getAllEls(hiddenSelector, row).length
        const wasHidden = hidden > 0
        hidden = now
        if (!wasHidden || now > 0) return
        requestAnimationFrame(() => {
            row.scrollLeft = row.scrollWidth
        })
    })
    anchor.observe(row, { subtree: true, attributes: true, attributeFilter: ['class'] })

    return function stop() {
        anchor.disconnect()
    }
}

function setupReadProgress() {
    const el = getElById(progressWidgetId)
    if (!el) return null

    let icon = getEl('.sw-top-arrow', el)
    if (!icon) {
        const holder = createEl('span')
        holder.innerHTML = doubleUpArrow
        icon = holder.firstElementChild
        addClass(icon, 'sw-top-arrow')
        el.appendChild(icon)
    }

    const onClick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const stopClick = onListen(el, 'click', onClick)

    return function stop() {
        stopClick()
        if (icon.isConnected) icon.remove()
    }
}

function setupTocSpy() {
    const nav = getElByClass(docsifyClasses.sidebarNav)
    if (!nav) return null

    let items = []
    let ticking = false
    let frame = 0

    const collect = () => {
        const heads = []
        const scope = `.${docsifyClasses.markdownSection}`

        for (const h of getAllEls(`${scope} h1, ${scope} h2, ${scope} h3, ${scope} h4`)) {
            const span = getEl('span', h)
            const text = (span ? span.textContent : h.textContent).trim()
            if (text) heads.push({ el: h, text: text })
        }

        const found = []
        for (const a of getAllEls('a', nav)) {
            const title = (a.getAttribute('title') || a.textContent || '').trim()
            if (!title) continue
            const match = heads.find(item => item.text === title)
            const li = a.closest('li')
            if (!match || !li) continue
            found.push({ li: li, heading: match.el })
        }

        found.sort((a, b) =>
            a.heading.compareDocumentPosition(b.heading) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)

        return found
    }

    const apply = () => {
        if (!items.length) items = collect()
        if (!items.length) return

        const doc = document.scrollingElement || document.documentElement
        const threshold = 100
        let current = items[0]

        for (const item of items) {
            if (item.heading.getBoundingClientRect().top > threshold) break
            current = item
        }

        if (doc.scrollTop + window.innerHeight >= doc.scrollHeight - 2) {
            current = items[items.length - 1]
        }

        const marked = items.filter(item => hasClass(item.li, elementStatus.active))
        if (marked.length === 1 && marked[0] === current) return

        for (const item of items) toggleClass(item.li, elementStatus.active, item === current)
    }

    const onScroll = () => {
        if (ticking) return
        ticking = true
        frame = requestAnimationFrame(() => {
            apply()
            ticking = false
        })
    }

    const fixer = new MutationObserver(() => apply())
    fixer.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] })

    const stopScroll = onListen(document, 'scroll', onScroll, { capture: true, passive: true })
    const stopResize = onListen(window, 'resize', onScroll)

    ticking = true
    frame = requestAnimationFrame(() => {
        apply()
        ticking = false
    })

    return function cleanup() {
        window.cancelAnimationFrame(frame)
        fixer.disconnect()
        stopScroll()
        stopResize()
    }
}

export function takeSlots(root) {
    if (!root) return []

    return [
        {
            at: 'line',
            take: () => getEl(`:scope > ul.${breadcrumbClass}`, root)
        },
        {
            at: 'meta',
            take: () => getEl(`:scope > #${countWordsBlockId}`, root)
        }
    ]
}

export function setupPlugin(root) {
    if (root) eagerTocPageImages(root)

    const stops = [setupWidgetsRow(), setupReadProgress(), setupTocSpy()].filter(Boolean)

    return function stopPlugin() {
        stops.forEach(function (stop) { stop() })
    }
}
