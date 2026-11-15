/*
 * Atom 订阅读取。
 * feedUrl 在 config.js，fallbackPosts 也在 config.js。
 */
(function () {
    'use strict'

    const App = window.App = window.App || {}
    const F = App.feed = {}
    const CFG = App.config

    /*
     * 语言检测
     * 从纯文本采样，统计假名、汉字与拉丁字母三类字符。
     * 判定看假名占 CJK 的比例而非占全部字符的比例，
     * 中文里夹少量日语引用不会被误判成日语。
     */
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

    /* 各语言的"本文首发"一类标记，抽取正文时整块去掉 */
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

                /* 拉取成功但没有该语言的文章属正常情况 */
                if (!filtered.length) {
                    console.log(
                        '[homepage] Atom 中没有 ' + lang + ' 的文章，使用内嵌数据'
                    )
                    return getFallback(lang)
                }

                return filtered.slice(0, CFG.blog.postLimit)
            })
            .catch(function (err) {
                console.warn(
                    '[homepage] Atom 拉取失败（' + lang + '），使用内嵌数据：',
                    err.message
                )
                return getFallback(lang)
            })
    }
})()
