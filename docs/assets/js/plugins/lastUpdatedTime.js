import pathNameData from '../config/tocdata.json.js'
import { protectCodeBlocks, codeBlockModes } from '../utils/common.js'

let lastUpdatedTimeOptions = {
    enable: false
}

function plugin(hook, vm) {
    if (!lastUpdatedTimeOptions.enable) return

    hook.beforeEach(function (content) {
        const pluginIdentifier = 'last_updated_code'

        const matched = pathNameData.find(item => item.href === vm.route.path)
        const updated = (matched && matched.editedTime) ? matched.editedTime : '---'

        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.protect)

        content = content.replace(/{docsify-last-updated}/g, () => updated)

        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.restore)

        return content
    })
}

window.$docsify['lastUpdatedTime'] = Object.assign(
    lastUpdatedTimeOptions,
    window.$docsify['lastUpdatedTime']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
