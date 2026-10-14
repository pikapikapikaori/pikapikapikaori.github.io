(function () {
    'use strict'

    var App = window.App = window.App || {}
    var F = App.feed = {}
    var CFG = App.config

    /* 从 entry 的 content HTML 中提取封面图和正文摘要 */
    function extractSummary(html, len) {
        try {
            var doc = new DOMParser().parseFromString(html, 'text/html')

            var imgEl = doc.querySelector('figure img, img')
            var cover = imgEl ? (imgEl.getAttribute('src') || '') : ''

            /* 移除标题、图片、脚本、样式之类的引用块 */
            doc.querySelectorAll('h1, figure, script, style').forEach(function (el) {
                el.remove()
            })
            doc.querySelectorAll('blockquote').forEach(function (el) {
                if (/本文首发|最后编辑于/.test(el.textContent)) el.remove()
            })

            var text = (doc.body.textContent || '')
                .replace(/\{docsify-[a-z-]+\}/gi, '')
                .replace(/\s+/g, ' ')
                .trim()

            return { cover: cover, excerpt: text.slice(0, len) }
        } catch (e) {
            return { cover: '', excerpt: '' }
        }
    }

    function parseAtom(xml) {
        var doc = new DOMParser().parseFromString(xml, 'application/xml')
        if (doc.querySelector('parsererror')) throw new Error('XML parse error')

        return [].slice.call(doc.querySelectorAll('entry'))
            .slice(0, CFG.blog.postLimit)
            .map(function (en) {
                var titleEl = en.querySelector('title')
                var linkEl = en.querySelector('link')
                var cEl = en.querySelector('content')
                var uEl = en.querySelector('updated')

                var title = titleEl ? titleEl.textContent.trim() : ''
                var link = linkEl ? linkEl.getAttribute('href') : '#'
                var raw = cEl ? cEl.textContent : ''
                var upd = uEl ? uEl.textContent : ''
                var s = extractSummary(raw, CFG.blog.excerptLength)

                return {
                    title: title,
                    link: link,
                    cover: s.cover,
                    excerpt: s.excerpt,
                    date: upd.slice(0, 10).replace(/-/g, '.')
                }
            })
            .filter(function (p) { return p.title })
    }

    /* 返回 Promise<Post[]> */
    F.loadPosts = function () {
        return fetch(CFG.feedUrl, { mode: 'cors', credentials: 'omit' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status)
                return res.text()
            })
            .then(function (text) {
                var posts = parseAtom(text)
                if (!posts.length) throw new Error('empty feed')
                return posts
            })
            .catch(function (err) {
                console.warn('[landing] Atom 拉取失败，使用内嵌兜底：', err.message)
                return CFG.fallbackPosts
            })
    }
})()
