/**
 *   1. 把 h1 / 面包屑 / 版记 / 字数 拼成报头行
 *   2. 按 h2 切节，按块级媒体切段，每段正文自己是一个双栏块（不用 column-span）
 *   3. 栏数切换（1 / 2），存 localStorage
 *   4. 入场动效（IntersectionObserver）
 *   5. 进度条兼作回顶：插件的 #scroll-to-top-span 由 CSS 隐掉，箭头画进进度条
 *
 *   结构性改动都发生在 renderTheme 内，会被 widgets 的 DOM journal 记录并回滚；
 *   异步加的类名一律挂在 html.sw-active 之下，切主题后自然失效。
 */

import { takeSlots, setupPlugin } from './plugin.js'
import { makeEl } from './util.js'

const COLS_KEY = 'swiss-cols'
const DATE_RE = /\d{4}\s*[.\-/]\s*\d{1,2}\s*(?:[.\-/]\s*\d{1,2})?/

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
    1: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.5" y="6" width="17" height="3"></rect><rect x="3.5" y="10.5" width="17" height="3"></rect><rect x="3.5" y="15" width="11" height="3"></rect></svg>',
    2: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.5" y="6" width="7" height="3"></rect><rect x="3.5" y="10.5" width="7" height="3"></rect><rect x="3.5" y="15" width="7" height="3"></rect><rect x="13.5" y="6" width="7" height="3"></rect><rect x="13.5" y="10.5" width="7" height="3"></rect><rect x="13.5" y="15" width="7" height="3"></rect></svg>'
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

function plateFor(el) {
    const figure = makeEl(isImageParagraph(el) ? 'figure' : 'div', 'sw-plate')
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
    Array.prototype.forEach.call(root.querySelectorAll('.sw-cols button'), function (btn) {
        btn.classList.toggle('is-active', cols === 2)
        btn.innerHTML = COLS_ICONS[cols]
    })
}

function buildColsControl(root) {
    const wrap = makeEl('div', 'sw-cols')
    const btn = makeEl('button')
    btn.type = 'button'
    btn.addEventListener('click', function () {
        writeCols(root, Number(root.dataset.swCols) === 1 ? 2 : 1)
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
    if (nav.querySelector('.sw-wordmark')) return

    const side = document.querySelector('.sidebar .app-name a')
    const name = (side ? side.textContent : document.title || '').trim()
    if (!name) return

    const link = makeEl('a', 'sw-wordmark')
    link.href = '#/'
    link.textContent = name
    nav.insertBefore(link, nav.firstChild)
}

function buildMast(root, slots) {
    const h1 = root.querySelector(':scope > h1')

    const slotsAt = function (at) {
        return (slots || []).reduce(function (out, slot) {
            if (slot.at !== at) return out
            const el = slot.take()
            if (el) out.push(el)
            return out
        }, [])
    }

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

    const mast = makeEl('div', 'sw-mast')
    if (h1) mast.appendChild(h1)

    const line = makeEl('div', 'sw-mastline')
    slotsAt('line').forEach(function (el) { line.appendChild(el) })

    const meta = makeEl('div', 'sw-meta')
    slotsAt('meta').forEach(function (el) { meta.appendChild(el) })

    meta.appendChild(buildColsControl(root))
    line.appendChild(meta)

    if (bylineQuote) {
        const byline = makeEl('p', 'sw-byline')
        byline.innerHTML = joinQuoteLines(bylineQuote)
        line.appendChild(byline)
        bylineQuote.remove()
    }

    mast.appendChild(line)

    root.insertBefore(mast, root.firstElementChild)

    if (coverParagraph) {
        const cover = plateFor(coverParagraph)
        cover.classList.add('sw-cover')
        mast.after(cover)
    }
}

function buildSections(root) {
    const content = Array.prototype.filter.call(root.children, function (el) {
        return !el.classList.contains('sw-mast') && !el.classList.contains('sw-cover')
    })

    if (!content.length) return

    const fragment = document.createDocumentFragment()
    let section = null
    let run = null
    let justOpened = false

    function openSection(heading) {
        section = makeEl('section', 'sw-sec')
        section.style.setProperty('--sw-delay', '0ms')
        run = null
        justOpened = Boolean(heading)

        if (heading) {
            const head = makeEl('div', 'sw-sec-head')
            head.appendChild(heading)
            section.appendChild(head)
        }

        fragment.appendChild(section)
    }

    function openRun() {
        run = makeEl('div', 'sw-run')
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
            el.classList.add('sw-dateline')
            section.querySelector('.sw-sec-head').appendChild(el)
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

    Array.prototype.forEach.call(fragment.querySelectorAll('.sw-run'), function (run) {
        if (!run.children.length) return
        const onlyHeads = Array.prototype.every.call(run.children, function (el) {
            return /^H[3-6]$/.test(el.tagName)
        })
        if (onlyHeads) run.classList.add('sw-run--head')
    })

    root.appendChild(fragment)
}

function setupMotion(root) {
    document.documentElement.classList.add('sw-motion')

    const targets = []

    const title = root.querySelector('.sw-mast > h1')
    if (title) targets.push({ el: title, delay: 0 })

    Array.prototype.forEach.call(root.querySelectorAll('.sw-sec'), function (section) {
        Array.prototype.forEach.call(section.children, function (el, index) {
            if (!el.matches('.sw-sec-head, .sw-run, .sw-plate')) return
            el.style.setProperty('--sw-delay', Math.min(index, 3) * 70 + 'ms')
            targets.push({ el: el, delay: 0 })
        })
    })

    if (!targets.length) return

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return
            requestAnimationFrame(function () {
                entry.target.classList.add('sw-in')
            })
            observer.unobserve(entry.target)
        })
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 })

    targets.forEach(function (item) {
        item.el.setAttribute('data-sw-in', '')
        observer.observe(item.el)
    })

    return observer
}

export function renderTheme(options) {
    const onCleanup = options && options.onCleanup
    const root = document.querySelector('.markdown-section')
    let observer = null
    let titleTimer = 0

    if (root && root.dataset.swOn !== '1') {
        root.dataset.swOn = '1'
        demoteSidebarTitle()
        buildNavWordmark()
        buildMast(root, takeSlots(root))
        buildSections(root)
        writeCols(root, readCols())
        document.documentElement.classList.add('sw-active')
        observer = setupMotion(root)

        const title = root.querySelector('.sw-mast > h1')
        if (title) titleTimer = window.setTimeout(function () { title.classList.add('sw-in') }, 60)
    }

    const stopPlugin = setupPlugin(root)

    if (typeof onCleanup !== 'function') {
        stopPlugin()
        return
    }

    onCleanup(function () {
        window.clearTimeout(titleTimer)
        if (observer) observer.disconnect()
        stopPlugin()
        document.documentElement.classList.remove('sw-active', 'sw-motion')
    })
}
