const hexRegex = /#[a-f\d]{3}(?:[a-f\d]?|(?:[a-f\d]{3}(?:[a-f\d]{2})?)?)\b/gim
const hslRegex = /\bhsla?\((?:(-?\d+(?:deg|g?rad|turn)?),\s*((?:\d{1,2}|100)%),\s*((?:\d{1,2}|100)%)(?:,\s*((?:\d{1,2}|100)%|0(?:\.\d+)?|1))?|(-?\d+(?:deg|g?rad|turn)?)\s+((?:\d{1,2}|100)%)\s+((?:\d{1,2}|100)%)(?:\s+((?:\d{1,2}|100)%|0(?:\.\d+)?|1))?)\)/gim
const rgbRegex = /\brgba?\((?:(25[0-5]|2[0-4]\d|1?\d{1,2}|(?:\d{1,2}|100)%),\s*(25[0-5]|2[0-4]\d|1?\d{1,2}|(?:\d{1,2}|100)%),\s*(25[0-5]|2[0-4]\d|1?\d{1,2}|(?:\d{1,2}|100)%)(?:,\s*((?:\d{1,2}|100)%|0(?:\.\d+)?|1))?|(25[0-5]|2[0-4]\d|1?\d{1,2}|(?:\d{1,2}|100)%)\s+(25[0-5]|2[0-4]\d|1?\d{1,2}|(?:\d{1,2}|100)%)\s+(25[0-5]|2[0-4]\d|1?\d{1,2}|(?:\d{1,2}|100)%)(?:\s+((?:\d{1,2}|100)%|0(?:\.\d+)?|1))?)\)/gim

const colorPattern = new RegExp(
    `(?:${hexRegex.source})|(?:${hslRegex.source})|(?:${rgbRegex.source})`,
    'gi'
)

const swatchClass = 'color-swatch'

function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []

    let node = walker.nextNode()
    while (node !== null) {
        nodes.push(node)
        node = walker.nextNode()
    }

    return nodes
}

function findColors(text) {
    const colors = []

    colorPattern.lastIndex = 0
    let match = colorPattern.exec(text)
    while (match !== null) {
        colors.push({ index: match.index, color: match[0] })
        match = colorPattern.exec(text)
    }

    return colors
}

function locate(nodes, index) {
    let offset = index

    for (const node of nodes) {
        const length = node.nodeValue.length
        if (offset < length) {
            return { node, offset }
        }
        offset -= length
    }

    return null
}

function insertSwatchBefore(node, offset, color) {
    const swatch = document.createElement('span')
    swatch.className = swatchClass
    swatch.style.backgroundColor = color

    const anchor = offset === 0 ? node : node.splitText(offset)
    anchor.parentNode.insertBefore(swatch, anchor)
}

function decorateCodeElement(codeElement) {
    const nodes = collectTextNodes(codeElement)
    if (nodes.length === 0) return

    // 代码块会被 Prism 拆成多个 token，因此按元素的完整文本匹配，再映射回文本节点
    const text = nodes.map(node => node.nodeValue).join('')
    const colors = findColors(text)
    if (colors.length === 0) return

    // 从后往前插入，避免 splitText 影响后续匹配点的定位
    for (let i = colors.length - 1; i >= 0; i--) {
        const position = locate(nodes, colors[i].index)
        if (position) {
            insertSwatchBefore(position.node, position.offset, colors[i].color)
        }
    }
}

function plugin(hook, vm) {
    hook.doneEach(function () {
        const section = document.querySelector('.markdown-section')
        if (!section) return

        section.querySelectorAll('code').forEach(decorateCodeElement)
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
