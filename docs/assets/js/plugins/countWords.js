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
        roughTime = Math.ceil(result.total.time)
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
        <div id="count-words-block-span-div" style="
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
