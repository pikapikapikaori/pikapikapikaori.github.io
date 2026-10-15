/**
 * 语法速查（只读）
 *
 * 路由：
 *   #/grammar               语言选择
 *   #/grammar/:lang         展示该语言语法
 *   #/grammar/:lang#anchor  锚点定位（由本视图从 location.hash 解析）
 *   #/grammar/:lang?ref=xxx ?ref 参数也支持
 */

import { h, replace } from '../utils/dom.js'
import { LANGUAGES, getLanguage } from '../data/languages.js'
import { loadGrammar } from '../services/grammar-service.js'
import { createGrammarTable } from '../components/grammar-table.js'

export default {
    needsUser: false,
    layout: 'shell',

    async mount(main, ctx) {
        const rawLang = (ctx.params && ctx.params.lang) || ''
        let lang = rawLang
        let anchor = ''

        // 处理 /grammar/la#la-noun-1st-decl 情况
        if (lang.includes('#')) {
            const parts = lang.split('#')
            lang = parts[0]
            anchor = parts[1] || ''
        }
        // 优先 ?ref=
        if (ctx.query && ctx.query.ref) anchor = ctx.query.ref

        if (!lang) { renderLanguagePicker(main); return }

        const language = getLanguage(lang)
        if (!language) {
            replace(main, h('div', { class: 'empty' },
                h('div', { class: 'empty__title' }, '未知语言'),
                h('div', { class: 'empty__desc' }, String(lang))
            ))
            return
        }

        const doc = await loadGrammar(lang)
        if (!doc) { renderNoData(main, lang, language); return }

        renderGrammar(main, lang, language, doc, anchor)
    }
}

/* ---------------- 子视图 ---------------- */

function renderLanguagePicker(main) {
    const grid = h('div', { class: 'lang-grid' })
    for (const l of LANGUAGES) {
        grid.appendChild(h('div', {
            class: 'lang-card',
            role: 'button',
            tabindex: '0',
            onclick: () => location.hash = `#/grammar/${l.code}`,
            onkeydown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    location.hash = `#/grammar/${l.code}`
                }
            }
        },
        h('div', {
            class: 'lang-card__native',
            lang: l.code,
            style: l.rtl ? { direction: 'rtl' } : {}
        }, l.native),
        h('div', { class: 'lang-card__name' }, l.name),
        h('div', { class: 'lang-card__stats' },
            h('span', { class: 'lang-card__stat' }, '点击查看基础语法')
        )
        ))
    }

    replace(main,
        h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' }, '语法速查'),
                h('div', { class: 'page-head__sub' }, '选择语言查看名词变格、动词变位、代词、字母形态等')
            )
        ),
        grid
    )
}

function renderNoData(main, lang, language) {
    replace(main,
        h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' },
                    h('span', { lang: lang }, language.native), ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' }, '语法速查')
            ),
            h('button', {
                class: 'btn', type: 'button',
                onclick: () => location.hash = '#/grammar'
            }, '切换语言')
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

    // 内容
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
            ),
            h('button', {
                class: 'btn', type: 'button',
                onclick: () => location.hash = '#/grammar'
            }, '切换语言')
        ),
        h('div', { class: 'grammar-layout' }, nav, content)
    )

    /* ---- 辅助 ---- */

    function setActiveNav(activeId) {
        nav.querySelectorAll('.grammar-nav__link').forEach((el) => {
            el.classList.toggle('grammar-nav__link--active', el.dataset.anchor === activeId)
        })
    }

    /* ---- 锚点 ---- */
    if (anchor && allIds.has(anchor)) {
        setActiveNav(anchor)
        setTimeout(() => scrollToAnchor(anchor, lang, false), 60)
    }
}

/* ---------------- 工具 ---------------- */

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
