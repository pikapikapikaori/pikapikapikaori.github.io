(function () {
    'use strict'

    var App = window.App = window.App || {}

    App.config = {

        /* ---------------- 站点信息 ---------------- */
        feedUrl: '../../assets/resources/meta/feed.atom',
        siteName: 'ピカピカピ',
        email: 'Lyy8759@outlook.com',
        startYear: 2026,

        /* ---------------- 博客 rail ---------------- */
        blog: {
            postLimit: 6,
            excerptLength: 108,
            /* 语言检测采样字符数：从正文纯文本开头取这么长来判断语言 */
            langSampleLength: 400,
            /* 每次最多解析多少条 entry，再按语言过滤，再取前 postLimit 条 */
            scanLimit: 60,
            /* 结尾阻尼：进度超过 followRampStart 后，follow 从 motion.follow
               线性升到 followEnd，让 rail 在解除吸附前精确停在末尾，
               避免「页面已经下滑、rail 仍在横移」 */
            followRampStart: 0.62,
            followEnd: 0.95
        },

        /* ---------------- 摄影 stack ---------------- */
        photo: {
            totalScreens: 6.875,

            phases: {
                flyIn: 0.24,
                zoom: 0.40,
                shuffle: 1.00
            },

            stackScaleMax: 1.7,

            entries: [
                { x: -180, y: -90, r: -26, s: 0.60 },
                { x: 170, y: -130, r: 22, s: 0.68 },
                { x: -195, y: 115, r: 16, s: 0.64 },
                { x: 185, y: 100, r: -20, s: 0.66 },
                { x: 12, y: -200, r: 12, s: 0.58 },
                { x: -150, y: -160, r: -18, s: 0.62 },
                { x: 155, y: 150, r: 14, s: 0.66 },
                { x: -165, y: 165, r: -14, s: 0.62 }
            ],

            entryStagger: 0.09,
            exitStagger: 0.10,
            stackOffset: { x: 3.2, y: 2.6, r: 2.2 },
            exitY: 108,
            magnetFlat: 0.30,
            followPhaseC: 0.09,
            followBlendRange: 0.06
        },

        /* ---------------- 摄影照片 ---------------- */
        photos: {

            /* ============ 中文 ============ */
            'zh-Hans': [
                { src: '../../_media/Photograph/scenery-6.jpg', caption: '京都 / 2024',   g: '', ratio: '3/2' },
                { src: '../../_media/Photograph/scenery-3.jpg', caption: '檐下 / 2024', g: '', ratio: '3/2'  },
                { src: '../../_media/Photograph/scenery-5.jpg', caption: '樱 / 2024',   g: '', ratio: '3/2' },
                { src: '../../_media/Photograph/figure-1.jpg', caption: '美希 / 2024', g: '', ratio: '3/2' },
                { src: '../../_media/Photograph/figure-2.jpg', caption: '春香 / 2024', g: '', ratio: '3/2' },
                { src: '../../_media/Photograph/figure-7.jpg', caption: '美希 / 2024', g: '', ratio: '3/2'  },
                { src: '../../_media/Photograph/figure-9.jpg', caption: '美希 / 2024',   g: '', ratio: '3/2' },
                { src: '../../_media/Photograph/figure-12.jpg', caption: '美希 / 2024',   g: '', ratio: '3/2' }
            ],

            /* ============ 英语 ============ */
            'en': [
                { src: '../../en-us/_media/Photograph/scenery-6.jpg', caption: 'Kyoto / 2024',   g: '', ratio: '3/2' },
                { src: '../../en-us/_media/Photograph/scenery-3.jpg', caption: 'Under the Eaves / 2024', g: '', ratio: '3/2'  },
                { src: '../../en-us/_media/Photograph/scenery-5.jpg', caption: 'Cherry Blossoms / 2024',   g: '', ratio: '3/2' },
                { src: '../../en-us/_media/Photograph/figure-1.jpg', caption: 'Miki / 2024', g: '', ratio: '3/2' },
                { src: '../../en-us/_media/Photograph/figure-2.jpg', caption: 'Haruka / 2024', g: '', ratio: '3/2' },
                { src: '../../en-us/_media/Photograph/figure-7.jpg', caption: 'Miki / 2024', g: '', ratio: '3/2'  },
                { src: '../../en-us/_media/Photograph/figure-9.jpg', caption: 'Miki / 2024',   g: '', ratio: '3/2' },
                { src: '../../en-us/_media/Photograph/figure-12.jpg', caption: 'Miki / 2024',   g: '', ratio: '3/2' }
            ],

            /* ============ 日语 ============ */
            'ja': [
                { src: '../../jp/_media/Photograph/scenery-6.jpg', caption: '京都 / 2024',   g: '', ratio: '3/2' },
                { src: '../../jp/_media/Photograph/scenery-3.jpg', caption: '軒下 / 2024', g: '', ratio: '3/2'  },
                { src: '../../jp/_media/Photograph/scenery-5.jpg', caption: '桜 / 2024',   g: '', ratio: '3/2' },
                { src: '../../jp/_media/Photograph/figure-1.jpg', caption: 'みき / 2024', g: '', ratio: '3/2' },
                { src: '../../jp/_media/Photograph/figure-2.jpg', caption: '春香 / 2024', g: '', ratio: '3/2' },
                { src: '../../jp/_media/Photograph/figure-7.jpg', caption: 'みき / 2024', g: '', ratio: '3/2'  },
                { src: '../../jp/_media/Photograph/figure-9.jpg', caption: 'みき / 2024',   g: '', ratio: '3/2' },
                { src: '../../jp/_media/Photograph/figure-12.jpg', caption: 'みき / 2024',   g: '', ratio: '3/2' }
            ]
        },

        /* ---------------- 动画 ---------------- */
        motion: {
            follow: 0.16,
            rootMargin: '400px 0px'
        },

        /* ---------------- 拉取失败 / 无对应语言文章时的兜底数据 ----------------
           按语言分组。当前 UI 语言在组里找不到，会回退到 'zh-Hans' 组。 */
        fallbackPosts: {

            /* ============ 中文 ============ */
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

            /* ============ 英语 ============ */
            'en': [
                {
                    title: 'Birthday E-card for GF',
                    link: '../../#/en-us/writings/PrivateEcard-20220517',
                    date: '2026.10.05',
                    cover: '',
                    excerpt: 'You can visit here to view the whole page.'
                }
            ],

            /* ============ 日语 ============ */
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
