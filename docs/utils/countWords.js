// default values
var countWordsOptions = {
    countable: true,
    position: 'top',
    margin: '10px',
    float: 'right',
    fontsize: '0.9em',
    color: 'rgb(90,90,90)',
    localization: {
        words: 'words',
        minute: 'min',
    },
    isExpected: true,
}

// Docsify plugin functions
function plugin(hook, vm) {
    if (!countWordsOptions.countable) {
        return
    }
    let wordsCount
    hook.beforeEach(function (content) {
        // Match regex every time you start parsing .md
        wordsCount = content.match(
            /([\u0800-\u4e00]+?|[\u4e00-\u9fa5]+?|[a-zA-Z0-9]+)/g
        ).length
        return content
    })
    hook.doneEach(function () {
        let tempLocalization = {
            words: '',
            minute: '',
        }
        // Update countWords.localization strings
        Object.keys(tempLocalization).forEach(key => {
            const textValue = countWordsOptions.localization[key]

            if (typeof textValue === 'string') {
                tempLocalization[key] = textValue
            }
            else if (typeof textValue === 'object') {
                Object.keys(textValue).some(match => {
                    const isMatch = location.href.indexOf(match) > -1

                    tempLocalization[key] = isMatch ? textValue[match] : countWordsOptions.localization[key]

                    return isMatch
                })
            }
        })

        // Support localization
        let str = wordsCount + ' ' + tempLocalization.words
        let readTime = Math.ceil(wordsCount / 400) + ' ' + tempLocalization.minute

        document.getElementById('count-words-block-span').innerText = str.concat(' | ').concat(countWordsOptions.isExpected ? readTime : '')
    })
    hook.afterEach(function (html, next) {
        // add html string
        next(
            `
        ${countWordsOptions.position === 'bottom' ? html : ''}
        <div id="count-words-block-span-div" style="margin-${countWordsOptions.position ? 'bottom' : 'top'}: ${countWordsOptions.margin
        };">
            <span id="count-words-block-span" style="
                  float: ${countWordsOptions.float === 'right' ? 'right' : 'left'};
                  font-size: ${countWordsOptions.fontsize};
                  color:${countWordsOptions.color};">
            </span>
            <div style="clear: both"></div>
        </div>
        ${countWordsOptions.position !== 'bottom' ? html : ''}
        `
        )
    })
}

// Docsify plugin options
window.$docsify['countWords'] = Object.assign(
    countWordsOptions,
    window.$docsify['countWords']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
