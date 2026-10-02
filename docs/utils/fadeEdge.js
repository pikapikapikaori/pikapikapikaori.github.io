function plugin(hook, vm) {

    function attachFadeEdge(container) {
        if (!container) return
        if (container.querySelector('.fade-edge')) return

        const top = document.createElement('div')
        top.className = 'fade-edge top'
        const bottom = document.createElement('div')
        bottom.className = 'fade-edge bottom'
        container.prepend(top)
        container.append(bottom)

        // 容器是否能自己滚
        function isSelfScrollable(el) {
            const oy = getComputedStyle(el).overflowY
            if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false
            return el.scrollHeight > el.clientHeight + 1
        }

        // 不自滚容器里，用内容包裹层代表实际内容范围
        function getInnerEl() {
            return container.querySelector('.markdown-section') || container
        }

        const update = () => {
            let atTop, atBottom

            if (isSelfScrollable(container)) {
                const max = container.scrollHeight - container.clientHeight
                atTop = container.scrollTop <= 1
                atBottom = container.scrollTop >= max - 1
            } else {
                // 容器随文档滚
                const cRect = container.getBoundingClientRect()
                const iRect = getInnerEl().getBoundingClientRect()

                atTop = cRect.top >= -1
                atBottom = iRect.bottom <= window.innerHeight + 1
            }

            top.classList.toggle('show', !atTop)
            bottom.classList.toggle('show', !atBottom)
        }

        container.addEventListener('scroll', update, { passive: true })
        window.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update, { passive: true })
        new ResizeObserver(update).observe(container)
        new ResizeObserver(update).observe(getInnerEl())
        update()
    }

    function initFadeEdges() {
        attachFadeEdge(document.querySelector('.content'))
        attachFadeEdge(document.querySelector('.sidebar'))
    }

    hook.doneEach(function () {
        initFadeEdges()
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)

