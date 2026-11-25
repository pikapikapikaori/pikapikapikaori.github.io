import pathNameData from '../config/tocdata.json.js'
import { protectCodeBlocks, codeBlockModes, formatDate } from '../utils/common.js'
import { calLocalized } from '../utils/localization.js'

const articleDateOptions = {
    enable: false
}

function plugin(hook, vm) {
    if (!articleDateOptions.enable) return

    hook.beforeEach(function (content) {
        const pluginIdentifier = 'article_date_code'

        const matched = pathNameData.find(item => item.href === vm.route.path)
        const dateFormat = calLocalized({dateFormat: articleDateOptions.dateFormat}, vm.route.path).dateFormat
        const created = matched?.createdTime ? formatDate(matched.createdTime, dateFormat) : '---'
        const updated = matched?.editedTime ? formatDate(matched.editedTime, dateFormat) : '---'

        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.protect)

        content = content.replace(/{ad-created}/g, () => created).replace(/{ad-last-updated}/g, () => updated)

        content = protectCodeBlocks(content, pluginIdentifier, codeBlockModes.restore)

        return content
    })
}

window.$docsify['articleDate'] = Object.assign(
    articleDateOptions,
    window.$docsify['articleDate']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
