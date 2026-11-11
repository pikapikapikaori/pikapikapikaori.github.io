/** 全站配置：只放数据，不放函数。 */

export const GRAMMAR_FILES = [
    'la', 'grc', 'he', 'sa', 'mnc', 'ja', 'zh-cls', 'en', 'fr', 'de',
]

export const EXTERNAL_SOURCES = [
    { id: 'wiktionary', label: 'Wiktionary', file: 'wiktionary' },
]

export const EXTERNAL_BASE = new URL('../../external/js/', import.meta.url)

/** 起始页的默认数据源：随站点一起发布的用户 JSON */
export const DEFAULT_DATA_SOURCE = {
    file: 'pikapikapi-20261111-1101.json',
    base: new URL('../../../data/user/', import.meta.url)
}

export const ANALYZE_SOURCES = [
    { id: 'perseus', label: 'Perseus', file: 'perseus', langs: ['grc', 'la'] },
]

/** 能弹「原文预览浮层」的语言：值是判断元素里有没有该文字的字符范围 */
export const SCRIPT_POPUP_LANGS = {
    // 传统蒙古文、满文、锡伯文，U+1800 – U+18AF
    mnc: /[\u1800-\u18AF]/
}

/** 有短音符（˘）的语言，见 utils/breve.js */
export const BREVE_LANGS = ['la', 'grc']

/** 搜索时把查询串同时展开成「原文 + 转写」的语言 */
export const SCRIPT_SEARCH_LANGS = ['sa', 'grc', 'he', 'mnc']

export const POS_LIST = [
    { value: 'noun',      label: '名词' },
    { value: 'verb',      label: '动词' },
    { value: 'adj',       label: '形容词' },
    { value: 'adv',       label: '副词' },
    { value: 'pron',      label: '代词' },
    { value: 'prep',      label: '前置介词' },
    { value: 'postp',     label: '后置介词' },
    { value: 'ambip',     label: '中置介词' },
    { value: 'conj',      label: '连词' },
    { value: 'particle',  label: '助词' },
    { value: 'participle', label: '分词' },
    { value: 'num',       label: '数词' },
    { value: 'interj',    label: '感叹词' },
    { value: 'other',     label: '其它' },
]

export const WORD_SOURCE_OPTIONS = [
    { value: 'manual', label: '手动' },
    ...EXTERNAL_SOURCES.map((s) => ({ value: s.id, label: s.label })),
]

export const THEMES = [
    { value: 'auto',  label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark',  label: '深色' },
]

export const PAGE_SIZE_OPTIONS = [20, 30, 40, 50]

export const LS_KEYS = {
    user: 'ln.currentUser',
    theme: 'ln.theme',
    font: 'ln.font.mode',
    fontFamily: 'ln.font.family',
    fontSize: 'ln.font.size',
    defaultSourceUser: 'ln.defaultSourceUser',
}

export const DEFAULT_SETTINGS = {
    theme: 'auto',              // auto | light | dark
    fontMode: 'default',        // default | system | local
    fontFamily: null,           // local 模式下的字体名
    fontUrl: null,              // local 模式下的 objectURL（仅本次会话有效，不持久化）
    pageSize: 30,               // PAGE_SIZE_OPTIONS 之一
    reviewOrder: 'mastery-asc', // mastery-asc | added-desc | random
    defaultSource: 'manual',    // WORD_SOURCE_OPTIONS 里的 value
    sortField: 'addedAt',       // addedAt | encounterCount | mastery | lemma
    sortOrder: 'desc',          // asc | desc
    languageOrder: [],          // 用户自定义的语言排列顺序
    groupOrder: ['classical', 'modern'],
}
