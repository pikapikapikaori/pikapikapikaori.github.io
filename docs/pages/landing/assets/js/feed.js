(function () {
    'use strict'

    var App = window.App = window.App || {}
    var F = App.feed = {}
    var CFG = App.config

    /* ============================================================
       语言检测

       从纯文本采样，统计三类字符：
         - 假名（平假名/片假名/半角片假名）
         - 汉字（CJK 统一表意文字基本区）
         - 拉丁字母
       判定顺序：
         1. 既无假名也无汉字 → 有拉丁就是 en，否则 null
         2. 假名数 ≥ KANA_MIN 且 假名/(假名+汉字) ≥ KANA_RATIO → ja
         3. 有汉字 → zh-Hans
         4. 有拉丁 → en
         5. 否则 null
       关键在步骤 2 用"假名占 CJK 的比例"而非"占全部字符的比例"，
       这样中文里夹杂少量日语引用（如「絵コンテ」）不会被误判。
       ============================================================ */

    var KANA_MIN = 3
    var KANA_RATIO = 0.15

    function detectLang(text, sampleLen) {
        var sample = String(text || '').slice(0, sampleLen)

        var kana  = (sample.match(/[\u3040-\u30FF\uFF65-\uFF9F]/g) || []).length
        var han   = (sample.match(/[\u4E00-\u9FFF]/g) || []).length
        var latin = (sample.match(/[A-Za-z]/g) || []).length

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

    /* ============================================================
       从 entry 的 content HTML 中提取：
         - cover    : 第一张图的 src
         - fullText : 去掉标题/封面/首发说明后的正文纯文本
         - excerpt  : fullText 的前 N 字符
       ============================================================ */

    /* 各种语言的"本文首发"标记 */
    var BOILERPLATE_RE = /本文首发|最后编辑于|first published|Last edited|最初に公開|最終編集/i

    function extractContent(html, excerptLen) {
        try {
            var doc = new DOMParser().parseFromString(html, 'text/html')

            var imgEl = doc.querySelector('figure img, img')
            var cover = imgEl ? (imgEl.getAttribute('src') || '') : ''

            doc.querySelectorAll('h1, figure, script, style').forEach(function (el) {
                el.remove()
            })
            doc.querySelectorAll('blockquote').forEach(function (el) {
                if (BOILERPLATE_RE.test(el.textContent)) el.remove()
            })

            var fullText = (doc.body.textContent || '')
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

    /* ============================================================
       解析 Atom
       ============================================================ */

    function parseAtom(xml) {
        var doc = new DOMParser().parseFromString(xml, 'application/xml')
        if (doc.querySelector('parsererror')) throw new Error('XML parse error')

        var entries = [].slice.call(doc.querySelectorAll('entry'))
            .slice(0, CFG.blog.scanLimit)

        return entries.map(function (en) {
            var titleEl = en.querySelector('title')
            var linkEl = en.querySelector('link')
            var cEl = en.querySelector('content')
            var uEl = en.querySelector('updated')

            var title = titleEl ? titleEl.textContent.trim() : ''
            var link = linkEl ? linkEl.getAttribute('href') : '#'
            var raw = cEl ? cEl.textContent : ''
            var upd = uEl ? uEl.textContent : ''

            var info = extractContent(raw, CFG.blog.excerptLength)
            var lang = detectLang(info.fullText, CFG.blog.langSampleLength)

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

    /* ============================================================
       兜底
       ============================================================ */

    function getFallback(lang) {
        var map = CFG.fallbackPosts || {}
        return map[lang] || map['zh-Hans'] || []
    }

    /* ============================================================
       对外接口：loadPosts(lang) → Promise<Post[]>
       ============================================================ */

    F.loadPosts = function (lang) {
        lang = lang || 'zh-Hans'

        return fetch(CFG.feedUrl, { mode: 'cors', credentials: 'omit' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status)
                return res.text()
            })
            .then(function (text) {
                var all = parseAtom(text)

                var filtered = all.filter(function (p) {
                    return p.lang === lang
                })

                if (!filtered.length) {
                    throw new Error('no posts in ' + lang)
                }

                return filtered.slice(0, CFG.blog.postLimit)
            })
            .catch(function (err) {
                console.warn(
                    '[landing] Atom 拉取或过滤失败（' + lang + '），使用内嵌兜底：',
                    err.message
                )
                return getFallback(lang)
            })
    }
})()
