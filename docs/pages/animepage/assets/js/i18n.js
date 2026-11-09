/* 
 * 多语言
 *
 * 初始语言顺序：?lang= → 本地存储 → 浏览器语言。
 * 带 data-lang 的链接点击后直接切换，不刷新页面。
 * 文字只写在词典里，页面用 data-i18n、data-i18n-html、data-i18n-attr 标记。
 */
(function () {
    'use strict'

    var App = window.App = window.App || {}

    var STORAGE_KEY = 'pikapikapi:lang:animepage'

    /* 
     * key      —— 内部标识，同时用作词典的键、data-lang 的值、存储值与 ?lang= 的值
     * htmlLang —— 写到 <html lang> 上的值
     * label    —— 语言入口显示的名字，始终用该语言自身的写法
     */
    var LANGUAGES = [
        { key: 'zh-Hant', htmlLang: 'zh-Hant', label: '中文' },
        { key: 'en', htmlLang: 'en', label: 'English' },
        { key: 'ja', htmlLang: 'ja', label: '日本語' }
    ]

    var SUPPORTED = LANGUAGES.map(function (lang) { return lang.key })

    var HTML_LANG = {}
    var LABELS = {}

    LANGUAGES.forEach(function (lang) {
        HTML_LANG[lang.key] = lang.htmlLang || lang.key
        LABELS[lang.key] = lang.label
    })

    /* 三种语言完全相同的文字，不必在每份词典里重复 */
    var COMMON = {
        'meta.title': 'ピカピカピ',
        'intro.slogan': 'Don\'t worry,<br>be happy.',
        'link.github': 'Github'
    }

    var DICT = {
        'zh-Hant': {
            'lang.title': '語言',
            'intro.quote': '式微，式微，胡不歸？微君之故，胡爲乎中露？<br>式微，式微，胡不歸？微君之躬，胡爲乎泥中？<br>—— 《詩經·式微》',
            'intro.photo': '歡迎訪問我的攝影主頁。',
            'intro.dream': '想成為一個愛智慧、愛美的人。',
            'intro.name': '李亦楊',
            'link.blog': '博客',
            'link.blog.href': '../../#/',
            'link.email': '電子郵箱',
            'footer.copyright': '&copy; 2023 - {year} 李亦楊 - All Rights Reserved.'
        },

        en: {
            'lang.title': 'Language',
            'intro.quote': 'Now more than ever seems it rich to die,<br>To cease upon the midnight with no pain,<br>While thou art pouring forth thy soul abroad.<br>In such an ecstasy!<br>Still wouldst thou sing, and I have ears in vain --<br>To thy high requiem become a sod.<br>— John Keats, "Ode to a Nightingale"',
            'intro.photo': 'Welcome to my photography page.',
            'intro.dream': 'Dream of becoming a person who holds love for wisdom and beauty.',
            'intro.name': 'Yi-Yang Li',
            'link.blog': 'Blog',
            'link.blog.href': '../../#/en-us/',
            'link.email': 'Email',
            'footer.copyright': '&copy; 2023 - {year} Yi-Yang Li - All Rights Reserved.'
        },

        ja: {
            'lang.title': '言語',
            'intro.quote': 'ひるもなほ<br>星みるひとの<br>目にも似る<br>さびしきつかれ<br>早春のたび<br>—— 宮沢賢治',
            'intro.photo': '私の写真サイトへようこそ。',
            'intro.dream': '知恵と美への愛を持つ人になりたいです。',
            'intro.name': '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
            'link.blog': 'ブログ',
            'link.blog.href': '../../#/jp/',
            'link.email': 'メール',
            'footer.copyright': '&copy; 2023 - {year} <ruby>李亦楊<rt>リエキヨウ</rt></ruby> - All Rights Reserved.'
        }
    }

    var current = null
    var listeners = []

    function readSaved() {
        try { return localStorage.getItem(STORAGE_KEY) } catch (e) { return null }
    }

    function writeSaved(value) {
        try { localStorage.setItem(STORAGE_KEY, value) } catch (e) { /* 忽略：隐私模式下不可写 */ }
    }

    function guess() {
        var nav = (navigator.language || 'en').toLowerCase()

        if (nav.indexOf('zh') === 0) return 'zh-Hant'
        if (nav.indexOf('ja') === 0) return 'ja'

        return 'en'
    }

    function readUrlLang() {
        try {
            var value = new URLSearchParams(window.location.search).get('lang')

            if (value && SUPPORTED.indexOf(value) !== -1) return value
        } catch (e) { /* 忽略 */ }

        return null
    }

    function syncUrl(lang) {
        try {
            var url = new URL(window.location.href)

            url.searchParams.set('lang', lang)
            window.history.replaceState(null, '', url.toString())
        } catch (e) { /* 忽略：file:// 下会抛错 */ }
    }

    function resolveLang() {
        var fromUrl = readUrlLang()

        if (fromUrl) {
            writeSaved(fromUrl)
            return fromUrl
        }

        return readSaved() || guess()
    }

    /* 先查当前语言词典，再查共用表 */
    function text(dict, key) {
        if (dict[key] != null) return dict[key]

        return COMMON[key]
    }

    function withYear(value) {
        return value.replace(/\{year\}/g, String(new Date().getFullYear()))
    }

    function fillAttrs(el, dict) {
        el.dataset.i18nAttr.split(',').forEach(function (pair) {
            var parts = pair.split(':')
            var value = text(dict, parts[1].trim())

            if (value != null) el.setAttribute(parts[0].trim(), value)
        })
    }

    function syncEntries() {
        document.querySelectorAll('a[data-lang]').forEach(function (el) {
            var on = el.dataset.lang === current

            el.textContent = LABELS[el.dataset.lang] || el.dataset.lang
            el.classList.toggle('is-current', on)
            if (on) el.setAttribute('aria-current', 'true')
            else el.removeAttribute('aria-current')
        })
    }

    function apply(lang) {
        if (SUPPORTED.indexOf(lang) === -1) lang = 'en'

        current = lang

        var dict = DICT[lang]
        var root = document.documentElement

        root.lang = HTML_LANG[lang] || lang
        root.setAttribute('data-lang', lang)

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var value = text(dict, el.dataset.i18n)

            if (value != null) el.textContent = value
        })

        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            var value = text(dict, el.dataset.i18nHtml)

            if (value != null) el.innerHTML = withYear(value)
        })

        document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
            fillAttrs(el, dict)
        })

        var title = text(dict, 'meta.title')

        if (title) document.title = title

        var description = text(dict, 'meta.description')

        if (description) {
            var metaDescription = document.querySelector('meta[name="description"]')

            if (metaDescription) metaDescription.setAttribute('content', description)
        }

        var keywords = text(dict, 'meta.keywords')

        if (keywords) {
            var metaKeywords = document.querySelector('meta[name="keywords"]')

            if (metaKeywords) metaKeywords.setAttribute('content', keywords)
        }

        syncUrl(lang)
        syncEntries()
        writeSaved(lang)

        listeners.forEach(function (fn) {
            try { fn(lang) } catch (e) { /* 忽略单个监听器的错误 */ }
        })
    }

    function bindEntries() {
        document.querySelectorAll('a[data-lang]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return

                e.preventDefault()
                e.stopPropagation()
                apply(el.dataset.lang)
            })
        })
    }

    App.i18n = {
        set: apply,
        get: function () { return current },
        onChange: function (fn) { listeners.push(fn) },
        t: function (key) {
            return DICT[current] ? text(DICT[current], key) : undefined
        },
        list: function (key) {
            var value = DICT[current] ? DICT[current][key] : null

            return Array.isArray(value) ? value : null
        },
        init: function () {
            bindEntries()
            apply(resolveLang())
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', App.i18n.init)
    } else {
        App.i18n.init()
    }
})()
