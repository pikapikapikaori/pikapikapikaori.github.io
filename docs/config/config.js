window.$docsify = {
    name: '<h1 class="page-sidebar-title-class">ピカピカピ</h1>',
    repo: '',
    coverpage: ['/', '/jp/', '/en-us/'],
    loadNavbar: true,
    loadSidebar: true,
    subMaxLevel: 3,
    auto2top: true,
    themeColor: '#c7a2ec',

    nameLink: {
        '/jp/': '#/jp/',
        '/en-us/': '#/en-us/',
        '/': '#/'
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

    // 脚注插件设置
    loadFooter: true,

    // 全局搜索插件设置
    search: {
        paths: 'auto',
        depth: 4,
        placeholder: {
            '/en-us/': 'Type to search',
            '/jp/': '検索',
            '/': '搜索'
        },
        noData: {
            '/en-us/': 'No Results',
            '/jp/': '結果がありません',
            '/': '找不到结果'
        },
        hideOtherSidebarContent: true,
        pathNamespaces: ['/jp', '/en-us'],
    },

    // 翻页插件设置
    pagination: {
        previousText: {
            '/en-us/': 'PREVIOUS',
            '/jp/': '前',
            '/': '上一篇'
        },
        nextText: {
            '/en-us/': 'NEXT',
            '/jp/': '次',
            '/': '下一篇'
        },
        crossChapter: false,
        crossChapterText: false,
    },

    // 复制代码插件设置
    copyCode: {
        buttonText: {
            '/en-us/': 'Copy to clipboard',
            '/jp/': 'クリックしてコピー',
            '/': '点击复制'
        },
        errorText: {
            '/en-us/': 'Error',
            '/jp/': 'エラー',
            '/': '错误'
        },
        successText: {
            '/en-us/': 'Copied',
            '/jp/': 'コピーしました',
            '/': '复制成功'
        }
    },

    // 支持 mermaid 插件设置
    mermaidConfig: {
        querySelector: '.mermaid',
    },


    // 自用插件
    // 页面添加 gitalk，并在最底端添加 footer，使得 gitalk 下方有空间
    gitalkWithFooter: {
        footerInnerHtml: '<small>&copy; 2023 - {gitalk-footer-yyyy} 李亦杨 / <ruby>李亦楊<rt>リエキヨウ</rt></ruby> / Yi-Yang Li - All Rights Reserved.</small>',
        gitalkConfig: {
            clientID: '6a54e5946401951488d1',
            clientSecret: '5ca9de120592a9908348d09480cea6917112a4ec',
            repo: 'pikapikapi-blog',
            owner: 'pikapikapikaori',
            admin: ['pikapikapikaori'],
            // facebook-like distraction free mode
            distractionFreeMode: false,
        }
    },

    // 添加字数统计，并能够 i18n 国际化
    countWords: {
        countable: true,
        position: 'top',
        float: 'right',
        fontsize: '0.9rem',
        localization: {
            words: {
                '/en-us/': 'words',
                '/jp/': '字',
                '/': '字'
            },
            minute: {
                '/en-us/': 'min',
                '/jp/': '分',
                '/': '分钟'
            },
        },
        isExpected: true,
    },

    // 添加目录页
    tocPage: {
        recentAmount: 8,
        coverPath: [
            '/',
            '/en-us/',
            '/jp/'
        ]
    },

    // 添加动态封面
    dynamicCover: {
        backgrounds: [
            '_media/coverBackgrounds/cover-1.jpg',
            '_media/coverBackgrounds/cover-2.jpg',
            '_media/coverBackgrounds/cover-3.jpg',
        ]
    },

    // 添加 breadcrumb 头
    breadcrumb: {
        localization: [
            'en-us',
            'jp',
        ]
    },

    // 更改 html lang 信息
    htmlLang: {
        localization: {
            'jp': 'ja',
            'en-us': 'en',
            'default': 'zh-Hans'
        }
    },

    // 添加小组件
    addWidgets: {
        useSwitchMode: true,
        top: 20,
        topOffset: 500,
        themes: [
            {
                name: 'card',
                light: './style/theme/layout/card.css',
                dark: './style/theme/layout/card.css',
                lightColor: '#100e17',
                darkColor: '#100e17',
                lightThemeColor: '#c7a2ec',
                darkThemeColor: '#c7a2ec'
            },
            {
                name: 'default',
                light: './style/theme/vue.css',
                dark: './style/theme/dark.css',
                lightColor: '#ffffff',
                darkColor: '#3f3f3f',
                lightThemeColor: '#c7a2ec',
                darkThemeColor: '#c7a2ec'
            },
            {
                name: 'lavender',
                light: './style/theme/lavender.css',
                dark: './style/theme/lavandula.css',
                lightColor: '#f5f0fa',
                darkColor: '#1f1830',
                lightThemeColor: '#cda2ec',
                darkThemeColor: '#cda2ec'
            },
            {
                name: 'kraft',
                light: './style/theme/kraft.css',
                dark: './style/theme/bronze.css',
                lightColor: '#f4ecd8',
                darkColor: '#2a1f14',
                lightThemeColor: '#ecc7a2',
                darkThemeColor: '#ecc7a2'
            },
            {
                name: 'matcha',
                light: './style/theme/matcha.css',
                dark: './style/theme/library.css',
                lightColor: '#e3efd1',
                darkColor: '#1e3328',
                lightThemeColor: '#c7eca2',
                darkThemeColor: '#c7eca2'
            },
            {
                name: 'kirby',
                light: './style/theme/kirby.css',
                dark: './style/theme/metaknight.css',
                lightColor: '#ffeef4',
                darkColor: '#1a2238',
                lightThemeColor: '#eca2bb',
                darkThemeColor: '#a2aeec'
            },
            {
                name: 'catppuccin',
                light: './style/theme/latte.css',
                dark: './style/theme/catppuccin.css',
                lightColor: '#eff1f5',
                darkColor: '#1e1e2e',
                lightThemeColor: '#c1a2ec',
                darkThemeColor: '#c1a2ec'
            },
            {
                name: 'gold',
                light: './style/theme/whitegold.css',
                dark: './style/theme/darkgold.css',
                lightColor: '#f5f0e8',
                darkColor: '#0a0a0a',
                lightThemeColor: '#ecdaa2',
                darkThemeColor: '#ecdaa2'
            },
            {
                name: 'calligraphy',
                light: './style/theme/calligraphy.css',
                dark: './style/theme/grid.css',
                lightColor: '#fbfbf5',
                darkColor: '#1a2028',
                lightThemeColor: '#ecc7a2',
                darkThemeColor: '#a2c7ec'
            },
            {
                name: 'typography',
                light: './style/theme/typography.css',
                dark: './style/theme/dot.css',
                lightColor: '#fafaf5',
                darkColor: '#1e2128',
                lightThemeColor: '#ecc7a2',
                darkThemeColor: '#a2c7ec'
            },
            {
                name: 'misty',
                light: './style/theme/misty.css',
                dark: './style/theme/midnight.css',
                lightColor: '#fbfbf5',
                darkColor: '#14171c',
                lightThemeColor: '#a2d9ec',
                darkThemeColor: '#a2d9ec'
            },
            {
                name: 'sunlit',
                light: './style/theme/sunlit.css',
                dark: './style/theme/candlelit.css',
                lightColor: '#faf6ee',
                darkColor: '#1a1614',
                lightThemeColor: '#eca2ae',
                darkThemeColor: '#eca2ae'
            },
            {
                name: 'linen',
                light: './style/theme/linen.css',
                dark: './style/theme/weave.css',
                lightColor: '#f7f3ec',
                darkColor: '#18150f',
                lightThemeColor: '#eca2ae',
                darkThemeColor: '#eca2ae'
            },
            {
                name: 'cross',
                light: './style/theme/sky.css',
                dark: './style/theme/star.css',
                lightColor: '#f7fafc',
                darkColor: '#1e2128',
                lightThemeColor: '#d3a2ec',
                darkThemeColor: '#a2d3ec'
            },
            {
                name: 'haunted',
                light: './style/theme/ghost.css',
                dark: './style/theme/haunted.css',
                lightColor: '#faf8fd',
                darkColor: '#100e17',
                lightThemeColor: '#ecc1a2',
                darkThemeColor: '#ecc1a2'
            },
        ]
    },

    // 目录、文章列表切换
    tocSwitcher: {
        localization: {
            toc: {
                '/en-us/': 'Contents',
                '/jp/': '目次',
                '/': '目录'
            },
            default: {
                '/en-us/': 'Articles',
                '/jp/': '文章一覧',
                '/': '文章列表'
            },
        }
    },

    // 添加替换 Markdown 中的 Html 注释
    htmlReplace: {
        links: {
            github: 'https://github.com/pikapikapikaori/',
            email: 'mailto:Lyy8759@outlook.com',
            rss: './pikapikapi-blog-rss.atom'
        },
        blockTagConfigMap: new Map([
            /* Brief Comments */
            [
                'brief-comments',
                {
                    startHtml: '<div class="brief-comments-container">',
                    endHtml: '</div>'
                }
            ],
            [
                'brief-comments-year',
                {
                    startHtml: '<hr class="brief-comments-in-blog-title-year-divider"><details class="brief-comments-in-blog-title-year">',
                    endHtml: '</details>'
                }
            ],
            [
                'brief-comments-comments',
                {
                    startHtml: '<div class="brief-comments-in-blog">',
                    endHtml: '</div>'
                }
            ],
            [
                'brief-comments-comments-container',
                {
                    startHtml: '<div class="brief-comments-in-blog-comments-container">',
                    endHtml: '</div>'
                }
            ],

            /* Personal Ten */
            [
                'personal-ten',
                {
                    startHtml: '<div class="personal-ten-best-container">',
                    endHtml: '</div>'
                }
            ],
            [
                'personal-ten-card',
                {
                    startHtml: '<div class="personal-ten-best-card"><div class="personal-ten-best-content">',
                    endHtml: '</div></div>'
                }
            ],
            [
                'personal-ten-img',
                {
                    startHtml: '<div class="personal-ten-best-content-img">',
                    endHtml: '</div>'
                }
            ],
            [
                'personal-ten-info',
                {
                    startHtml: '<div class="personal-ten-best-content-info">',
                    endHtml: '</div>'
                }
            ],

            /* Footnote */
            [
                'footnote',
                {
                    startHtml: '<div class="footnote-div">',
                    endHtml: '</div>'
                }
            ],

            /* Toc Style Card */
            [
                'toc-card-wrap',
                {
                    startHtml: '<div class="toc-page-div">',
                    endHtml: '</div>'
                }
            ],
            [
                'toc-card',
                {
                    startHtml: '<a class="toc-page-display-a" ',
                    endHtml: '</div></a>'
                }
            ],

            /* About Page Container */
            [
                'about-page-wrap',
                {
                    startHtml: '<div class="main-page-right-panel-container">',
                    endHtml: '</div>'
                }
            ],
            [
                'about-page-links-img',
                {
                    startHtml: '<div class="main-page-about-me-image-links">',
                    endHtml: '</div>'
                }
            ],

            /* Multiple Image Container */
            [
                'multi-img-wrap',
                {
                    startHtml: '<section class="multi-images-container-section">',
                    endHtml: '</section>'
                }
            ],

            /* Poem Container */
            [
                'poem-wrap',
                {
                    startHtml: '<div><div class="writing-direction-vertical-div writing-direction-vertical-rtl-div poem-div">',
                    endHtml: '</div></div>'
                }
            ],

            /* Writing Direction Vertical Container */
            [
                'vertical-ltr-wrap',
                {
                    startHtml: '<div><div class="writing-direction-vertical-div writing-direction-vertical-ltr-div">',
                    endHtml: '</div></div>'
                }
            ],
            [
                'vertical-rtl-wrap',
                {
                    startHtml: '<div><div class="writing-direction-vertical-div writing-direction-vertical-rtl-div">',
                    endHtml: '</div></div>'
                }
            ],
            [
                'rtl-wrap',
                {
                    startHtml: '<div class="writing-direction-rtl-div">',
                    endHtml: '</div>'
                }
            ],

            /* Minority Language Container */
            [
                'minor-lang-wrap',
                {
                    startHtml: '<span class="minority-language-font">',
                    endHtml: '</span>'
                }
            ],
            [
                'minor-lang-ranjana-wrap',
                {
                    startHtml: '<span class="minority-language-font-ranjana">',
                    endHtml: '</span>'
                }
            ],
            [
                'minor-lang-jiagu-wrap',
                {
                    startHtml: '<span class="minority-language-font-jiagu">',
                    endHtml: '</span>'
                }
            ],
            [
                'minor-lang-zhuanwen-wrap',
                {
                    startHtml: '<span class="minority-language-font-zhuanwen">',
                    endHtml: '</span>'
                }
            ],
            [
                'minor-lang-jinwen-wrap',
                {
                    startHtml: '<span class="minority-language-font-jinwen">',
                    endHtml: '</span>'
                }
            ],
            [
                'minor-lang-cjkext-wrap',
                {
                    startHtml: '<span class="minority-language-font-cjkext">',
                    endHtml: '</span>'
                }
            ]
        ]),
        inlineTagConfigMap: new Map([
            /* Brief Comments */
            [
                'brief-comments-summary',
                (payload) => `<summary>${payload}</summary>`
            ],
            [
                'brief-comments-logo',
                (payload) => `<div class="brief-comments-in-blog-image-container"><img src="${payload}" alt="Logo" class="ignore-view-full-image-img"></div>`
            ],
            [
                'brief-comments-divider',
                (payload) => `<hr class="brief-comments-in-blog-comments-divider"/><p>${payload}</p>`
            ],

            /* Footnote */
            [
                'footnote-num',
                (payload) => `<sup class="footnote-num-sup">${payload}</sup>`
            ],

            /* Toc Style Card */
            [
                'toc-card-href',
                (payload) => `href="${payload}" target="_blank"><div class="toc-page-display-div">`
            ],
            [
                'toc-card-img',
                (payload) => `<div class="toc-page-display-title-img"><img class="ignore-view-full-image-img" src="${payload}"></center></div>`
            ],
            [
                'toc-card-title',
                (payload) => `<div class="toc-page-display-title-div">${payload}</div>`
            ],
            [
                'toc-card-description',
                (payload) => `<div class="toc-page-display-date-div">${payload}</div>`
            ],

            /* About Page Container */
            [
                'about-page-title',
                (payload) => `<h4 class="main-page-about-me-title">${payload}</h4>`
            ],
            [
                'about-page-p',
                (payload) => `<p class="main-page-about-me-description">${payload}</p>`
            ],
            [
                'about-page-links',
                () => '<div class="main-page-about-me-links"><a href="{link-github}" target="_blank" rel="noopener">{icon-github}</a><a href="{link-email}" target="_blank" rel="noopener">{icon-email}</a><a href="{link-rss}" target="_blank" rel="noopener">{icon-rss}</a></div>'
            ],

            /* Frame */
            [
                'iframe-link',
                (payload) => `<iframe width="100%" ${payload} frameborder="0" loading="lazy" title="Embedded Website" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>`
            ],
            [
                'iframe-video-link',
                (payload) => `<iframe style="aspect-ratio: var(--global-aspect-ratio-tv);" src="${payload}" title="Video Player" frameborder="0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" allowfullscreen></iframe>`
            ]
        ])
    },
}
