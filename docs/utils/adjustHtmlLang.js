let htmlLangOptions = {
    localization: {
        'jp': 'ja',
        'en-us': 'en',
        'default': 'zh-Hans'
    }
}

function plugin(hook, vm) {
    hook.doneEach(function () {
        const localization = htmlLangOptions.localization

        const curLocal = vm.route.path.split('/')[1]

        let lang = localization[curLocal] || localization.default

        document.documentElement.lang = lang
    })
}

window.$docsify['htmlLang'] = Object.assign(
    htmlLangOptions,
    window.$docsify['htmlLang']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
