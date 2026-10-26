/**
 *   1. 把 h1 / 面包屑 / 版记 / 字数 拼成报头行
 *   2. 按 h2 切节，按块级媒体切段，每段正文自己是一个双栏块（不用 column-span）
 *   3. 栏数切换（1 / 2），存 localStorage
 *   4. 入场动效（IntersectionObserver）
 *   5. 进度条兼作回顶：插件的 #scroll-to-top-span 由 CSS 隐掉，箭头画进进度条
 *
 * 结构性改动都发生在 renderTheme 内，会被 widgets 的 DOM journal 记录并回滚；
 * 异步加的类名一律挂在 html.ed-active 之下，切主题后自然失效。
 */

const COLS_KEY = 'editorial-cols'
const DATE_RE = /\d{4}\s*[.\-/年]\s*\d{1,2}\s*[.\-/月]?\s*\d{0,2}/

/** 块级媒体：不进栏，独占整幅 */
const PLATE_SELECTOR = [
    'iframe',
    'video',
    'pre',
    'table',
    'figure',
    'hr',
    'footer',
    '.docsify-tabs',
    '.toc-page-div',
    '.toc-paginator-div',
    '.docsify-pagination-container',
    '.docsify-example-panels',
    '.multi-images-container-section',
    '.brief-comments-container'
].join(',')

const COLS_ICONS = {
    1: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="3.5" y="6" width="17" height="3"></rect><rect x="3.5" y="10.5" width="17" height="3"></rect><rect x="3.5" y="15" width="11" height="3"></rect></svg>',
    2: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="3.5" y="6" width="7" height="3"></rect><rect x="3.5" y="10.5" width="7" height="3"></rect><rect x="3.5" y="15" width="7" height="3"></rect><rect x="13.5" y="6" width="7" height="3"></rect><rect x="13.5" y="10.5" width="7" height="3"></rect><rect x="13.5" y="15" width="7" height="3"></rect></svg>'
}


const TOP_ARROW = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M6 11l6-6 6 6M6 19l6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

/* ---------- 内联样式暂存：只在「CSS 盖不掉」时才用，复原由自己负责 ---------- */

const stashed = new Map()

function stashInline(el, props) {
    if (!el) return
    const current = el.getAttribute('style')
    if (current === null) return
    if (!stashed.has(el)) stashed.set(el, current)
    props.forEach(function (prop) {
        el.style.removeProperty(prop)
    })
}

function restoreInline() {
    stashed.forEach(function (orig, el) {
        if (!el.isConnected) return
        const old = document.createElement('div').style
        old.cssText = orig
        Array.from(old).forEach(function (name) {
            if (el.style.getPropertyValue(name)) return
            el.style.setProperty(name, old.getPropertyValue(name), old.getPropertyPriority(name))
        })
    })
    stashed.clear()
}

/* ---------- 结构判定 ---------- */

function isBlankText(node) {
    return node.nodeType === 3 && !node.textContent.trim()
}

function imgIn(el) {
    if (!el || el.nodeType !== 1) return null
    if (el.tagName === 'IMG') return el
    if (el.tagName === 'CENTER' || el.tagName === 'A' || el.tagName === 'PICTURE') {
        return el.querySelector('img')
    }
    return null
}

function isImageParagraph(el) {
    if (!el || el.tagName !== 'P') return false
    const kids = Array.prototype.filter.call(el.childNodes, function (n) { return !isBlankText(n) })
    if (kids.length !== 1) return false
    const only = kids[0]
    if (imgIn(only)) return !only.textContent.trim()
    return false
}

function isPlate(el) {
    if (!el || el.nodeType !== 1) return false
    if (isImageParagraph(el)) return true
    return el.matches(PLATE_SELECTOR)
}

function quoteLines(el) {
    const box = el.querySelector('p') || el
    const clone = box.cloneNode(true)
    Array.prototype.forEach.call(clone.querySelectorAll('br'), function (br) {
        br.replaceWith('\n')
    })
    return clone.textContent.split('\n').map(function (s) { return s.trim() }).filter(Boolean)
}

function datedLineCount(lines) {
    return lines.filter(function (line) { return DATE_RE.test(line) }).length
}

function isBylineQuote(el) {
    if (!el || el.tagName !== 'BLOCKQUOTE') return false
    const lines = quoteLines(el)
    if (lines.length < 2 || lines.length > 4) return false
    return datedLineCount(lines) >= 1
}

function isDatelineQuote(el) {
    if (!el || el.tagName !== 'BLOCKQUOTE') return false
    if (el.textContent.trim().length > 80) return false
    const lines = quoteLines(el)
    if (!lines.length || lines.length > 3) return false
    return datedLineCount(lines) >= 1
}

function joinQuoteLines(el) {
    const box = el.querySelector('p') || el
    const clone = box.cloneNode(true)
    Array.prototype.forEach.call(clone.querySelectorAll('br'), function (br) {
        br.replaceWith(' · ')
    })
    return clone.innerHTML.trim()
}

/* ---------- 拼装 ---------- */

function makeEl(tag, className) {
    const el = document.createElement(tag)
    if (className) el.className = className
    return el
}

function plateFor(el) {
    const figure = makeEl(isImageParagraph(el) ? 'figure' : 'div', 'ed-plate')
    figure.appendChild(el)
    return figure
}

function readCols() {
    const saved = Number(localStorage.getItem(COLS_KEY))
    return saved === 1 ? 1 : 2
}

function writeCols(root, cols) {
    root.dataset.edCols = String(cols)
    localStorage.setItem(COLS_KEY, String(cols))
    Array.prototype.forEach.call(root.querySelectorAll('.ed-cols button'), function (btn) {
        btn.setAttribute('aria-pressed', String(cols === 2))
        btn.innerHTML = COLS_ICONS[cols]
    })
}

function buildColsControl(root) {
    const wrap = makeEl('div', 'ed-cols')
    const btn = makeEl('button')
    btn.type = 'button'
    btn.addEventListener('click', function () {
        writeCols(root, Number(root.dataset.edCols) === 1 ? 2 : 1)
    })
    wrap.appendChild(btn)

    return wrap
}

/* ---------- 主流程 ---------- */

function demoteSidebarTitle() {
    const el = document.querySelector('.sidebar > h1.app-name')
    if (!el) return

    const box = makeEl('div', 'app-name')
    while (el.firstChild) box.appendChild(el.firstChild)
    el.replaceWith(box)
}

function buildNavWordmark() {
    const nav = document.querySelector('.app-nav')
    if (!nav) return
    if (nav.querySelector('.ed-wordmark')) return

    const side = document.querySelector('.sidebar .app-name a')
    const name = (side ? side.textContent : document.title || '').trim()
    if (!name) return

    const link = makeEl('a', 'ed-wordmark')
    link.href = '#/'
    link.textContent = name
    nav.insertBefore(link, nav.firstChild)
}

function buildMast(root, parts) {
    const h1 = root.querySelector(':scope > h1')
    const crumb = parts && parts.crumb
    const countWords = parts && parts.countWords

    let coverParagraph = null
    let bylineQuote = null

    if (h1) {
        let node = h1.nextElementSibling
        let steps = 0
        while (node && steps < 4) {
            if (/^H[2-6]$/.test(node.tagName)) break
            if (!coverParagraph && isImageParagraph(node)) {
                coverParagraph = node
                node = node.nextElementSibling
                steps++
                continue
            }
            if (!bylineQuote && isBylineQuote(node)) bylineQuote = node
            break
        }
    }

    const mast = makeEl('div', 'ed-mast')
    if (h1) mast.appendChild(h1)

    const line = makeEl('div', 'ed-mastline')
    if (crumb) line.appendChild(crumb)

    const meta = makeEl('div', 'ed-meta')

    if (countWords) meta.appendChild(countWords)

    meta.appendChild(buildColsControl(root))
    line.appendChild(meta)

    if (bylineQuote) {
        const byline = makeEl('p', 'ed-byline')
        byline.innerHTML = joinQuoteLines(bylineQuote)
        line.appendChild(byline)
        bylineQuote.remove()
    }

    mast.appendChild(line)

    root.insertBefore(mast, root.firstElementChild)

    if (coverParagraph) {
        const cover = plateFor(coverParagraph)
        cover.classList.add('ed-cover')
        mast.after(cover)
    }
}

function buildSections(root) {
    const content = Array.prototype.filter.call(root.children, function (el) {
        return !el.classList.contains('ed-mast') && !el.classList.contains('ed-cover')
    })

    if (!content.length) return

    const fragment = document.createDocumentFragment()
    let section = null
    let run = null
    let justOpened = false

    function openSection(heading) {
        section = makeEl('section', 'ed-sec')
        section.style.setProperty('--ed-delay', '0ms')
        run = null
        justOpened = Boolean(heading)

        if (heading) {
            const head = makeEl('div', 'ed-sec-head')
            head.appendChild(heading)
            section.appendChild(head)
        }

        fragment.appendChild(section)
    }

    function openRun() {
        run = makeEl('div', 'ed-run')
        section.appendChild(run)
        return run
    }

    content.forEach(function (el) {
        if (el.tagName === 'H2') {
            openSection(el)
            return
        }

        if (!section) openSection(null)

        if (justOpened && isDatelineQuote(el)) {
            el.classList.add('ed-dateline')
            section.querySelector('.ed-sec-head').appendChild(el)
            justOpened = false
            return
        }
        justOpened = false

        if (isPlate(el)) {
            run = null
            section.appendChild(plateFor(el))
            return
        }

        if (!run) openRun()
        run.appendChild(el)
    })

    root.appendChild(fragment)
}

function setupMotion(root) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    document.documentElement.classList.add('ed-motion')

    const targets = []

    const title = root.querySelector('.ed-mast > h1')
    if (title) targets.push({ el: title, delay: 0 })

    Array.prototype.forEach.call(root.querySelectorAll('.ed-sec'), function (section) {
        Array.prototype.forEach.call(section.children, function (el, index) {
            if (!el.matches('.ed-sec-head, .ed-run, .ed-plate')) return
            el.style.setProperty('--ed-delay', Math.min(index, 3) * 70 + 'ms')
            targets.push({ el: el, delay: 0 })
        })
    })

    if (!targets.length) return

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return
            requestAnimationFrame(function () {
                entry.target.classList.add('ed-in')
            })
            observer.unobserve(entry.target)
        })
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 })

    targets.forEach(function (item) {
        item.el.setAttribute('data-ed-in', '')
        observer.observe(item.el)
    })

    return observer
}


function takeBreadcrumb(root) {
    return root.querySelector(':scope > ul.breadcrumb')
}

function takeCountWords(root) {
    const el = root.querySelector(':scope > #count-words-block-span-div')
    if (!el) return null
    stashInline(el.querySelector('#count-words-block-span'), ['font-size'])
    return el
}

function eagerTocPageImages(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.toc-page-div img'), function (img, index) {
        if (index < 6) img.loading = 'eager'
    })
}

function setupWidgetsRow() {
    const container = document.getElementById('page-right-widgets-container')
    if (!container) return null

    let row = container.querySelector(':scope > .widgets-row')
    if (!row) {
        row = document.createElement('div')
        row.className = 'widgets-row'
        container.insertBefore(row, container.firstChild)
    }

    Array.prototype.forEach.call(
        container.querySelectorAll(':scope > .page-right-tools-widgets-span'),
        function (el) { row.appendChild(el) }
    )

    let hidden = row.querySelectorAll('.page-right-tools-widgets-span-disappear').length

    const anchor = new MutationObserver(function () {
        const now = row.querySelectorAll('.page-right-tools-widgets-span-disappear').length
        const wasHidden = hidden > 0
        hidden = now
        if (!wasHidden || now > 0) return
        requestAnimationFrame(function () {
            row.scrollLeft = row.scrollWidth
        })
    })
    anchor.observe(row, { subtree: true, attributes: true, attributeFilter: ['class'] })

    return function stop() {
        anchor.disconnect()
    }
}

function setupReadProgress() {
    const el = document.getElementById('progress-span')
    if (!el) return null

    let icon = el.querySelector('.ed-top-arrow')
    if (!icon) {
        const holder = makeEl('span')
        holder.innerHTML = TOP_ARROW
        icon = holder.firstElementChild
        icon.classList.add('ed-top-arrow')
        el.appendChild(icon)
    }

    const onClick = function () {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    }

    el.addEventListener('click', onClick)

    return function stop() {
        el.removeEventListener('click', onClick)
        if (icon.isConnected) icon.remove()
    }
}

function setupTocSpy() {
    const nav = document.querySelector('.sidebar-nav')
    if (!nav) return null

    let items = []
    let ticking = false
    let frame = 0

    const collect = function () {
        const heads = []
        Array.prototype.forEach.call(
            document.querySelectorAll('.markdown-section h1, .markdown-section h2, .markdown-section h3, .markdown-section h4'),
            function (h) {
                const span = h.querySelector('span')
                const text = (span ? span.textContent : h.textContent).trim()
                if (text) heads.push({ el: h, text: text })
            }
        )

        const found = []
        Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
            const title = (a.getAttribute('title') || a.textContent || '').trim()
            if (!title) return
            const match = heads.find(function (item) { return item.text === title })
            const li = a.closest('li')
            if (!match || !li) return
            found.push({ li: li, heading: match.el })
        })

        found.sort(function (a, b) {
            return a.heading.compareDocumentPosition(b.heading) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        })
        return found
    }

    const apply = function () {
        if (!items.length) items = collect()
        if (!items.length) return

        const doc = document.scrollingElement || document.documentElement
        const threshold = 100
        let current = items[0]

        for (let i = 0; i < items.length; i++) {
            if (items[i].heading.getBoundingClientRect().top <= threshold) current = items[i]
            else break
        }

        if (doc.scrollTop + window.innerHeight >= doc.scrollHeight - 2) {
            current = items[items.length - 1]
        }

        const marked = items.filter(function (it) { return it.li.classList.contains('active') })
        if (marked.length === 1 && marked[0] === current) return

        items.forEach(function (it) { it.li.classList.toggle('active', it === current) })
    }

    const onScroll = function () {
        if (ticking) return
        ticking = true
        frame = requestAnimationFrame(function () {
            apply()
            ticking = false
        })
    }

    const fixer = new MutationObserver(function () { apply() })
    fixer.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] })

    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    ticking = true
    frame = requestAnimationFrame(function () {
        apply()
        ticking = false
    })

    return function cleanup() {
        window.cancelAnimationFrame(frame)
        fixer.disconnect()
        document.removeEventListener('scroll', onScroll, { capture: true })
        window.removeEventListener('resize', onScroll)
    }
}

export function renderTheme(options) {
    const onCleanup = options && options.onCleanup
    const root = document.querySelector('.markdown-section')
    let observer = null
    let titleTimer = 0

    restoreInline()

    if (root && root.dataset.edOn !== '1') {
        root.dataset.edOn = '1'
        demoteSidebarTitle()
        buildNavWordmark()
        buildMast(root, {
            crumb: takeBreadcrumb(root),
            countWords: takeCountWords(root)
        })
        buildSections(root)
        eagerTocPageImages(root)
        writeCols(root, readCols())
        document.documentElement.classList.add('ed-active')
        observer = setupMotion(root)

        const title = root.querySelector('.ed-mast > h1')
        if (title) titleTimer = window.setTimeout(function () { title.classList.add('ed-in') }, 60)
    }

    const stopWidgetsRow = setupWidgetsRow()
    const stopReadProgress = setupReadProgress()
    const stopTocSpy = setupTocSpy()

    if (typeof onCleanup !== 'function') {
        if (stopWidgetsRow) stopWidgetsRow()
        if (stopReadProgress) stopReadProgress()
        if (stopTocSpy) stopTocSpy()
        return
    }

    onCleanup(function () {
        window.clearTimeout(titleTimer)
        if (observer) observer.disconnect()
        if (stopWidgetsRow) stopWidgetsRow()
        if (stopReadProgress) stopReadProgress()
        if (stopTocSpy) stopTocSpy()
        document.documentElement.classList.remove('ed-active', 'ed-motion')
        restoreInline()
    })
}
