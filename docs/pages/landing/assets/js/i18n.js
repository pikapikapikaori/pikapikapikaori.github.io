/* ========================================================
 * 添加新语言只需改两处：
 * 1. 在 LANGUAGES 数组里加一项 { key, htmlLang, label }
 * 2. 在 DICT 里加一份对应 key 的翻译表
 * 菜单 DOM、<html lang>、显示名都会自动同步。
   ======================================================== */
(function () {
    'use strict'

    var App = window.App = window.App || {}
    var I = App.i18n = {}

    var KEY = 'pikapikapi:lang'

    /* 
     * ---------- 语言清单 ----------
     * key      —— 内部标识，同时用作 DICT 的键、data-lang 的值、存储值
     * htmlLang —— 写到 <html lang> 上的值（BCP 47）
     * label    —— 在菜单里显示的名字，始终用该语言自身的写法 
     */
    var LANGUAGES = [
        { key: 'zh-Hans', htmlLang: 'zh-Hans', label: '中文' },
        { key: 'en', htmlLang: 'en', label: 'English' },
        { key: 'ja', htmlLang: 'ja', label: '日本語' }
    ]

    /* 派生表：避免在逻辑里反复遍历 LANGUAGES */
    var SUPPORTED = LANGUAGES.map(function (l) { return l.key })

    var HTML_LANG = {}
    var LABELS = {}
    LANGUAGES.forEach(function (l) {
        HTML_LANG[l.key] = l.htmlLang || l.key
        LABELS[l.key] = l.label
    })

    /* ---------- 翻译表 ---------- */
    var DICT = {
        'zh-Hans': {
            'nav.blog': '博客',
            'nav.photo': '摄影',
            'nav.about': '关于',
            'hero.kicker': 'ピカピカピ',
            'hero.name': '李亦杨',
            'hero.tagline': 'Don\'t worry, be happy.',
            'hero.location': '上海',
            'hero.scroll': '继续',
            'quote.text': '式微，式微，胡不歸？微君之故，胡爲乎中露？\n式微，式微，胡不歸？微君之躬，胡爲乎泥中？',
            'quote.author': '《詩經·式微》',
            'shelf.blog.title': '博客',
            'shelf.photo.title': '摄影',
            'shelf.blog.hint': '文章',
            'shelf.photo.hint': '足迹 · 爱好',
            'shelf.prev': '上一篇',
            'shelf.next': '下一篇',
            'rail.blog.label': '文章',
            'theme.toggle': '切换主题',
            'lang.menu.label': '语言',
            'about.title': '关于',
            'about.p1': '我是李亦楊，写字、拍照，偶尔看很多动画。',
            'about.p2': '这里是我在互联网上的一小块地方，把散落各处的东西连起来。',
            'about.now': '最近在读旧书，也在整理上一季度的单集回顾。',
            'footer.feed': '订阅',
            'footer.email': '邮件',
            'footer.copyrightTitle': '李亦杨',
            'footer.copyrightInfo': '版权所有',
            'meta.title': 'ピカピカピ',
            'meta.desc': 'Don\'t worry, be happy.'
        },

        en: {
            'nav.blog': 'Blog',
            'nav.photo': 'Photography',
            'nav.about': 'About',
            'hero.kicker': 'ピカピカピ',
            'hero.name': 'Yi-Yang Li',
            'hero.tagline': 'Don\'t worry, be happy.',
            'hero.location': 'Shanghai',
            'hero.scroll': 'Continue',
            'quote.text': 'Still wouldst thou sing, and I have ears in vain\nTo thy high requiem become a sod.',
            'quote.author': 'John Keats, Ode to a Nightingale',
            'shelf.blog.title': 'Blog',
            'shelf.photo.title': 'Photography',
            'shelf.blog.hint': 'Posts',
            'shelf.photo.hint': 'Traces · Interests',
            'shelf.prev': 'Previous',
            'shelf.next': 'Next',
            'rail.blog.label': 'Posts',
            'theme.toggle': 'Theme',
            'lang.menu.label': 'Language',
            'about.title': 'About',
            'about.p1': 'I\'m 李亦楊 — I write, I take photographs, and I watch too much anime.',
            'about.p2': 'This page is a small corner of the internet, tying together the pieces scattered elsewhere.',
            'about.now': 'Currently reading old books, and catching up on last season\'s episode notes.',
            'footer.feed': 'Feed',
            'footer.email': 'Email',
            'footer.copyrightTitle': 'Yi-Yang Li',
            'footer.copyrightInfo': 'All rights reserved.',
            'meta.title': 'ピカピカピ',
            'meta.desc': 'Don\'t worry, be happy.'
        },

        ja: {
            'nav.blog': 'ブログ',
            'nav.photo': '写真',
            'nav.about': '情報',
            'hero.kicker': 'ピカピカピ',
            'hero.name': '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
            'hero.tagline': 'Don\'t worry, be happy.',
            'hero.location': '上海',
            'hero.scroll': 'つつき',
            'quote.text': 'ひるもなほ\n星みるひとの\n目にも似る\nさびしきつかれ\n早春のたび',
            'quote.author': '宮沢賢治',
            'shelf.blog.title': 'ブログ',
            'shelf.photo.title': '写真',
            'shelf.blog.hint': '文章',
            'shelf.photo.hint': '足跡・興味',
            'shelf.prev': '前へ',
            'shelf.next': '次へ',
            'rail.blog.label': '文章',
            'theme.toggle': 'テーマ',
            'lang.menu.label': '言語',
            'about.title': '情報',
            'about.p1': '李亦楊です。書いたり、撮ったり、アニメをたくさん観たりしています。',
            'about.p2': 'ここは、あちこちに散らばったものを一つにつなぐための、小さな場所です。',
            'about.now': '最近は古い本を読みつつ、前クールの感想をまとめています。',
            'footer.feed': '購読',
            'footer.email': 'メール',
            'footer.copyrightTitle': '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
            'footer.copyrightInfo': '無断転載を禁じます',
            'meta.title': 'ピカピカピ',
            'meta.desc': 'Don\'t worry, be happy.'
        }
    }

    var current = null
    var listeners = []

    /* ---------- 存储与推断 ---------- */

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

    /* ---------- 应用语言 ---------- */

    function apply(lang) {
        if (SUPPORTED.indexOf(lang) === -1) lang = 'en'
        current = lang

        document.documentElement.lang = HTML_LANG[lang] || lang
        document.documentElement.setAttribute('data-lang', lang)

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

        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            var v = d[el.dataset.i18nHtml]
            if (v != null) el.innerHTML = v
        })

        document.title = d['meta.title']
        var md = document.querySelector('meta[name="description"]')
        if (md) md.setAttribute('content', d['meta.desc'])

        syncPicker()
        writeSaved(lang)

        listeners.forEach(function (fn) {
            try { fn(lang) } catch (e) { console.warn(e) }
        })
    }

    /* ---------- 语言选择器 ---------- */

    var picker, trigger, menu, options = []

    function buildMenu() {
        menu.innerHTML = ''
        LANGUAGES.forEach(function (lang) {
            var li = document.createElement('li')
            li.className = 'lang-option'
            li.setAttribute('role', 'option')
            li.setAttribute('tabindex', '-1')
            li.setAttribute('aria-selected', 'false')
            li.dataset.lang = lang.key
            li.textContent = lang.label
            menu.appendChild(li)
        })
        options = [].slice.call(menu.querySelectorAll('.lang-option'))
    }

    function syncPicker() {
        if (!trigger || !menu) return

        var cur = document.getElementById('langCurrent')
        if (cur) cur.textContent = LABELS[current] || current

        options.forEach(function (opt) {
            var on = opt.dataset.lang === current
            opt.setAttribute('aria-selected', on ? 'true' : 'false')
        })
    }

    function isOpen() {
        return !!(menu && menu.classList.contains('open'))
    }

    function openPicker() {
        menu.classList.add('open')
        trigger.setAttribute('aria-expanded', 'true')

        var idx = SUPPORTED.indexOf(current)
        var target = options[idx] || options[0]
        if (target) target.focus()
    }

    function closePicker(focusBack) {
        menu.classList.remove('open')
        trigger.setAttribute('aria-expanded', 'false')
        if (focusBack) trigger.focus()
    }

    function initPicker() {
        picker = document.getElementById('langPicker')
        trigger = document.getElementById('langTrigger')
        menu = document.getElementById('langMenu')
        if (!picker || !trigger || !menu) return

        buildMenu()

        trigger.addEventListener('click', function (e) {
            e.stopPropagation()
            if (isOpen()) closePicker(); else openPicker()
        })

        trigger.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                openPicker()
            }
        })

        menu.addEventListener('click', function (e) {
            var opt = e.target.closest('.lang-option')
            if (!opt) return
            apply(opt.dataset.lang)
            closePicker(true)
        })

        menu.addEventListener('keydown', function (e) {
            var i = options.indexOf(document.activeElement)

            if (e.key === 'Escape') {
                e.preventDefault()
                closePicker(true)

            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                options[(i + 1) % options.length].focus()

            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                options[(i - 1 + options.length) % options.length].focus()

            } else if (e.key === 'Home') {
                e.preventDefault()
                options[0].focus()

            } else if (e.key === 'End') {
                e.preventDefault()
                options[options.length - 1].focus()

            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (i >= 0) {
                    apply(options[i].dataset.lang)
                    closePicker(true)
                }

            } else if (e.key === 'Tab') {
                closePicker()
            }
        })

        document.addEventListener('click', function (e) {
            if (!isOpen()) return
            if (picker.contains(e.target)) return
            closePicker()
        })
    }

    I.init = function () {
        initPicker()
        apply(readSaved() || guess())
    }

    I.set = apply
    I.get = function () { return current }
    I.onChange = function (fn) { listeners.push(fn) }

    /* 暴露语言清单，方便外部（比如未来的 hreflang 生成）使用 */
    I.languages = LANGUAGES
})()
