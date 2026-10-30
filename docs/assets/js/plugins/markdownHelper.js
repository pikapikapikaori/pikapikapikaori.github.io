import { bindShortcuts } from '../utils/shortcut.js'

function plugin(hook, vm) {
    function searchInput() {
        return document.querySelector('.sidebar .search input[type="search"]')
    }

    function openSidebar() {
        const isNarrow = window.matchMedia('screen and (max-width: 768px)').matches

        document.body.classList.toggle('close', isNarrow)
    }

    function focusSearch() {
        const input = searchInput()
        if (!input) return

        openSidebar()
        input.focus()
    }

    function leaveSearch() {
        const input = searchInput()
        if (!input || document.activeElement !== input) return

        const clearButton = document.querySelector('.sidebar .search .clear-button')

        if (clearButton && clearButton.classList.contains('show')) {
            clearButton.click()
        }
        else {
            input.value = ''
            input.dispatchEvent(new Event('input', { bubbles: true }))
        }

        input.blur()
    }

    function updateSticky() {
        const cover = document.querySelector('section.cover.show')
        const threshold = cover ? cover.getBoundingClientRect().height : 0
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
        document.body.classList.toggle('sticky', scrollTop >= threshold)
    }

    hook.mounted(function () {
        bindShortcuts({
            Slash: focusSearch,
            Escape: { allowInInput: true, handler: leaveSearch }
        }, { when: () => !document.body.classList.contains('has-toc') })

        window.addEventListener('scroll', updateSticky, { passive: true })
        window.addEventListener('resize', updateSticky, { passive: true })

        const cover = document.querySelector('section.cover')
        if (cover) new MutationObserver(updateSticky).observe(cover, { attributes: true, attributeFilter: ['class'] })

        updateSticky()
    })

    hook.doneEach(function () {
        const sidebar = document.getElementsByClassName('sidebar')[0]
        const appName = sidebar && sidebar.getElementsByClassName('app-name')[0]
        const search = sidebar && sidebar.getElementsByClassName('search')[0]

        if (appName && search) search.before(appName)

        updateSticky()
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
