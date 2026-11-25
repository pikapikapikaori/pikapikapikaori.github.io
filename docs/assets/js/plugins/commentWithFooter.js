import { arrow } from '../utils/icons.js'
import { TokenReplacer } from '../utils/tokenReplacer.js'
import { calLocalized } from '../utils/localization.js'
import { toDate, formatDate } from '../utils/common.js'
import { docsifyIds } from '../utils/constants.js'
import { createEl, getElById, getAllEls, addClass, setAttrs, setData, getData, setCssVar, onListen } from '../utils/dom.js'
import { ignoreViewFullImageClass } from './viewFullImage.js'

const commentClasses = {
    comments: 'cwf-comments',
    heading: 'cwf-heading',
    headingTitle: 'cwf-heading-title',
    title: 'cwf-title',
    count: 'cwf-count',
    contentHost: 'cwf-content-host',
    textControl: 'cwf-text-control',
    sort: 'cwf-sort',
    toggle: 'cwf-toggle',
    quote: 'cwf-quote',
    quoteMissing: 'cwf-quote-missing',
    quoteLink: 'cwf-quote-link',
    quoteAuthor: 'cwf-quote-author',
    author: 'cwf-author',
    quoteExcerpt: 'cwf-quote-excerpt',
    item: 'cwf-item',
    comment: 'cwf-comment',
    isOwner: 'is-owner',
    avatar: 'cwf-avatar',
    content: 'cwf-content',
    meta: 'cwf-meta',
    date: 'cwf-date',
    id: 'cwf-id',
    detail: 'cwf-detail',
    body: 'cwf-body',
    isClamped: 'is-clamped',
    limited: 'cwf-limited',
    backlinks: 'cwf-backlinks',
    toggleWrap: 'cwf-toggle-wrap',
    tocPaginatorDiv: 'toc-paginator-div',
    tocPaginatorButtonDiv: 'toc-paginator-button-div',
    paginatorHit: 'paginator-hit',
    tocPaginatorButtonSpan: 'toc-paginator-button-span',
    tocPaginatorInput: 'toc-paginator-input',
    tocPaginatorInputBox: 'toc-paginator-input-box',
    empty: 'cwf-empty',
    list: 'cwf-list',
}

const commentTextBlocks = new Set(['p', 'br', 'blockquote', 'li', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'])

let commentWithFooterOptions = {
    enable: false,
    use: 'builtin',
    footerInnerHtml: '',
    localization: {},
    commentConfig: {
        ownerId: '',
        pageSize: 5,
        quotePreviewLength: 80,
        maxCommentLength: 240,
        contentPreviewLines: 6,
        localization: {},
    },
    gitalkConfig: {
        clientID: '',
        clientSecret: '',
        repo: 'pikapikapi-blog',
        owner: 'pikapikapikaori',
        admin: ['pikapikapikaori',],
        distractionFreeMode: false,
    },
}

const commentContainerId = 'comment-container'
const footerId = 'footer-under-comment'
const providerFileNames = {
    gitalk: 'gitalk-enhance.js'
}

const providerCache = new Map()

function resolveProviderUrl(name) {
    const fileName = providerFileNames[name]
    if (!fileName) {
        return null
    }

    return new URL('../../external/js/' + fileName, import.meta.url).href
}

function loadProvider(name) {
    if (providerCache.has(name)) {
        return providerCache.get(name)
    }

    const url = resolveProviderUrl(name)
    if (!url) {
        return Promise.resolve(null)
    }

    const promise = import(url)
        .then(mod => mod.default || mod.gitalkProvider || null)
        .catch(() => {
            providerCache.delete(name)
            return null
        })
    providerCache.set(name, promise)
    return promise
}

const commentRoot = new URL('../../../data/comments/content/', import.meta.url)
const manifestUrl = new URL('../../resources/meta/file-cache.json', import.meta.url)
const userUrl = new URL('../user.json', commentRoot)

function safePath(value) {
    if (typeof value !== 'string' || /[:?#\\]/.test(value)) {
        return null
    }

    try {
        const parts = value.replace(/^\//, '').split('/').map(decodeURIComponent)
        if (parts.some(part => !part || part === '.' || part === '..' || /[/\\?#\x00-\x1f]/.test(part))) {
            return null
        }

        return parts.join('/')
    } catch {
        return null
    }
}

function resolveUser(id, users) {
    const user = users[id]
    return {id, name: user.name, avatar: user.avatar ? new URL(user.avatar, userUrl).href : ''}
}

async function loadComments(file) {
    const path = safePath(file)
    if (!path || !path.endsWith('.md')) {
        return []
    }

    const response = await fetch(manifestUrl, { cache: 'no-store' })
    if (!response.ok) {
        throw new Error('Comments index unavailable')
    }

    const manifest = await response.json()
    const target = 'data/comments/content/' + path.slice(0, -3) + '.json'
    const entry = manifest.batches.some(batch => batch.files.some(candidate => candidate.path === target))

    if (!entry) {
        return []
    }

    const url = new URL(path.slice(0, -3).split('/').map(encodeURIComponent).join('/') + '.json', commentRoot)
    const [commentsResponse, usersResponse] = await Promise.all([fetch(url), fetch(userUrl)])
    if (!commentsResponse.ok || !usersResponse.ok) {
        throw new Error('Comments unavailable')
    }

    const [comments, users] = await Promise.all([commentsResponse.json(), usersResponse.json()])
    return comments.map(item => ({...item, author: resolveUser(item.authorId, users), replyTo: [...new Set(item.replyTo || [])]}))
}

function mountBuiltinComments(host, comments, config, routePath, isStale, marked) {
    const bodyNodes = new Map()
    const commentIndices = new Map(comments.map((item, index) => [item.id, index]))
    const domId = (id, kind) => 'cwf-' + kind + '-' + commentIndices.get(id)
    const section = createEl('section', {className: commentClasses.comments})
    const header = createEl('header', {className: commentClasses.heading})
    const titleWrap = createEl('div', {className: commentClasses.headingTitle})
    const heading = createEl('h2', {className: commentClasses.title})
    const count = createEl('span', {className: commentClasses.count})
    const sort = createEl('button', {className: commentClasses.textControl + ' ' + commentClasses.sort})
    const contentHost = createEl('div', {className: commentClasses.contentHost})
    setAttrs(heading, {tabindex: -1})
    setAttrs(sort, {type: 'button'})
    titleWrap.append(heading, count)
    header.append(titleWrap, sort)
    section.append(header, contentHost)
    host.replaceChildren(section)
    let newestFirst = true
    let page = 1
    const expandedBodies = new Set()
    const commentsById = new Map(comments.map(item => [item.id, item]))
    const localized = calLocalized(config.localization, routePath)
    const dateFormat = calLocalized({dateFormat: config.dateFormat}, routePath).dateFormat

    const t = key => localized[key] ?? ''

    const markdownCache = new Map()
    function renderMarkdown(source) {
        // Fresh standard options keep Docsify's TOC renderer out of comments.
        return createEl('template', {html: marked.parse(source, {...marked.getDefaults(), headerIds: false})}).content
    }

    function visibleText(node) {
        function text(n) {
            if (n.nodeType === Node.TEXT_NODE) {
                return n.data
            }

            return [...n.childNodes].map(text).join('') + (commentTextBlocks.has(n.localName) ? '\n' : '')
        }

        return text(node).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    }

    function markdownFor(data) {
        if (!markdownCache.has(data.id)) {
            const dom = renderMarkdown(data.body)
            markdownCache.set(data.id, {dom, text: visibleText(dom)})
        }

        return markdownCache.get(data.id)
    }

    function limitedMarkdown(data) {
        const source = markdownFor(data)
        const limit = Math.max(0, Math.floor(Number(config.maxCommentLength) || 0))
        const limited = Array.from(source.text).length > limit
        if (!limited) {
            return {dom: source.dom.cloneNode(true), limited}
        }

        let remaining = limit
        const result = document.createDocumentFragment()

        function take(node, parent) {
            if (remaining <= 0) {
                return
            }

            if (node.nodeType === Node.TEXT_NODE) {
                const chars = Array.from(node.data)
                const text = chars.slice(0, remaining).join('')
                remaining -= Array.from(text).length
                if (text) {
                    parent.append(document.createTextNode(text))
                }

                return
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
                return
            }

            const clone = node.cloneNode(false)
            for (const child of node.childNodes) {
                take(child, clone)
            }

            parent.append(clone)

            if (node.localName !== 'br' && commentTextBlocks.has(node.localName) && remaining > 0) {
                remaining--
            }
        }

        for (const child of source.dom.childNodes) {
            take(child, result)
        }

        return {dom: result, limited}
    }

    function orderedComments() {
        return [...comments].sort((a, b) => newestFirst ? toDate(b.date) - toDate(a.date) : toDate(a.date) - toDate(b.date))
    }

    function quoteNode(data, targetId, reverse = false) {
        const quote = createEl('blockquote', {className: commentClasses.quote})
        const target = commentsById.get(targetId)
        if (!target) {
            quote.append(createEl('p', {className: commentClasses.quoteMissing, text: t('quoteMissing')}))
            return quote
        }

        const link = createEl('a', {className: commentClasses.quoteLink})
        setAttrs(link, {href: '#' + domId(target.id, 'comment')})
        setData(link, 'focus', 'quote-' + data.id + '-' + targetId + '-' + (reverse ? 'reverse' : 'forward'))
        const chars = Array.from(markdownFor(target).text)
        const limit = Math.max(0, Math.floor(Number(config.quotePreviewLength) || 0))
        const relation = createEl('span', {className: commentClasses.quoteAuthor})
        const reply = document.createTextNode(t('reply'))
        const author = createEl('span', {className: commentClasses.author, text: target.author.name})
        const space = document.createTextNode(' ')
        relation.append(...(reverse ? [author, space, reply] : [reply, space, author]))
        link.append(relation, createEl('p', {className: commentClasses.quoteExcerpt, text: chars.slice(0, limit).join('') + (chars.length > limit ? '…' : '')}))
        onListen(link, 'click', event => {
            event.preventDefault()
            jumpToComment(target.id)
        })
        quote.append(link)
        return quote
    }

    function jumpToComment(id) {
        const index = orderedComments().findIndex(item => item.id === id)
        if (index < 0) {
            return
        }

        page = Math.floor(index / config.pageSize) + 1
        expandedBodies.add(id)
        render()
        requestAnimationFrame(() => {
            if (isStale()) {
                return
            }

            const body = bodyNodes.get(id)
            body?.focus({preventScroll: true})
            body?.scrollIntoView({block: 'center', behavior: 'instant'})
        })
    }

    const disclosureMeasurements = new WeakMap()
    const disclosureObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            disclosureMeasurements.get(entry.target)?.()
        }
    })

    function commentNode(data) {
        const li = createEl('li', {className: commentClasses.item})
        setAttrs(li, {id: domId(data.id, 'comment')})
        const article = createEl('article', {className: commentClasses.comment})
        if (config.ownerId && data.author.id === config.ownerId) {
            addClass(article, commentClasses.isOwner)
        }

        const avatar = createEl('span', {className: commentClasses.avatar, text: [...data.author.name][0]})
        if (data.author.avatar) {
            const image = createEl('img', {className: ignoreViewFullImageClass})
            setAttrs(image, {alt: ''})
            setAttrs(image, {src: data.author.avatar})
            onListen(image, 'error', () => image.remove(), {once: true})
            avatar.append(image)
        }

        const content = createEl('div', {className: commentClasses.content})
        const meta = createEl('div', {className: commentClasses.meta})
        meta.append(createEl('strong', {className: commentClasses.author, text: data.author.name}))

        const time = createEl('time', {className: commentClasses.date})
        setAttrs(time, {datetime: toDate(data.date).toISOString()})
        time.textContent = formatDate(data.date, dateFormat)
        meta.append(time)
        const number = createEl('span', {className: commentClasses.id, text: data.id})
        setAttrs(number, {title: data.id})
        meta.append(number)
        content.append(meta)
        const detail = createEl('div', {className: commentClasses.detail})
        setAttrs(detail, {id: domId(data.id, 'content')})
        content.append(detail)
        for (const id of data.replyTo) {
            detail.append(quoteNode(data, id))
        }

        const body = createEl('div', {className: commentClasses.body})
        const markdown = limitedMarkdown(data)
        body.append(markdown.dom)
        setAttrs(body, {id: domId(data.id, 'body')})
        setAttrs(body, {tabindex: -1})
        bodyNodes.set(data.id, body)
        detail.append(body)
        const expanded = expandedBodies.has(data.id)
        if (!expanded) {
            addClass(detail, commentClasses.isClamped)
        }

        if (markdown.limited) {
            detail.append(createEl('p', {className: commentClasses.limited, text: t('contentLimited')}))
        }

        const incoming = orderedComments().filter(item => item.replyTo.includes(data.id))
        if (incoming.length) {
            const links = createEl('div', {className: commentClasses.backlinks})
            for (const reply of incoming) {
                links.append(quoteNode(data, reply.id, true))
            }

            detail.append(links)
        }

        article.append(avatar, content)
        li.append(article)
        let state

        function measureDisclosure() {
            if (isStale() || !detail.isConnected) {
                return
            }

            const lineHeight = parseFloat(getComputedStyle(body).lineHeight)
            const previewHeight = lineHeight * config.contentPreviewLines
            const top = detail.getBoundingClientRect().top
            let clippedHeight = previewHeight
            if (!expanded) {
                let lastLine = top
                const walker = document.createTreeWalker(detail, NodeFilter.SHOW_TEXT)
                while (walker.nextNode()) {
                    if (!walker.currentNode.data.trim()) {
                        continue
                    }

                    const range = document.createRange()
                    range.selectNodeContents(walker.currentNode)
                    for (const rect of range.getClientRects()) {
                        if (rect.bottom <= top + previewHeight + .5) {
                            lastLine = Math.max(lastLine, rect.bottom)
                        }
                    }
                }

                if (lastLine > top) {
                    clippedHeight = Math.min(previewHeight, lastLine - top + 2)
                }
            }

            const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
            setCssVar('--cwf-preview-height', clippedHeight / rootFontSize + 'rem', detail)
            const hasOverflow = detail.scrollHeight > previewHeight + 2
            const boundary = detail.getBoundingClientRect()
            for (const link of getAllEls('a[href]', detail)) {
                link.inert = false
                setAttrs(link, {tabindex: null})
                const box = link.getBoundingClientRect()
                if (!expanded && hasOverflow && (box.bottom > boundary.bottom + .5 || box.top >= boundary.bottom)) {
                    link.inert = true
                    setAttrs(link, {tabindex: -1})
                }
            }

            if (expanded || hasOverflow) {
                if (!state) {
                    const key = 'text-' + data.id
                    const toggle = createEl('button', {
                        className: commentClasses.textControl + ' ' + commentClasses.toggle,
                        text: t(expanded ? 'collapseText' : 'expandText'),
                        attrs: {type: 'button'},
                        data: {focus: key},
                    })
                    onListen(toggle, 'click', () => {
                        if (expanded) {
                            expandedBodies.delete(data.id)
                        } else {
                            expandedBodies.add(data.id)
                        }

                        render(key)
                    })
                    state = createEl('span', {className: commentClasses.toggleWrap})
                    state.append(toggle)
                    content.append(state)
                }
            } else if (state) {
                state.remove()
                state = null
            }
        }

        disclosureMeasurements.set(detail, measureDisclosure)
        requestAnimationFrame(() => {
            if (isStale()) {
                return
            }

            measureDisclosure()
            if (detail.isConnected) {
                disclosureObserver.observe(detail)
            }
        })
        return li
    }

    function paginator(current, total, key, onPage) {
        const nav = createEl('nav', {className: commentClasses.tocPaginatorDiv})

        function arrowButton(direction, target, disabled) {
            const b = createEl('button', {
                className: commentClasses.tocPaginatorButtonDiv + ' ' + commentClasses.paginatorHit,
                attrs: {type: 'button'},
                data: {focus: key + '-' + direction},
            })
            onListen(b, 'click', () => onPage(target))
            b.disabled = disabled
            const icon = createEl('span', {className: commentClasses.tocPaginatorButtonSpan})
            icon.innerHTML = arrow[direction]
            b.append(icon)
            return b
        }

        const field = createEl('div', {className: commentClasses.tocPaginatorInput})
        const input = createEl('input', {className: commentClasses.tocPaginatorInputBox})
        setAttrs(input, {type: 'text', inputmode: 'numeric', pattern: '[0-9]*'})
        input.value = String(current)
        setData(input, 'focus', key + '-input')
        let committed = false

        function commit() {
            if (committed) {
                return
            }

            committed = true
            const raw = input.value.trim()
            const valid = /^[+-]?\d+$/.test(raw)
            const next = valid ? Math.max(1, Math.min(total, Number(raw))) : current
            input.value = String(next)
            if (next !== current) {
                onPage(next)
            }
        }

        onListen(input, 'input', () => {
            committed = false
        })
        onListen(input, 'focus', () => {
            committed = false
        })
        onListen(input, 'keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault()
                commit()
            }
        })
        onListen(input, 'blur', commit)
        field.append(input, createEl('span', {text: '/'}), createEl('span', {text: String(total)}))
        nav.append(arrowButton('prev', current - 1, current === 1), field, arrowButton('next', current + 1, current === total))
        return nav
    }

    function reset() {
        page = 1
        expandedBodies.clear()
    }

    function movePage(next) {
        page = next
        expandedBodies.clear()
        render()
        scrollHeading()
    }

    function scrollHeading() {
        if (isStale()) {
            return
        }

        heading.focus({preventScroll: true})
        heading.scrollIntoView({block: 'start', behavior: 'instant'})
    }

    function render(focusKey) {
        if (isStale()) {
            return
        }

        disclosureObserver.disconnect()
        bodyNodes.clear()
        heading.textContent = t('title')
        count.textContent = comments.length + ' ' + t('count')
        sort.textContent = t(newestFirst ? 'newest' : 'oldest')
        sort.disabled = !comments.length
        contentHost.replaceChildren()
        if (!comments.length) {
            contentHost.append(createEl('p', {className: commentClasses.empty, text: t('empty')}))
            return
        }

        const ordered = orderedComments()
        const pages = Math.ceil(ordered.length / config.pageSize)
        page = Math.max(1, Math.min(page, pages))
        const list = createEl('ol', {className: commentClasses.list})
        for (const data of ordered.slice((page - 1) * config.pageSize, page * config.pageSize)) {
            list.append(commentNode(data))
        }

        contentHost.append(list)
        if (pages > 1) {
            const nav = paginator(page, pages, 'comments', movePage)
            contentHost.append(nav)
        }

        if (focusKey) {
            requestAnimationFrame(() => {
                if (!isStale()) {
                    getAllEls('[data-focus]', host).find(node => getData(node, 'focus') === focusKey)?.focus({preventScroll: true})
                }
            })
        }
    }

    onListen(sort, 'click', () => {
        newestFirst = !newestFirst
        reset()
        render()
        scrollHeading()
    })

    function refreshDisclosures() {
        requestAnimationFrame(() => {
            if (!isStale()) {
                for (const detail of getAllEls('.' + commentClasses.detail, host)) {
                    disclosureMeasurements.get(detail)?.()
                }
            }
        })
    }

    render()
    const listenerDisposers = [
        onListen(window, 'resize', refreshDisclosures),
        onListen(document, 'load', refreshDisclosures, true),
        onListen(document.fonts, 'loadingdone', refreshDisclosures),
    ]
    document.fonts?.ready.then(refreshDisclosures)
    const themeObserver = new MutationObserver(refreshDisclosures)
    themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme', 'style', 'class']})
    return () => {
        disclosureObserver.disconnect()
        themeObserver.disconnect()
        listenerDisposers.forEach(dispose => dispose())
        host.replaceChildren()
    }
}

function plugin(hook, vm) {
    if (!commentWithFooterOptions.enable) {
        return
    }

    const pluginIdentifier = 'comment_footer'
    const replacer = new TokenReplacer({
        prefix: pluginIdentifier,
    })
    let commentContainer = null
    let footerDiv = null
    let renderSeq = 0
    let activeProvider = null
    let destroyBuiltin = null

    function ensureLayout() {
        const main = getElById(docsifyIds.main)
        if (!main || !main.parentNode) {
            return null
        }

        if (!footerDiv || !footerDiv.isConnected) {
            footerDiv = getElById(footerId)
            if (!footerDiv) {
                const footer = createEl('footer')
                footerDiv = createEl('div', { attrs: { id: footerId } })
                footer.appendChild(footerDiv)
                main.parentNode.appendChild(footer)
            }
        }

        const footer = footerDiv.closest('footer')
        if (footer.parentNode !== main.parentNode) {
            main.parentNode.appendChild(footer)
        }

        if (!commentContainer || !commentContainer.isConnected) {
            const containers = getAllEls('#' + commentContainerId)
            commentContainer = containers[0] || null
            for (let i = 1; i < containers.length; i++) {
                containers[i].remove()
            }

            if (!commentContainer) {
                commentContainer = createEl('div', { attrs: { id: commentContainerId } })
            }
        }

        if (commentContainer.parentNode !== footer.parentNode || commentContainer.nextElementSibling !== footer) {
            footer.parentNode.insertBefore(commentContainer, footer)
        }

        return footerDiv
    }

    function destroyComment() {
        if (destroyBuiltin) {
            destroyBuiltin()
        }

        destroyBuiltin = null
        if (activeProvider && activeProvider.destroy) {
            activeProvider.destroy(commentContainer)
        } else if (commentContainer) {
            commentContainer.innerHTML = ''
        }

        activeProvider = null
    }

    function renderFooter(input) {
        const tmpLocalization = calLocalized(commentWithFooterOptions.localization)
        Object.keys(tmpLocalization).forEach(key => {
            replacer.unregisterToken(key)
            replacer.registerToken(key, tmpLocalization[key])
        })
        return replacer.replace(input)
    }

    function renderComment() {
        const name = commentWithFooterOptions.use
        const seq = ++renderSeq
        const routePath = vm.route.path
        const isStale = () => seq !== renderSeq || routePath !== vm.route.path
        if (name === 'builtin') {
            destroyComment()
            const localized = calLocalized(commentWithFooterOptions.commentConfig.localization, routePath)
            loadComments(vm.route.file).then(comments => {
                if (isStale()) {
                    return
                }

                destroyBuiltin = mountBuiltinComments(commentContainer, comments, commentWithFooterOptions.commentConfig, routePath, isStale, vm.compiler._marked)
            }).catch(() => {
                if (isStale()) {
                    return
                }

                const status = createEl('p', { className: commentClasses.empty })
                status.textContent = localized.error
                commentContainer.replaceChildren(status)
            })
            return
        }

        if (!providerFileNames[name]) {
            destroyComment()
            return
        }

        loadProvider(name).then(provider => {
            if (isStale()) {
                return
            }

            if (!provider) {
                destroyComment()
                return
            }

            if (provider.preload) {
                provider.preload(commentWithFooterOptions)
            }

            destroyComment()
            activeProvider = provider
            provider.mount(commentContainer, {
                vm,
                config: commentWithFooterOptions,
                isStale
            })
        })
    }

    hook.mounted(function () {
        const footer = ensureLayout()
        if (!footer) {
            return
        }

        const name = commentWithFooterOptions.use
        if (!providerFileNames[name]) {
            return
        }

        loadProvider(name).then(provider => {
            if (provider && provider.preload) {
                provider.preload(commentWithFooterOptions)
            }
        })
    })
    hook.beforeEach(function (content) {
        renderSeq++
        destroyComment()
        return content
    })
    hook.doneEach(function () {
        const footer = ensureLayout()
        if (!footer) {
            return
        }

        const footerInnerHtml = renderFooter(commentWithFooterOptions.footerInnerHtml)
        footer.innerHTML = '<div>' + footerInnerHtml + '</div>'
        renderComment()
    })
}

window.$docsify['commentWithFooter'] = Object.assign(
    commentWithFooterOptions,
    window.$docsify['commentWithFooter']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
