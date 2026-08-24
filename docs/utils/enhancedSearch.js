function plugin (hook, vm) {
    hook.doneEach(function () {
        let sidebar = document.getElementsByClassName('sidebar')[0]
        let appName = sidebar.getElementsByClassName('app-name')[0]
        let search = sidebar.getElementsByClassName('search')[0]

        sidebar.insertBefore(appName, search)
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
