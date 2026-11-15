import { calLocalized } from '../utils/localization.js'
import { countText } from '../utils/common.js'
import { getElById } from '../utils/dom.js'

export const countWordsBlockId = 'count-words-block-span-div'

let countWordsOptions = {
    enable: false,
    countable: true,
    position: 'top',
    float: 'right',
    fontsize: '0.9em',
    localization: {
        words: 'words',
        minute: 'min',
    },
    isExpected: true,
}

function plugin(hook, vm) {
    if (!countWordsOptions.enable) return

    if (!countWordsOptions.countable) {
        return
    }
    let wordsCount, roughTime

    hook.beforeEach(function (content) {
        const result = countText(content)
        wordsCount = result.total.count
        roughTime = Math.ceil(result.total.time)
        return content
    })
    hook.doneEach(function () {
        let tempLocalization = calLocalized(countWordsOptions.localization, undefined)

        let str = wordsCount + ' ' + tempLocalization.words
        let readTime = roughTime + ' ' + tempLocalization.minute

        const countWordsEl = getElById('count-words-block-span')
        if (!countWordsEl) return

        countWordsEl.innerText = str.concat(' | ').concat(countWordsOptions.isExpected ? readTime : '')
    })
    hook.afterEach(function (html, next) {
        next(
            `
        ${countWordsOptions.position === 'bottom' ? html : ''}
        <div id="${countWordsBlockId}" style="
            --count-words-float: ${countWordsOptions.float === 'right' ? 'right' : 'left'};
            --count-words-font-size: ${countWordsOptions.fontsize};">
            <span id="count-words-block-span"></span>
            <div class="count-words-block-clear"></div>
        </div>
        ${countWordsOptions.position !== 'bottom' ? html : ''}
        `
        )
    })
}

window.$docsify['countWords'] = Object.assign(
    countWordsOptions,
    window.$docsify['countWords']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
