/* ========================================================
   i18n.js —— 多语言
   添加新语言：在 DICT 里加一项，把 key 加入 SUPPORTED，
   再在 index.html 的 <select> 里加一个 <option> 即可。
   ======================================================== */
(function () {
    'use strict'

    var App = window.App = window.App || {}
    var I = App.i18n = {}

    var KEY = 'pikapikapi:lang'
    var SUPPORTED = ['zh-Hans', 'en', 'ja']

    var DICT = {
        'zh-Hans': {
            'nav.blog': '博客',
            'nav.photo': '摄影',
            'nav.about': '关于',
            'hero.location': '上海',
            'hero.scroll': '向下',
            'quote.text': '露水的世，虽然是露水的世，虽然是如此。',
            'quote.author': '小林一茶',
            'shelf.blog.title': '博客',
            'shelf.photo.title': '摄影',
            'shelf.blog.hint': '继续滚动 · 浏览',
            'shelf.photo.hint': '继续滚动 · 展开',
            'shelf.prev': '上一组',
            'shelf.next': '下一组',
            'about.title': '关于',
            'about.p1': '我是李亦楊，写字、拍照，偶尔看很多动画。',
            'about.p2': '这里是我在互联网上的一小块地方，把散落各处的东西连起来。',
            'about.now': '最近在读旧书，也在整理上一季度的单集回顾。',
            'footer.rss': 'Atom',
            'footer.email': '邮件',
            'meta.title': 'ピカピカピ',
            'meta.desc': 'Don\'t worry, be happy.'
        },

        en: {
            'nav.blog': 'Blog',
            'nav.photo': 'Photography',
            'nav.about': 'About',
            'hero.location': 'Shanghai',
            'hero.scroll': 'Scroll',
            'quote.text': 'This world of dew is a world of dew — and yet, and yet…',
            'quote.author': 'Kobayashi Issa',
            'shelf.blog.title': 'Blog',
            'shelf.photo.title': 'Photography',
            'shelf.blog.hint': 'Keep scrolling',
            'shelf.photo.hint': 'Keep scrolling · Unfold',
            'shelf.prev': 'Previous',
            'shelf.next': 'Next',
            'about.title': 'About',
            'about.p1': 'I\'m 李亦楊 — I write, I take photographs, and I watch too much anime.',
            'about.p2': 'This page is a small corner of the internet, tying together the pieces scattered elsewhere.',
            'about.now': 'Currently reading old books, and catching up on last season\'s episode notes.',
            'footer.rss': 'Atom',
            'footer.email': 'Email',
            'meta.title': 'ピカピカピ',
            'meta.desc': 'Don\'t worry, be happy.'
        },

        ja: {
            'nav.blog': 'ブログ',
            'nav.photo': '写真',
            'nav.about': 'について',
            'hero.location': '上海',
            'hero.scroll': 'スクロール',
            'quote.text': '露の世は　露の世ながら　さりながら。',
            'quote.author': '小林一茶',
            'shelf.blog.title': 'ブログ',
            'shelf.photo.title': '写真',
            'shelf.blog.hint': 'スクロールして見る',
            'shelf.photo.hint': 'スクロールして開く',
            'shelf.prev': '前へ',
            'shelf.next': '次へ',
            'about.title': 'について',
            'about.p1': '李亦楊です。書いたり、撮ったり、アニメをたくさん観たりしています。',
            'about.p2': 'ここは、あちこちに散らばったものを一つにつなぐための、小さな場所です。',
            'about.now': '最近は古い本を読みつつ、前クールの感想をまとめています。',
            'footer.rss': 'Atom',
            'footer.email': 'メール',
            'meta.title': 'ピカピカピ',
            'meta.desc': 'Don\'t worry, be happy.'
        }
    }

    var current = null
    var listeners = []

    function readSaved() {
        try { return localStorage.getItem(KEY) } catch (e) { return null }
    }
    function writeSaved(v) {
        try { localStorage.setItem(KEY, v) } catch (e) { /* ignore */ }
    }
    function guess() {
        var nav = (navigator.language || 'en').toLowerCase()
        if (nav.indexOf('zh') === 0) return 'zh-Hans'
        if (nav.indexOf('ja') === 0) return 'ja'
        return 'en'
    }

    function apply(lang) {
        if (SUPPORTED.indexOf(lang) === -1) lang = 'en'
        current = lang
        document.documentElement.lang = lang
        var d = DICT[lang]

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var v = d[el.dataset.i18n]
            if (v != null) el.textContent = v
        })
        document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
            var parts = el.dataset.i18nAttr.split(':')
            var v = d[parts[1]]
            if (v != null) el.setAttribute(parts[0], v)
        })

        document.title = d['meta.title']
        var md = document.querySelector('meta[name="description"]')
        if (md) md.setAttribute('content', d['meta.desc'])

        var sel = document.getElementById('langSelect')
        if (sel) sel.value = lang

        writeSaved(lang)

        listeners.forEach(function (fn) {
            try { fn(lang) } catch (e) { console.warn(e) }
        })
    }

    I.init = function () {
        apply(readSaved() || guess())
        var sel = document.getElementById('langSelect')
        if (sel) {
            sel.addEventListener('change', function (e) {
                apply(e.target.value)
            })
        }
    }

    I.set = apply
    I.get = function () { return current }
    I.onChange = function (fn) { listeners.push(fn) }
})()
