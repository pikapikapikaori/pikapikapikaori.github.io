import pathNameData from '../config/tocdata.json.js'
import { protectCodeBlocks, codeBlockModes, formatDate } from '../utils/common.js'
import { calLocalized } from '../utils/localization.js'

let lastUpdatedTimeOptions = {
    enable: false
}

function plugin(hook, vm) {
    if (!lastUpdatedTimeOptions.enable) return

    hook.beforeEach(function (content) {
        const pluginIdentifier = 'last_updated_code'

        const matched = pathNameData.find(item => item.href === vm.route.path)
        const dateFormat = calLocalized({dateFormat: lastUpdatedTimeOptions.dateFormat}, vm.route.path).dateFormat
        const updated = matched?.editedTime ? formatDate(matched.editedTime, dateFormat) : '---'

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
