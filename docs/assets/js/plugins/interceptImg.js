import { calLocalized } from '../utils/localization.js'
import { createEl, getAllEls, setData } from '../utils/dom.js'

let interceptImgOptions = {
    enable: false,
    localization: {
        separator: {
            default: '：',
            '/jp/': '：',
            '/en-us/': ':'
        },
        img: {
            default: '图片',
            '/jp/': '画像',
            '/en-us/': 'image'
        },
        video: {
            default: '视频',
            '/jp/': '動画',
            '/en-us/': 'video'
        },
        audio: {
            default: '音频',
            '/jp/': '音声',
            '/en-us/': 'audio'
        },
        iframe: {
            default: '内嵌页',
            '/jp/': 'インラインフレーム',
            '/en-us/': 'iframe'
        },
        source: {
            default: '媒体源',
            '/jp/': 'ソース',
            '/en-us/': 'source'
        }
    }
}

function plugin(hook, vm) {
    if (!interceptImgOptions.enable) return

    function formatMediaPlaceholder(tag, el, localizedNames) {
        const name = localizedNames[tag]
        if (!name) return `[${tag}]`

        const alt = (el.getAttribute('alt') || '').trim()
        if (!alt) return `[${name}]`

        const separator = localizedNames.separator
        return `[${name}${separator}${alt}]`
    }

    hook.afterEach(function (html) {
        const template = createEl('template')
        template.innerHTML = html

        const routePath = vm.route.path
        const localizedNames = calLocalized(interceptImgOptions.localization)

        getAllEls('img, video, audio, iframe, source', template.content)
            .forEach(el => {
                const tag = el.tagName.toLowerCase()
                const text = formatMediaPlaceholder(tag, el, localizedNames)

                const ph = createEl('span', {
                    className: 'blocked-media',
                    text: text,
                    data: { blockedTag: tag }
                })

                for (const attr of el.attributes) {
                    if (attr.name === 'class' || attr.name === 'style') continue
                    const camel = attr.name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
                    setData(ph, 'original' + camel, attr.value)
                }

                el.replaceWith(ph)
            })

        return template.innerHTML
    })
}

window.$docsify['interceptImg'] = Object.assign(
    interceptImgOptions,
    window.$docsify['interceptImg']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
