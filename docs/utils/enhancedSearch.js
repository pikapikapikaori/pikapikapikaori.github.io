function plugin(hook, vm) {
    hook.doneEach(function () {
        const sidebar = document.getElementsByClassName('sidebar')[0]
        if (!sidebar) return

        const appName = sidebar.getElementsByClassName('app-name')[0]
        const search = sidebar.getElementsByClassName('search')[0]
        if (!appName || !search) return

        search.before(appName)
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
