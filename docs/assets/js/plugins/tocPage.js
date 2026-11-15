import pagesData from '../config/tocdata.json.js'
import {
    protectCodeBlocks,
    codeBlockModes,
    lockNoTransition,
    unlockNoTransition,
    makeButtonLike,
    isEnabled,
    clamp,
    toDate
} from '../utils/common.js'
import { mediaQueries, docsifyClasses, elementStatus } from '../utils/constants.js'
import { getEl, getAllEls, getElByClass, onListen, toggleClass, hasClass, setCssVar } from '../utils/dom.js'
import { arrow } from '../utils/icons.js'
import { bindShortcuts } from '../utils/shortcut.js'
import { ignoreViewFullImageClass } from './viewFullImage.js'

let tocPageOptions = {
    enable: false,
    recentAmount: 8,
    renderStyle: 'card',
    dateFormat: null,
    columns: 2,
    narrowColumns: 1,
    defaultImg: './assets/resources/img/default/picture-2.gif',
    localPath: [],
    coverPath: ['/']
}

export const hasTocClass = 'has-toc'
export const tocPageDivClass = 'toc-page-div'

const tocRenderStyles = {
    card: { name: 'card', render: renderCardPage },
    list: { name: 'list', render: renderListPage }
}

const tocFilters = {
    none: { name: 'none', filter: filterByBaseUrl },
    lang: { name: 'lang', filter: filterByLanguage }
}

function shouldUseTableKey(table, value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(table, value)
}

function resolveRenderStyle(value) {
    return shouldUseTableKey(tocRenderStyles, value) ? tocRenderStyles[value] : tocRenderStyles.card
}

function resolveFilter(value) {
    if (!isEnabled(value)) return tocFilters.none

    return shouldUseTableKey(tocFilters, value) ? tocFilters[value] : tocFilters.none
}

function toColumnCount(value, fallback) {
    const count = Math.floor(Number(value))

    return count >= 1 ? count : fallback
}

function hasRequiredTime(pageData, renderStyle) {
    return renderStyle.name !== tocRenderStyles.list.name || Boolean(pageData.time)
}

function isPageInLanguage(pageData, context) {
    if (context.languagePrefix === '/') {
        return !context.languagePrefixes.some(prefix => pageData.href.includes(prefix))
    }

    return pageData.href.includes(context.languagePrefix)
}

function filterByBaseUrl(pageData, context) {
    return hasRequiredTime(pageData, context.renderStyle) && pageData.baseUrl === context.baseUrl
}

function filterByLanguage(pageData, context) {
    return hasRequiredTime(pageData, context.renderStyle) && isPageInLanguage(pageData, context)
}

function filterPages(pages, context) {
    const activeFilter = resolveFilter(context.filterMode)

    return pages
        .filter(page => activeFilter.filter(page, context))
        .sort(comparePages)
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

function formatPostDate(timeStr, routePath, dateFormat) {
    if (!dateFormat) return timeStr

    const parts = timeStr.split('.')
    if (parts.length < 3) return timeStr

    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)
    const { default: defaultFormatter, ...routeFormatters } = dateFormat

    let formatter = defaultFormatter

    Object.keys(routeFormatters).some(match => {
        if (routePath.indexOf(match) === -1) return false

        formatter = routeFormatters[match]
        return true
    })

    return typeof formatter === 'function' ? formatter(month, day) : timeStr
}

function buildPageContext(page, context) {
    return {
        pageHref: '#' + page.href,
        pagePictureHref: context.pathname.replace(/\/$/, '') + page.cover,
        formattedDate: formatPostDate(page.time, context.routePath, context.dateFormat)
    }
}

function renderCardPage(tocPageDiv, pages, context) {
    let html = ''

    pages.forEach(page => {
        const { pageHref, pagePictureHref, formattedDate } = buildPageContext(page, context)

        html += `<a class='toc-page-display-a' href='${pageHref}'><div class='toc-page-display-div'><div class='toc-page-display-title-img'><img class='${ignoreViewFullImageClass}' src='${pagePictureHref}' loading='lazy' onerror='this.src="${context.defaultImg}"'></div><div class='toc-page-display-title-div'>${page.title}</div><div class='toc-page-display-date-div'>${formattedDate}</div></div></a>`
    })

    tocPageDiv.innerHTML = html
}

function renderListPage(tocPageDiv, pages, context) {
    const list = tocPageDiv.childNodes[0]

    if (!list) return

    let html = ''
    let currentYear = ''

    pages.forEach(page => {
        const { pageHref, formattedDate } = buildPageContext(page, context)
        const year = page.time.split('.')[0]

        if (year !== currentYear) {
            html += `<li class="toc-year-group">${year}</li>`
            currentYear = year
        }

        html += `<li class="toc-post-item"><span class="toc-post-date">${formattedDate}</span><a href="${pageHref}" class="toc-post-link">${page.title}</a></li>`
    })

    list.innerHTML = html
}

function paginate(totalCount, pageSize, pageIndex) {
    const maxPageIndex = Math.ceil(totalCount / pageSize)
    const currentPageIndex = clamp(pageIndex, 1, maxPageIndex)

    return {
        pageIndex: currentPageIndex,
        maxPageIndex,
        offset: (currentPageIndex - 1) * pageSize,
        limit: pageSize
    }
}

function getPaginatorInput() {
    return getEl('input', getElByClass('toc-paginator-input'))
}

function plugin(hook, vm) {
    if (!tocPageOptions.enable) return

    const pluginIdentifier = 'toc'

    const renderStyle = resolveRenderStyle(tocPageOptions.renderStyle)
    const dateFormat = tocPageOptions.dateFormat

    const localPath = tocPageOptions.localPath
    const languagePrefixes = localPath.map(locale => '/' + locale + '/')

    const tocPaginatorDiv = `<div class='toc-paginator-div'><div class='tocPaginatorLeftButtonDiv toc-paginator-button-div'><span class="toc-paginator-button-span">${arrow.prev}</span></div><div class='toc-paginator-input'></div><div class='tocPaginatorRightButtonDiv toc-paginator-button-div'><span class="toc-paginator-button-span">${arrow.next}</span></div></div>`

    const tocDiv = renderStyle.name === tocRenderStyles.list.name
        ? `<div class='${tocPageDivClass} toc-page-list'><ul></ul></div>${tocPaginatorDiv}`
        : `<div class='${tocPageDivClass} toc-page-card'></div>${tocPaginatorDiv}`

    const recentAmount = tocPageOptions.recentAmount

    const columns = toColumnCount(tocPageOptions.columns, 2)
    const narrowColumns = toColumnCount(tocPageOptions.narrowColumns, 1)

    let hasTocs = false

    let filterMode = tocFilters.none.name

    let savedCloseState = null

    let pendingCloseToggle = undefined

    const narrowMql = window.matchMedia(mediaQueries.narrow)

    let filteredPages = []

    let curPageIndex = 1

    let maxPageIndex = 1

    const coverPath = tocPageOptions.coverPath

    function handleRouteChange(willBeToc) {
        const body = document.body

        if (willBeToc && !hasTocs) {
            savedCloseState = hasClass(body, elementStatus.close)
            pendingCloseToggle = !narrowMql.matches
        } else if (!willBeToc && hasTocs) {
            if (savedCloseState !== null) {
                pendingCloseToggle = savedCloseState
                savedCloseState = null
            }
        }

        toggleClass(body, hasTocClass, willBeToc)

        hasTocs = willBeToc
    }

    function syncSidebarA11y() {
        const body = document.body
        const closed = hasClass(body, elementStatus.close)

        const sidebar = getElByClass(docsifyClasses.sidebar)
        if (sidebar) {
            const sidebarHidden = narrowMql.matches ? !closed : closed
            if (sidebar.inert !== sidebarHidden) sidebar.inert = sidebarHidden
        }

        const toggle = getElByClass(docsifyClasses.sidebarToggle)
        if (toggle) {
            const toggleHidden = hasClass(body, hasTocClass)
            if (toggle.inert !== toggleHidden) toggle.inert = toggleHidden
        }
    }

    function bindSidebarA11y() {
        if (window.__tocPageSidebarA11yBound) return
        window.__tocPageSidebarA11yBound = true

        onListen(narrowMql, 'change', syncSidebarA11y)
        new MutationObserver(syncSidebarA11y).observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        })

        syncSidebarA11y()
    }

    function renderTocStage1(content) {
        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.protect)

        const tocMarkupReg = /<!--\s*toc(?::([\w-]+))?\s*-->/g
        let matched = false
        let mode = tocFilters.none.name

        content = content.replace(tocMarkupReg, (markup, rawMode) => {
            if (matched) return markup

            const nextFilter = isEnabled(rawMode)
                ? (shouldUseTableKey(tocFilters, rawMode) ? tocFilters[rawMode] : null)
                : tocFilters.none

            if (!nextFilter) return markup

            matched = true
            mode = nextFilter.name
            return tocDiv
        })

        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.restore)

        return {
            content,
            hasToc: matched,
            filterMode: mode
        }
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

    function createFilterContext() {
        return {
            filterMode,
            renderStyle,
            languagePrefix: resolveLanguagePrefix(),
            languagePrefixes,
            baseUrl: resolveBaseUrl()
        }
    }

    function createRenderContext() {
        return {
            dateFormat,
            routePath: vm.route.path,
            pathname: location.pathname,
            defaultImg: tocPageOptions.defaultImg
        }
    }

    function refreshFilteredPages() {
        filteredPages = filterPages(pagesData, createFilterContext())
    }

    function renderTocContents() {
        refreshFilteredPages()
        renderTocPageUnderPaginator()
    }

    function renderTocPageUnderPaginator() {
        const tocPageDiv = getElByClass(tocPageDivClass)

        if (!tocPageDiv) return

        const paging = paginate(filteredPages.length, recentAmount, curPageIndex)

        curPageIndex = paging.pageIndex
        maxPageIndex = paging.maxPageIndex

        renderStyle.render(
            tocPageDiv,
            filteredPages.slice(paging.offset, paging.offset + paging.limit),
            createRenderContext()
        )

        const tocPaginatorInput = getPaginatorInput()
        if (tocPaginatorInput) {
            tocPaginatorInput.value = curPageIndex
        }
        document.scrollingElement.scrollTop = 0
    }

    function gotoPage(index) {
        const target = paginate(filteredPages.length, recentAmount, index).pageIndex

        if (target === Number(curPageIndex)) return

        curPageIndex = target

        renderTocPageUnderPaginator()
    }

    function renderTocPaginator() {
        const tocPaginatorInputDiv = getElByClass('toc-paginator-input')
        const tocPaginatorLeftButtonDiv = getElByClass('tocPaginatorLeftButtonDiv')
        const tocPaginatorRightButtonDiv = getElByClass('tocPaginatorRightButtonDiv')

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

        const tocPaginatorInput = getEl('input', tocPaginatorInputDiv)

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

        const h1 = getEl(`.${docsifyClasses.markdownSection} h1`)
        if (h1?.innerText) return h1.innerText
        const link = getAllEls(`.${docsifyClasses.sidebarNav} a`)
            .find(a => a.hash.slice(1) === path)

        return link?.textContent
    }

    hook.mounted(function () {
        setCssVar('--tocpage-columns', columns)
        setCssVar('--tocpage-narrow-columns', narrowColumns)

        onListen(narrowMql, 'change', onScreenWidthChange)

        bindSidebarA11y()

        bindShortcuts({
            ArrowLeft: { handler: () => gotoPage(curPageIndex - 1), repeat: true },
            ArrowRight: { handler: () => gotoPage(curPageIndex + 1), repeat: true },
            KeyP: function () {
                const input = getPaginatorInput()
                if (!input) return

                input.focus()
                input.select()
            },
            Escape: {
                allowInInput: true,
                handler: function () {
                    const input = getPaginatorInput()
                    if (!input || document.activeElement !== input) return

                    input.blur()
                }
            }
        }, { when: () => hasTocs })

        function onScreenWidthChange(e) {
            if (!hasTocs) return
            lockNoTransition()
            toggleClass(document.body, elementStatus.close, !e.matches)
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
                toggleClass(document.body, elementStatus.close, targetClose)
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
