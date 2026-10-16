import { h, qs } from './dom.js'

/**
 * 面包屑改为渲染在 .app-main 最上方（正文顶部），不再放 header。
 *
 * 用法：
 *   view.mount() 开头调 setBreadcrumbs([...])
 *   main.js 的 mountView 在 await view.mount() 之后调 applyBreadcrumbs()
 *
 * 这样避免 view 内部的 replace(main, ...) 把面包屑清掉。
 */

let pendingItems = null

export function setBreadcrumbs(items) {
    pendingItems = Array.isArray(items) ? items : []
}

export function clearBreadcrumbs() {
    pendingItems = null
}

/** 由 mountView 在视图挂载完成后调用 */
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

    // 返回上一层级
    const parent = items[items.length - 2]
    if (parent && parent.href) {
        nav.appendChild(h('a', {
            class: 'page-breadcrumbs__back',
            href: parent.href,
            title: `返回 ${parent.label}`,
            'aria-label': `返回 ${parent.label}`
        },
        h('span', { class: 'page-breadcrumbs__back-arrow', 'aria-hidden': 'true' }, '←'),
        h('span', { class: 'page-breadcrumbs__back-label' }, parent.label)
        ))
    }

    main.insertBefore(nav, main.firstChild)
}
