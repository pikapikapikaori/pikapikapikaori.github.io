import { calLocalized } from '../utils/localization.js'

let htmlLangOptions = {
    localization: {
        lang: {
            '/jp/': 'ja',
            '/en-us/': 'en',
            default: 'zh-Hans'
        }
    }
}

function plugin(hook, vm) {
    hook.doneEach(function () {
        document.documentElement.lang = calLocalized(htmlLangOptions.localization, undefined).lang
    })
}

window.$docsify['htmlLang'] = Object.assign(
    htmlLangOptions,
    window.$docsify['htmlLang']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
