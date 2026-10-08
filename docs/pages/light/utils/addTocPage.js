import pagesData from '../../../assets/js/config/tocdata.json.js'

function plugin(hook, vm) {

    const i18nPath = ['en-us/', 'jp/']

    const tocMarkup = '<!-- toc -->'

    const tocDiv = '<div class=\'toc-page-div\'><ul></ul></div><div class=\'toc-paginator-div\'><div class=\'tocPaginatorLeftButtonDiv toc-paginator-button-div\'><span class="toc-paginator-button-span"><?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color)"><path d="M15 6l-6 6 6 6" stroke="var(--theme-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div><div class=\'toc-paginator-input\'></div><div class=\'tocPaginatorRightButtonDiv toc-paginator-button-div\'><span class="toc-paginator-button-span"><?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color)"><path d="M9 6l6 6-6 6" stroke="var(--theme-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div></div>'

    const recentAmount = 16

    let hasTocs = false

    let savedCloseState = null

    let pendingCloseToggle = undefined

    const narrowMql = window.matchMedia('(max-width: 768px)')

    let sortedPages = []

    let curPageIndex = 1

    let maxPageIndex = 1

    function getOrdinalSuffix(day) {
        if (day > 3 && day < 21) return 'th'

        switch (day % 10) {
            case 1: return 'st'
            case 2: return 'nd'
            case 3: return 'rd'
            default: return 'th'
        }
    }

    const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const dateLocalizationOptions = {
        format: {
            'default': (month, day) => `${month} 月 ${day} 日`,
            '/jp/': (month, day) => `${month} 月 ${day} 日`,
            '/en-us/': (month, day) => `${EN_MONTHS[month - 1]} ${day}${getOrdinalSuffix(day)}`
        }
    }

    function formatPostDate(timeStr, routePath) {
        if (!timeStr) return ''

        const parts = timeStr.split('.')
        if (parts.length < 3) return timeStr

        const month = parseInt(parts[1], 10)
        const day = parseInt(parts[2], 10)

        let tempLocalization = {
            format: ''
        }

        Object.keys(tempLocalization).forEach(key => {
            const textValue = dateLocalizationOptions[key]

            if (typeof textValue === 'object') {
                Object.keys(textValue).some(match => {
                    const isMatch = match !== 'default' && routePath.indexOf(match) > -1

                    tempLocalization[key] = isMatch
                        ? textValue[match](month, day)
                        : textValue['default'](month, day)

                    return isMatch
                })
            }
        })

        return tempLocalization.format
    }

    function handleRouteChange(willBeToc) {
        const body = document.body

        if (willBeToc && !hasTocs) {
            savedCloseState = body.classList.contains('close')
            pendingCloseToggle = !narrowMql.matches
        } else if (!willBeToc && hasTocs) {
            if (savedCloseState !== null) {
                pendingCloseToggle = savedCloseState
                savedCloseState = null
            }
        }

        body.classList.toggle('has-toc', willBeToc)

        hasTocs = willBeToc
    }

    function renderTocStage1(content, vm) {
        const codeMarkup = /(```[\s\S]*?```)/gm
        const codeBlocks = []

        content = content.replace(codeMarkup, (block) => {
            const marker = `<!-- toc-codeblock-${codeBlocks.length} -->`
            codeBlocks.push(block)
            return marker
        })

        const hasToc = content.includes(tocMarkup)

        if (hasToc) {
            content = content.replace(tocMarkup, tocDiv)
        }

        codeBlocks.forEach((block, i) => {
            content = content.replace(`<!-- toc-codeblock-${i} -->`, () => block)
        })

        return {
            content,
            hasToc
        }
    }

    function renderTocContents() {
        let tocPageDiv = document.getElementsByClassName('toc-page-div')[0].childNodes[0]

        if (!tocPageDiv) return

        let curi18n = '/'

        i18nPath.forEach(path => {
            if (vm.route.path.includes(path)) {
                curi18n = path
            }
        })

        let pages = pagesData.filter(pageData => {
            let matched
            if (curi18n === '/') {
                matched = !i18nPath.some(p => pageData.href.includes(p))
            }
            else {
                matched = pageData.href.includes(curi18n)
            }
            return matched && pageData.time
        }).sort((a, b) => {
            const timeA = a.time
            const timeB = b.time

            const isEmptyA = !timeA || timeA.trim?.() === ''
            const isEmptyB = !timeB || timeB.trim?.() === ''

            if (isEmptyA && isEmptyB) return 0
            if (isEmptyA) return 1
            if (isEmptyB) return -1

            const dateA = new Date(timeA.replace(/\./g, '-'))
            const dateB = new Date(timeB.replace(/\./g, '-'))

            return dateB - dateA
        })

        sortedPages = pages

        maxPageIndex = Math.ceil(pages.length / recentAmount)

        renderTocPageUnderPaginator()
    }

    function renderTocPageUnderPaginator() {
        let tocPageDiv = document.getElementsByClassName('toc-page-div')[0].childNodes[0]
        tocPageDiv.innerHTML = ''

        if (curPageIndex < 1) {
            curPageIndex = 1
        }

        if (curPageIndex > maxPageIndex) {
            curPageIndex = maxPageIndex
        }

        let pages = sortedPages.slice((curPageIndex - 1) * recentAmount, curPageIndex * recentAmount)

        let currentYear = ''

        pages.forEach(page => {
            let pageHref = '#' + page.href

            let year = page.time.split('.')[0]

            let formattedDate = formatPostDate(page.time, vm.route.path)

            if (year !== currentYear) {
                tocPageDiv.innerHTML += `<li class="toc-year-group">${year}</li>`
                currentYear = year
            }

            let pageHrefDiv = `<li class="toc-post-item"><span class="toc-post-date">${formattedDate}</span><a href="${pageHref}" class="toc-post-link">${page.title}</a></li>`

            tocPageDiv.innerHTML += pageHrefDiv
        })

        let tocPaginatorInputDiv = document.getElementsByClassName('toc-paginator-input')
        if (tocPaginatorInputDiv.length > 0) {
            tocPaginatorInputDiv = tocPaginatorInputDiv[0]
            if (tocPaginatorInputDiv.hasChildNodes()) {
                tocPaginatorInputDiv.childNodes[0].value = curPageIndex
            }
        }
        document.scrollingElement.scrollTop = 0
    }

    function renderTocPaginator() {
        let tocPaginatorInputDiv = document.getElementsByClassName('toc-paginator-input')[0]
        let tocPaginatorLeftButtonDiv = document.getElementsByClassName('tocPaginatorLeftButtonDiv')[0]
        let tocPaginatorRightButtonDiv = document.getElementsByClassName('tocPaginatorRightButtonDiv')[0]

        if (!tocPaginatorInputDiv || !tocPaginatorLeftButtonDiv || !tocPaginatorRightButtonDiv) {
            return
        }

        tocPaginatorLeftButtonDiv.onclick = function (e) {
            if (curPageIndex > 1) {
                curPageIndex -= 1
                renderTocPageUnderPaginator()
            }
        }
        tocPaginatorRightButtonDiv.onclick = function (e) {
            if (curPageIndex < maxPageIndex) {
                curPageIndex += 1
                renderTocPageUnderPaginator()
            }
        }

        tocPaginatorInputDiv.innerHTML = '<input class=\'toc-paginator-input-box\' type=\'number\' value=\'' + curPageIndex + '\' min=\'1\' max=\'' + maxPageIndex + '\'></input><span>/</span><span>' + maxPageIndex + '</span>'

        let tocPaginatorInput = tocPaginatorInputDiv.childNodes[0]

        tocPaginatorInput.onchange = function () {
            curPageIndex = this.value

            renderTocPageUnderPaginator()

            this.value = curPageIndex
        }
    }

    function resolveHeading(path) {
        const matchedPage = pagesData.find(page => page && page.href === path)

        if (matchedPage && matchedPage.title) {
            return matchedPage.title
        }

        const h1 = document.querySelector('.markdown-section h1')
        if (h1?.innerText) return h1.innerText
        const link = Array.from(
            document.querySelectorAll('.sidebar-nav a')
        ).find(a => a.hash.slice(1) === path)

        return link?.textContent
    }

    hook.mounted(function () {
        narrowMql.addEventListener('change', onScreenWidthChange)

        function onScreenWidthChange(e) {
            if (!hasTocs) return
            document.body.classList.add('no-transition')
            document.body.classList.toggle('close', !e.matches)
            void document.body.offsetHeight
            document.body.classList.remove('no-transition')
        }
    })

    hook.beforeEach(function (content) {
        const result = renderTocStage1(content, vm)

        handleRouteChange(result.hasToc)

        return result.content
    })

    hook.doneEach(function () {
        if (hasTocs) {
            renderTocContents()
            renderTocPaginator()
        }

        if (pendingCloseToggle !== undefined) {
            const targetClose = pendingCloseToggle
            pendingCloseToggle = undefined

            requestAnimationFrame(() => {
                void document.body.offsetHeight
                document.body.classList.toggle('close', targetClose)
            })
        }

        document.scrollingElement.scrollTop = 0

        let path = vm.route.path
        if (path != '/') {
            document.title = resolveHeading(path)
        }
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
