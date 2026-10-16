/**
 * 语言元数据
 *
 * code       语言 code，与 /data/grammar/{code}.json 对应
 * name       中文名
 * native     本语言书写形式
 * classical  是否古典语言（数据保留，暂不驱动行为）
 * vertical   是否纵向书写（满语 true，其他 false）
 * rtl        是否从右到左（希伯来 true）
 */

export const LANGUAGES = [
    { code: 'la',     name: '拉丁语',       native: 'Latina',    classical: true,  vertical: false, rtl: false },
    { code: 'grc',    name: '古希腊语',     native: 'Ἑλληνική',  classical: true,  vertical: false, rtl: false },
    { code: 'he',     name: '圣经希伯来语', native: 'עברית',     classical: false, vertical: false, rtl: true  },
    { code: 'sa',     name: '梵语',         native: 'संस्कृतम्',  classical: true,  vertical: false, rtl: false },
    { code: 'mnc',    name: '满语',         native: 'ᠮᠠᠨᠵᡠ',     classical: true,  vertical: true,  rtl: false },
    { code: 'ja',     name: '现代日语',     native: '日本語',     classical: false, vertical: false, rtl: false },
    { code: 'ja-cls', name: '古典日语',     native: '古文',       classical: true,  vertical: false, rtl: false },
    { code: 'zh-cls', name: '古汉语',       native: '文言',       classical: true,  vertical: false, rtl: false },
    { code: 'en',     name: '现代英语',     native: 'English',   classical: false, vertical: false, rtl: false },
    { code: 'fr',     name: '法语',         native: 'Français',  classical: false, vertical: false, rtl: false },
    { code: 'de',     name: '德语',         native: 'Deutsch',   classical: false, vertical: false, rtl: false }
]

export const LANGUAGE_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]))

export function getLanguage(code) {
    return LANGUAGE_MAP[code] || null
}

export function languageName(code) {
    const l = LANGUAGE_MAP[code]
    return l ? l.name : code
}
