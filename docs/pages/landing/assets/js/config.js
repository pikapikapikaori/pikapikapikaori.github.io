/* ========================================================
   config.js —— 所有可调配置集中在这里
   ======================================================== */
(function () {
    'use strict'

    var App = window.App = window.App || {}

    App.config = {

        /* ---------------- 站点信息 ---------------- */
        feedUrl: 'https://pikapikapi.com/assets/resources/meta/pikapikapi-blog-rss.atom',
        siteName: 'ピカピカピ',
        author: '李亦楊',
        email: 'hi@pikapikapi.com',

        /* ---------------- 博客 rail ---------------- */
        blog: {
            postLimit: 6,        /* 最多拉取几篇 */
            excerptLength: 108   /* 摘要截取字符数 */
        },

        /* ---------------- 摄影 stack ---------------- */
        photo: {
            /* 总滚动距离 = 视口高度 × totalScreens。
               这个值直接决定每段动画的"快慢"。3.2 显得太快，5.5 比较从容 */
            totalScreens: 5.5,

            /* 三个阶段累计结束点（0–1），必须递增，最后为 1 */
            phases: {
                flyIn: 0.30,   /* A：照片飞入并叠放 */
                zoom: 0.50,   /* B：整叠放大、后几张下移退位 */
                shuffle: 1.00    /* C：一张张从下往上切换 */
            },

            /* 阶段 B：整叠最大放大倍数 */
            stackScaleMax: 1.7,

            /* 阶段 A：每张卡片的入场起点。
               x, y 为百分比（相对卡片自身尺寸），正 x 向右，正 y 向下
               r 为旋转角度，s 为初始缩放 */
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

            /* 阶段 A：每张之间错开的进度（相对阶段 A 的跨度） */
            entryStagger: 0.09,

            /* 阶段 B：每张卡片下移退位的错开 */
            exitStagger: 0.10,

            /* 堆叠时每张卡片相对中心的偏移（%，相对自身尺寸） */
            stackOffset: { x: 3.2, y: 2.6, r: 2.2 },

            /* 阶段 B 退场的目标 y（%） */
            exitY: 108,

            /* 阶段 C：磁吸强度。
               0    = 完全均匀
               0.30 = 每张卡片在两端各占 30% 的进度作为"平台"（推荐）
               0.40 = 平台更长，切换更突兀 */
            magnetFlat: 0.30
        },

        /* ---------------- 摄影照片 ----------------
           把 src 换成你的照片 URL。g 是加载前的占位渐变 */
        photos: [
            { src: '', caption: '都市 / 2025', g: 'linear-gradient(140deg,#e3c9a3,#8c6f4e)' },
            { src: '', caption: '旅途 / 2025', g: 'linear-gradient(160deg,#a9b6ad,#4d5a52)' },
            { src: '', caption: '日常 / 2024', g: 'linear-gradient(120deg,#d9b8a8,#7d5142)' },
            { src: '', caption: '夜 / 2024', g: 'linear-gradient(200deg,#8e9bb3,#2f3646)' },
            { src: '', caption: '光 / 2024', g: 'linear-gradient(150deg,#f0dfb8,#b08e57)' },
            { src: '', caption: '静物 / 2023', g: 'linear-gradient(170deg,#cbb9c4,#6a5666)' },
            { src: '', caption: '海 / 2023', g: 'linear-gradient(180deg,#a6c2cf,#3e5c6b)' }
        ],

        /* ---------------- 动画 ---------------- */
        motion: {
            /* 阻尼系数：0.10 偏重，0.16 中等，0.22 跟手 */
            follow: 0.16,
            /* 只有 section 进入视口附近时才跑 rAF */
            rootMargin: '400px 0px'
        },

        /* ---------------- 拉取失败时的兜底数据 ---------------- */
        fallbackPosts: [
            {
                title: '季度印象最深刻单集 2025.10', link: 'https://pikapikapi.com/#/writings/SeasonBest-202510-20251203',
                date: '2026.10.05', cover: 'https://pikapikapi.com/writings/_media/SeasonBest-202510-20251203/cover-picture.jpg',
                excerpt: '和 #39 Bpart 是一个整体，就放在这里一起说了。在这部动画里实在是难得的题材，看得出来本季度 OP 和 ED 也都配合着这集的内核制作。'
            },
            {
                title: '季度印象最深刻单集 2025.07', link: 'https://pikapikapi.com/#/writings/SeasonBest-202507-20250826',
                date: '2025.10.12', cover: 'https://pikapikapi.com/writings/_media/SeasonBest-202507-20250826/cover-picture.jpg',
                excerpt: '作为这种类型的动画和上季度「mono」同样具备着异质的气息。本话聚焦于硝子，从小压抑的、小众的、不被理解的爱好，在纯粹的科研式的研究之中闪烁。'
            },
            {
                title: '季度印象最深刻单集 2025.04', link: 'https://pikapikapi.com/#/writings/SeasonBest-202504-20250430',
                date: '2025.07.01', cover: 'https://pikapikapi.com/writings/_media/SeasonBest-202504-20250430/cover-picture.jpg',
                excerpt: '开篇对赛璐璐动画的戏仿实在令人惊喜，从作画到色指到演出到摄影全方面的完成了出色的致敬，而惊喜的 OP 之后则是全段的高作画力的动画。'
            },
            {
                title: '季度印象最深刻单集 2025.01', link: 'https://pikapikapi.com/#/writings/SeasonBest-202501-20250112',
                date: '2025.04.04', cover: 'https://pikapikapi.com/writings/_media/SeasonBest-202501-20250112/cover-picture.jpg',
                excerpt: '难以忘怀的 #49 之后，作为 20 周年企划的第一话，开场对两人关系性的蜻蜓点水般的描写就已经展现出了村山功的实力。'
            },
            {
                title: '季度印象最深刻单集 2024.10', link: 'https://pikapikapi.com/#/writings/SeasonBest-202410-20241007',
                date: '2025.01.06', cover: 'https://pikapikapi.com/writings/_media/SeasonBest-202410-20241007/cover-picture.jpg',
                excerpt: '季度最受瞩目也的确大约是本季目前为止最高质量的作品，科学猴汤浅徒弟山代風我的出色把控带来的是全方位的高质量制作与文本的趣味性的并驾齐驱。'
            },
            {
                title: '季度印象最深刻单集 2024.07', link: 'https://pikapikapi.com/#/writings/SeasonBest-202407-20240721',
                date: '2024.10.07', cover: 'https://pikapikapi.com/writings/_media/SeasonBest-202407-20240721/cover-picture.jpg',
                excerpt: '应该说是很有米澤味的日常推理故事吧，但最难能可贵的反而是这份日常。并不是像 #1 那样进行过多的省略以快速推进主线。'
            }
        ]
    }
})()
