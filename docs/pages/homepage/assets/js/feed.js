(function () {
    'use strict'

    const App = window.App = window.App || {}
    const F = App.feed = {}
    const CFG = App.config

    const KANA_MIN = 3
    const KANA_RATIO = 0.15

    function detectLang(text, sampleLen) {
        const sample = String(text || '').slice(0, sampleLen)

        const kana = (sample.match(/[\u3040-\u30FF\uFF65-\uFF9F]/g) || []).length
        const han = (sample.match(/[\u4E00-\u9FFF]/g) || []).length
        const latin = (sample.match(/[A-Za-z]/g) || []).length

        if (kana + han === 0) {
            return latin > 0 ? 'en' : null
        }

        if (kana >= KANA_MIN && kana / (kana + han) >= KANA_RATIO) {
            return 'ja'
        }

        if (han > 0) return 'zh-Hans'
        if (latin > 0) return 'en'
        return null
    }

    const BOILERPLATE_RE = /本文首发|最后编辑于|first published|Last edited|最初に公開|最終編集/i

    function extractContent(html, excerptLen) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html')

            const imgEl = doc.querySelector('figure img, img')
            const cover = imgEl ? (imgEl.getAttribute('src') || '') : ''

            doc.querySelectorAll('h1, figure, script, style').forEach(function (el) {
                el.remove()
            })
            doc.querySelectorAll('blockquote').forEach(function (el) {
                if (BOILERPLATE_RE.test(el.textContent)) el.remove()
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
        } catch (e) {
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
            const lang = detectLang(info.fullText, CFG.blog.langSampleLength)

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
        return map[lang] || map['zh-Hans'] || []
    }

    F.loadPosts = function (lang) {
        lang = lang || 'zh-Hans'

        return fetch(CFG.feedUrl, { mode: 'cors', credentials: 'omit' })
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
            .catch(function (err) {
                return getFallback(lang)
            })
    }
})()
