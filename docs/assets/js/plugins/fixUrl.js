import { queryAll, setAttrs } from '../utils/dom.js'

let fixUrlOptions = {
    enable: false,
    prefix: './'
}

function plugin(hook) {
    if (!fixUrlOptions.enable) return

    const selector = 'a,img,iframe'

    const prefix = fixUrlOptions.prefix

    function fixRelativeUrls(el) {
        if (!el || el.nodeType !== 1) {
            return el
        }

        const protocolRe = /^(?:[a-zA-Z][a-zA-Z0-9+.\-]*:|\/\/|#)/

        const nodes = [el, ...queryAll('[src], [href]', el)]

        nodes.forEach(node => {
            const attrs = {}

            for (const attr of ['src', 'href']) {
                if (!node.hasAttribute(attr)) continue
                const v = node.getAttribute(attr)
                const stripped = (v || '').trim()
                if (!stripped) continue
                if (protocolRe.test(stripped)) continue
                if (stripped.startsWith(prefix)) continue
                attrs[attr] = prefix + v
            }

            setAttrs(node, attrs)
        })

        return el
    }

    hook.doneEach(() => {
        queryAll(selector).forEach(el => {
            fixRelativeUrls(el)
        })
    })
}

window.$docsify['fixUrl'] = Object.assign(
    fixUrlOptions,
    window.$docsify['fixUrl']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
