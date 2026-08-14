function plugin(hook, vm) {
    hook.doneEach(function () {
        lang = 'zh-Hans'
        switch (location.href.split('#')[1].split('/')[1]) {
            case 'jp':
                lang = 'ja'
                break
            case 'en-us':
                lang = 'en'
                break
            default:
                lang = 'zh-Hans'
        }

        document.documentElement.lang = lang
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)