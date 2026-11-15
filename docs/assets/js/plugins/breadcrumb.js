import pathNameData from '../config/breadcrumbData.json.js'
import { isEnabled } from '../utils/common.js'
import { docsifyClasses, docsifyIds } from '../utils/constants.js'
import { tags, createElement, query, byId, byClass } from '../utils/dom.js'

let breadcrumbOptions = {
    enable: false,
    localization: [
        'en-us', 
        'jp',
    ]
}

function plugin(hook, vm) {
    if (!breadcrumbOptions.enable) return

    let isReadme = false

    hook.afterEach(function (html, next) {

        isReadme = false

        const i18nPathList = breadcrumbOptions.localization

        let parts = vm.route.path.split('/').slice(1)
        let breadcrumb = '<ul class=\'breadcrumb\'>'
        let curPath = '/'

        if (!i18nPathList.includes(parts[0])) {
            if (parts.length == 1 && parts[0] == '') {
                breadcrumb += `<li class='${docsifyClasses.active}'>首页</li>`
            }
            else {
                breadcrumb += '<li><a href=\'' + '#' + curPath + '\'>首页</a></li>'
            }
        }

        if (!isEnabled(parts[parts.length - 1])) {
            parts = parts.slice(0, -1)
            isReadme = true
        }
        else {
            isReadme = false
        }

        parts.forEach(function (part, index) {
            curPath += part + '/'
            let curHrefPath = '#' + curPath

            let matched = pathNameData.find(item => item.path === curPath)

            let secondaryText = part.replace(/\.md$/, '').replace(/[_-]/g, ' ')

            let displayText = matched ? matched.name : secondaryText.charAt(0).toUpperCase() + secondaryText.slice(1)

            if (index < parts.length - 1) {
                breadcrumb += '<li><a href=\'' + curHrefPath + '\'>' + displayText + '</a></li>'
            } else {
                breadcrumb += `<li class='${docsifyClasses.active}'>` + displayText + '</li>'
            }
        })

        breadcrumb += '</ul>'

        next(breadcrumb + html)
    })

    hook.doneEach(function () {
        if (!isReadme) {
            const mainEl = byId(docsifyIds.main)
            const h1El = query('h1', mainEl)
            let pageTitle = h1El ? h1El.textContent.trim() : ''

            let breadcrumb = byClass('breadcrumb')
            if (!breadcrumb) return

            if (pageTitle === '404') {
                let homePageLi = query('li:first-child', breadcrumb)

                breadcrumb.innerHTML = ''

                breadcrumb.appendChild(homePageLi.cloneNode(true))

                let notFoundLi = createElement(tags.li, {
                    className: docsifyClasses.active,
                    text: pageTitle
                })
                breadcrumb.appendChild(notFoundLi)
            }
            else {
                const activeEl = byClass(docsifyClasses.active, breadcrumb)
                if (!activeEl) return

                activeEl.innerHTML = pageTitle
            }
        }
    })
}

window.$docsify['breadcrumb'] = Object.assign(
    breadcrumbOptions,
    window.$docsify['breadcrumb']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
