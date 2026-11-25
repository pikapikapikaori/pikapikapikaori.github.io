import pagesData from '../config/tocdata.json.js'
import {
    protectCodeBlocks,
    codeBlockModes,
    lockNoTransition,
    unlockNoTransition,
    isEnabled,
    clamp,
    toDate,
    formatDate
} from '../utils/common.js'
import { mediaQueries, docsifyClasses, elementStatus } from '../utils/constants.js'
import { getEl, getAllEls, getElByClass, onListen, toggleClass, hasClass, setCssVar } from '../utils/dom.js'
import { arrow } from '../utils/icons.js'
import { bindShortcuts } from '../utils/shortcut.js'
import { matchesLocalePath, calLocalized } from '../utils/localization.js'
import { ignoreViewFullImageClass } from './viewFullImage.js'

let tocPageOptions = {
    enable: false,
    recentAmount: 8,
    renderStyle: 'card',
    dateFormat: 'YYYY.MM.DD',
    columns: 2,
    narrowColumns: 1,
    defaultImg: './assets/resources/img/default/picture-2.gif',
    localPath: [],
    coverPath: ['/']
}

const tocClasses = {
    pageDisplayA: 'toc-page-display-a',
    pageDisplayDiv: 'toc-page-display-div',
    pageDisplayTitleImg: 'toc-page-display-title-img',
    pageDisplayTitleDiv: 'toc-page-display-title-div',
    pageDisplayDateDiv: 'toc-page-display-date-div',
    yearGroup: 'toc-year-group',
    postItem: 'toc-post-item',
    postDate: 'toc-post-date',
    postLink: 'toc-post-link',
    paginatorDiv: 'toc-paginator-div',
    tocPaginatorLeftButtonDiv: 'tocPaginatorLeftButtonDiv',
    paginatorButtonDiv: 'toc-paginator-button-div',
    paginatorButtonSpan: 'toc-paginator-button-span',
    paginatorInput: 'toc-paginator-input',
    tocPaginatorRightButtonDiv: 'tocPaginatorRightButtonDiv',
    pageList: 'toc-page-list',
    pageCard: 'toc-page-card',
    paginatorInputBox: 'toc-paginator-input-box',
}

export const hasTocClass = 'has-toc'
export const tocPageDivClass = 'toc-page-div'

const tocRenderStyles = {
    card: { name: 'card', render: renderCardPage },
    list: { name: 'list', render: renderListPage }
}

const tocFilters = {
    none: { name: 'none', filter: () => true },
    baseUrl: { name: 'baseUrl', filter: filterByBaseUrl },
    type: { name: 'type', filter: page => page.type !== 'intro' },
    lang: { name: 'lang', filter: filterByLanguage }
}

function shouldUseTableKey(table, value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(table, value)
}

function resolveRenderStyle(value) {
    return shouldUseTableKey(tocRenderStyles, value) ? tocRenderStyles[value] : tocRenderStyles.card
}

function toColumnCount(value, fallback) {
    const count = Math.floor(Number(value))

    return count >= 1 ? count : fallback
}

function isPageInLanguage(pageData, context) {
    if (context.languagePrefix === '/') {
        return !context.languagePrefixes.some(prefix => matchesLocalePath(pageData.href, prefix))
    }

    return matchesLocalePath(pageData.href, context.languagePrefix)
}

function filterByBaseUrl(pageData, context) {
    return pageData.baseUrl === context.baseUrl
}

function filterByLanguage(pageData, context) {
    return isPageInLanguage(pageData, context)
}

function filterPages(pages, context) {
    const activeFilters = context.filterMode.split(/\s+/).filter(Boolean).map(name => tocFilters[name])

    return pages
        .filter(page => activeFilters.every(filter => filter.filter(page, context)))
        .sort(comparePages)
}

function comparePages(a, b) {
    return toDate(b.createdTime) - toDate(a.createdTime)
}

function buildPageContext(page, context) {
    return {
        pageHref: '#' + page.href,
        pagePictureHref: isEnabled(page.cover)
            ? context.pathname.replace(/\/$/, '') + page.cover
            : context.defaultImg,
        formattedDate: formatDate(page.createdTime, context.dateFormat)
    }
}

function renderCardPage(tocPageDiv, pages, context) {
    let html = ''

    pages.forEach(page => {
        const { pageHref, pagePictureHref, formattedDate } = buildPageContext(page, context)

        html += `<a class='${tocClasses.pageDisplayA}' href='${pageHref}'><div class='${tocClasses.pageDisplayDiv}'><div class='${tocClasses.pageDisplayTitleImg}'><img class='${ignoreViewFullImageClass}' src='${pagePictureHref}' loading='lazy' onerror='this.src="${context.defaultImg}"'></div><div class='${tocClasses.pageDisplayTitleDiv}'>${page.title}</div><div class='${tocClasses.pageDisplayDateDiv}'>${formattedDate}</div></div></a>`
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
        const year = toDate(page.createdTime).getFullYear()

        if (year !== currentYear) {
            html += `<li class="${tocClasses.yearGroup}">${year}</li>`
            currentYear = year
        }

        html += `<li class="${tocClasses.postItem}"><span class="${tocClasses.postDate}">${formattedDate}</span><a href="${pageHref}" class="${tocClasses.postLink}">${page.title}</a></li>`
    })

    list.innerHTML = html
}

function paginate(totalCount, pageSize, pageIndex) {
    const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 8
    const maxPageIndex = Math.max(1, Math.ceil(totalCount / size))
    const numericIndex = Number(pageIndex)
    const currentPageIndex = clamp(Number.isFinite(numericIndex) ? Math.trunc(numericIndex) : 1, 1, maxPageIndex)

    return {
        pageIndex: currentPageIndex,
        maxPageIndex,
        offset: (currentPageIndex - 1) * size,
        limit: size
    }
}

function getPaginatorInput() {
    return getEl('input', getElByClass(tocClasses.paginatorInput))
}

function plugin(hook, vm) {
    if (!tocPageOptions.enable) return

    const pluginIdentifier = 'toc'

    const renderStyle = resolveRenderStyle(tocPageOptions.renderStyle)
    const dateFormat = tocPageOptions.dateFormat

    const localPath = tocPageOptions.localPath
    const languagePrefixes = localPath.map(locale => '/' + locale + '/')

    const tocPaginatorDiv = `<div class='${tocClasses.paginatorDiv}'><button type='button' class='${tocClasses.tocPaginatorLeftButtonDiv} ${tocClasses.paginatorButtonDiv}'><span class="${tocClasses.paginatorButtonSpan}">${arrow.prev}</span></button><div class='${tocClasses.paginatorInput}'></div><button type='button' class='${tocClasses.tocPaginatorRightButtonDiv} ${tocClasses.paginatorButtonDiv}'><span class="${tocClasses.paginatorButtonSpan}">${arrow.next}</span></button></div>`

    const tocDiv = renderStyle.name === tocRenderStyles.list.name
        ? `<div class='${tocPageDivClass} ${tocClasses.pageList}'><ul></ul></div>${tocPaginatorDiv}`
        : `<div class='${tocPageDivClass} ${tocClasses.pageCard}'></div>${tocPaginatorDiv}`

    const recentAmount = Number.isSafeInteger(tocPageOptions.recentAmount) && tocPageOptions.recentAmount > 0
        ? tocPageOptions.recentAmount : 8

    const columns = toColumnCount(tocPageOptions.columns, 2)
    const narrowColumns = toColumnCount(tocPageOptions.narrowColumns, 1)

    let hasTocs = false
    let paginatorDisposers = []

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

        const tocMarkupReg = /<!--\s*toc(?::([\w\s-]*))?\s*-->/g
        let matched = false
        let mode = tocFilters.none.name

        content = content.replace(tocMarkupReg, (markup, rawMode) => {
            if (matched) return markup

            const names = (rawMode || '').trim().split(/\s+/).filter(Boolean)
            if (!names.every(name => shouldUseTableKey(tocFilters, name))) return markup

            matched = true
            mode = names.join(' ')
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
            if (matchesLocalePath(vm.route.path, path)) curi18n = path
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
            dateFormat: calLocalized({dateFormat}, vm.route.path).dateFormat,
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
        updatePaginatorButtons()
        document.scrollingElement.scrollTop = 0
    }

    function updatePaginatorButtons() {
        const left = getElByClass(tocClasses.tocPaginatorLeftButtonDiv)
        const right = getElByClass(tocClasses.tocPaginatorRightButtonDiv)
        if (left) left.disabled = curPageIndex <= 1
        if (right) right.disabled = curPageIndex >= maxPageIndex
    }

    function gotoPage(index) {
        const target = paginate(filteredPages.length, recentAmount, index).pageIndex

        if (target === Number(curPageIndex)) return

        curPageIndex = target

        renderTocPageUnderPaginator()
    }

    function renderTocPaginator() {
        paginatorDisposers.forEach(dispose => dispose())
        paginatorDisposers = []
        const tocPaginatorInputDiv = getElByClass(tocClasses.paginatorInput)
        const tocPaginatorLeftButtonDiv = getElByClass(tocClasses.tocPaginatorLeftButtonDiv)
        const tocPaginatorRightButtonDiv = getElByClass(tocClasses.tocPaginatorRightButtonDiv)

        if (!tocPaginatorInputDiv || !tocPaginatorLeftButtonDiv || !tocPaginatorRightButtonDiv) {
            return
        }

        updatePaginatorButtons()

        paginatorDisposers.push(onListen(tocPaginatorLeftButtonDiv, 'click', () => {
            gotoPage(curPageIndex - 1)
        }))
        paginatorDisposers.push(onListen(tocPaginatorRightButtonDiv, 'click', () => {
            gotoPage(curPageIndex + 1)
        }))

        tocPaginatorInputDiv.innerHTML = `<input class='${tocClasses.paginatorInputBox}' type='text' inputmode='numeric' pattern='[0-9]*' value='${curPageIndex}'><span>/</span><span>${maxPageIndex}</span>`

        const tocPaginatorInput = getEl('input', tocPaginatorInputDiv)

        let committed = false
        function commitInput() {
            if (committed) return
            committed = true
            const raw = tocPaginatorInput.value.trim()
            const value = Number(raw)
            if (/^[+-]?\d+$/.test(raw) && Number.isFinite(value)) gotoPage(value)
            tocPaginatorInput.value = curPageIndex
        }
        paginatorDisposers.push(onListen(tocPaginatorInput, 'input', () => { committed = false }))
        paginatorDisposers.push(onListen(tocPaginatorInput, 'focus', () => { committed = false }))
        paginatorDisposers.push(onListen(tocPaginatorInput, 'blur', commitInput))
        paginatorDisposers.push(onListen(tocPaginatorInput, 'keydown', event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commitInput()
        }))
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
        paginatorDisposers.forEach(dispose => dispose())
        paginatorDisposers = []
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
