/**
 * 语言元数据
 * code 与 /data/grammar/{code}.json 对应
 */

export const LANGUAGES = [
    { code: 'la',     name: '拉丁语',       native: 'Latina',       rtl: false },
    { code: 'grc',    name: '古希腊语',     native: 'Ἑλληνική',     rtl: false },
    { code: 'he',     name: '圣经希伯来语', native: 'עברית',        rtl: true  },
    { code: 'sa',     name: '梵语',         native: 'संस्कृतम्',     rtl: false },
    { code: 'mnc',    name: '满语',         native: 'ᠮᠠᠨᠵᡠ',        rtl: false },
    { code: 'ja',     name: '现代日语',     native: '日本語',        rtl: false },
    { code: 'ja-cls', name: '古典日语',     native: '古文',          rtl: false },
    { code: 'zh-cls', name: '古汉语',       native: '文言',          rtl: false },
    { code: 'en',     name: '现代英语',     native: 'English',      rtl: false },
    { code: 'fr',     name: '法语',         native: 'Français',     rtl: false },
    { code: 'de',     name: '德语',         native: 'Deutsch',      rtl: false }
]

export const LANGUAGE_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]))

export function getLanguage(code) {
    return LANGUAGE_MAP[code] || null
}

export function languageName(code) {
    const l = LANGUAGE_MAP[code]
    return l ? l.name : code
}
