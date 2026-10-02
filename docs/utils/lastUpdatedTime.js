import pathNameData from '../config/tocdata.json.js'

function plugin(hook, vm) {
    const codeMarkup = /(```[\s\S]*?```)/g

    hook.beforeEach(function (content) {
        const matched = pathNameData.find(item => item.href === vm.route.path)
        const updated = (matched && matched.editedTime) ? matched.editedTime : '---'

        // 1. 保护代码块
        const codeBlocks = []
        content = content.replace(codeMarkup, (block) => {
            const marker = `<!-- last-updated-code-${codeBlocks.length} -->`
            codeBlocks.push(block)
            return marker
        })

        // 2. 替换占位符
        content = content.replace(/{docsify-last-updated}/g, () => updated)

        // 3. 还原代码块
        codeBlocks.forEach((block, i) => {
            content = content.replace(`<!-- last-updated-code-${i} -->`, () => block)
        })

        return content
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
