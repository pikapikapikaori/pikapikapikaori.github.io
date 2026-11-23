import { docsifyClasses, elementStatus } from '../utils/constants.js'
import { onListen, toggleClass, hasClass, createEl, getEl, getElByClass } from '../utils/dom.js'

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
        if (getEl('.fade-edge', container)) return

        const top = createEl('div', { className: 'fade-edge top' })
        const bottom = createEl('div', { className: 'fade-edge bottom' })
        container.prepend(top)
        container.append(bottom)

        const update = () => {
            const { atTop, atBottom } = containerEdgeState(container)

            toggleClass(top, elementStatus.show, !atTop)
            toggleClass(bottom, elementStatus.show, !atBottom)
        }

        onListen(container, 'scroll', update, { passive: true })
        onListen(window, 'scroll', update, { passive: true })
        onListen(window, 'resize', update, { passive: true })
        new ResizeObserver(update).observe(container)
        update()
    }

    function attachContentFadeEdge(container) {
        if (!container) return

        if (getEl('.content-fade-edge', document.body)) return

        const top = createEl('div', { className: 'fade-edge content-fade-edge top' })

        const bottom = createEl('div', { className: 'fade-edge content-fade-edge bottom' })

        document.body.prepend(top)
        document.body.append(bottom)

        const update = () => {
            let atTop, atBottom

            const cover = getEl(`section.${docsifyClasses.cover}.${elementStatus.show}`)

            if (cover) {
                const scrollTop = document.scrollingElement.scrollTop
                const max = document.scrollingElement.scrollHeight - window.innerHeight
                atTop = scrollTop <= 1
                atBottom = scrollTop >= max - 1
            } else {
                const state = containerEdgeState(container)
                atTop = state.atTop
                atBottom = state.atBottom
            }

            toggleClass(top, elementStatus.show, !atTop)
            toggleClass(bottom, elementStatus.show, !atBottom)
        }

        onListen(container, 'scroll', update, { passive: true })
        onListen(window, 'scroll', update, { passive: true })
        onListen(window, 'resize', update, { passive: true })
        new ResizeObserver(update).observe(container)
        update()
    }

    function initFadeEdges() {
        attachContentFadeEdge(getElByClass(docsifyClasses.content))
        attachSidebarFadeEdge(getElByClass(docsifyClasses.sidebar))
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
