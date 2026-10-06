function plugin(hook, vm) {

    const mediaLocalizationOptions = {
        img: {
            'default': (el) => `[图片${el.getAttribute('alt') ? '：' + el.getAttribute('alt') : ''}]`,
            '/jp/': (el) => `[画像${el.getAttribute('alt') ? '：' + el.getAttribute('alt') : ''}]`,
            '/en-us/': (el) => `[image${el.getAttribute('alt') ? ': ' + el.getAttribute('alt') : ''}]`
        },
        video: {
            'default': () => '[视频]',
            '/jp/': () => '[動画]',
            '/en-us/': () => '[video]'
        },
        audio: {
            'default': () => '[音频]',
            '/jp/': () => '[音声]',
            '/en-us/': () => '[audio]'
        },
        iframe: {
            'default': () => '[内嵌页]',
            '/jp/': () => '[インラインフレーム]',
            '/en-us/': () => '[iframe]'
        },
        source: {
            'default': () => '[媒体源]',
            '/jp/': () => '[ソース]',
            '/en-us/': () => '[source]'
        }
    }

    function formatMediaPlaceholder(tag, el, routePath) {
        const tagOptions = mediaLocalizationOptions[tag]
        if (!tagOptions) return `[${tag}]`

        let result = ''
        let matched = false
        Object.keys(tagOptions).some(match => {
            const isMatch = match !== 'default' && routePath.indexOf(match) > -1
            if (isMatch) {
                result = tagOptions[match](el)
                matched = true
            }
            return isMatch
        })
        if (!matched) result = tagOptions['default'](el)

        return result
    }

    hook.afterEach(function (html) {
        const template = document.createElement('template')
        template.innerHTML = html

        const routePath = vm.route.path

        template.content
            .querySelectorAll('img, video, audio, iframe, source')
            .forEach(el => {
                const tag = el.tagName.toLowerCase()
                const text = formatMediaPlaceholder(tag, el, routePath)

                const ph = document.createElement('span')
                ph.className = 'blocked-media'
                ph.dataset.blockedTag = tag
                ph.textContent = text

                for (const attr of el.attributes) {
                    if (attr.name === 'class' || attr.name === 'style') continue
                    const camel = attr.name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
                    ph.dataset['original' + camel] = attr.value
                }

                el.replaceWith(ph)
            })

        return template.innerHTML
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
