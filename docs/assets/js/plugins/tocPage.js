import pagesData from '../config/tocdata.json.js'
import { protectCodeBlocks, lockNoTransition, unlockNoTransition, makeButtonLike, isEnabled } from '../utils/common.js'
import { bindShortcuts } from '../utils/shortcut.js'

let tocPageOptions = {
    recentAmount: 8,
    renderStyle: 'card',
    dateFormat: null,
    columns: 2,
    narrowColumns: 1,
    defaultImg: './assets/resources/img/default/picture-2.gif',
    localPath: [],
    coverPath: ['/']
}

const tocModes = {
    renderStyles: { card: 'card', list: 'list' },
    filters: { none: 'none', lang: 'lang' }
}

function toColumnCount(value, fallback) {
    const count = Math.floor(Number(value))

    return count >= 1 ? count : fallback
}

function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || min, min), max)
}

function toDate(timeStr) {
    return new Date(timeStr.replace(/\./g, '-'))
}

function plugin(hook, vm) {

    const pluginIdentifier = 'toc'

    const renderStyle = tocModes.renderStyles[tocPageOptions.renderStyle]
    const dateFormat = tocPageOptions.dateFormat

    const localPath = tocPageOptions.localPath
    const languagePrefixes = localPath.map(locale => '/' + locale + '/')

    const tocPaginatorDiv = '<div class=\'toc-paginator-div\'><div class=\'tocPaginatorLeftButtonDiv toc-paginator-button-div\'><span class="toc-paginator-button-span"><?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div><div class=\'toc-paginator-input\'></div><div class=\'tocPaginatorRightButtonDiv toc-paginator-button-div\'><span class="toc-paginator-button-span"><?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div></div>'

    const tocDiv = renderStyle === tocModes.renderStyles.list
        ? `<div class='toc-page-div toc-page-list'><ul></ul></div>${tocPaginatorDiv}`
        : `<div class='toc-page-div toc-page-card'></div>${tocPaginatorDiv}`

    const recentAmount = tocPageOptions.recentAmount

    const columns = toColumnCount(tocPageOptions.columns, 2)
    const narrowColumns = toColumnCount(tocPageOptions.narrowColumns, 1)

    let hasTocs = false

    let filterMode = tocModes.filters.none

    let savedCloseState = null

    let pendingCloseToggle = undefined

    const narrowMql = window.matchMedia('screen and (max-width: 768px)')

    let sortedPages = []

    let curPageIndex = 1

    let maxPageIndex = 1

    const coverPath = tocPageOptions.coverPath

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

    function syncSidebarA11y() {
        const body = document.body
        const closed = body.classList.contains('close')

        const sidebar = document.querySelector('.sidebar')
        if (sidebar) {
            const sidebarHidden = narrowMql.matches ? !closed : closed
            if (sidebar.inert !== sidebarHidden) sidebar.inert = sidebarHidden
        }

        const toggle = document.querySelector('.sidebar-toggle')
        if (toggle) {
            const toggleHidden = body.classList.contains('has-toc')
            if (toggle.inert !== toggleHidden) toggle.inert = toggleHidden
        }
    }

    function bindSidebarA11y() {
        if (window.__tocPageSidebarA11yBound) return
        window.__tocPageSidebarA11yBound = true

        narrowMql.addEventListener('change', syncSidebarA11y)
        new MutationObserver(syncSidebarA11y).observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        })

        syncSidebarA11y()
    }

    function renderTocStage1(content) {
        content = protectCodeBlocks(content, pluginIdentifier, 'protect')

        const tocMarkupReg = /<!--\s*toc(?::([\w-]+))?\s*-->/g
        let matched = false
        let mode = tocModes.filters.none

        content = content.replace(tocMarkupReg, (markup, rawMode) => {
            if (matched) return markup

            const nextMode = !isEnabled(rawMode) ? tocModes.filters.none : rawMode
            if (nextMode !== tocModes.filters.none && nextMode !== tocModes.filters.lang) return markup

            matched = true
            mode = nextMode
            return tocDiv
        })

        content = protectCodeBlocks(content, pluginIdentifier, 'restore')

        return {
            content,
            hasToc: matched,
            filterMode: mode
        }
    }

    function isPageInLanguage(pageData, curi18n) {
        if (curi18n === '/') {
            return !languagePrefixes.some(path => pageData.href.includes(path))
        }
        return pageData.href.includes(curi18n)
    }

    function isPageInBaseUrl(pageData, baseUrl) {
        return pageData.baseUrl === baseUrl
    }

    function hasRequiredTime(pageData, style) {
        return style !== tocModes.renderStyles.list || !!pageData.time
    }

    function resolveLanguagePrefix() {
        let curi18n = '/'
        languagePrefixes.forEach(path => {
            if (vm.route.path.includes(path)) curi18n = path
        })
        return curi18n
    }

    function resolveBaseUrl() {
        const baseUrl = vm.route.path.split('/').slice(0, -1).join('/')
        return isEnabled(baseUrl) ? baseUrl : '/'
    }

    function buildPageFilter(pageData) {
        if (renderStyle === tocModes.renderStyles.list && !pageData.time) {
            return false
        }

        if (filterMode === tocModes.filters.lang) {
            return isPageInLanguage(pageData, resolveLanguagePrefix())
        }

        return isPageInBaseUrl(pageData, resolveBaseUrl())
    }

    function comparePages(a, b) {
        const timeA = a.time
        const timeB = b.time

        const isEmptyA = !isEnabled(timeA)
        const isEmptyB = !isEnabled(timeB)

        if (isEmptyA && isEmptyB) return 0
        if (isEmptyA) return 1
        if (isEmptyB) return -1

        return toDate(timeB) - toDate(timeA)
    }

    function formatPostDate(timeStr, routePath) {
        if (!dateFormat) return timeStr

        const parts = timeStr.split('.')
        if (parts.length < 3) return timeStr

        const month = parseInt(parts[1], 10)
        const day = parseInt(parts[2], 10)

        let formatter = dateFormat.default

        Object.keys(dateFormat).some(match => {
            if (match === 'default' || routePath.indexOf(match) === -1) return false

            formatter = dateFormat[match]
            return true
        })

        return typeof formatter === 'function' ? formatter(month, day) : timeStr
    }

    function buildPageContext(page) {
        return {
            pageHref: '#' + page.href,
            pagePictureHref: location.pathname.replace(/\/$/, '') + page.cover,
            formattedDate: formatPostDate(page.time, vm.route.path)
        }
    }

    function renderTocContents() {
        const tocPageDiv = document.getElementsByClassName('toc-page-div')[0]

        if (!tocPageDiv) return

        const pages = pagesData
            .filter(buildPageFilter)
            .sort(comparePages)

        sortedPages = pages

        maxPageIndex = Math.ceil(pages.length / recentAmount)

        renderTocPageUnderPaginator()
    }

    function renderPageList(pages) {
        const tocPageDiv = document.getElementsByClassName('toc-page-div')[0]

        if (!tocPageDiv) return

        const isList = renderStyle === tocModes.renderStyles.list
        const container = isList ? tocPageDiv.childNodes[0] : tocPageDiv

        if (!container) return

        container.innerHTML = ''

        let currentYear = ''

        pages.forEach(page => {
            const { pageHref, pagePictureHref, formattedDate } = buildPageContext(page)

            if (isList) {
                const year = page.time.split('.')[0]

                if (year !== currentYear) {
                    container.innerHTML += `<li class="toc-year-group">${year}</li>`
                    currentYear = year
                }

                container.innerHTML += `<li class="toc-post-item"><span class="toc-post-date">${formattedDate}</span><a href="${pageHref}" class="toc-post-link">${page.title}</a></li>`
            } else {
                container.innerHTML += `<a class='toc-page-display-a' href='${pageHref}'><div class='toc-page-display-div'><div class='toc-page-display-title-img'><img class='ignore-view-full-image-img' src='${pagePictureHref}' loading='lazy' onerror='this.src="${tocPageOptions.defaultImg}"'></div><div class='toc-page-display-title-div'>${page.title}</div><div class='toc-page-display-date-div'>${formattedDate}</div></div></a>`
            }
        })
    }

    function clampPageIndex() {
        curPageIndex = clamp(curPageIndex, 1, maxPageIndex)
    }

    function renderTocPageUnderPaginator() {
        const tocPageDiv = document.getElementsByClassName('toc-page-div')[0]

        if (!tocPageDiv) return

        clampPageIndex()

        const pages = sortedPages.slice(
            (curPageIndex - 1) * recentAmount,
            curPageIndex * recentAmount
        )

        renderPageList(pages)

        const tocPaginatorInput = document.querySelector('.toc-paginator-input-box')
        if (tocPaginatorInput) {
            tocPaginatorInput.value = curPageIndex
        }
        document.scrollingElement.scrollTop = 0
    }

    function gotoPage(index) {
        const target = clamp(index, 1, maxPageIndex)

        if (target === Number(curPageIndex)) return

        curPageIndex = target

        renderTocPageUnderPaginator()
    }

    function renderTocPaginator() {
        const tocPaginatorInputDiv = document.getElementsByClassName('toc-paginator-input')[0]
        const tocPaginatorLeftButtonDiv = document.getElementsByClassName('tocPaginatorLeftButtonDiv')[0]
        const tocPaginatorRightButtonDiv = document.getElementsByClassName('tocPaginatorRightButtonDiv')[0]

        if (!tocPaginatorInputDiv || !tocPaginatorLeftButtonDiv || !tocPaginatorRightButtonDiv) {
            return
        }

        makeButtonLike(tocPaginatorLeftButtonDiv.childNodes[0])
        makeButtonLike(tocPaginatorRightButtonDiv.childNodes[0])

        tocPaginatorLeftButtonDiv.onclick = function () {
            gotoPage(curPageIndex - 1)
        }
        tocPaginatorRightButtonDiv.onclick = function () {
            gotoPage(curPageIndex + 1)
        }

        tocPaginatorInputDiv.innerHTML = `<input class='toc-paginator-input-box' type='number' value='${curPageIndex}' min='1' max='${maxPageIndex}'></input><span>/</span><span>${maxPageIndex}</span>`

        const tocPaginatorInput = tocPaginatorInputDiv.childNodes[0]

        tocPaginatorInput.onchange = function () {
            gotoPage(this.value)

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
        const rootStyle = document.documentElement.style
        rootStyle.setProperty('--tocpage-columns', columns)
        rootStyle.setProperty('--tocpage-narrow-columns', narrowColumns)

        narrowMql.addEventListener('change', onScreenWidthChange)

        bindSidebarA11y()

        bindShortcuts({
            ArrowLeft: { handler: () => gotoPage(curPageIndex - 1), repeat: true },
            ArrowRight: { handler: () => gotoPage(curPageIndex + 1), repeat: true },
            KeyP: function () {
                const input = document.querySelector('.toc-paginator-input input')
                if (!input) return

                input.focus()
                input.select()
            },
            Escape: {
                allowInInput: true,
                handler: function () {
                    const input = document.querySelector('.toc-paginator-input input')
                    if (!input || document.activeElement !== input) return

                    input.blur()
                }
            }
        }, { when: () => hasTocs })

        function onScreenWidthChange(e) {
            if (!hasTocs) return
            lockNoTransition()
            document.body.classList.toggle('close', !e.matches)
            unlockNoTransition()
        }
    })

    hook.beforeEach(function (content) {
        const result = renderTocStage1(content)

        filterMode = result.filterMode
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
        if (!coverPath.includes(path)) {
            document.title = resolveHeading(path)
        }

        syncSidebarA11y()
    })
}

window.$docsify['tocPage'] = Object.assign(
    tocPageOptions,
    window.$docsify['tocPage']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
