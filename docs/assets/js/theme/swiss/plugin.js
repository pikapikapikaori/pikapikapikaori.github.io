import { makeEl } from './util.js'

const TOP_ARROW = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 11l6-6 6 6M6 19l6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

function eagerTocPageImages(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.toc-page-div img'), function (img, index) {
        if (index < 6) img.loading = 'eager'
    })
}

function setupWidgetsRow() {
    const container = document.getElementById('page-right-widgets-container')
    if (!container) return null

    let row = container.querySelector(':scope > .widgets-row')
    if (!row) {
        row = document.createElement('div')
        row.className = 'widgets-row'
        container.insertBefore(row, container.firstChild)
    }

    Array.prototype.forEach.call(
        container.querySelectorAll(':scope > .page-right-tools-widgets-span, :scope > .page-right-popups'),
        function (el) { row.appendChild(el) }
    )

    let hidden = row.querySelectorAll('.page-right-tools-widgets-span-disappear').length

    const anchor = new MutationObserver(function () {
        const now = row.querySelectorAll('.page-right-tools-widgets-span-disappear').length
        const wasHidden = hidden > 0
        hidden = now
        if (!wasHidden || now > 0) return
        requestAnimationFrame(function () {
            row.scrollLeft = row.scrollWidth
        })
    })
    anchor.observe(row, { subtree: true, attributes: true, attributeFilter: ['class'] })

    return function stop() {
        anchor.disconnect()
    }
}

function setupReadProgress() {
    const el = document.getElementById('progress-span')
    if (!el) return null

    let icon = el.querySelector('.sw-top-arrow')
    if (!icon) {
        const holder = makeEl('span')
        holder.innerHTML = TOP_ARROW
        icon = holder.firstElementChild
        icon.classList.add('sw-top-arrow')
        el.appendChild(icon)
    }

    const onClick = function () {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    }

    el.addEventListener('click', onClick)

    return function stop() {
        el.removeEventListener('click', onClick)
        if (icon.isConnected) icon.remove()
    }
}

function setupTocSpy() {
    const nav = document.querySelector('.sidebar-nav')
    if (!nav) return null

    let items = []
    let ticking = false
    let frame = 0

    const collect = function () {
        const heads = []
        Array.prototype.forEach.call(
            document.querySelectorAll('.markdown-section h1, .markdown-section h2, .markdown-section h3, .markdown-section h4'),
            function (h) {
                const span = h.querySelector('span')
                const text = (span ? span.textContent : h.textContent).trim()
                if (text) heads.push({ el: h, text: text })
            }
        )

        const found = []
        Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
            const title = (a.getAttribute('title') || a.textContent || '').trim()
            if (!title) return
            const match = heads.find(function (item) { return item.text === title })
            const li = a.closest('li')
            if (!match || !li) return
            found.push({ li: li, heading: match.el })
        })

        found.sort(function (a, b) {
            return a.heading.compareDocumentPosition(b.heading) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        })
        return found
    }

    const apply = function () {
        if (!items.length) items = collect()
        if (!items.length) return

        const doc = document.scrollingElement || document.documentElement
        const threshold = 100
        let current = items[0]

        for (let i = 0; i < items.length; i++) {
            if (items[i].heading.getBoundingClientRect().top <= threshold) current = items[i]
            else break
        }

        if (doc.scrollTop + window.innerHeight >= doc.scrollHeight - 2) {
            current = items[items.length - 1]
        }

        const marked = items.filter(function (it) { return it.li.classList.contains('active') })
        if (marked.length === 1 && marked[0] === current) return

        items.forEach(function (it) { it.li.classList.toggle('active', it === current) })
    }

    const onScroll = function () {
        if (ticking) return
        ticking = true
        frame = requestAnimationFrame(function () {
            apply()
            ticking = false
        })
    }

    const fixer = new MutationObserver(function () { apply() })
    fixer.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] })

    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    ticking = true
    frame = requestAnimationFrame(function () {
        apply()
        ticking = false
    })

    return function cleanup() {
        window.cancelAnimationFrame(frame)
        fixer.disconnect()
        document.removeEventListener('scroll', onScroll, { capture: true })
        window.removeEventListener('resize', onScroll)
    }
}

export function takeSlots(root) {
    if (!root) return []

    return [
        {
            at: 'line',
            take: function () { return root.querySelector(':scope > ul.breadcrumb') }
        },
        {
            at: 'meta',
            take: function () { return root.querySelector(':scope > #count-words-block-span-div') }
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
