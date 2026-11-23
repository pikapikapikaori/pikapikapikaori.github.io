(function () {
    'use strict'

    const App = window.App = window.App || {}
    const F = App.feed = {}
    const CFG = App.config
    const I = App.i18n

    let boilerplateRe = null

    function boilerplatePattern() {
        if (boilerplateRe) return boilerplateRe

        const phrases = I.mergedList('feed.boilerplate')
        if (!phrases.length) return null

        boilerplateRe = new RegExp(phrases.map(function (phrase) {
            return String(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        }).join('|'), 'i')

        return boilerplateRe
    }

    function extractContent(html, excerptLen) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html')
            const boilerplate = boilerplatePattern()

            const imgEl = doc.querySelector('figure img, img')
            const cover = imgEl ? (imgEl.getAttribute('src') || '') : ''

            doc.querySelectorAll('h1, figure, script, style').forEach(function (el) {
                el.remove()
            })
            doc.querySelectorAll('blockquote').forEach(function (el) {
                if (boilerplate && boilerplate.test(el.textContent)) el.remove()
            })

            const fullText = (doc.body.textContent || '')
                .replace(/\{docsify-[a-z-]+\}/gi, '')
                .replace(/\s+/g, ' ')
                .trim()

            return {
                cover: cover,
                fullText: fullText,
                excerpt: fullText.slice(0, excerptLen)
            }
        } catch {
            return { cover: '', fullText: '', excerpt: '' }
        }
    }

    function parseAtom(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        if (doc.querySelector('parsererror')) throw new Error('XML parse error')

        const entries = [].slice.call(doc.querySelectorAll('entry'))
            .slice(0, CFG.blog.scanLimit)

        return entries.map(function (en) {
            const titleEl = en.querySelector('title')
            const linkEl = en.querySelector('link')
            const cEl = en.querySelector('content')
            const uEl = en.querySelector('updated')

            const title = titleEl ? titleEl.textContent.trim() : ''
            const link = linkEl ? linkEl.getAttribute('href') : '#'
            const raw = cEl ? cEl.textContent : ''
            const upd = uEl ? uEl.textContent : ''

            const info = extractContent(raw, CFG.blog.excerptLength)
            const lang = I.detectLang(info.fullText, CFG.blog.langSampleLength)

            return {
                title: title,
                link: link,
                cover: info.cover,
                excerpt: info.excerpt,
                date: upd.slice(0, 10).replace(/-/g, '.'),
                lang: lang
            }
        }).filter(function (p) { return p.title })
    }

    function getFallback(lang) {
        const map = CFG.fallbackPosts || {}
        return map[lang] || map[I.defaultLang] || []
    }

    F.loadPosts = function (lang) {
        lang = lang || I.defaultLang

        return fetch(I.t('common.feed.href'), { mode: 'cors', credentials: 'omit' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status)
                return res.text()
            })
            .then(function (text) {
                const filtered = parseAtom(text).filter(function (p) {
                    return p.lang === lang
                })

                if (!filtered.length) {
                    return getFallback(lang)
                }

                return filtered.slice(0, CFG.blog.postLimit)
            })
            .catch(function () {
                return getFallback(lang)
            })
    }
})()
