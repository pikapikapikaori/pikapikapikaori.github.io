/**
 * Editorial（dark）—— 报纸版面引擎
 *
 * 由 widgets.js 在每次 doneEach（路由切换）与主题切换时调用：
 *   renderTheme({ isDark, name, onCleanup })
 *
 * 与 swiss.js 完全独立：类名前缀 ed-，存储键 editorial-cols，互不共享代码。
 *
 * 只做四件事：
 *   1. 把 h1 / 面包屑 / 版记 / 字数 拼成报头行
 *   2. 按 h2 切节，按块级媒体切段，每段正文自己是一个双栏块（不用 column-span）
 *   3. 栏数切换（1 / 2），存 localStorage
 *   4. 入场动效（IntersectionObserver）
 *
 * 结构性改动都发生在 renderTheme 内，会被 widgets 的 DOM journal 记录并回滚；
 * 异步加的类名一律挂在 html.ed-active 之下，切主题后自然失效。
 */

const COLS_KEY = 'editorial-cols'
const DATE_RE = /\d{4}\s*[.\-/年]\s*\d{1,2}\s*[.\-/月]?\s*\d{0,2}/

/** 块级媒体：这些元素不进栏，自己独占整幅 */
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
    '.multi-images-container-section'
].join(',')

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

/** <p><img></p>、<p><a><img></a></p>，以及题注插件改造后的 <p><center><img></center></p> */
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

/** 引用块按 <br> 分行，用于辨认版记 / 小节日期 */
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

/** 版记：h1 之后、两级标题之前，至少两行、至少一行带日期 */
function isBylineQuote(el) {
    if (!el || el.tagName !== 'BLOCKQUOTE') return false
    const lines = quoteLines(el)
    if (lines.length < 2 || lines.length > 4) return false
    return datedLineCount(lines) >= 1
}

/** 小节日期：紧跟在 h2/h3 之后，至多三行、至少一行带日期、总长有限 */
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
    root.dataset.swCols = String(cols)
    localStorage.setItem(COLS_KEY, String(cols))
    Array.prototype.forEach.call(root.querySelectorAll('.ed-cols button'), function (btn) {
        btn.setAttribute('aria-pressed', String(Number(btn.dataset.cols) === cols))
    })
}

function buildColsControl(root) {
    const wrap = makeEl('div', 'ed-cols')
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', '正文栏数')

    ;[1, 2].forEach(function (cols) {
        const btn = makeEl('button')
        btn.type = 'button'
        btn.dataset.cols = String(cols)
        btn.textContent = cols === 1 ? '单栏' : '双栏'
        btn.addEventListener('click', function () {
            writeCols(root, cols)
        })
        wrap.appendChild(btn)
    })

    return wrap
}

/* ---------- 主流程 ---------- */

/* 侧栏站名是导航，不是标题：把 docsify 的 h1 降级为 div，全页只留一个 h1 */
function demoteSidebarTitle() {
    const el = document.querySelector('.sidebar > h1.app-name')
    if (!el) return

    const box = makeEl('div', 'app-name')
    while (el.firstChild) box.appendChild(el.firstChild)
    el.replaceWith(box)
}

function buildMast(root) {
    const h1 = root.querySelector(':scope > h1')
    const crumb = root.querySelector(':scope > ul.breadcrumb')
    const countWords = root.querySelector(':scope > #count-words-block-span-div')

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

    if (countWords) {
        meta.appendChild(countWords)
        /* 插件给这一行写死了 0.9rem 与 float，报头行要统一字号 —— 这是唯一需要清内联的地方 */
        stashInline(countWords.querySelector('#count-words-block-span'), ['font-size'])
    }

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

    /* 索引页的封面在首屏附近，改成即时加载，别等滚动才出现 */
    Array.prototype.forEach.call(root.querySelectorAll('.toc-page-div img'), function (img, index) {
        if (index < 6) img.loading = 'eager'
    })
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

export function renderTheme(options) {
    const onCleanup = options && options.onCleanup
    const root = document.querySelector('.markdown-section')
    let observer = null
    let titleTimer = 0

    restoreInline()

    if (root && root.dataset.swOn !== '1') {
        root.dataset.swOn = '1'
        demoteSidebarTitle()
        buildMast(root)
        buildSections(root)
        writeCols(root, readCols())
        document.documentElement.classList.add('ed-active')
        observer = setupMotion(root)

        const title = root.querySelector('.ed-mast > h1')
        if (title) titleTimer = window.setTimeout(function () { title.classList.add('ed-in') }, 60)
    }

    if (typeof onCleanup !== 'function') return

    onCleanup(function () {
        window.clearTimeout(titleTimer)
        if (observer) observer.disconnect()
        document.documentElement.classList.remove('ed-active', 'ed-motion')
        restoreInline()
    })
}
