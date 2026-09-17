let tocSwitcherOptions = {
    localization: {
        toc: 'Contents',
        default: 'Articles',
    },
}

function plugin(hook, vm) {
    hook.doneEach(function () {
        let tempLocalization = {
            toc: '',
            default: '',
        }

        Object.keys(tempLocalization).forEach(key => {
            const textValue = tocSwitcherOptions.localization[key]

            if (typeof textValue === 'string') {
                tempLocalization[key] = textValue
            }
            else if (typeof textValue === 'object') {
                Object.keys(textValue).some(match => {
                    const isMatch = location.href.indexOf(match) > -1

                    tempLocalization[key] = isMatch ? textValue[match] : tocSwitcherOptions.localization[key]

                    return isMatch
                })
            }
        })

        const sidebarNav = document.querySelector('.sidebar-nav')

        let switchWrap = document.querySelector('.switch-toc-wrap-div') ? document.querySelector('.switch-toc-wrap-div') : document.createElement('div')

        switchWrap.className = 'switch-toc-wrap-div'
        switchWrap.innerHTML = `<button class="toc-btn active-btn">${tempLocalization.toc}</button><button class="default-btn">${tempLocalization.default}</button>`

        sidebarNav.before(switchWrap)

        switchWrap.innerHTML = `<button class="toc-btn active-btn">${tempLocalization.toc}</button><button class="default-btn">${tempLocalization.default}</button>`

        sidebarNav.before(switchWrap)

        const tocBtn = switchWrap.querySelector('.toc-btn')
        const defaultBtn = switchWrap.querySelector('.default-btn')

        const activeBtnClass = 'active-btn'

        tocBtn.onclick = (e) => {
            e.stopPropagation()
            tocBtn.classList.add(activeBtnClass)
            defaultBtn.classList.remove(activeBtnClass)
        }

        defaultBtn.onclick = (e) => {
            e.stopPropagation()
            defaultBtn.classList.add(activeBtnClass)
            tocBtn.classList.remove(activeBtnClass)
        }

        // 修复滚动高亮
        const headingList = []
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
            const span = h.querySelector('span')
            const text = (span ? span.textContent : h.textContent).trim()
            if (text) headingList.push({ heading: h, text })
        })


        const items = []
        document.querySelectorAll('.sidebar-nav a').forEach(a => {
            const title = (a.getAttribute('title') || a.textContent || '').trim()
            if (!title) return

            const match = headingList.find(item => item.text === title)
            if (!match) return

            const li = a.closest('li')
            if (!li) return

            items.push({ li, heading: match.heading })
        })

        if (items.length === 0) return

        items.sort((a, b) => a.heading.offsetTop - b.heading.offsetTop)

        const offset = 100
        let ticking = false

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

            items.forEach(it => it.li.classList.remove('active'))
            if (current) current.li.classList.add('active')
        }

        const onScroll = () => {
            if (ticking) return
            ticking = true
            requestAnimationFrame(() => {
                updateActive()
                ticking = false
            })
        }

        window.removeEventListener('scroll', onScroll)
        window.addEventListener('scroll', onScroll)

        updateActive()
    })
}

window.$docsify['tocSwitcher'] = Object.assign(
    tocSwitcherOptions,
    window.$docsify['tocSwitcher']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
