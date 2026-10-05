const commentReplaceMark = 'annotation:replace'

const links = {
    github: 'https://github.com/pikapikapikaori/',
    email: 'mailto:Lyy8759@outlook.com',
    rss: './pikapikapi-blog-rss.atom'
}

const icons = {
    github: '<?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor"><path d="M16 22.027v-2.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7a5.44 5.44 0 00-1.5-3.75 5.07 5.07 0 00-.09-3.77s-1.18-.35-3.91 1.48a13.38 13.38 0 00-7 0c-2.73-1.83-3.91-1.48-3.91-1.48A5.07 5.07 0 005 5.797a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7a3.37 3.37 0 00-.94 2.58v2.87M9 20.027c-3 .973-5.5 0-7-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    email: '<?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor"><path d="M7 9l5 3.5L17 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 17V7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="currentColor" stroke-width="1.5"></path></svg>',
    rss: '<?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor"><path d="M12 19c0-4.2-2.8-7-7-7M19 19c0-8.4-5.6-14-14-14M5 19.01l.01-.011" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
}

const blockTagConfigMap = new Map([
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

    /* About Pge Container */
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
])

const inlineTagConfigMap = new Map([
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
        'toc-card-description',
        (payload) => `<div class="toc-page-display-title-div">ピカピカピ</div><div class="toc-page-display-date-div">${payload}</div>`
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
        () => `<div class="main-page-about-me-links"><a href="${links.github}" target="_blank" rel="noopener">${icons.github}</a><a href="${links.email}" target="_blank" rel="noopener">${icons.email}</a><a href="${links.rss}" target="_blank" rel="noopener">${icons.rss}</a></div>`
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


const blockTagKeys = Array.from(blockTagConfigMap.keys())
const inlineTagKeys = Array.from(inlineTagConfigMap.keys())

const regex = {
    codeMarkup: /(```[\s\S]*?```)/gm,
    commentReplaceMarkup: new RegExp(`<!-- ${commentReplaceMark} (.*?) -->`),
}

function renderStage1(content) {
    // 1.保护代码块
    const codeBlockMatch = content.match(regex.codeMarkup) || []
    const codeBlockMarkers = codeBlockMatch.map((item, i) => {
        const marker = `<!-- ${commentReplaceMark} CODEBLOCK${i} -->`
        content = content.replace(item, marker)
        return marker
    })

    for (const [tagKey, cfg] of blockTagConfigMap) {
        const startMarker = `<!-- ${tagKey}:start -->`
        const endMarker = `<!-- ${tagKey}:end -->`

        let scanPos = 0
        while (true) {
            const startIndex = content.indexOf(startMarker, scanPos)
            if (startIndex === -1) break

            const searchAfter = startIndex + startMarker.length
            const endIndex = content.indexOf(endMarker, searchAfter)
            if (endIndex === -1) {
                console.warn(`[comment‑wrapper] cannot find ${tagKey}:end for ${startMarker}`)
                scanPos = searchAfter
                continue
            }

            const beforePart = content.slice(0, startIndex)
            const innerPart = content.slice(searchAfter, endIndex)
            const afterPart = content.slice(endIndex + endMarker.length)

            const replacedChunk = [
                `<!-- ${commentReplaceMark} ${cfg.startHtml} -->`,
                innerPart,
                `<!-- ${commentReplaceMark} ${cfg.endHtml} -->`
            ].join('')

            content = beforePart + replacedChunk + afterPart
            scanPos = beforePart.length + replacedChunk.length
        }
    }

    for (const [tagKey, renderFn] of inlineTagConfigMap) {
        const inlineReg = new RegExp(`<!--\\s*${tagKey}:([\\s\\S]*?)\\s*-->`, 'g')
        content = content.replace(inlineReg, (fullMatch, payload) => {
            const trimmedPayload = payload.trim()
            const outputHtml = renderFn(trimmedPayload)
            return `<!-- ${commentReplaceMark} ${outputHtml} -->`
        })
    }

    codeBlockMarkers.forEach((marker, i) => {
        content = content.replace(marker, () => codeBlockMatch[i])
    })

    return content
}

function renderStage2(html) {
    let match
    while (true) {
        match = regex.commentReplaceMarkup.exec(html)
        if (match === null) break

        const fullComment = match[0]
        const realHtml = match[1] || ''
        html = html.replace(fullComment, () => realHtml)
    }
    return html
}

function plugin(hook, vm) {
    let hasAnyMarker = false

    hook.beforeEach(function (content) {
        hasAnyMarker = false
        for (const key of blockTagKeys) {
            if (content.includes(`<!-- ${key}:start -->`)) {
                hasAnyMarker = true
                break
            }
        }
        if (!hasAnyMarker) {
            for (const key of inlineTagKeys) {
                if (content.includes(`<!-- ${key}:`)) {
                    hasAnyMarker = true
                    break
                }
            }
        }

        if (hasAnyMarker) {
            content = renderStage1(content)
        }
        return content
    })

    hook.afterEach(function (html, next) {
        if (hasAnyMarker) {
            html = renderStage2(html)
        }
        next(html)
    })

    hook.doneEach(function () {
        // Set first brief comment year to open.
        let firstBriefNote = document.querySelector('.brief-comments-container details:first-of-type')
        if (firstBriefNote) {
            firstBriefNote.open = true
        }
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
