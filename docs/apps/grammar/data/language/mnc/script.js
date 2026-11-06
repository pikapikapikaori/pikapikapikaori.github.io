/**
 * 满语的「转写 ⇄ 满文」档案（与 data/paradigm/ 同一套加载方式）。
 *
 * 满文的四种位置形是同一个 Unicode 码位，由字体按上下文自动选择，所以「转写 → 满文」
 * 只需要逐字母映射；双字母 / 带撇号的字母优先匹配。字母表与语法页「满文字母」一节一致
 * （基本 25 + 带点 3 + 汉语借词 9）。
 */

/* ---------------- 转写 ↔ 满文 ---------------- */

/*
 * 满文的四种位置形是同一个 Unicode 码位，由字体按上下文自动选择，
 * 所以「转写 → 满文」只需要逐字母映射；双字母 / 带撇号的字母优先匹配。
 * 字母表与语法页「满文字母」一节一致（基本 25 + 带点 3 + 汉语借词 9）。
 */
const LETTERS = [
    // 带点字母（只出现在 e / i 前，用来区分 k g h）
    ['k\'', '\u1863'], ['g\'', '\u186C'], ['h\'', '\u186D'],
    // 汉语借词字母
    ['ts\'', '\u1871'], ['dz\'', '\u1870'], ['j\'', '\u186A'], ['c\'', '\u1872'],
    ['s\'', '\u1878'], ['f\'', '\u186B'],
    ['ts', '\u186E'], ['dz', '\u186F'], ['ž', '\u1877'],
    // 基本字母
    ['ng', '\u1829'],
    ['a', '\u1820'], ['e', '\u185D'], ['i', '\u1873'], ['o', '\u1823'],
    ['u', '\u1860'], ['ū', '\u1861'],
    ['n', '\u1828'], ['k', '\u1874'], ['g', '\u1864'], ['h', '\u1865'],
    ['b', '\u182A'], ['p', '\u1866'], ['s', '\u1830'], ['š', '\u1867'],
    ['t', '\u1868'], ['d', '\u1869'], ['m', '\u182E'], ['l', '\u182F'],
    ['r', '\u1875'], ['j', '\u1835'], ['c', '\u1834'], ['f', '\u1876'],
    ['w', '\u1838'], ['y', '\u1836']
]

const SCRIPT_TO_ROMAN = new Map(LETTERS.map(([roman, script]) => [script, roman]))
const MAX_KEY = Math.max(...LETTERS.map(([roman]) => [...roman].length))

/** 满文脚本的码位范围（竖排文字的判据也用它） */
export const SCRIPT_RANGE = /[\u1800-\u18AF]/

/** 「显示转写」开关按这个范围切分原文片段 */
export const scriptRange = SCRIPT_RANGE

/** 是否含有满文字母 */
export function hasScript(text) {
    return SCRIPT_RANGE.test(String(text ?? ''))
}

/** 转写里只保留词内的连字符：去掉词首 / 词尾的 `-`，`–` / `—` 归一成 `-` */
function normalizeRoman(text) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/[–—]/g, '-')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.replace(/^-+|-+$/g, ''))
        .join(' ')
}

/** 转写 → 满文（表里没有的字符原样保留） */
export function toScript(text) {
    const source = normalizeRoman(text)
    const chars = [...source]
    let out = ''
    let i = 0
    while (i < chars.length) {
        let matched = false
        for (let len = MAX_KEY; len >= 1; len -= 1) {
            const chunk = chars.slice(i, i + len).join('')
            const hit = LETTERS.find(([roman]) => roman === chunk)
            if (hit) {
                out += hit[1]
                i += len
                matched = true
                break
            }
        }
        if (!matched) {
            out += chars[i]
            i += 1
        }
    }
    return out
}

/** 满文 → 转写（表里没有的字符原样保留） */
export function toRoman(text) {
    let out = ''
    for (const ch of String(text ?? '')) {
        out += SCRIPT_TO_ROMAN.get(ch) ?? ch
    }
    return out
}
