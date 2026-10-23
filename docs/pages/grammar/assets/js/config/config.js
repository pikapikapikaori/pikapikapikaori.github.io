/**
 * 全站配置
 *
 * 只放「站点级」的约定：要加载哪些语言、有哪些外部数据源、界面枚举、存储键、默认设置。
 * 不放各个模块自己的解析表与实现细节（如 Wiktionary 的模板名映射写在 `external/js/` 里）。
 *
 * 本文件不 import 其它模块，避免与 store / models 形成环。
 */

/* ---------------- 语言数据 ---------------- */

/** 要加载的语言文件：`data/grammar/{code}.json`（顺序无所谓，显示顺序由 JSON 里的 group.order / order 决定） */
export const GRAMMAR_FILES = [
    'la', 'grc', 'he', 'sa', 'mnc', 'ja', 'zh-cls', 'en', 'fr', 'de',
]

/* ---------------- 外部数据源 ---------------- */

/**
 * 外部数据源清单：对应 `external/js/{file}.js`
 *
 * 每个文件必须导出 `lookupWordForForm({ lemma, langCode, preferredPos, grammarDoc })`
 * → `{ pos, meanings, examples, paradigm, inflections, summary } | null`。
 * 生词表单按这份清单逐个动态 import，一个源一个查询按钮；加载失败的源不显示。
 */
export const EXTERNAL_SOURCES = [
    { id: 'wiktionary', label: 'Wiktionary', file: 'wiktionary' },
]

/** 外部数据源模块的根路径 */
export const EXTERNAL_BASE = new URL('../../../external/js/', import.meta.url)

/* ---------------- 文字处理 ---------------- */

/**
 * 需要「原文预览浮层」（hover / click 弹出原文）的语言。
 * 键是语言 code，值是用来判断元素里是否真有该文字的脚本范围；不写正则则一律允许。
 * 与是否竖写无关 —— 竖写只影响浮层的样式（看 languages.js 里的 `vertical`）。
 */
export const SCRIPT_POPUP_LANGS = {
    // 传统蒙古文 / 满文 / 锡伯文，U+1800 – U+18AF
    mnc: /[\u1800-\u18AF]/
}

/**
 * 检索时同时匹配「原文」与「转写副本」（Word.paradigmRoman）的语言。
 * 不在列表里的语言只按自己的文字检索（如梵语只搜天城体、日语只搜假名与和制汉字）。
 */
export const TRANSLIT_SEARCH_LANGS = ['mnc']

/**
 * 检索时把查询串同时展开成「原文 + 转写」的语言。
 * 梵语数据存天城体，用户可能输入 IAST，两边都要能命中。
 */
export const SCRIPT_SEARCH_LANGS = ['sa']

/**
 * 渲染时用 <bdi> 包住文字的语言：文字本身的书写方向与界面不同（竖写 / RTL），
 * 不包的话会影响周围的标点与排版。值是**该文字的 Unicode 范围** —— 只有命中的字符才会被包进 <bdi>，
 * 同一格里的中文、拉丁转写等保持原样（如 `<td lang="he">מִי（人）/ מָה（物）</td>` 只包 מִי 与 מָה）。
 * `dir` 由语言元数据决定（`rtl: true` → "rtl"，否则 "auto"）。
 */
export const BDI_LANGS = {
    // 传统蒙古文 / 满文 / 锡伯文
    mnc: /[\u1800-\u18AF]/,
    // 希伯来文（含元音点与重复号）
    he: /[\u0590-\u05FF\uFB1D-\uFB4F]/
}

/* ---------------- 词条枚举 ---------------- */

/** 词性；顺序即展示顺序 */
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

/** 某个语言可用的词性（JSON 顶层 `pos` 数组；缺省用全局清单） */
export function posOptions(posValues) {
    const values = Array.isArray(posValues) && posValues.length
        ? posValues
        : POS_LIST.map((p) => p.value)
    const set = new Set(values)
    return POS_LIST.filter((p) => set.has(p.value))
}

/** 语法性；顺序即展示顺序 */
export const GENDERS = [
    { value: 'm', label: '阳性' },
    { value: 'f', label: '阴性' },
    { value: 'n', label: '中性' },
]

/** 词条来源：手动 + 各外部源 */
export const WORD_SOURCE_OPTIONS = [
    { value: 'manual', label: '手动' },
    ...EXTERNAL_SOURCES.map((s) => ({ value: s.id, label: s.label })),
]

/* ---------------- 界面 ---------------- */

/** 主题：值 / 显示名；数组顺序即切换顺序 */
export const THEMES = [
    { value: 'auto',  label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark',  label: '深色' },
]

/** 每页卡片数可选值 */
export const PAGE_SIZE_OPTIONS = [20, 30, 40, 50]

/* ---------------- 本地存储 ---------------- */

export const LS_KEYS = {
    user: 'ln.currentUser',
    theme: 'ln.theme',
    font: 'ln.font.mode',
    fontFamily: 'ln.font.family',
}

/* ---------------- 用户设置默认值 ---------------- */

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
