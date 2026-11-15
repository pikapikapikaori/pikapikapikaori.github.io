import { TokenReplacer } from '../utils/tokenReplacer.js'
import { protectCodeBlocks, isEnabled, codeBlockModes } from '../utils/common.js'
import { annotationIcons } from '../utils/icons.js'
import { query } from '../utils/dom.js'

let htmlReplaceOptions = {
    enable: false,
    links: {
        github: 'https://github.com/pikapikapikaori/',
        email: 'mailto:Lyy8759@outlook.com',
        feed: './assets/resources/meta/feed.atom'
    },
    tags: []
}

function plugin(hook, vm) {
    if (!htmlReplaceOptions.enable) return

    const pluginIdentifier = 'html_replace'

    const commentReplaceMark = 'annotation:replace'

    const replacer = new TokenReplacer({
        prefix: pluginIdentifier,
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

        Object.keys(annotationIcons).forEach(key => {
            replacer.registerToken(`icon_${key}`, annotationIcons[key])
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

    const commentReplaceMarkup = new RegExp(`<!-- ${commentReplaceMark} (.*?) -->`)

    function renderStage1(content) {
        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.protect)

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

        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.restore)

        return content
    }

    function renderStage2(html) {
        let match
        while (true) {
            match = commentReplaceMarkup.exec(html)
            if (!isEnabled(match)) break

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
        const firstBriefNote = query('.brief-comments-container details:first-of-type')
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
