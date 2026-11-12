let fixUrlOptions = {
    prefix: './'
}

function plugin(hook, vm) {
    const query = 'a,img,iframe'

    const prefix = fixUrlOptions.prefix

    function fixRelativeUrls(el) {
        if (!el || el.nodeType !== 1) {
            return el
        }

        const protocolRe = /^(?:[a-zA-Z][a-zA-Z0-9+.\-]*:|\/\/|#)/

        const nodes = [el, ...el.querySelectorAll('[src], [href]')]

        nodes.forEach(node => {
            for (const attr of ['src', 'href']) {
                if (!node.hasAttribute(attr)) continue
                const v = node.getAttribute(attr)
                const stripped = (v || '').trim()
                if (!stripped) continue
                if (protocolRe.test(stripped)) continue
                if (stripped.startsWith(prefix)) continue
                node.setAttribute(attr, prefix + v)
            }
        })

        return el
    }

    hook.doneEach(() => {
        Array.from(document.querySelectorAll(query)).forEach(el => {
            fixRelativeUrls(el)
        })
    })
}

window.$docsify['fixUrl'] = Object.assign(
    fixUrlOptions,
    window.$docsify['fixUrl']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
