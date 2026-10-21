import { h, replace, htmlFragment } from '../utils/dom.js'
import { getLanguage } from '../data/languages.js'
import { loadGrammar } from '../services/grammar-service.js'
import { createGrammarTable } from '../components/grammar-table.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'

export default {
    needsUser: false,
    layout: 'shell',

    async mount(main, ctx) {
        const rawLang = (ctx.params && ctx.params.lang) || ''
        let lang = rawLang
        let anchor = ''
        let group = ''

        if (lang.includes('#')) {
            const parts = lang.split('#')
            lang = parts[0]
            anchor = parts[1] || ''
        }
        if (ctx.params && ctx.params.group) {
            group = String(ctx.params.group)
            if (group.includes('#')) {
                const parts = group.split('#')
                group = parts[0]
                anchor = anchor || parts[1] || ''
            }
        }
        if (ctx.query && ctx.query.ref) anchor = ctx.query.ref

        if (!lang) {
            location.replace('#/languages')
            return
        }

        const language = getLanguage(lang)
        if (!language) {
            replace(main, h('div', { class: 'empty' },
                h('div', { class: 'empty__title' }, '未知语言'),
                h('div', { class: 'empty__desc' }, String(lang))
            ))
            return
        }

        setBreadcrumbs([
            { label: '语言选择', href: '#/languages' },
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: '语法速查' }
        ])

        if (language.grammar === false) {
            location.replace(`#/lang/${lang}/words`)
            return
        }

        const doc = await loadGrammar(lang)
        if (!doc) { renderNoData(main, lang, language); return }

        renderGrammar(main, lang, language, doc, anchor, group)
    }
}

function renderNoData(main, lang, language) {
    replace(main,
        h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' },
                    h('span', { lang: lang }, language.native), ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' }, '语法速查')
            )
        ),
        h('div', { class: 'empty' },
            h('div', { class: 'empty__title' }, '尚未提供该语言的语法数据'),
            h('div', { class: 'empty__desc' }, `请创建 /data/grammar/${lang}.json`)
        )
    )
}

/** 该 section 属于哪一章（没有 groups 的文档整篇算一章） */
function groupOfSection(section, groups) {
    if (!groups) return ''
    return (section && section.group) || groups[0].id
}

/** anchor（section 或 item 的 id）落在哪一章 */
function groupOfAnchor(doc, anchor, groups) {
    for (const section of doc.sections || []) {
        if (!section || !section.id) continue
        if (section.id === anchor) return groupOfSection(section, groups)
        if ((section.items || []).some((item) => item && item.id === anchor)) {
            return groupOfSection(section, groups)
        }
    }
    return ''
}

function renderGrammar(main, lang, language, doc, anchor, groupParam) {
    // 章节来自文档的 groups（少于两章就不分页）
    const groups = Array.isArray(doc.groups) && doc.groups.length > 1 ? doc.groups : null

    let current = ''
    if (groups) {
        current = (anchor && groupOfAnchor(doc, anchor, groups)) || ''
        if (!current && groupParam && groups.some((g) => g.id === groupParam)) current = groupParam
        if (!current) current = groups[0].id

        // 锚点不在本章时，跳到它真正所在的章节页
        const here = (doc.sections || []).filter((s) => s && s.id && groupOfSection(s, groups) === current)
        const inPage = here.some((s) => s.id === anchor
            || (s.items || []).some((item) => item && item.id === anchor))
        if (anchor && !inPage) {
            const target = groupOfAnchor(doc, anchor, groups)
            if (target && target !== current) {
                location.hash = `#/grammar/${lang}/${target}#${anchor}`
                return
            }
        }
    }

    const sections = groups
        ? (doc.sections || []).filter((s) => s && s.id && groupOfSection(s, groups) === current)
        : (doc.sections || [])

    const currentGroup = groups ? groups.find((g) => g.id === current) : null
    const nav = h('aside', { class: 'grammar-nav', 'aria-label': '语法目录' })

    // 章节切换
    if (groups) {
        const chapters = h('div', { class: 'grammar-chapters' })
        chapters.appendChild(h('div', { class: 'grammar-nav__title' }, '章节'))
        for (const g of groups) {
            chapters.appendChild(h('a', {
                class: 'grammar-chapter' + (g.id === current ? ' grammar-chapter--active' : ''),
                href: `#/grammar/${lang}/${g.id}`
            }, g.title))
        }
        nav.appendChild(chapters)
    }

    const content = h('div', { class: 'grammar-content' })
    const allIds = new Set()

    // 本页的目录（一级标题 = section）
    const toc = h('div', { class: 'grammar-nav__group' })
    toc.appendChild(h('div', { class: 'grammar-nav__title' }, currentGroup ? currentGroup.title : '目录'))
    for (const section of sections) {
        if (!section || !section.id) continue
        allIds.add(section.id)
        toc.appendChild(h('a', {
            class: 'grammar-nav__link grammar-nav__link--section',
            href: `#/grammar/${lang}${groups ? '/' + current : ''}#${section.id}`,
            dataset: { anchor: section.id },
            onclick: (e) => {
                e.preventDefault()
                ensureRendered(section.id)
                scrollToAnchor(section.id, lang, true)
                setActiveNav(section.id)
            }
        }, section.title || section.id))

        for (const item of section.items || []) {
            if (!item || !item.id) continue
            allIds.add(item.id)
            toc.appendChild(h('a', {
                class: 'grammar-nav__link',
                href: `#/grammar/${lang}${groups ? '/' + current : ''}#${item.id}`,
                dataset: { anchor: item.id },
                onclick: (e) => {
                    e.preventDefault()
                    ensureRendered(item.id)
                    scrollToAnchor(item.id, lang, true)
                    setActiveNav(item.id)
                }
            }, item.title || item.id))
        }
    }
    nav.appendChild(toc)

    /** 渲染一个条目的表格与说明（懒加载时按需调用） */
    function fillItem(it, item) {
        if (it.dataset.filled === '1') return
        it.dataset.filled = '1'
        for (const t of item.tables || []) {
            const table = createGrammarTable({ ...t, lang: t.lang || lang })
            if (table) it.appendChild(table)
        }
        if (item.notes) {
            it.appendChild(h('div', { class: 'grammar-item__notes' }, htmlFragment(item.notes)))
        }
    }

    // 带锚点时，锚点所在章节及其之前的条目立即渲染，保证滚动位置准确
    const anchorSectionIndex = anchor
        ? sections.findIndex((s) => s && (s.id === anchor
            || (s.items || []).some((item) => item && item.id === anchor)))
        : -1
    const lazy = new Map()   // element -> item

    sections.forEach((section, index) => {
        if (!section || !section.id) return
        const sec = h('section', { class: 'grammar-section', id: section.id },
            h('h1', { class: 'grammar-section__title' }, section.title || section.id)
        )
        if (section.notes) {
            sec.appendChild(h('div', { class: 'grammar-section__notes' }, htmlFragment(section.notes)))
        }

        for (const item of section.items || []) {
            if (!item || !item.id) continue
            const it = h('div', { class: 'grammar-item', id: item.id },
                h('h2', { class: 'grammar-item__title' }, item.title || item.id)
            )
            if (anchorSectionIndex < 0 || index <= anchorSectionIndex) fillItem(it, item)
            else lazy.set(it, item)
            sec.appendChild(it)
        }
        content.appendChild(sec)
    })

    // 剩余条目在接近视口时再渲染（语法页表很大，全量渲染会很慢）
    if (lazy.size && typeof IntersectionObserver === 'function') {
        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue
                const item = lazy.get(entry.target)
                if (item) { fillItem(entry.target, item); lazy.delete(entry.target) }
                io.unobserve(entry.target)
            }
        }, { rootMargin: '900px 0px' })
        for (const el of lazy.keys()) io.observe(el)
    } else {
        for (const [el, item] of lazy) fillItem(el, item)
        lazy.clear()
    }

    /** 锚点可能在懒加载区里：先渲染再滚动 */
    function ensureRendered(id) {
        for (const [el, item] of [...lazy]) {
            if (item.id === id) { fillItem(el, item); lazy.delete(el) }
        }
    }

    replace(main,
        h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' },
                    h('span', { lang: lang }, language.native), ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' },
                    currentGroup ? `语法速查 · ${currentGroup.title}` : '语法速查')
            )
        ),
        h('div', { class: 'grammar-layout' }, nav, content)
    )

    function setActiveNav(activeId) {
        nav.querySelectorAll('.grammar-nav__link').forEach((el) => {
            el.classList.toggle('grammar-nav__link--active', el.dataset.anchor === activeId)
        })
    }

    if (anchor && allIds.has(anchor)) {
        setActiveNav(anchor)
        ensureRendered(anchor)
        setTimeout(() => scrollToAnchor(anchor, lang, false), 60)
    }
}

function scrollToAnchor(id, lang, updateUrl) {
    const el = document.getElementById(id)
    if (!el) return
    // 用 scrollIntoView + CSS 的 scroll-margin-top，滚动容器不是 window 时也能用
    try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
        const y = el.getBoundingClientRect().top + window.scrollY - 80
        window.scrollTo({ top: y, behavior: 'smooth' })
    }

    if (updateUrl) {
        const target = `#/grammar/${lang}#${id}`
        if (location.hash !== target) {
            try { history.replaceState(null, '', target) }
            catch { /* ignore */ }
        }
    }
}
