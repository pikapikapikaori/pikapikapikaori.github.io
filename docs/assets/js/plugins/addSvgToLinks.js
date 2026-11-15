import { docsifyClasses } from '../utils/constants.js'
import { getAllEls, getData, setData } from '../utils/dom.js'
import { link } from '../utils/icons.js'
import { breadcrumbClass } from './breadcrumb.js'

let addSvgToLinksOptions = {
    enable: false
}

function plugin(hook, vm) {
    if (!addSvgToLinksOptions.enable) return

    const query = `.${docsifyClasses.markdownSection} p a,.${docsifyClasses.markdownSection} li a,.${docsifyClasses.markdownSection} blockquote a,.${docsifyClasses.markdownSection} table a`

    hook.doneEach(function () {
        getAllEls(query).forEach(a => {
            let curURL = new URL(a.href)
            let curLink = curURL.origin + curURL.pathname + curURL.hash.split('?')[0]
            let documentLink = location.origin + location.pathname + location.hash.split('?')[0]

            if (getData(a, 'linkIcon')) return

            if (a.closest('.' + breadcrumbClass)) return

            if (curLink === documentLink) return

            let isInternal = curURL.origin === location.origin

            setData(a, 'linkIcon', isInternal ? 'internal' : 'external')
            a.innerHTML += isInternal ? link.internal : link.external
        })
    })
}

window.$docsify['addSvgToLinks'] = Object.assign(
    addSvgToLinksOptions,
    window.$docsify['addSvgToLinks']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
