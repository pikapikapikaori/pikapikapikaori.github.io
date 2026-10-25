import { h, qs } from './dom.js'

/**
 * 面包屑渲染在 .app-main 顶部，不放 header：视图 mount 开头调 setBreadcrumbs()，
 * mountView 在 await 之后调 applyBreadcrumbs()，这样视图内部的 replace(main, ...) 不会把面包屑清掉。
 */

let pendingItems = null

export function setBreadcrumbs(items) {
    pendingItems = Array.isArray(items) ? items : []
}

export function clearBreadcrumbs() {
    pendingItems = null
}

export function applyBreadcrumbs() {
    const main = qs('.app-main')
    if (!main) return

    const old = main.querySelector(':scope > .page-breadcrumbs')
    if (old) old.remove()

    const items = pendingItems
    pendingItems = null

    if (!items || items.length === 0) return

    const nav = h('nav', {
        class: 'page-breadcrumbs',
        'aria-label': '面包屑'
    })

    const trail = h('div', { class: 'page-breadcrumbs__trail' })

    items.forEach((item, i) => {
        if (!item || !item.label) return

        if (i > 0) {
            trail.appendChild(h('span', {
                class: 'crumb-sep',
                'aria-hidden': 'true'
            }, '›'))
        }

        const isLast = i === items.length - 1
        if (isLast || !item.href) {
            trail.appendChild(h('span', { class: 'crumb-current' }, item.label))
        } else {
            trail.appendChild(h('a', {
                class: 'crumb-link',
                href: item.href
            }, item.label))
        }
    })

    nav.appendChild(trail)

    main.insertBefore(nav, main.firstChild)
}
