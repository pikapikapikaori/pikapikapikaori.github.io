/**
 * 根据当前 URL 从本地化配置中取出对应语言的文案
 *
 * @param {Object} localization 本地化配置对象
 *   结构示例：
 *   {
 *     info: {
 *       '/jp/': '情報',
 *       '/en-us/': 'Info',
 *       '/zh-cn/': '信息',
 *       default: 'Info' // 可选：没有匹配到时使用
 *     },
 *     title: {
 *       '/jp/': 'タイトル',
 *       '/en-us/': 'Title',
 *       '/zh-cn/': '标题'
 *     }
 *   }
 *
 * @param {string} [href] 当前地址，默认使用 location.href
 *
 * @returns {Object} 例如 { info: '信息', title: '标题' }
 */
export function calLocalized(localization, href) {
    const currentHref =
        href || (typeof location !== 'undefined' ? location.href : '')

    const result = {}

    Object.keys(localization).forEach(key => {
        const translations = localization[key]

        if (typeof translations === 'string') {
            result[key] = translations
            return
        }

        if (
            !translations ||
            typeof translations !== 'object' ||
            Array.isArray(translations)
        ) {
            return
        }

        const matchedKey = Object.keys(translations).find(rule => {
            if (rule === 'default') return false

            return currentHref.indexOf(rule) > -1
        })

        if (matchedKey) {
            result[key] = translations[matchedKey]
        } else if ('default' in translations) {
            result[key] = translations.default
        } else {
            result[key] = ''
        }
    })

    return result
}
