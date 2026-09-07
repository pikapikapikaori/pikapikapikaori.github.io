const commentReplaceMark = 'annotation:replace'

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
        content = content.replace(marker, codeBlockMatch[i])
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
        html = html.replace(fullComment, realHtml)
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
        document.querySelector('.brief-comments-container details:first-of-type').open = true
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
