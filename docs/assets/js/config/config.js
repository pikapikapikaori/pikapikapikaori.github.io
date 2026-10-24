(function () {
    const i18nDefault = 'zh-cn'

    const i18nTexts = {
        'en-us': {
            searchPlaceholder: 'Type to search',
            searchNoData: 'No Results',
            previous: 'PREVIOUS',
            next: 'NEXT',
            copyButton: 'Copy to clipboard',
            copyError: 'Error',
            copySuccess: 'Copied',
            words: 'words',
            minute: 'min',
            toc: 'Contents',
            articles: 'Articles',
            gitalkInfo: 'Yi-Yang Li',
            gitalkCopy: 'All Rights Reserved.',
            divider: ' · ',
            htmlLang: 'en',
            nameLink: '#/en-us/'
        },
        'jp': {
            searchPlaceholder: '検索',
            searchNoData: '結果がありません',
            previous: '前',
            next: '次',
            copyButton: 'クリックしてコピー',
            copyError: 'エラー',
            copySuccess: 'コピーしました',
            words: '字',
            minute: '分',
            toc: '目次',
            articles: '文章一覧',
            gitalkInfo: '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
            gitalkCopy: '無断転載を禁じます',
            divider: ' ・ ',
            htmlLang: 'ja',
            nameLink: '#/jp/'
        },
        'zh-cn': {
            searchPlaceholder: '搜索',
            searchNoData: '找不到结果',
            previous: '上一篇',
            next: '下一篇',
            copyButton: '点击复制',
            copyError: '错误',
            copySuccess: '复制成功',
            words: '字',
            minute: '分钟',
            toc: '目录',
            articles: '文章列表',
            gitalkInfo: '李亦杨',
            gitalkCopy: '版权所有',
            divider: ' · ',
            htmlLang: 'zh-Hans',
            nameLink: '#/'
        }
    }

    // 全部 locale（含默认），顺序即 i18nTexts 的 key 顺序
    const i18nAllLocales = Object.keys(i18nTexts)

    // 非默认 locale，用于 alias / breadcrumb
    const i18nLocales = i18nAllLocales.filter(locale => locale !== i18nDefault)

    // locale -> 路径前缀
    const i18nPathMap = Object.fromEntries(
        i18nAllLocales.map(locale => [
            locale,
            locale === i18nDefault ? '/' : `/${locale}/`
        ])
    )

    // 路径前缀数组，顺序同 i18nTexts
    const i18nLocalePrefixes = i18nAllLocales.map(locale => i18nPathMap[locale])

    // search.pathNamespaces
    const i18nPathNamespaces = i18nLocales.map(locale => `/${locale}`)

    // i18n 文案生成器
    const cali18nText = key => ({
        ...Object.fromEntries(
            i18nAllLocales.map(locale => [
                i18nPathMap[locale],
                i18nTexts[locale][key]
            ])
        ),
        default: i18nTexts[i18nDefault][key]
    })

    window.$docsify = {
        name: 'ピカピカピ',
        repo: '',
        coverpage: i18nLocalePrefixes,
        loadNavbar: true,
        loadSidebar: true,
        subMaxLevel: 3,
        auto2top: true,
        themeColor: '#c7a2ec',

        alias: {
            '/.*_navbar\\.md$': function (path) {
                const locale = i18nLocales.find(l => path.includes(l))
                return locale ? '/' + locale + '/_navbar.md' : '/_navbar.md'
            }
        },

        nameLink: cali18nText('nameLink'),

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
            placeholder: cali18nText('searchPlaceholder'),
            noData: cali18nText('searchNoData'),
            hideOtherSidebarContent: true,
            pathNamespaces: i18nPathNamespaces,
        },

        // 翻页插件设置
        pagination: {
            previousText: cali18nText('previous'),
            nextText: cali18nText('next'),
            crossChapter: false,
            crossChapterText: false,
        },

        // 复制代码插件设置
        copyCode: {
            buttonText: cali18nText('copyButton'),
            errorText: cali18nText('copyError'),
            successText: cali18nText('copySuccess')
        },

        // 支持 mermaid 插件设置
        mermaidConfig: {
            querySelector: '.mermaid',
        },


        // 自用插件
        // 页面添加 gitalk，并在最底端添加 footer，使得 gitalk 下方有空间
        gitalkWithFooter: {
            footerInnerHtml: '<small>&copy; 2023 - {gitalk_footer-yyyy}{gitalk_footer-divider}{gitalk_footer-info}{gitalk_footer-divider}{gitalk_footer-copy}</small>',
            localization: {
                info: cali18nText('gitalkInfo'),
                copy: cali18nText('gitalkCopy'),
                divider: cali18nText('divider')
            },
            gitalkConfig: {
                clientID: '6a54e5946401951488d1',
                clientSecret: '5ca9de120592a9908348d09480cea6917112a4ec',
                repo: 'pikapikapi-blog',
                owner: 'pikapikapikaori',
                admin: ['pikapikapikaori'],
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
                words: cali18nText('words'),
                minute: cali18nText('minute'),
            },
            isExpected: true,
        },

        // 添加目录页
        tocPage: {
            recentAmount: 8,
            defaultImg: './assets/resources/img/default/picture-2.gif',
            coverPath: i18nLocalePrefixes
        },

        // 添加动态封面
        dynamicCover: {
            backgrounds: [
                './assets/resources/img/cover/cover-1.jpg',
                './assets/resources/img/cover/cover-2.jpg',
                './assets/resources/img/cover/cover-3.jpg',
            ]
        },

        // 添加 breadcrumb 头
        breadcrumb: {
            localization: i18nLocales
        },

        // 更改 html lang 信息
        htmlLang: {
            localization: {
                lang: cali18nText('htmlLang')
            }
        },

        // 添加小组件
        widgets: {
            useSwitchMode: true,
            top: 20,
            topOffset: 500,
            themes: [
                {
                    name: 'default',
                    light: {
                        themeColor: '#c7a2ec',
                        bgColor: '#ffffff',
                        css: './assets/css/theme/vue.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#c7a2ec',
                        bgColor: '#3f3f3f',
                        css: './assets/css/theme/dark.css',
                        js: null
                    }
                },
                {
                    name: 'lavender',
                    light: {
                        themeColor: '#cda2ec',
                        bgColor: '#f5f0fa',
                        css: './assets/css/theme/lavender.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#cda2ec',
                        bgColor: '#1f1830',
                        css: './assets/css/theme/lavandula.css',
                        js: null
                    }
                },
                {
                    name: 'kraft',
                    light: {
                        themeColor: '#ecc7a2',
                        bgColor: '#f4ecd8',
                        css: './assets/css/theme/kraft.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#ecc7a2',
                        bgColor: '#2a1f14',
                        css: './assets/css/theme/bronze.css',
                        js: null
                    }
                },
                {
                    name: 'matcha',
                    light: {
                        themeColor: '#c7eca2',
                        bgColor: '#e3efd1',
                        css: './assets/css/theme/matcha.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#c7eca2',
                        bgColor: '#1e3328',
                        css: './assets/css/theme/library.css',
                        js: null
                    }
                },
                {
                    name: 'kirby',
                    light: {
                        themeColor: '#eca2bb',
                        bgColor: '#ffeef4',
                        css: './assets/css/theme/kirby.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#a2aeec',
                        bgColor: '#1a2238',
                        css: './assets/css/theme/metaknight.css',
                        js: null
                    }
                },
                {
                    name: 'catppuccin',
                    light: {
                        themeColor: '#c1a2ec',
                        bgColor: '#eff1f5',
                        css: './assets/css/theme/latte.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#c1a2ec',
                        bgColor: '#1e1e2e',
                        css: './assets/css/theme/catppuccin.css',
                        js: null
                    }
                },
                {
                    name: 'gold',
                    light: {
                        themeColor: '#ecdaa2',
                        bgColor: '#f5f0e8',
                        css: './assets/css/theme/whitegold.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#ecdaa2',
                        bgColor: '#0a0a0a',
                        css: './assets/css/theme/darkgold.css',
                        js: null
                    }
                },
                {
                    name: 'calligraphy',
                    light: {
                        themeColor: '#ecc7a2',
                        bgColor: '#fbfbf5',
                        css: './assets/css/theme/calligraphy.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#a2c7ec',
                        bgColor: '#1a2028',
                        css: './assets/css/theme/grid.css',
                        js: null
                    }
                },
                {
                    name: 'typography',
                    light: {
                        themeColor: '#ecc7a2',
                        bgColor: '#fafaf5',
                        css: './assets/css/theme/typography.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#a2c7ec',
                        bgColor: '#1e2128',
                        css: './assets/css/theme/dot.css',
                        js: null
                    }
                },
                {
                    name: 'misty',
                    light: {
                        themeColor: '#a2d9ec',
                        bgColor: '#fbfbf5',
                        css: './assets/css/theme/misty.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#a2d9ec',
                        bgColor: '#14171c',
                        css: './assets/css/theme/midnight.css',
                        js: null
                    }
                },
                {
                    name: 'sunlit',
                    light: {
                        themeColor: '#eca2ae',
                        bgColor: '#faf6ee',
                        css: './assets/css/theme/sunlit.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#eca2ae',
                        bgColor: '#1a1614',
                        css: './assets/css/theme/candlelit.css',
                        js: null
                    }
                },
                {
                    name: 'linen',
                    light: {
                        themeColor: '#eca2ae',
                        bgColor: '#f7f3ec',
                        css: './assets/css/theme/linen.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#eca2ae',
                        bgColor: '#18150f',
                        css: './assets/css/theme/weave.css',
                        js: null
                    }
                },
                {
                    name: 'cross',
                    light: {
                        themeColor: '#d3a2ec',
                        bgColor: '#f7fafc',
                        css: './assets/css/theme/sky.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#a2d3ec',
                        bgColor: '#1e2128',
                        css: './assets/css/theme/star.css',
                        js: null
                    }
                },
                {
                    name: 'haunted',
                    light: {
                        themeColor: '#ecc1a2',
                        bgColor: '#faf8fd',
                        css: './assets/css/theme/ghost.css',
                        js: null
                    },
                    dark: {
                        themeColor: '#ecc1a2',
                        bgColor: '#100e17',
                        css: './assets/css/theme/haunted.css',
                        js: null
                    }
                }
            ]
        },

        // 目录、文章列表切换
        tocSwitcher: {
            localization: {
                toc: cali18nText('toc'),
                list: cali18nText('articles'),
            }
        },

        // 添加替换 Markdown 中的 Html 注释
        htmlReplace: {
            links: {
                github: 'https://github.com/pikapikapikaori/',
                email: 'mailto:Lyy8759@outlook.com',
                feed: './assets/resources/meta/feed.atom'
            },
            tags: [
                /* Brief Comments */
                {
                    type: 'block',
                    tag: 'brief-comments',
                    startHtml: '<div class="brief-comments-container">',
                    endHtml: '</div>'
                },
                {
                    type: 'block',
                    tag: 'brief-comments-year',

                    startHtml: '<hr class="brief-comments-in-blog-title-year-divider"><details class="brief-comments-in-blog-title-year">',
                    endHtml: '</details>'
                },
                {
                    type: 'block',
                    tag: 'brief-comments-comments',

                    startHtml: '<div class="brief-comments-in-blog">',
                    endHtml: '</div>'
                },
                {
                    type: 'block',
                    tag: 'brief-comments-comments-container',

                    startHtml: '<div class="brief-comments-in-blog-comments-container">',
                    endHtml: '</div>'
                },
                {
                    type: 'inline',
                    tag: 'brief-comments-summary',
                    startHtml: '<summary>',
                    endHtml: '</summary>'
                },
                {
                    type: 'inline',
                    tag: 'brief-comments-logo',
                    startHtml: '<div class="brief-comments-in-blog-image-container"><img src="',
                    endHtml: '" alt="Logo" class="ignore-view-full-image-img"></div>'
                },
                {
                    type: 'inline',
                    tag: 'brief-comments-divider',
                    startHtml: '<hr class="brief-comments-in-blog-comments-divider"/><p>',
                    endHtml: '</p>'
                },

                /* Personal Ten */
                {
                    type: 'block',
                    tag: 'personal-ten',

                    startHtml: '<div class="personal-ten-best-container">',
                    endHtml: '</div>'
                },
                {
                    type: 'block',
                    tag: 'personal-ten-card',

                    startHtml: '<div class="personal-ten-best-card"><div class="personal-ten-best-content">',
                    endHtml: '</div></div>'
                },
                {
                    type: 'block',
                    tag: 'personal-ten-img',

                    startHtml: '<div class="personal-ten-best-content-img">',
                    endHtml: '</div>'
                },
                {
                    type: 'block',
                    tag: 'personal-ten-info',

                    startHtml: '<div class="personal-ten-best-content-info">',
                    endHtml: '</div>'
                },

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

                /* Toc Style Card */
                {
                    type: 'block',
                    tag: 'toc-card-wrap',

                    startHtml: '<div class="toc-page-div">',
                    endHtml: '</div>'
                },
                {
                    type: 'block',
                    tag: 'toc-card',

                    startHtml: '<a class="toc-page-display-a" ',
                    endHtml: '</div></a>'
                },
                {
                    type: 'inline',
                    tag: 'toc-card-href',
                    startHtml: 'href="',
                    endHtml: '" target="_blank"><div class="toc-page-display-div">'
                },
                {
                    type: 'inline',
                    tag: 'toc-card-img',
                    startHtml: '<div class="toc-page-display-title-img"><img class="ignore-view-full-image-img" src="',
                    endHtml: '"></center></div>'
                },
                {
                    type: 'inline',
                    tag: 'toc-card-title',

                    startHtml: '<div class="toc-page-display-title-div">',
                    endHtml: '</div>'
                },
                {
                    type: 'inline',
                    tag: 'toc-card-description',
                    startHtml: '<div class="toc-page-display-date-div">',
                    endHtml: '</div>'
                },

                /* About Page Container */
                {
                    type: 'block',
                    tag: 'about-page-wrap',

                    startHtml: '<div class="main-page-right-panel-container">',
                    endHtml: '</div>'
                },
                {
                    type: 'block',
                    tag: 'about-page-links-img',

                    startHtml: '<div class="main-page-about-me-image-links">',
                    endHtml: '</div>'
                },
                {
                    type: 'inline',
                    tag: 'about-page-title',
                    startHtml: '<h4 class="main-page-about-me-title">',
                    endHtml: '</h4>'
                },
                {
                    type: 'inline',
                    tag: 'about-page-p',
                    startHtml: '<p class="main-page-about-me-description">',
                    endHtml: '</p>'
                },
                {
                    type: 'entire',
                    tag: 'about-page-links',
                    entireHtml: '<div class="main-page-about-me-links"><a href="{html_replace-link_github}" target="_blank" rel="noopener">{html_replace-icon_github}</a><a href="{html_replace-link_email}" target="_blank" rel="noopener">{html_replace-icon_email}</a><a href="{html_replace-link_feed}" target="_blank" rel="noopener">{html_replace-icon_feed}</a></div>'
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

                /* Writing Direction Vertical Container */
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

                /* Minority Language Container */
                {
                    type: 'block',
                    tag: 'minor-lang-wrap',

                    startHtml: '<span class="minority-language-font">',
                    endHtml: '</span>'
                },
                {
                    type: 'block',
                    tag: 'minor-lang-ranjana-wrap',

                    startHtml: '<span class="minority-language-font-ranjana">',
                    endHtml: '</span>'
                },
                {
                    type: 'block',
                    tag: 'minor-lang-jiagu-wrap',

                    startHtml: '<span class="minority-language-font-jiagu">',
                    endHtml: '</span>'
                },
                {
                    type: 'block',
                    tag: 'minor-lang-zhuanwen-wrap',

                    startHtml: '<span class="minority-language-font-zhuanwen">',
                    endHtml: '</span>'
                },
                {
                    type: 'block',
                    tag: 'minor-lang-jinwen-wrap',

                    startHtml: '<span class="minority-language-font-jinwen">',
                    endHtml: '</span>'
                },
                {
                    type: 'block',
                    tag: 'minor-lang-cjkext-wrap',
                    startHtml: '<span class="minority-language-font-cjkext">',
                    endHtml: '</span>'
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
                    startHtml: '<iframe style="aspect-ratio: var(--global-aspect-ratio-tv);" src="',
                    endHtml: '" title="Video Player" frameborder="0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" allowfullscreen></iframe>'
                }
            ]
        },
    }
})()
