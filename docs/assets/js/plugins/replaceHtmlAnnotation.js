import { TokenReplacer } from '../utils/tokenReplacer.js'

let htmlReplaceOptions = {
    links: {
        github: 'https://github.com/pikapikapikaori/',
        email: 'mailto:Lyy8759@outlook.com',
        rss: './assets/resources/meta/pikapikapi-blog-rss.atom'
    },
    tags: []
}

function plugin(hook, vm) {
    const commentReplaceMark = 'annotation:replace'

    const icons = {
        github: '<?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor"><path d="M16 22.027v-2.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7a5.44 5.44 0 00-1.5-3.75 5.07 5.07 0 00-.09-3.77s-1.18-.35-3.91 1.48a13.38 13.38 0 00-7 0c-2.73-1.83-3.91-1.48-3.91-1.48A5.07 5.07 0 005 5.797a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7a3.37 3.37 0 00-.94 2.58v2.87M9 20.027c-3 .973-5.5 0-7-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
        email: '<?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor"><path d="M7 9l5 3.5L17 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 17V7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="currentColor" stroke-width="1.5"></path></svg>',
        rss: '<?xml version="1.0" encoding="UTF-8"?><svg width="100%" height="100%" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor"><path d="M12 19c0-4.2-2.8-7-7-7M19 19c0-8.4-5.6-14-14-14M5 19.01l.01-.011" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    }

    const replacer = new TokenReplacer({
        prefix: 'html_replace',
    })

    const blockTagConfigMap = new Map()
    const inlineTagConfigMap = new Map()

    function resolvePlaceholders(str) {
        return replacer.replace(str)
    }

    function initializeReplacer() {
        Object.keys(htmlReplaceOptions.links).forEach(key => {
            replacer.registerToken(`link_${key}`, htmlReplaceOptions.links[key])
        })

        Object.keys(icons).forEach(key => {
            replacer.registerToken(`icon_${key}`, icons[key])
        })
    }

    function initializeTags() {
        htmlReplaceOptions.tags.forEach(item => {
            if (!item || !item.tag) return

            switch (item.type) {
                case 'block':
                    blockTagConfigMap.set(item.tag, {
                        startHtml: resolvePlaceholders(item.startHtml),
                        endHtml: resolvePlaceholders(item.endHtml)
                    })
                    break

                case 'inline':
                    inlineTagConfigMap.set(item.tag, payload =>
                        resolvePlaceholders(item.startHtml + payload + item.endHtml)
                    )
                    break

                case 'entire':
                    inlineTagConfigMap.set(item.tag, () =>
                        resolvePlaceholders(item.entireHtml)
                    )
                    break

                default:
                    console.warn(`[htmlReplace] Unknown type: ${item.type} (tag: ${item.tag})`)
            }
        })
    }

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

    let hasAnyMarker = false

    hook.mounted(function () {
        initializeReplacer()
        initializeTags()
    })

    hook.beforeEach(function (content) {
        const blockTagKeys = Array.from(blockTagConfigMap.keys())
        const inlineTagKeys = Array.from(inlineTagConfigMap.keys())

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

window.$docsify['htmlReplace'] = Object.assign(
    htmlReplaceOptions,
    window.$docsify['htmlReplace']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
