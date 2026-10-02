import pagesData from '../config/tocdata.json.js'

function plugin(hook, vm) {

    const tocMarkup = '<!-- toc -->'

    const tocDiv = '<div class=\'toc-page-div\'></div><div class=\'toc-paginator-div\'><div class=\'tocPaginatorLeftButtonDiv toc-paginator-button-div\'><span class="toc-paginator-button-span"><?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color)"><path d="M15 6l-6 6 6 6" stroke="var(--theme-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div><div class=\'toc-paginator-input\'></div><div class=\'tocPaginatorRightButtonDiv toc-paginator-button-div\'><span class="toc-paginator-button-span"><?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color)"><path d="M9 6l6 6-6 6" stroke="var(--theme-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div></div>'

    const recentAmount = 8

    let hasTocs = false

    let savedCloseState = null

    let pendingCloseToggle = undefined

    const narrowMql = window.matchMedia('(max-width: 768px)')

    let sortedPages = []

    let curPageIndex = 1

    let maxPageIndex = 1

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

        // 1. 先保护代码块
        content = content.replace(codeMarkup, (block) => {
            const marker = `<!-- toc-codeblock-${codeBlocks.length} -->`
            codeBlocks.push(block)
            return marker
        })

        // 2. 在保护代码块之后，再判断是否真的有 <!-- toc -->
        const hasToc = content.includes(tocMarkup)

        if (hasToc) {
            content = content.replace(tocMarkup, tocDiv)
        }

        // 3. 还原代码块
        codeBlocks.forEach((block, i) => {
            content = content.replace(`<!-- toc-codeblock-${i} -->`, () => block)
        })

        return {
            content,
            hasToc
        }
    }

    function renderTocContents() {
        let tocPageDiv = document.getElementsByClassName('toc-page-div')[0]

        if (!tocPageDiv) return

        tocPageDiv.innerHTML = ''

        let baseUrl = vm.route.path.split('/').slice(0, -1).join('/')

        if (baseUrl === '') {
            baseUrl = '/'
        }

        let pages = pagesData.filter(pageData => pageData.baseUrl === baseUrl).sort((a, b) => {
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
        let tocPageDiv = document.getElementsByClassName('toc-page-div')[0]
        tocPageDiv.innerHTML = ''

        if (curPageIndex < 1) {
            curPageIndex = 1
        }

        if (curPageIndex > maxPageIndex) {
            curPageIndex = maxPageIndex
        }

        let pages = sortedPages.slice((curPageIndex - 1) * recentAmount, curPageIndex * recentAmount)

        pages.forEach(page => {
            let pageHref = '#' + page.href
            let pagePictureHref = location.pathname.replace(/\/$/, '') + page.cover

            let pageHrefDiv = '<a class=\'toc-page-display-a\' href=\'' + pageHref + '\'><div class=\'toc-page-display-div\'><div class=\'toc-page-display-title-img\'><img class=\'ignore-view-full-image-img\' src=\'' + pagePictureHref + '\' loading=\'lazy\' onerror=\'this.src=\"_media/defaultImg/picture-2.gif\"\'></div><div class=\'toc-page-display-title-div\'>' + page.title + '</div><div class=\'toc-page-display-date-div\'>' + page.time + '</div></div></a>'

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

        // fix auto2top
        document.scrollingElement.scrollTop = 0

        // fix autoHeader
        let path = vm.route.path
        // for default title '- ピカピカピ'
        if (path != '/') {
            Array.from(document.getElementsByClassName('sidebar-nav')[0].getElementsByTagName('a')).some(a => {
                if (a.href.split('#')[1] === path) {
                    if (document.title != a.textContent) {
                        document.title = a.textContent
                    }
                    return true
                }
                return false
            })
        }
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
