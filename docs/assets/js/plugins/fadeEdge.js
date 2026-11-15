import { docsifyClasses } from '../utils/constants.js'
import { tags, eventNames, on, toggleClass, hasClass, createElement, query, byClass } from '../utils/dom.js'

let fadeEdgeOptions = {
    enable: false
}

function plugin(hook, vm) {
    if (!fadeEdgeOptions.enable) return

    function isSelfScrollable(el) {
        const oy = getComputedStyle(el).overflowY
        if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false
        return el.scrollHeight > el.clientHeight + 1
    }

    function containerEdgeState(container) {
        if (isSelfScrollable(container)) {
            const max = container.scrollHeight - container.clientHeight
            return {
                atTop: container.scrollTop <= 1,
                atBottom: container.scrollTop >= max - 1
            }
        }

        const cRect = container.getBoundingClientRect()
        let contentBottom = cRect.bottom

        for (const child of container.children) {
            if (hasClass(child, 'fade-edge')) continue
            const r = child.getBoundingClientRect()
            if (r.bottom > contentBottom) contentBottom = r.bottom
        }

        return {
            atTop: cRect.top >= -1,
            atBottom: contentBottom <= window.innerHeight + 1
        }
    }

    function attachSidebarFadeEdge(container) {
        if (!container) return
        if (query('.fade-edge', container)) return

        const top = createElement(tags.div, { className: 'fade-edge top' })
        const bottom = createElement(tags.div, { className: 'fade-edge bottom' })
        container.prepend(top)
        container.append(bottom)

        const update = () => {
            const { atTop, atBottom } = containerEdgeState(container)

            toggleClass(top, docsifyClasses.show, !atTop)
            toggleClass(bottom, docsifyClasses.show, !atBottom)
        }

        on(container, eventNames.scroll, update, { passive: true })
        on(window, eventNames.scroll, update, { passive: true })
        on(window, eventNames.resize, update, { passive: true })
        new ResizeObserver(update).observe(container)
        update()
    }

    function attachContentFadeEdge(container) {
        if (!container) return

        if (query('.content-fade-edge', document.body)) return

        const top = createElement(tags.div, { className: 'fade-edge content-fade-edge top' })

        const bottom = createElement(tags.div, { className: 'fade-edge content-fade-edge bottom' })

        document.body.prepend(top)
        document.body.append(bottom)

        const update = () => {
            let atTop, atBottom

            const cover = query(`section.cover.${docsifyClasses.show}`)

            if (cover) {
                // cover 页：用页面滚动判断
                const scrollTop = document.scrollingElement.scrollTop
                const max = document.scrollingElement.scrollHeight - window.innerHeight
                atTop = scrollTop <= 1
                atBottom = scrollTop >= max - 1
            } else {
                const state = containerEdgeState(container)
                atTop = state.atTop
                atBottom = state.atBottom
            }

            toggleClass(top, docsifyClasses.show, !atTop)
            toggleClass(bottom, docsifyClasses.show, !atBottom)
        }

        on(container, eventNames.scroll, update, { passive: true })
        on(window, eventNames.scroll, update, { passive: true })
        on(window, eventNames.resize, update, { passive: true })
        new ResizeObserver(update).observe(container)
        update()
    }

    function initFadeEdges() {
        attachContentFadeEdge(byClass(docsifyClasses.content))
        attachSidebarFadeEdge(byClass(docsifyClasses.sidebar))
    }

    hook.doneEach(function () {
        initFadeEdges()
    })
}

window.$docsify['fadeEdge'] = Object.assign(
    fadeEdgeOptions,
    window.$docsify['fadeEdge']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
