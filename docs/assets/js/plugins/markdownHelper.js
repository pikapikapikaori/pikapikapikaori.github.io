function plugin(hook, vm) {
    function updateSticky() {
        const cover = document.querySelector('section.cover.show')
        const threshold = cover ? cover.getBoundingClientRect().height : 0
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
        document.body.classList.toggle('sticky', scrollTop >= threshold)
    }

    hook.mounted(function () {
        window.addEventListener('scroll', updateSticky, { passive: true })
        window.addEventListener('resize', updateSticky, { passive: true })

        const cover = document.querySelector('section.cover')
        if (cover) new MutationObserver(updateSticky).observe(cover, { attributes: true, attributeFilter: ['class'] })

        updateSticky()
    })

    hook.doneEach(function () {
        updateSticky()
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
