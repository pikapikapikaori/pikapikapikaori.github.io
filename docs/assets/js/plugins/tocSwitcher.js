import { calLocalized } from '../utils/localization.js'
import { docsifyClasses } from '../utils/constants.js'
import {
    tags,
    eventNames,
    on,
    off,
    addClass,
    removeClass,
    createElement,
    query,
    queryAll,
    byClass
} from '../utils/dom.js'

let tocSwitcherOptions = {
    enable: false,
    localization: {
        toc: 'Contents',
        list: 'Articles',
    },
}

function plugin(hook, vm) {
    if (!tocSwitcherOptions.enable) return

    let tocSwitcherOnScroll = null
    let ticking = false

    hook.doneEach(function () {
        let tempLocalization = calLocalized(tocSwitcherOptions.localization, undefined)

        const sidebarNav = byClass(docsifyClasses.sidebarNav)
        if (!sidebarNav) return

        let switchWrap = byClass('switch-toc-wrap-div') || createElement(tags.div)

        addClass(switchWrap, 'switch-toc-wrap-div')
        switchWrap.innerHTML = `<button class="toc-btn active-btn">${tempLocalization.toc}</button><button class="default-btn">${tempLocalization.list}</button>`

        sidebarNav.before(switchWrap)

        const tocBtn = query('.toc-btn', switchWrap)
        const defaultBtn = query('.default-btn', switchWrap)

        const activeBtnClass = 'active-btn'

        on(tocBtn, eventNames.click, e => {
            e.stopPropagation()
            addClass(tocBtn, activeBtnClass)
            removeClass(defaultBtn, activeBtnClass)
        })

        on(defaultBtn, eventNames.click, e => {
            e.stopPropagation()
            addClass(defaultBtn, activeBtnClass)
            removeClass(tocBtn, activeBtnClass)
        })

        // 修复滚动高亮
        const headingList = []
        queryAll('h1, h2, h3, h4, h5, h6').forEach(h => {
            const span = query('span', h)
            const text = (span ? span.textContent : h.textContent).trim()
            if (text) headingList.push({ heading: h, text })
        })


        const items = []
        queryAll(`.${docsifyClasses.sidebarNav} a`).forEach(a => {
            const title = (a.getAttribute('title') || a.textContent || '').trim()
            if (!title) return

            const match = headingList.find(item => item.text === title)
            if (!match) return

            const li = a.closest('li')
            if (!li) return

            items.push({ li, heading: match.heading })
        })

        if (tocSwitcherOnScroll) {
            off(window, eventNames.scroll, tocSwitcherOnScroll)
            tocSwitcherOnScroll = null
        }

        if (items.length === 0) return

        items.sort((a, b) => a.heading.offsetTop - b.heading.offsetTop)

        const offset = 100

        const updateActive = () => {
            const scrollY = window.scrollY || document.documentElement.scrollTop
            const pos = scrollY + offset

            let current = items[0]
            for (let i = 0; i < items.length; i++) {
                if (items[i].heading.offsetTop <= pos) {
                    current = items[i]
                } else {
                    break
                }
            }

            items.forEach(it => removeClass(it.li, docsifyClasses.active))
            if (current) addClass(current.li, docsifyClasses.active)
        }

        tocSwitcherOnScroll = () => {
            if (ticking) return
            ticking = true
            requestAnimationFrame(() => {
                updateActive()
                ticking = false
            })
        }

        on(window, eventNames.scroll, tocSwitcherOnScroll)
        updateActive()
    })
}

window.$docsify['tocSwitcher'] = Object.assign(
    tocSwitcherOptions,
    window.$docsify['tocSwitcher']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
