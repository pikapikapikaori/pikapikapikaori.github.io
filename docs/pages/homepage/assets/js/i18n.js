(function () {
    'use strict'

    const App = window.App = window.App || {}
    const I = App.i18n = {}

    const STORAGE = App.storage
    const LANG_NAME = STORAGE.NAMES.lang

    const LANGUAGES = [
        { key: 'zh-Hans', htmlLang: 'zh-Hans', label: '中文' },
        { key: 'en', htmlLang: 'en', label: 'English' },
        { key: 'ja', htmlLang: 'ja', label: '日本語' }
    ]

    const ALIASES = {
        'zh-Hant': 'zh-Hans'
    }

    const PHOTO_CAPTION_PREFIX = 'photo.caption.'

    const SUPPORTED = LANGUAGES.map(function (lang) { return lang.key })
    const HTML_LANG = {}
    const LABELS = {}

    LANGUAGES.forEach(function (lang) {
        HTML_LANG[lang.key] = lang.htmlLang || lang.key
        LABELS[lang.key] = lang.label
    })

    const COMMON = {
        'meta.title': 'ピカピカピ',
        'common.motto': 'Mihi vivam quod superest aevi, si quid superesse volunt di.',
        'common.layout.brand': 'Brand',
        'common.layout.mondrian': 'Mondrian',
        'common.layout.starTrail': 'Star Trail',
        'common.layout.photography': 'Photography',
        'common.feed.href': '../../assets/resources/meta/feed.atom'
    }

    const DICT = {
        'zh-Hans': {
            'meta.description': 'Don\'t worry, be happy.',
            'control.language': '语言',
            'control.language.unselected': '未选择语言',
            'control.layout': '布局',
            'layout.unselected': '未选择布局',
            'control.theme': '主题',
            'theme.light': '亮色',
            'theme.dark': '暗色',
            'theme.system': '跟随系统',
            'control.theme.current': '当前主题',
            'control.theme.next': '切换到',
            'layout.loadFailed': '页面加载失败，请刷新后重试。',
            'common.name': '李亦杨',
            'common.tagline': 'Don\'t worry, be happy.',
            'common.kicker': 'ピカピカピ',
            'common.aboutTitle': '关于<span>我</span>',
            'common.about.p1': '欢迎访问我的个人主页。',
            'common.about.p2': '想成为一个爱智慧、爱美的人。',
            'common.quote.title': '《诗经·式微》',
            'common.quote.text': '式微，式微，胡不归？微君之故，胡为乎中露？<br>式微，式微，胡不归？微君之躬，胡为乎泥中？',
            'common.blog.label': '博客',
            'common.feed.label': '订阅',
            'common.email.label': '邮件',
            'common.photo.label': '摄影',
            'common.blog.hint': '文章',
            'common.photo.hint': '足迹',
            'common.lightbox.aria': '照片预览',
            'common.lightbox.close': '关闭',
            'common.lightbox.source': '查看原图',
            'common.untitled': '未命名',
            'common.avatarAlt': '头像',
            'common.carousel.prev': '上一篇',
            'common.carousel.next': '下一篇',
            'common.carousel.label': '文章',
            'common.main.aria': '个人主页',
            'common.blog.href': '../../#/',
            'photography.links.aria': '站点链接',
            'common.flip.open': '点击翻转查看详情',
            'common.flip.close': '点击收起详情',
            'common.footer.copyright': '&copy; {years} 李亦杨 - 版权所有',
            'common.slogans': [
                '古来圣贤皆寂寞<br>惟有饮者留其名',
                '归去来兮<br>田园将芜胡不归',
                '世事漫随流水<br>算来梦里浮生<br>醉乡路稳宜频到<br>此外不堪行',
                '唯愿当歌对酒时<br>月光长照金樽里',
                '东船西舫悄无言<br>唯见江心秋月白',
                '酒旗戏鼓甚处市<br>想依稀<br>王谢邻里',
                '问君何能尔<br>心远地自偏'
            ],
            'common.scroll': '继续'
        },

        en: {
            'meta.description': 'Don\'t worry, be happy.',
            'control.language': 'Language',
            'control.language.unselected': 'No language selected',
            'control.layout': 'Layout',
            'layout.unselected': 'No layout selected',
            'control.theme': 'Theme',
            'theme.light': 'Light',
            'theme.dark': 'Dark',
            'theme.system': 'System',
            'control.theme.current': 'Current theme',
            'control.theme.next': 'switch to',
            'layout.loadFailed': 'Page failed to load. Reload to try again.',
            'common.name': 'Yi-Yang Li',
            'common.tagline': 'Don\'t worry, be happy.',
            'common.kicker': 'ピカピカピ',
            'common.aboutTitle': 'About <span>Me</span>',
            'common.about.p1': 'Welcome to my personal page.',
            'common.about.p2': 'Dream of becoming a person who holds love for wisdom and beauty.',
            'common.quote.title': 'Ode to a Nightingale',
            'common.quote.text': 'Still wouldst thou sing, and I have ears in vain<br>To thy high requiem become a sod.',
            'common.blog.label': 'Blog',
            'common.feed.label': 'Feed',
            'common.email.label': 'Email',
            'common.photo.label': 'Photography',
            'common.blog.hint': 'Posts',
            'common.photo.hint': 'Traces',
            'common.lightbox.aria': 'Photo viewer',
            'common.lightbox.close': 'Close',
            'common.lightbox.source': 'View photo',
            'common.untitled': 'Untitled',
            'common.avatarAlt': 'Avatar',
            'common.carousel.prev': 'Previous',
            'common.carousel.next': 'Next',
            'common.carousel.label': 'Posts',
            'common.main.aria': 'Main page',
            'common.blog.href': '../../#/en-us/',
            'photography.links.aria': 'Site links',
            'common.flip.open': 'Click to flip for details',
            'common.flip.close': 'Click to collapse details',
            'common.footer.copyright': '&copy; {years} Yi-Yang Li - All Rights Reserved.',
            'common.slogans': [
                'Don\'t worry<br>Be happy'
            ],
            'common.scroll': 'Continue'
        },

        ja: {
            'meta.description': 'Don\'t worry, be happy.',
            'control.language': '言語',
            'control.language.unselected': '言語未選択',
            'control.layout': 'レイアウト',
            'layout.unselected': 'レイアウト未選択',
            'control.theme': 'テーマ',
            'theme.light': '明るい',
            'theme.dark': '暗い',
            'theme.system': 'システムに従う',
            'control.theme.current': '現在のテーマ',
            'control.theme.next': '次のテーマ',
            'layout.loadFailed': 'ページを読み込めませんでした。再読み込みしてください。',
            'common.name': '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
            'common.tagline': 'Don\'t worry, be happy.',
            'common.kicker': 'ピカピカピ',
            'common.aboutTitle': '私<span>について</span>',
            'common.about.p1': '私の個人サイトへようこそ。',
            'common.about.p2': '知恵と美への愛を持つ人になりたいです。',
            'common.quote.title': '宮沢賢治',
            'common.quote.text': 'ひるもなほ<br>星みるひとの<br>目にも似る<br>さびしきつかれ<br>早春のたび',
            'common.blog.label': 'ブログ',
            'common.feed.label': 'フィード',
            'common.email.label': 'メール',
            'common.photo.label': '写真',
            'common.blog.hint': '文章',
            'common.photo.hint': '足跡',
            'common.lightbox.aria': '写真の表示',
            'common.lightbox.close': '閉じる',
            'common.lightbox.source': '元の写真を見る',
            'common.untitled': '無題',
            'common.avatarAlt': 'アバター',
            'common.carousel.prev': '前へ',
            'common.carousel.next': '次へ',
            'common.carousel.label': '文章',
            'common.main.aria': 'メインページ',
            'common.blog.href': '../../#/jp/',
            'photography.links.aria': 'サイトリンク',
            'common.flip.open': 'クリックして詳細を表示',
            'common.flip.close': 'クリックして閉じる',
            'common.footer.copyright': '&copy; {years} <ruby>李亦楊<rt>リエキヨウ</rt></ruby> - 無断転載を禁じます',
            'common.slogans': [
                '悲しみが終わらないのは<br>私達の力が足りないから',
                '憎しみが消えないのは<br>私達の愛がまだ足りないから'
            ],
            'common.scroll': 'つづき'
        }
    }

    let current = null
    const listeners = []

    function normalize(lang) {
        if (ALIASES[lang]) return ALIASES[lang]
        return SUPPORTED.indexOf(lang) === -1 ? null : lang
    }

    function guess() {
        const nav = (navigator.language || 'en').toLowerCase()

        if (nav.indexOf('zh') === 0) return 'zh-Hans'
        if (nav.indexOf('ja') === 0) return 'ja'

        return 'en'
    }

    function readUrlLang() {
        try {
            const value = new URLSearchParams(window.location.search).get('lang')
            return normalize(value)
        } catch (e) {}

        return null
    }

    function syncUrl(lang) {
        try {
            const url = new URL(window.location.href)
            url.searchParams.set('lang', lang)
            window.history.replaceState(null, '', url.toString())
        } catch (e) {   }
    }

    function resolveLang() {
        const fromUrl = readUrlLang()

        if (fromUrl) {
            STORAGE.set(LANG_NAME, fromUrl)
            return fromUrl
        }

        return normalize(STORAGE.get(LANG_NAME)) || guess()
    }

    function text(dict, key) {
        if (dict[key] != null) return dict[key]
        return COMMON[key]
    }

    function copyrightYears() {
        const now = new Date().getFullYear()
        const start = Number(App.config && App.config.startYear)

        if (!isFinite(start) || start <= 0 || start > now) return String(now)
        return now > start ? start + '-' + now : String(start)
    }

    function withYear(value) {
        return String(value)
            .replace(/\{years\}/g, copyrightYears())
            .replace(/\{year\}/g, String(new Date().getFullYear()))
    }

    function fillAttrs(el, dict) {
        el.dataset.i18nAttr.split(',').forEach(function (pair) {
            const parts = pair.split(':')
            const value = text(dict, parts[1].trim())

            if (value != null && !Array.isArray(value)) {
                el.setAttribute(parts[0].trim(), withYear(value))
            }
        })
    }

    function fillHref(el, dict) {
        const value = text(dict, el.dataset.i18nAttrHref)

        if (value != null && !Array.isArray(value)) {
            el.setAttribute('href', value)
        }
    }

    function render() {
        if (!current) return

        const dict = DICT[current]
        const root = document.documentElement

        root.lang = HTML_LANG[current] || current
        root.setAttribute('data-lang', current)

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            const value = text(dict, el.dataset.i18n)

            if (value != null && !Array.isArray(value)) {
                el.textContent = withYear(value)
            }
        })

        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            const value = text(dict, el.dataset.i18nHtml)

            if (value != null && !Array.isArray(value)) {
                el.innerHTML = withYear(value)
            }
        })

        document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
            fillAttrs(el, dict)
        })

        document.querySelectorAll('[data-i18n-attr-href]').forEach(function (el) {
            fillHref(el, dict)
        })

        const title = text(dict, 'meta.title')
        if (title) document.title = title

        const description = text(dict, 'meta.description')
        if (description) {
            const metaDescription = document.querySelector('meta[name="description"]')
            if (metaDescription) metaDescription.setAttribute('content', description)
        }
    }

    function apply(lang, initial) {
        current = normalize(lang) || 'en'

        render()
        syncUrl(current)
        STORAGE.set(LANG_NAME, current)

        if (!initial) App.utils.scrollToTopInstant()

        listeners.slice().forEach(function (fn) {
            try { fn(current) } catch (e) {}
        })
    }

    I.init = function () {
        apply(resolveLang(), true)
    }

    I.set = apply
    I.get = function () { return current }
    I.refresh = render
    I.t = function (key) {
        const value = DICT[current] ? text(DICT[current], key) : undefined

        if (value != null) return value

        const table = App.photoCaptions && App.photoCaptions[current]
        if (table && key.indexOf(PHOTO_CAPTION_PREFIX) === 0) {
            return table[key.slice(PHOTO_CAPTION_PREFIX.length)]
        }

        return value
    }
    I.list = function (key) {
        const value = DICT[current] ? DICT[current][key] : null
        return Array.isArray(value) ? value : null
    }
    I.languages = SUPPORTED.slice()
    I.label = function (lang) { return LABELS[lang] || lang }
    I.onChange = function (fn) {
        listeners.push(fn)

        return function () {
            const i = listeners.indexOf(fn)
            if (i !== -1) listeners.splice(i, 1)
        }
    }
})()
