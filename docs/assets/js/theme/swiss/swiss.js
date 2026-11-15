/**
 *   进度条兼作回顶：插件的 #scroll-to-top-span 由 CSS 隐掉，箭头画进进度条
 *
 *   结构性改动都发生在 renderTheme 内，会被 widgets 的 DOM journal 记录并回滚；
 *   异步加的类名一律挂在 html.sw-active 之下，切主题后自然失效。
 */

import { takeSlots, setupPlugin } from './plugin.js'
import { tocPageDivClass } from '../../plugins/tocPage.js'
import { createStorage } from '../../utils/storage.js'
import { docsifyClasses, elementStatus } from '../../utils/constants.js'
import { article } from '../../utils/icons.js'
import {
    onListen,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    createEl,
    getEl,
    getAllEls,
    getElByClass,
    setCssVar,
    getData,
    setData
} from '../../utils/dom.js'

const colsKey = 'swiss-cols'
const colsStorage = createStorage('local')
const dateRe = /\d{4}\s*[.\-/]\s*\d{1,2}\s*(?:[.\-/]\s*\d{1,2})?/

/** 块级媒体：不进栏，独占整幅 */
const plateSelector = [
    'iframe',
    'video',
    'pre',
    'table',
    'figure',
    'hr',
    'footer',
    '.docsify-tabs',
    `.${tocPageDivClass}`,
    '.toc-paginator-div',
    '.docsify-pagination-container',
    '.docsify-example-panels',
    '.multi-images-container-section',
    '.brief-comments-container'
].join(',')

const colsIcons = {
    1: article.colsOne,
    2: article.colsTwo
}

function isBlankText(node) {
    return node.nodeType === 3 && !node.textContent.trim()
}

function imgIn(el) {
    if (!el || el.nodeType !== 1) return null
    if (el.tagName === 'IMG') return el
    if (el.tagName === 'CENTER' || el.tagName === 'A' || el.tagName === 'PICTURE') {
        return getEl('img', el)
    }
    return null
}

function isImageParagraph(el) {
    if (!el || el.tagName !== 'P') return false
    const kids = Array.from(el.childNodes).filter(node => !isBlankText(node))
    if (kids.length !== 1) return false
    const only = kids[0]
    if (imgIn(only)) return !only.textContent.trim()
    return false
}

function isPlate(el) {
    if (!el || el.nodeType !== 1) return false
    if (isImageParagraph(el)) return true
    return el.matches(plateSelector)
}

function quoteLines(el) {
    const box = getEl('p', el) || el
    const clone = box.cloneNode(true)
    for (const br of getAllEls('br', clone)) br.replaceWith('\n')
    return clone.textContent.split('\n').map(line => line.trim()).filter(Boolean)
}

function datedLineCount(lines) {
    return lines.filter(line => dateRe.test(line)).length
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
    const box = getEl('p', el) || el
    const clone = box.cloneNode(true)
    for (const br of getAllEls('br', clone)) br.replaceWith(' · ')
    return clone.innerHTML.trim()
}

function plateFor(el) {
    const figure = createEl(isImageParagraph(el) ? 'figure' : 'div', { className: 'sw-plate' })
    figure.appendChild(el)
    return figure
}

function readCols() {
    return colsStorage.getItem(colsKey) === '1' ? 1 : 2
}

function applyCols(root, cols) {
    if (!root) return
    setData(root, 'swCols', cols)
    for (const btn of getAllEls('.sw-cols button', root)) {
        toggleClass(btn, elementStatus.isActive, cols === 2)
        btn.innerHTML = colsIcons[cols]
    }
}

function persistCols(cols) {
    colsStorage.setItem(colsKey, String(cols))
}

function setCols(root, cols) {
    applyCols(root, cols)
    persistCols(cols)
}

function buildColsControl(root) {
    const wrap = createEl('div', { className: 'sw-cols' })
    const btn = createEl('button', { attrs: { type: 'button' } })
    onListen(btn, 'click', () => {
        setCols(root, Number(getData(root, 'swCols')) === 1 ? 2 : 1)
    })
    wrap.appendChild(btn)

    return wrap
}

function demoteSidebarTitle() {
    const el = getEl(`.${docsifyClasses.sidebar} > h1.${docsifyClasses.appName}`)
    if (!el) return

    const box = createEl('div', { className: docsifyClasses.appName })
    while (el.firstChild) box.appendChild(el.firstChild)
    el.replaceWith(box)
}

function buildNavWordmark() {
    const nav = getElByClass(docsifyClasses.appNav)
    if (!nav) return
    if (getEl('.sw-wordmark', nav)) return

    const side = getEl(`.${docsifyClasses.sidebar} .${docsifyClasses.appName} a`)
    const name = (side ? side.textContent : document.title || '').trim()
    if (!name) return

    const link = createEl('a', { className: 'sw-wordmark' })
    link.href = '#/'
    link.textContent = name
    nav.insertBefore(link, nav.firstChild)
}

function buildMast(root, slots) {
    const h1 = getEl(':scope > h1', root)

    const slotsAt = at => (slots || []).reduce((out, slot) => {
        if (slot.at !== at) return out
        const el = slot.take()
        if (el) out.push(el)
        return out
    }, [])

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

    const mast = createEl('div', { className: 'sw-mast' })
    if (h1) mast.appendChild(h1)

    const line = createEl('div', { className: 'sw-mastline' })
    slotsAt('line').forEach(el => line.appendChild(el))

    const meta = createEl('div', { className: 'sw-meta' })
    slotsAt('meta').forEach(el => meta.appendChild(el))

    meta.appendChild(buildColsControl(root))
    line.appendChild(meta)

    if (bylineQuote) {
        const byline = createEl('p', { className: 'sw-byline' })
        byline.innerHTML = joinQuoteLines(bylineQuote)
        line.appendChild(byline)
        bylineQuote.remove()
    }

    mast.appendChild(line)

    root.insertBefore(mast, root.firstElementChild)

    if (coverParagraph) {
        const cover = plateFor(coverParagraph)
        addClass(cover, 'sw-cover')
        mast.after(cover)
    }
}

function buildSections(root) {
    const content = Array.from(root.children)
        .filter(el => !hasClass(el, 'sw-mast') && !hasClass(el, 'sw-cover'))

    if (!content.length) return

    const fragment = document.createDocumentFragment()
    let section = null
    let run = null
    let justOpened = false

    function openSection(heading) {
        section = createEl('section', { className: 'sw-sec' })
        setCssVar('--sw-delay', '0ms', section)
        run = null
        justOpened = Boolean(heading)

        if (heading) {
            const head = createEl('div', { className: 'sw-sec-head' })
            head.appendChild(heading)
            section.appendChild(head)
        }

        fragment.appendChild(section)
    }

    function openRun() {
        run = createEl('div', { className: 'sw-run' })
        section.appendChild(run)
        return run
    }

    for (const el of content) {
        if (el.tagName === 'H2') {
            openSection(el)
            continue
        }

        if (!section) openSection(null)

        if (justOpened && isDatelineQuote(el)) {
            addClass(el, 'sw-dateline')
            getEl('.sw-sec-head', section).appendChild(el)
            justOpened = false
            continue
        }
        justOpened = false

        if (isPlate(el)) {
            run = null
            section.appendChild(plateFor(el))
            continue
        }

        if (!run) openRun()
        run.appendChild(el)
    }

    for (const group of getAllEls('.sw-run', fragment)) {
        if (!group.children.length) continue
        const onlyHeads = Array.from(group.children).every(el => /^H[3-6]$/.test(el.tagName))
        if (onlyHeads) addClass(group, 'sw-run--head')
    }

    root.appendChild(fragment)
}

function setupMotion(root) {
    addClass(document.documentElement, 'sw-motion')

    const targets = []

    const title = getEl('.sw-mast > h1', root)
    if (title) targets.push(title)

    for (const section of getAllEls('.sw-sec', root)) {
        for (const [index, el] of Array.from(section.children).entries()) {
            if (!el.matches('.sw-sec-head, .sw-run, .sw-plate')) continue
            setCssVar('--sw-delay', Math.min(index, 3) * 70 + 'ms', el)
            targets.push(el)
        }
    }

    if (!targets.length) return

    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue
            requestAnimationFrame(() => {
                addClass(entry.target, 'sw-in')
            })
            observer.unobserve(entry.target)
        }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 })

    for (const el of targets) {
        setData(el, 'swIn', '')
        observer.observe(el)
    }

    return observer
}

export function renderTheme(options) {
    const onCleanup = options && options.onCleanup
    const root = getElByClass(docsifyClasses.markdownSection)
    let observer = null
    let titleTimer = 0

    if (root && getData(root, 'swOn') !== '1') {
        setData(root, 'swOn', '1')
        demoteSidebarTitle()
        buildNavWordmark()
        buildMast(root, takeSlots(root))
        buildSections(root)
        applyCols(root, readCols())
        addClass(document.documentElement, 'sw-active')
        observer = setupMotion(root)

        const title = getEl('.sw-mast > h1', root)
        if (title) titleTimer = window.setTimeout(() => addClass(title, 'sw-in'), 60)
    }

    const stopPlugin = setupPlugin(root)

    if (typeof onCleanup !== 'function') {
        stopPlugin()
        return
    }

    onCleanup(() => {
        window.clearTimeout(titleTimer)
        if (observer) observer.disconnect()
        stopPlugin()
        removeClass(document.documentElement, 'sw-active sw-motion')
    })
}
