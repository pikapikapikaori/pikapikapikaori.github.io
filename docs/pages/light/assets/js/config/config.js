(function () {
    const lightLocales = ['en-us', 'jp']

    const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const ordinalSuffix = day => {
        if (day > 3 && day < 21) return 'th'

        switch (day % 10) {
            case 1: return 'st'
            case 2: return 'nd'
            case 3: return 'rd'
            default: return 'th'
        }
    }

    const localePattern = lightLocales.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

    window.$docsify = {
        name: 'ピカピカピ',
        basePath: '../../',
        coverpage: false,
        hideSidebar: true,
        loadNavbar: true,
        subMaxLevel: 2,
        auto2top: true,

        alias: {
            '/': '/pages/light/helpers/',
            [`/.*(${localePattern})/`]: function (path) {
                const locale = lightLocales.find(l => path.includes(l))
                return '/pages/light/helpers/' + locale + '/'
            },
            '/.*_navbar\\.md$': function (path) {
                const locale = lightLocales.find(l => path.includes(l))
                return locale ? '/pages/light/helpers/' + locale + '/_navbar.md' : '/pages/light/helpers/_navbar.md'
            },
            '/.*About': function (path) {
                if (path.startsWith('/pages/light/helpers/')) {
                    return path
                }
                return '/pages/light/helpers/' + path.replace(/^\//, '')
            }
        },

        notFoundPage: {
            '/jp': 'jp/404/_404.md',
            '/en-us': 'en-us/404/_404.md',
            '/': '404/_404.md'
        },

        // tab 插件设置
        tabs: {
            persist: false,
            sync: false,
            theme: 'material',
            tabComments: true,
            tabHeadings: true
        },

        // 自用插件
        tocPage: {
            enable: true,
            recentAmount: 16,
            renderStyle: 'list',
            localPath: lightLocales,
            coverPath: ['/', ...lightLocales.map(locale => '/' + locale + '/')],
            dateFormat: {
                default: (m, d) => `${m} 月 ${d} 日`,
                '/jp/': (m, d) => `${m} 月 ${d} 日`,
                '/en-us/': (m, d) => `${enMonths[m - 1]} ${d}${ordinalSuffix(d)}`
            }
        },

        fixUrl: {
            enable: true,
            prefix: '../../'
        },

        interceptImg: {
            enable: true
        },

        commentWithFooter: {
            enable: true,
            use: null,
            footerInnerHtml: '<small>&copy; 2023 - {comment_footer-yyyy}{comment_footer-divider}{comment_footer-info}{comment_footer-divider}{comment_footer-copy}</small>',
            localization: {
                info: {
                    '/en-us/': 'Yi-Yang Li',
                    '/jp/': '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
                    default: '李亦杨'
                },
                copy: {
                    '/en-us/': 'All Rights Reserved.',
                    '/jp/': '無断転載を禁じます',
                    default: '版权所有'
                },
                divider: {
                    '/en-us/': ' · ',
                    '/jp/': ' ・ ',
                    default: ' · '
                }
            }
        },

        htmlLang: {
            enable: true,
            localization: {
                lang: {
                    '/jp/': 'ja',
                    '/en-us/': 'en',
                    default: 'zh-Hans'
                }
            }
        },

        htmlReplace: {
            enable: true,
            links: {
                github: 'https://github.com/pikapikapikaori/',
                email: 'mailto:Lyy8759@outlook.com',
                feed: './assets/resources/meta/feed.atom'
            },
            tags: [
                /* Footnote */
                {
                    type: 'block',
                    tag: 'footnote',
                    startHtml: '<div class="footnote-div">',
                    endHtml: '</div>'
                },
                {
                    type: 'inline',
                    tag: 'footnote-num',
                    startHtml: '<sup class="footnote-num-sup">',
                    endHtml: '</sup>'
                },

                /* Multiple Image Container */
                {
                    type: 'block',
                    tag: 'multi-img-wrap',
                    startHtml: '<section class="multi-images-container-section">',
                    endHtml: '</section>'
                },

                /* Poem Container */
                {
                    type: 'block',
                    tag: 'poem-wrap',
                    startHtml: '<div><div class="writing-direction-vertical-div writing-direction-vertical-rtl-div poem-div">',
                    endHtml: '</div></div>'
                },

                /* Writing Direction */
                {
                    type: 'block',
                    tag: 'vertical-ltr-wrap',
                    startHtml: '<div><div class="writing-direction-vertical-div writing-direction-vertical-ltr-div">',
                    endHtml: '</div></div>'
                },
                {
                    type: 'block',
                    tag: 'vertical-rtl-wrap',
                    startHtml: '<div><div class="writing-direction-vertical-div writing-direction-vertical-rtl-div">',
                    endHtml: '</div></div>'
                },
                {
                    type: 'block',
                    tag: 'rtl-wrap',
                    startHtml: '<div class="writing-direction-rtl-div">',
                    endHtml: '</div>'
                },

                /* Frame */
                {
                    type: 'inline',
                    tag: 'iframe-link',
                    startHtml: '<iframe width="100%" ',
                    endHtml: ' frameborder="0" loading="lazy" title="Embedded Website" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>'
                },
                {
                    type: 'inline',
                    tag: 'iframe-video-link',
                    startHtml: '<iframe src="',
                    endHtml: '" title="Video Player" frameborder="0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" allowfullscreen></iframe>'
                }
            ]
        },
    }
})()
