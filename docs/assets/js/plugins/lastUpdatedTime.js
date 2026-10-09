import pathNameData from '../config/tocdata.json.js'
import { protectCodeBlocks } from '../utils/common.js'

function plugin(hook, vm) {
    hook.beforeEach(function (content) {
        const pluginIdentifier = 'last_updated_code'

        const matched = pathNameData.find(item => item.href === vm.route.path)
        const updated = (matched && matched.editedTime) ? matched.editedTime : '---'

        content = protectCodeBlocks(content, pluginIdentifier, 'protect')

        content = content.replace(/{docsify-last-updated}/g, () => updated)

        content = protectCodeBlocks(content, pluginIdentifier, 'restore')

        return content
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
