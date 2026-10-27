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

    hook.mounted(function () {
        bindShortcuts({
            Slash: focusSearch,
            Escape: { allowInInput: true, handler: leaveSearch }
        }, { when: () => !document.body.classList.contains('has-toc') })
    })

    hook.doneEach(function () {
        const sidebar = document.getElementsByClassName('sidebar')[0]
        if (!sidebar) return

        const appName = sidebar.getElementsByClassName('app-name')[0]
        const search = sidebar.getElementsByClassName('search')[0]
        if (!appName || !search) return

        search.before(appName)
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
