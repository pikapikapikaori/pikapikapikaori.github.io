function plugin(hook, vm) {
    function isSelfScrollable(el) {
        const oy = getComputedStyle(el).overflowY
        if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false
        return el.scrollHeight > el.clientHeight + 1
    }

    function attachSidebarFadeEdge(container) {
        if (!container) return
        if (container.querySelector('.fade-edge')) return

        const top = document.createElement('div')
        top.className = 'fade-edge top'
        const bottom = document.createElement('div')
        bottom.className = 'fade-edge bottom'
        container.prepend(top)
        container.append(bottom)

        const update = () => {
            let atTop, atBottom

            if (isSelfScrollable(container)) {
                const max = container.scrollHeight - container.clientHeight
                atTop = container.scrollTop <= 1
                atBottom = container.scrollTop >= max - 1
            } else {
                const cRect = container.getBoundingClientRect()
                let contentBottom = cRect.bottom

                for (const child of container.children) {
                    if (child.classList.contains('fade-edge')) continue
                    const r = child.getBoundingClientRect()
                    if (r.bottom > contentBottom) contentBottom = r.bottom
                }

                atTop = cRect.top >= -1
                atBottom = contentBottom <= window.innerHeight + 1
            }

            top.classList.toggle('show', !atTop)
            bottom.classList.toggle('show', !atBottom)
        }

        container.addEventListener('scroll', update, { passive: true })
        window.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update, { passive: true })
        new ResizeObserver(update).observe(container)
        update()
    }

    function attachContentFadeEdge(container) {
        if (!container) return

        if (document.body.querySelector('.content-fade-edge')) return

        const top = document.createElement('div')
        top.className = 'fade-edge content-fade-edge top'

        const bottom = document.createElement('div')
        bottom.className = 'fade-edge content-fade-edge bottom'

        document.body.prepend(top)
        document.body.append(bottom)

        const update = () => {
            let atTop, atBottom

            const cover = document.querySelector('section.cover.show')

            if (cover) {
                // cover 页：用页面滚动判断
                const scrollTop = document.scrollingElement.scrollTop
                const max = document.scrollingElement.scrollHeight - window.innerHeight
                atTop = scrollTop <= 1
                atBottom = scrollTop >= max - 1
            } else if (isSelfScrollable(container)) {
                const max = container.scrollHeight - container.clientHeight
                atTop = container.scrollTop <= 1
                atBottom = container.scrollTop >= max - 1
            } else {
                const cRect = container.getBoundingClientRect()
                let contentBottom = cRect.bottom

                for (const child of container.children) {
                    if (child.classList.contains('fade-edge')) continue
                    const r = child.getBoundingClientRect()
                    if (r.bottom > contentBottom) contentBottom = r.bottom
                }

                atTop = cRect.top >= -1
                atBottom = contentBottom <= window.innerHeight + 1
            }

            top.classList.toggle('show', !atTop)
            bottom.classList.toggle('show', !atBottom)
        }

        container.addEventListener('scroll', update, { passive: true })
        window.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update, { passive: true })
        new ResizeObserver(update).observe(container)
        update()
    }

    function initFadeEdges() {
        attachContentFadeEdge(document.querySelector('.content'))
        attachSidebarFadeEdge(document.querySelector('.sidebar'))
    }

    hook.doneEach(function () {
        initFadeEdges()
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
