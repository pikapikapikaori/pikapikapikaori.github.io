(function () {
    'use strict'

    const App = window.App = window.App || {}

    App.config = {
        layouts: ['brand', 'mondrian', 'starTrail', 'photography'],
        defaultLayout: 'mondrian',

        /* 地址栏主题色，按布局与亮暗取值。 */
        metaColors: {
            brand: { light: '#f7f3ea', dark: '#141210' },
            mondrian: { light: '#F2EDE4', dark: '#101214' },
            starTrail: { light: '#E6F1FA', dark: '#0B0E17' },
            photography: { light: '#F3EFE6', dark: '#101113' }
        },

        feedUrl: '../../assets/resources/meta/feed.atom',
        emailHref: 'mailto:Lyy8759@outlook.com',
        logoSrc: './assets/resources/logo/logo.jpg',
        startYear: 2023,

        /* 公共布局展示的照片数量；全部照片由 Photos.all 读取，不分片。 */
        photoLimit: 10,

        photos: [
            { id: 'scenery-6', src: '../../_media/Photograph/scenery-6.jpg', link: '', ratio: '3/2' },
            { id: 'scenery-3', src: '../../_media/Photograph/scenery-3.jpg', link: '', ratio: '3/2' },
            { id: 'scenery-5', src: '../../_media/Photograph/scenery-5.jpg', link: '', ratio: '3/2' },
            { id: 'figure-1', src: '../../_media/Photograph/figure-1.jpg', link: '', ratio: '3/2' },
            { id: 'figure-2', src: '../../_media/Photograph/figure-2.jpg', link: '', ratio: '3/2' },
            { id: 'figure-7', src: '../../_media/Photograph/figure-7.jpg', link: '', ratio: '3/2' },
            { id: 'figure-9', src: '../../_media/Photograph/figure-9.jpg', link: '', ratio: '3/2' },
            { id: 'figure-12', src: '../../_media/Photograph/figure-12.jpg', link: '', ratio: '3/2' }
        ],

        blog: {
            postLimit: 10,
            excerptLength: 108,
            /* 语言检测采样字符数：从正文纯文本开头取这么长来判断语言 */
            langSampleLength: 400,
            /* 每次最多解析多少条 entry，再按语言过滤，再取前 postLimit 条 */
            scanLimit: 60
        },

        /* 拉取失败或没有对应语言文章时的默认数据。 */
        fallbackPosts: {
            'zh-Hans': [
                {
                    title: '2020 年度印象最深刻动画',
                    link: '../../#/writings/YearBest-2020-20210102',
                    date: '2026.10.03',
                    cover: '../../writings/_media/YearBest-2020-20210102/cover-picture.jpg',
                    excerpt: '翻了翻 bgm 20 年一共标了 213 部，给分最高的来自深渊给了这一年唯一的九星。在其后一共标了 15 部 8 星，但真正的非续作 TV 动画也只有隐瞒之事、前说，映像研和 lapis 四部。只能感叹这一年动画片确实不好看。'
                },
                {
                    title: '2024 年度 TV 动画单集十选',
                    link: '../../#/writings/YearBest-2024-20250108',
                    date: '2025.01.08',
                    cover: '../../writings/_media/YearBest-2024-20250108/cover-picture.jpg',
                    excerpt: '冬春夏秋季度动画见：2024 冬季动画、2024 春季动画、2024 夏季动画、2024 秋季动画。仍然先重述下选集规则：2024 年内初次放送的 TV / WEB 动画内单集、2024 年内作为 BD/DVD 特典发售的 OVA/OAD。'
                },
                {
                    title: '2023 年度 TV 动画单集十选',
                    link: '../../#/writings/YearBest-2023-20240106',
                    date: '2025.01.08',
                    cover: '../../writings/_media/YearBest-2023-20240106/cover-picture.jpg',
                    excerpt: '很久不写评论了。年中开始正好空闲时间渐多，闲来无事为了记录也为了练练笔故而今年决定每个季度简单记录一下印象比较深的动画片。冬季动画错过了成文的时机，春夏秋季度的动画可见：'
                },
                {
                    title: '四月赏曲——浅谈「四月是你的谎言」音乐选择',
                    link: '../../#/writings/Shigatsunouso-20180401',
                    date: '2024.07.18',
                    cover: '../../writings/_media/Shigatsunouso-20180401/cover-picture.jpg',
                    excerpt: '春天，马上就要来了。让我与你相遇的春天，就要来了。再也没有你的春天……就要来了。伴随着小薰出场的，是口风琴版的《鸽子与少年》。《鸽子与少年》由久石让作曲，最初出现在宫崎骏执导的电影「天空之城」之中。'
                },
                {
                    title: '「FLCL」：以青春之名向平庸的反抗',
                    link: '../../#/writings/FLCL-20180922',
                    date: '2024.07.18',
                    cover: '../../writings/_media/FLCL-20180922/cover-picture.jpg',
                    excerpt: '21 世纪初，鹤卷和哉监督的作品「FLCL」映在了电视的屏幕上，其看似毫无逻辑的故事却让看过它的观众直呼过瘾。时隔 18 年后的今天，Production.I.G 公司推出了其续作「FLCL Alternative」与「FLCL Progressive」。'
                },
                {
                    title: '大量私货的 10 年代十佳动画',
                    link: '../../#/writings/10TenBest-20200105',
                    date: '2024.07.18',
                    cover: '../../writings/_media/10TenBest-20200105/cover-picture.jpg',
                    excerpt: '随着 2020 年到来，最近评价 10 年代十佳动画的问题下有很多人选出了自己心目中的个人十佳。我一直觉得要选出一份客观的榜单永远是不可能的，因而在考试周前逃避复习的同时就简单写写 10 年代我最喜欢的十部动画片。'
                }
            ],

            'en': [
                {
                    title: 'Birthday E-card for GF',
                    link: '../../#/en-us/writings/PrivateEcard-20220517',
                    date: '2026.10.05',
                    cover: '',
                    excerpt: 'You can visit here to view the whole page.'
                }
            ],

            'ja': [
                {
                    title: 'ノート：アルバム　令和 5 年 12 月 2 日',
                    link: '../../#/jp/writings/Notes-20231202',
                    date: '2026.10.03',
                    cover: '../../jp/writings/_media/Notes-20231202/cover-picture.gif',
                    excerpt: '令和 5 年 12 月 2 日、上海。Phat のアイドルマスター本家シリーズが全部手に入れたけど、みき以外の方はまだ箱を開けていません。15 周年記念の三人組、e8 のみき SLEEPING BEAUTY、そしていくつかの楓と凛のフィギュアの箱も開けていません。'
                },
                {
                    title: 'ノート：アルバム　令和 5 年 8 月 5 日',
                    link: '../../#/jp/writings/Notes-20230805',
                    date: '2026.10.03',
                    cover: '../../jp/writings/_media/Notes-20230805/cover-picture.jpg',
                    excerpt: '令和 5 年 8 月 5 日、上海。GSC ニア & ヒカリとホムラの amiibo が受け取ったので、GSC ヒカリとホムラとまとめて撮りました。'
                },
                {
                    title: 'ノート：アルバム　令和 5 年 5 月 8 日',
                    link: '../../#/jp/writings/Notes-20230508',
                    date: '2026.10.03',
                    cover: '../../jp/writings/_media/Notes-20230508/cover-picture.jpg',
                    excerpt: '令和 5 年 5 月 6 日、上海。'
                },
                {
                    title: 'ノート：アルバム　令和 2 年 4 月 21 日',
                    link: '../../#/jp/writings/Notes-20200421',
                    date: '2026.10.03',
                    cover: '../../jp/writings/_media/Notes-20200421/cover-picture.jpg',
                    excerpt: '令和元年 8 月 6 日から 8 月 13 日まで、東京。'
                },
                {
                    title: '日本旅行写真　令和 6 年 3 月',
                    link: '../../#/jp/writings/JPTra-20240328',
                    date: '2026.10.03',
                    cover: '../../jp/writings/_media/JPTra-20240328/picture-8.jpg',
                    excerpt: '令和 6 年 3 月 28 日から、3 月 31 日まで。大阪 & 京都。'
                },
                {
                    title: '日本旅行写真　令和 6 年 2 月',
                    link: '../../#/jp/writings/JPTra-20240217',
                    date: '2026.10.03',
                    cover: '../../jp/writings/_media/JPTra-20240217/picture-14.jpg',
                    excerpt: '令和 6 年 2 月 17 日から、2 月 24 日まで。北海道：札幌 & 小樽、越後湯沢、横浜 & 東京、京都。'
                }
            ]
        }
    }
})()
