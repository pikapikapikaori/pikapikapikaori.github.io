import { h, qs } from './dom.js'

/** 面包屑：先 setBreadcrumbs() 记下，等 mountView 的 await 之后再渲染。 */

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
