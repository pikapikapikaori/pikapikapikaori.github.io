import { calLocalized } from '../utils/localization.js'
import { countText } from '../utils/common.js'

let countWordsOptions = {
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
    if (!countWordsOptions.countable) {
        return
    }
    let wordsCount, roughTime

    hook.beforeEach(function (content) {
        const result = countText(content)
        wordsCount = result.total.count
        roughTime = Math.round(result.total.time)
        return content
    })
    hook.doneEach(function () {
        let tempLocalization = calLocalized(countWordsOptions.localization, undefined)

        let str = wordsCount + ' ' + tempLocalization.words
        let readTime = roughTime + ' ' + tempLocalization.minute

        document.getElementById('count-words-block-span').innerText = str.concat(' | ').concat(countWordsOptions.isExpected ? readTime : '')
    })
    hook.afterEach(function (html, next) {
        next(
            `
        ${countWordsOptions.position === 'bottom' ? html : ''}
        <div id="count-words-block-span-div">
            <span id="count-words-block-span" style="
                float: ${countWordsOptions.float === 'right' ? 'right' : 'left'};
                font-size: ${countWordsOptions.fontsize};">
            </span>
            <div style="clear: both"></div>
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
