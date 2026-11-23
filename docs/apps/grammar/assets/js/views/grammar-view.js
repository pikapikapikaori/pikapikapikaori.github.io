import { h, replace } from '../utils/dom.js'
import { getLanguage } from '../data/languages.js'
import { loadGrammarMeta, loadGrammarForChapter, loadScriptProfile } from '../services/grammar-service.js'
import { createPageTools } from '../components/page-tools.js'
import { annotateDualText, setDualTextVisible } from '../utils/dual-text.js'
import { annotateBreves, setBreveVisible } from '../utils/breve.js'
import { createGrammarTables } from '../components/grammar-table.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import { annotateBdi, bdiFragment, bdiNode } from '../utils/bdi.js'

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
            { label: '语言列表', href: '#/languages' },
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: '语法' }
        ])

        if (language.grammar === false) {
            location.replace(`#/lang/${lang}/words`)
            return
        }

        const meta = await loadGrammarMeta(lang)
        if (!meta) { renderNoData(main, lang, language); return }

        const chapters = meta.grammarFiles?.chapters || []
        let current = ''
        if (chapters.length > 1) {
            const byAnchor = anchor ? chapterOfAnchor(meta, anchor) : ''
            current = byAnchor
                || (chapters.some((c) => c.id === group) ? group : '')
                || chapters[0].id
            if (byAnchor && byAnchor !== current) {
                location.hash = `#/grammar/${lang}/${byAnchor}#${anchor}`
                return
            }
            if (!group) {
                const target = `#/grammar/${lang}/${current}${anchor ? `#${anchor}` : ''}`
                if (location.hash !== target) history.replaceState(null, '', target)
            }
        }

        const doc = await loadGrammarForChapter(lang, current)
        if (!doc) { renderNoData(main, lang, language); return }

        const scriptProfile = await loadScriptProfile(lang, meta)
        return renderGrammar(main, lang, language, doc, anchor, group, scriptProfile)
    }
}

function renderNoData(main, lang, language) {
    replace(main,
        h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' },
                    bdiNode(language.native, lang), ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' }, '语法')
            )
        ),
        h('div', { class: 'empty' },
            h('div', { class: 'empty__title' }, '尚未提供该语言的语法数据'),
            h('div', { class: 'empty__desc' }, `请创建 /data/language/${lang}/grammar/*.json`)
        )
    )
}

function chapterOfAnchor(meta, anchor) {
    for (const chapter of meta.grammarFiles?.chapters || []) {
        if ((chapter.anchors || []).includes(anchor)) return chapter.id
    }
    return ''
}

function groupOfSection(section, groups) {
    if (!groups) return ''
    return (section && section.group) || groups[0].id
}

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

function renderGrammar(main, lang, language, doc, anchor, groupParam, scriptProfile = null) {
    const groups = Array.isArray(doc.groups) && doc.groups.length > 1 ? doc.groups : null

    let current = ''
    if (groups) {
        current = (anchor && groupOfAnchor(doc, anchor, groups)) || ''
        if (!current && groupParam && groups.some((g) => g.id === groupParam)) current = groupParam
        if (!current) current = groups[0].id

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

    if (groups) {
        const chapters = h('div', { class: 'grammar-chapters' })
        chapters.appendChild(h('div', { class: 'grammar-nav__title' }, '章节'))
        for (const g of groups) {
            chapters.appendChild(h('a', {
                class: 'grammar-chapter' + (g.id === current ? ' grammar-chapter--active' : ''),
                href: `#/grammar/${lang}/${g.id}`
            }, bdiFragment(g.title, lang)))
        }
        nav.appendChild(chapters)
    }

    const content = h('div', { class: 'grammar-content' })
    const allIds = new Set()

    const toRoman = typeof scriptProfile?.toRoman === 'function'
        ? (text) => scriptProfile.toRoman(text)
        : null
    const scriptRange = toRoman && scriptProfile?.scriptRange instanceof RegExp
        ? scriptProfile.scriptRange
        : null
    const tools = createPageTools({
        lang,
        toRoman,
        anchorEl: main,
        onChange: (on) => {
            setDualTextVisible(on)
            if (on) annotateDualText(content, { range: scriptRange, toRoman })
        },
        onBreveChange: (on) => {
            setBreveVisible(on)
            annotateBreves(content, { selector: 'td, th' })
        }
    })
    document.body.appendChild(tools.el)
    if (tools.isOn() && toRoman) {
        setDualTextVisible(true)
        annotateDualText(content, { range: scriptRange, toRoman })
    }
    if (tools.isBreveOn()) setBreveVisible(true)
    annotateBreves(content, { selector: 'td, th' })

    const tocCurrent = h('span', { class: 'grammar-toc__current' })
    const tocDetails = h('details', { class: 'grammar-toc', open: true },
        h('summary', { class: 'grammar-toc__summary' },
            h('span', {}, '本页目录'),
            tocCurrent
        )
    )
    const toc = h('div', { class: 'grammar-nav__group' },
        h('div', { class: 'grammar-nav__title' }, '本页目录')
    )

    const skipSectionLink = sections.length === 1 && currentGroup
        && (sections[0].title || sections[0].id) === currentGroup.title
    const narrowQuery = window.matchMedia('screen and (max-width: 768px)')
    function afterTocJump() {
        if (narrowQuery.matches) tocDetails.open = false
    }

    for (const section of sections) {
        if (!section || !section.id) continue
        allIds.add(section.id)
        if (!skipSectionLink) {
            toc.appendChild(h('a', {
                class: 'grammar-nav__link grammar-nav__link--section',
                href: `#/grammar/${lang}${groups ? '/' + current : ''}#${section.id}`,
                dataset: { anchor: section.id },
                onclick: (e) => {
                    e.preventDefault()
                    ensureRendered(section.id)
                    scrollToAnchor(section.id, lang, true)
                    setActiveNav(section.id)
                    afterTocJump()
                }
            }, bdiFragment(section.title || section.id, lang)))
        }

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
                    afterTocJump()
                }
            }, bdiFragment(item.title || item.id, lang)))
        }
    }
    tocDetails.appendChild(toc)
    nav.appendChild(tocDetails)

    function syncTocOpen() {
        tocDetails.open = !narrowQuery.matches
    }
    syncTocOpen()
    narrowQuery.addEventListener('change', syncTocOpen)
    annotateBdi(nav, lang)

    function fillItem(it, item) {
        if (it.dataset.filled === '1') return
        it.dataset.filled = '1'
        const tables = createGrammarTables(item.tables || [], lang, item.title || '')
        if (tables) it.appendChild(tables)
        if (item.notes) {
            const notes = h('div', { class: 'grammar-item__notes' }, bdiFragment(item.notes, lang))
            it.appendChild(notes)
        }
        annotateBdi(it, lang)
        if (tools.isOn() && toRoman) annotateDualText(it, { range: scriptRange, toRoman })
    }

    const anchorSectionIndex = anchor
        ? sections.findIndex((s) => s && (s.id === anchor
            || (s.items || []).some((item) => item && item.id === anchor)))
        : -1
    const lazy = new Map()
    const itemOrder = []

    sections.forEach((section, index) => {
        if (!section || !section.id) return
        const sec = h('section', { class: 'grammar-section', id: section.id },
            h('h2', { class: 'grammar-section__title' }, bdiFragment(section.title || section.id, lang))
        )
        if (section.notes) {
            sec.appendChild(h('div', { class: 'grammar-section__notes' }, bdiFragment(section.notes, lang)))
        }
        annotateBdi(sec, lang)

        for (const item of section.items || []) {
            if (!item || !item.id) continue
            const it = h('div', { class: 'grammar-item', id: item.id },
                h('h3', { class: 'grammar-item__title' }, bdiFragment(item.title || item.id, lang))
            )
            if (anchorSectionIndex < 0 || index <= anchorSectionIndex) fillItem(it, item)
            else lazy.set(it, item)
            itemOrder.push({ el: it, item })
            sec.appendChild(it)
        }
        content.appendChild(sec)
    })

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

    function ensureRendered(id) {
        for (const entry of itemOrder) {
            if (lazy.has(entry.el)) {
                fillItem(entry.el, entry.item)
                lazy.delete(entry.el)
            }
            if (entry.item.id === id) break
        }
    }

    if (groups) {
        const gi = groups.findIndex((g) => g.id === current)
        const prevGroup = gi > 0 ? groups[gi - 1] : null
        const nextGroup = gi >= 0 && gi < groups.length - 1 ? groups[gi + 1] : null
        if (prevGroup || nextGroup) {
            content.appendChild(h('nav', { class: 'doc-pager', 'aria-label': '章节翻页' },
                prevGroup
                    ? h('a', { class: 'doc-pager__link', href: `#/grammar/${lang}/${prevGroup.id}` },
                        h('span', { class: 'doc-pager__dir' }, '上一章'),
                        h('span', { class: 'doc-pager__title' }, prevGroup.title))
                    : null,
                nextGroup
                    ? h('a', { class: 'doc-pager__link doc-pager__link--next', href: `#/grammar/${lang}/${nextGroup.id}` },
                        h('span', { class: 'doc-pager__dir' }, '下一章'),
                        h('span', { class: 'doc-pager__title' }, nextGroup.title))
                    : null
            ))
        }
    }

    replace(main,
        h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' },
                    bdiNode(language.native, lang), ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' }, '语法')
            )
        ),
        h('div', { class: 'grammar-layout' }, nav, content)
    )

    function setActiveNav(activeId) {
        let label = ''
        nav.querySelectorAll('.grammar-nav__link').forEach((el) => {
            const on = el.dataset.anchor === activeId
            el.classList.toggle('grammar-nav__link--active', on)
            if (on) label = el.textContent
        })
        if (!label) {
            const first = toc.querySelector('.grammar-nav__link')
            if (first) {
                first.classList.add('grammar-nav__link--active')
                label = first.textContent
            }
        }
        tocCurrent.textContent = label
    }

    if (anchor && allIds.has(anchor)) {
        setActiveNav(anchor)
        ensureRendered(anchor)
        setTimeout(() => scrollToAnchor(anchor, lang, false), 60)
    }

    const spyTargets = Array.from(content.querySelectorAll('.grammar-section, .grammar-item'))
        .filter((el) => el.id)
    let spyFrame = 0

    function syncActiveByScroll() {
        spyFrame = 0
        if (!spyTargets.length) return
        const margin = parseFloat(getComputedStyle(spyTargets[0]).scrollMarginTop)
        const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--h-header')) || 56
        const offset = (Number.isFinite(margin) ? margin : header + 24) + 1
        let active = spyTargets[0].id
        for (const el of spyTargets) {
            if (el.getBoundingClientRect().top - offset > 0) break
            active = el.id
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
            active = spyTargets[spyTargets.length - 1].id
        }
        setActiveNav(active)
    }

    function onScroll() {
        if (!spyFrame) spyFrame = requestAnimationFrame(syncActiveByScroll)
    }

    annotateBdi(content, lang)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const heightObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(onScroll)
        : null
    if (heightObserver) heightObserver.observe(content)
    if (!(anchor && allIds.has(anchor))) syncActiveByScroll()

    return () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onScroll)
        narrowQuery.removeEventListener('change', syncTocOpen)
        if (heightObserver) heightObserver.disconnect()
        if (spyFrame) cancelAnimationFrame(spyFrame)
        tools.destroy()
        setDualTextVisible(false)
        setBreveVisible(false)
    }
}

function scrollToAnchor(id, lang, updateUrl) {
    const el = document.getElementById(id)
    if (!el) return
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
            catch {   }
        }
    }
}
