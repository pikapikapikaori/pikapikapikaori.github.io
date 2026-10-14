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
            excerptLength: 108
        },

        /* ---------------- 摄影 stack ---------------- */
        photo: {
            totalScreens: 6.875,

            /* 三个阶段累计结束点（0–1），必须递增，最后为 1 */
            phases: {
                flyIn: 0.24,
                zoom: 0.40,
                shuffle: 1.00
            },

            /* 阶段 B：整叠最大放大倍数 */
            stackScaleMax: 1.7,

            /* 
             * 阶段 A：每张卡片的入场起点。
             * x/y 是"卡片高度的百分比"（横竖图卡片高度一致，所以位移视觉统一），
             * 正 x 向右，正 y 向下，r 为旋转角，s 为初始缩放
             */
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

            /* 阶段 A：每张之间的错开进度（相对阶段 A 跨度） */
            entryStagger: 0.09,

            /* 阶段 B：每张卡片下移退位的错开 */
            exitStagger: 0.10,

            /* 堆叠时每张相对中心的偏移（同样以卡片高度为基准） */
            stackOffset: { x: 3.2, y: 2.6, r: 2.2 },

            /* 阶段 B 退场的目标 y（%） */
            exitY: 108,

            /* 
            * 阶段 C：磁吸强度。
            * 0    = 完全均匀
            * 0.30 = 每张卡片两端各 30% 进度为平台
            * 0.40 = 平台更长，切换更突兀
            */
            magnetFlat: 0.30,

            /* 
            * 阶段 C：专用的阻尼系数。
            * 数值越小 → 跟随越慢 → 阻尼感越重。
            * 全局默认是 motion.follow = 0.16（约 100ms），这里用 0.09（约 190ms），阻尼感约翻倍。
            * 想更重再往下调到 0.06，想轻一些回到 0.12。
            */
            followPhaseC: 0.09,

            /* 
            * 阶段 B 与阶段 C 之间 follow 的平滑过渡跨度。
            * 避免在边界处突然改变阻尼带来的"顿感"。
            * 相对 section 的总进度（0–1），0.06 ≈ 半屏滚动
            */
            followBlendRange: 0.06
        },

        /*
         * ---------------- 摄影照片 ----------------
         * ratio 决定卡片宽高比：
         * '16/9'  横构图（默认，主用）
         * '4/3'   横向略方
         * '1/1'   方图
         * '3/4'   竖构图
         * '2/3'   竖构图更窄
         * '9/16'  竖构图极窄
         * src 换成真实图片 URL，g 是加载前的占位渐变。
         */
        photos: [
            { src: '', caption: '都市 / 2025', g: 'linear-gradient(140deg,#e3c9a3,#8c6f4e)', ratio: '16/9' },
            { src: '', caption: '旅途 / 2025', g: 'linear-gradient(160deg,#a9b6ad,#4d5a52)', ratio: '16/9' },
            { src: '', caption: '肖像 / 2024', g: 'linear-gradient(120deg,#d9b8a8,#7d5142)', ratio: '3/4'  },
            { src: '', caption: '夜 / 2024',   g: 'linear-gradient(200deg,#8e9bb3,#2f3646)', ratio: '16/9' },
            { src: '', caption: '光 / 2024',   g: 'linear-gradient(150deg,#f0dfb8,#b08e57)', ratio: '16/9' },
            { src: '', caption: '静物 / 2023', g: 'linear-gradient(170deg,#cbb9c4,#6a5666)', ratio: '1/1'  },
            { src: '', caption: '海 / 2023',   g: 'linear-gradient(180deg,#a6c2cf,#3e5c6b)', ratio: '16/9' }
        ],

        /* ---------------- 动画 ---------------- */
        motion: {
            /* 全局默认阻尼系数。0.10 偏重，0.16 中等，0.22 跟手 */
            follow: 0.16,
            /* 只有 section 进入视口附近时才跑 rAF */
            rootMargin: '400px 0px'
        },

        /* ---------------- 拉取失败时的兜底数据 ---------------- */
        fallbackPosts: [
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
                excerpt: '冬春夏秋季度动画见：2024 冬季动画、2024 春季动画、2024 夏季动画、2024 秋季动画。仍然先重述下选集规则：2024 年内初次放送的 TV/WEB 动画内单集、2024 年内作为 BD/DVD 特典发售的 OVA/OAD。'
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
        ]
    }
})()
