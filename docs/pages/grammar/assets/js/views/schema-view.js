/**
 * 数据格式：几章 JSON 结构文档。
 * 结构与语法页一致 —— 左侧「章节」+「本页目录」，右侧正文；正文开头一条结论，章尾翻页。
 */

import { h, replace } from '../utils/dom.js'
import { appStore, setNavContext } from '../app-state.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import { renderMarkdown, scanHeadings } from '../utils/markdown.js'
import { loadSchema, copyText, downloadMarkdown } from '../services/schema-service.js'
import { openSelectMenu } from '../components/select-menu.js'
import { createPageTools } from '../components/page-tools.js'
import { toast } from '../components/toast.js'

const NARROW = '(max-width: 1024px)'

/* 从哪个路由进的数据格式：本页切换文档会再走一次 schema → schema，不能让它冲掉来源 */
let entryFrom = null

export default {
    needsUser: false,
    layout: 'shell',

    async mount(main, ctx) {
        // 入口来源要在任何提前返回之前记下：'#/schema' 会重定向到 '#/schema/<doc>'
        const prevRoute = appStore.get().prevRoute
        if (prevRoute && prevRoute !== 'schema') entryFrom = prevRoute

        const raw = (ctx.params && ctx.params.doc) || ''
        const [rawId, rawAnchor] = raw.split('#')
        const anchor = rawAnchor || (ctx.query && ctx.query.ref) || ''

        let schema
        try {
            schema = await loadSchema()
        } catch (err) {
            replace(main,
                h('div', { class: 'empty' },
                    h('div', { class: 'empty__title' }, '数据格式文档加载失败'),
                    h('div', { class: 'empty__desc' }, String(err.message || err))
                )
            )
            return
        }

        const { title, docs } = schema
        if (!docs.length) {
            replace(main,
                h('div', { class: 'empty' },
                    h('div', { class: 'empty__title' }, '还没有数据格式文档'),
                    h('div', { class: 'empty__desc' }, '请创建 /data/schema/manifest.json')
                )
            )
            return
        }

        const index = docs.findIndex((d) => d.id === rawId)
        if (index < 0) {
            location.replace(`#/schema/${docs[0].id}`)
            return
        }

        const doc = docs[index]

        // 从首页（未登录 / 欢迎页）进来的回首页，否则回语言列表
        const fromHome = entryFrom === 'welcome' || !appStore.get().userId
        // 顶栏也跟着回到来源：从首页进来时「生词本」「设置」都回首页
        setNavContext(fromHome ? 'welcome' : 'user')
        setBreadcrumbs([
            fromHome
                ? { label: '首页', href: '#/welcome' }
                : { label: '语言列表', href: '#/languages' },
            // 当前手册不再进面包屑：末项就是「数据格式」本身
            { label: title }
        ])

        return render(main, { title, docs, index, doc, anchor })
    }
}

function render(main, { title, docs, index, doc, anchor }) {
    const narrowQuery = window.matchMedia(NARROW)

    /* ---------------- 头部 ---------------- */

    const copyMain = h('button', {
        class: 'btn btn--primary split-btn__main',
        type: 'button',
        onclick: () => doCopy()
    }, '复制 Markdown')

    const copyCaret = h('button', {
        class: 'btn btn--primary split-btn__caret',
        type: 'button',
        'aria-haspopup': 'menu',
        'aria-expanded': 'false',
        'aria-label': '更多导出方式',
        onclick: (e) => openSelectMenu({
            anchor: e.currentTarget,
            owner: e.currentTarget,
            items: [
                { value: 'copy', label: '复制 Markdown' },
                { value: 'download', label: '下载 .md' }
            ],
            onPick: (value) => {
                if (value === 'download') doDownload()
                else doCopy()
            }
        })
    }, '▾')

    async function doCopy() {
        try {
            await copyText(doc.markdown)
            toast.success(`已复制「${doc.title}」`, 2400)
            const label = copyMain.textContent
            copyMain.textContent = '已复制'
            setTimeout(() => { copyMain.textContent = label }, 1600)
        } catch (err) {
            toast.error(`复制失败：${err.message}`)
        }
    }

    function doDownload() {
        try {
            const name = downloadMarkdown(`grammar-${doc.id}.md`, doc.markdown)
            toast.success(`已下载 ${name}`, 3000)
        } catch (err) {
            toast.error(`下载失败：${err.message}`)
        }
    }

    const head = h('div', { class: 'page-head page-head--display schema-head' },
        h('div', {},
            h('h1', { class: 'page-head__title' }, title),
            h('div', { class: 'page-head__sub' }, doc.title)
        ),
        h('div', { class: 'page-head__actions' },
            h('div', { class: 'split-btn' }, copyMain, copyCaret)
        )
    )

    /* ---------------- 左栏：章节 + 本页目录 ---------------- */

    const nav = h('aside', { class: 'grammar-nav', 'aria-label': '数据格式目录' })

    const parts = h('div', { class: 'grammar-chapters' },
        h('div', { class: 'grammar-nav__title' }, '章节')
    )
    for (const item of docs) {
        parts.appendChild(h('a', {
            class: 'grammar-chapter' + (item.id === doc.id ? ' grammar-chapter--active' : ''),
            href: `#/schema/${item.id}`
        }, item.title))
    }
    nav.appendChild(parts)

    const tocCurrent = h('span', { class: 'grammar-toc__current' })
    const tocSummary = h('summary', { class: 'grammar-toc__summary' },
        h('span', {}, '本页目录'),
        tocCurrent
    )
    const tocDetails = h('details', { class: 'grammar-toc', open: true }, tocSummary)
    const toc = h('div', { class: 'grammar-nav__group' },
        h('div', { class: 'grammar-nav__title' }, '本页目录')
    )
    tocDetails.appendChild(toc)
    nav.appendChild(tocDetails)

    /* ---------------- 正文 ---------------- */

    const content = h('div', { class: 'grammar-content' })
    const body = h('div', { class: 'doc-body' })

    if (doc.lead) {
        const lead = h('blockquote', { class: 'doc-quote doc-quote--lead' })
        lead.appendChild(renderMarkdown(doc.lead))
        content.appendChild(lead)
    }
    content.appendChild(body)
    body.appendChild(renderMarkdown(doc.markdown))

    const headings = scanHeadings(doc.markdown)

    for (const item of headings) {
        if (item.level > 3) continue
        const link = h('a', {
            class: 'grammar-nav__link' + (item.level === 2 ? ' grammar-nav__link--section' : ''),
            href: `#/schema/${doc.id}#${item.id}`,
            dataset: { anchor: item.id }
        }, item.text)
        link.addEventListener('click', (e) => {
            e.preventDefault()
            jumpTo(item.id)
            setActiveNav(item.id)
            if (narrowQuery.matches) tocDetails.open = false
        })
        toc.appendChild(link)
    }

    /* ---------------- 章尾翻页 ---------------- */

    const prev = docs[index - 1]
    const next = docs[index + 1]
    content.appendChild(h('nav', { class: 'doc-pager', 'aria-label': '章节翻页' },
        prev
            ? h('a', { class: 'doc-pager__link', href: `#/schema/${prev.id}` },
                h('span', { class: 'doc-pager__dir' }, '上一章'),
                h('span', { class: 'doc-pager__title' }, prev.title))
            : null,
        next
            ? h('a', { class: 'doc-pager__link doc-pager__link--next', href: `#/schema/${next.id}` },
                h('span', { class: 'doc-pager__dir' }, '下一章'),
                h('span', { class: 'doc-pager__title' }, next.title))
            : null
    ))

    /* ---------------- 跨章锚点 ---------------- */

    const anchorDocs = new Map()
    for (const item of docs) {
        for (const hd of scanHeadings(item.markdown)) {
            if (!anchorDocs.has(hd.id)) anchorDocs.set(hd.id, item.id)
        }
    }

    body.addEventListener('click', (e) => {
        const link = e.target instanceof Element ? e.target.closest('a[data-anchor]') : null
        if (!link) return
        e.preventDefault()
        const target = link.dataset.anchor
        if (document.getElementById(target)) {
            jumpTo(target)
            setActiveNav(target)
            history.replaceState(null, '', `#/schema/${doc.id}#${target}`)
            return
        }
        const where = anchorDocs.get(target)
        if (where) {
            location.hash = `#/schema/${where}#${target}`
            return
        }
        toast.error('这一章里没有该条目', 2600)
    })

    replace(main, head, h('div', { class: 'grammar-layout' }, nav, content))

    /* ---------------- 右下角浮动工具：回到顶部 ---------------- */
    // 数据格式页没有转写 / 短音符，这里只会渲染「↑」一个按钮，行为与语法页一致
    const tools = createPageTools({ anchorEl: main })
    document.body.appendChild(tools.el)

    /* ---------------- 滚动与高亮 ---------------- */

    const targets = Array.from(content.querySelectorAll('.doc-heading'))
        .filter((el) => el.dataset.level === '2' || el.dataset.level === '3')

    function setActiveNav(activeId) {
        let label = ''
        nav.querySelectorAll('.grammar-nav__link').forEach((el) => {
            const on = el.dataset.anchor === activeId
            el.classList.toggle('grammar-nav__link--active', on)
            if (on) label = el.textContent
        })
        tocCurrent.textContent = label
    }

    function jumpTo(id) {
        const el = document.getElementById(id)
        if (!el) return
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } catch {
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
        }
    }

    let frame = 0
    function syncByScroll() {
        frame = 0
        if (!targets.length) return
        const margin = parseFloat(getComputedStyle(targets[0]).scrollMarginTop)
        const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--h-header')) || 56
        const offset = (Number.isFinite(margin) ? margin : header + 24) + 1
        let active = targets[0].id
        for (const el of targets) {
            if (el.getBoundingClientRect().top - offset > 0) break
            active = el.id
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
            active = targets[targets.length - 1].id
        }
        setActiveNav(active)
    }

    function onScroll() {
        if (!frame) frame = requestAnimationFrame(syncByScroll)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    // 窄屏常收、宽屏常开；与语法页同一套折叠规则
    function syncTocOpen() { tocDetails.open = !narrowQuery.matches }
    syncTocOpen()
    narrowQuery.addEventListener('change', syncTocOpen)

    if (anchor && document.getElementById(anchor)) {
        setActiveNav(anchor)
        setTimeout(() => jumpTo(anchor), 60)
    } else {
        syncByScroll()
    }

    return () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onScroll)
        narrowQuery.removeEventListener('change', syncTocOpen)
        if (frame) cancelAnimationFrame(frame)
        tools.destroy()
    }
}
