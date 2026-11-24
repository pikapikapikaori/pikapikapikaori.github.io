export const GRAMMAR_FILES = [
    'la', 'grc', 'he', 'sa', 'mnc', 'ja', 'zh-cls', 'en', 'fr', 'de',
]

export const EXTERNAL_SOURCES = [
    { id: 'wiktionary', label: 'Wiktionary', file: 'wiktionary' },
]

export const EXTERNAL_BASE = new URL('../../external/js/', import.meta.url)

export const DEFAULT_DATA_SOURCE = {
    file: 'pikapikapi-20261111-1101.json',
    base: new URL('../../../data/user/', import.meta.url)
}

export const ANALYZE_SOURCES = [
    { id: 'perseus', label: 'Perseus', file: 'perseus', langs: ['grc', 'la'] },
]

export const SCRIPT_POPUP_LANGS = {
    mnc: /[\u1800-\u18AF]/
}

export const BREVE_LANGS = ['la', 'grc']

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
    user: 'grammar:user',
    theme: 'grammar:theme',
    font: 'grammar:font:mode',
    fontFamily: 'grammar:font:family',
    fontSize: 'grammar:font:size',
    defaultSourceUser: 'grammar:default-source-user',
}

export const DEFAULT_SETTINGS = {
    theme: 'auto',
    fontMode: 'default',
    fontFamily: null,
    fontUrl: null,
    pageSize: 30,
    reviewOrder: 'mastery-asc',
    defaultSource: 'manual',
    sortField: 'addedAt',
    sortOrder: 'desc',
    languageOrder: [],
    groupOrder: ['classical', 'modern'],
}
