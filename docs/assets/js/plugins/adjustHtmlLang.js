import { calLocalized } from '../utils/localization.js'
import { setAttrs } from '../utils/dom.js'

let htmlLangOptions = {
    enable: false,
    localization: {
        lang: {
            '/jp/': 'ja',
            '/en-us/': 'en',
            default: 'zh-Hans'
        }
    }
}

function plugin(hook, vm) {
    if (!htmlLangOptions.enable) return

    hook.doneEach(function () {
        setAttrs(document.documentElement, {
            lang: calLocalized(htmlLangOptions.localization, undefined).lang
        })
    })
}

window.$docsify['htmlLang'] = Object.assign(
    htmlLangOptions,
    window.$docsify['htmlLang']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
