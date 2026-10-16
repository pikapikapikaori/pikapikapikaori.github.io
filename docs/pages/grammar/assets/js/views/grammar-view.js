import { h, replace } from '../utils/dom.js'
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

        if (lang.includes('#')) {
            const parts = lang.split('#')
            lang = parts[0]
            anchor = parts[1] || ''
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

        const doc = await loadGrammar(lang)
        if (!doc) { renderNoData(main, lang, language); return }

        renderGrammar(main, lang, language, doc, anchor)
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

function renderGrammar(main, lang, language, doc, anchor) {
    const nav = h('aside', { class: 'grammar-nav', 'aria-label': '语法目录' })
    const content = h('div', { class: 'grammar-content' })

    const allIds = new Set()

    for (const section of doc.sections || []) {
        if (!section || !section.id) continue
        allIds.add(section.id)

        const group = h('div', { class: 'grammar-nav__group' },
            h('div', { class: 'grammar-nav__title' }, section.title || section.id)
        )

        for (const item of section.items || []) {
            if (!item || !item.id) continue
            allIds.add(item.id)

            const link = h('a', {
                class: 'grammar-nav__link',
                href: `#/grammar/${lang}#${item.id}`,
                dataset: { anchor: item.id },
                onclick: (e) => {
                    e.preventDefault()
                    scrollToAnchor(item.id, lang, true)
                    setActiveNav(item.id)
                }
            }, item.title || item.id)
            group.appendChild(link)
        }
        nav.appendChild(group)
    }

    for (const section of doc.sections || []) {
        if (!section || !section.id) continue
        const sec = h('section', { class: 'grammar-section', id: section.id },
            h('h2', { class: 'grammar-section__title' }, section.title || section.id)
        )

        for (const item of section.items || []) {
            if (!item || !item.id) continue
            const it = h('div', { class: 'grammar-item', id: item.id },
                h('h3', { class: 'grammar-item__title' }, item.title || item.id)
            )

            for (const t of item.tables || []) {
                const table = createGrammarTable({ ...t, lang: t.lang || lang })
                if (table) it.appendChild(table)
            }
            if (item.notes) {
                it.appendChild(h('div', { class: 'grammar-item__notes' }, item.notes))
            }
            sec.appendChild(it)
        }
        content.appendChild(sec)
    }

    replace(main,
        h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' },
                    h('span', { lang: lang }, language.native), ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' }, '语法速查')
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
        setTimeout(() => scrollToAnchor(anchor, lang, false), 60)
    }
}

function scrollToAnchor(id, lang, updateUrl) {
    const el = document.getElementById(id)
    if (!el) return
    const headerH = 64
    const y = el.getBoundingClientRect().top + window.scrollY - headerH - 16
    window.scrollTo({ top: y, behavior: 'smooth' })

    if (updateUrl) {
        const target = `#/grammar/${lang}#${id}`
        if (location.hash !== target) {
            try { history.replaceState(null, '', target) }
            catch { /* ignore */ }
        }
    }
}
