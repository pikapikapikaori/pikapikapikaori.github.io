import { TokenReplacer } from '../utils/tokenReplacer.js'
import { protectCodeBlocks, isEnabled, codeBlockModes } from '../utils/common.js'
import * as icons from '../utils/icons.js'
import { getEl } from '../utils/dom.js'

let htmlReplaceOptions = {
    enable: false,
    links: {
        github: 'https://github.com/pikapikapikaori/',
        email: 'mailto:Lyy8759@outlook.com',
        feed: './assets/resources/meta/feed.atom'
    },
    tags: []
}

const iconLinkKeys = ['github', 'email', 'feed']

function plugin(hook, vm) {
    if (!htmlReplaceOptions.enable) return

    const pluginIdentifier = 'html_replace'

    const commentReplaceMark = 'annotation:replace'

    const replacer = new TokenReplacer({
        prefix: pluginIdentifier,
    })

    const blockTagConfigMap = new Map()
    const inlineTagConfigMap = new Map()

    function resolveIcon(identifier) {
        const parts = identifier.split('.')
        if (parts.length !== 2) return null

        const group = icons[parts[0]]
        const value = group ? group[parts[1]] : null
        return typeof value === 'string' ? value : null
    }

    function resolvePlaceholders(str) {
        return replacer.replace(str)
    }

    function initializeReplacer() {
        Object.keys(htmlReplaceOptions.links).forEach(key => {
            replacer.registerToken(`link_${key}`, htmlReplaceOptions.links[key])
        })

        iconLinkKeys.forEach(key => {
            replacer.registerToken(`icon_${key}`, icons.link[key])
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
            }
        })
    }

    const commentReplaceMarkup = new RegExp(`<!-- ${commentReplaceMark} (.*?) -->`)

    const inlineSvgMarkup = /<!--\s*svg:([A-Za-z0-9_.]+)\s*-->/g
    const inlineSvgMarkerPrefix = '<!-- svg:'

    function renderStage1(content) {
        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.protect)

        content = content.replace(inlineSvgMarkup, (fullMatch, identifier) => {
            const svg = resolveIcon(identifier)
            if (!svg) return fullMatch
            return `<!-- ${commentReplaceMark} <span class="inline-svg">${svg}</span> -->`
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

    // 导航、侧栏、封面不经过 beforeEach，只能扫描 DOM 注释补充替换
    const inlineSvgRoots = '.app-nav, .cover, .sidebar'
    const inlineSvgCommentMarkup = /^svg:([A-Za-z0-9_.]+)$/

    function replaceInlineSvgComments(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
        const commentNodes = []
        let node = walker.nextNode()
        while (node) {
            if (inlineSvgCommentMarkup.test(node.nodeValue.trim())) commentNodes.push(node)
            node = walker.nextNode()
        }

        commentNodes.forEach(comment => {
            const identifier = comment.nodeValue.trim().slice('svg:'.length)
            const svg = resolveIcon(identifier)
            if (!svg) return

            const span = document.createElement('span')
            span.className = 'inline-svg'
            span.innerHTML = svg
            comment.replaceWith(span)
        })
    }

    function scanInlineSvg() {
        document.querySelectorAll(inlineSvgRoots).forEach(replaceInlineSvgComments)
    }

    let inlineSvgScanPending = false

    function scheduleInlineSvgScan() {
        if (inlineSvgScanPending) return
        inlineSvgScanPending = true
        requestAnimationFrame(() => {
            inlineSvgScanPending = false
            scanInlineSvg()
        })
    }

    hook.mounted(function () {
        initializeReplacer()
        initializeTags()

        new MutationObserver(scheduleInlineSvgScan).observe(document.body, {
            childList: true,
            subtree: true
        })
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
        if (!hasAnyMarker && content.includes(inlineSvgMarkerPrefix)) {
            hasAnyMarker = true
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
        scanInlineSvg()

        const firstBriefNote = getEl('.brief-comments-container details:first-of-type')
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
