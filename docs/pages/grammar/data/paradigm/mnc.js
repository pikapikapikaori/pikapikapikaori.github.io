/**
 * 满语专用的后期处理：元音和谐。
 *
 * 满语是黏着语，词干本身不变，只在后面接后缀。后缀里的元音必须与词干最后
 * 一个元音同类，所以骨架表把那个位置写成占位符 `V`：
 *
 *   -hV  →  -ha（后元音）/ -he（前元音）/ -ho（圆唇）
 *   -sV  →  -sa / -se / -so
 *
 * 分组（与语法页「元音和谐」一节一致）：
 *   后元音 a、ū  → 'a'
 *   前元音 e、u  → 'e'
 *   圆唇   o     → 'o'
 *   i 是中性元音，本身不决定分组：向前找最近的非 i 元音，找不到时按 'e'
 */

const MACRON = '\u0304'
const COMBINING = /\p{M}/u

/**
 * 单个元音的和谐组：
 * - a / ā、o / ō → 后 / 圆唇
 * - u → 前元音；ū（带长音符）→ 后元音
 * - e / ē → 前元音
 * - i 是中性元音，返回 ''（不决定分组）
 */
function groupOf(base, marks) {
    if (base === 'a') return 'a'
    if (base === 'o') return 'o'
    if (base === 'u') return marks.includes(MACRON) ? 'a' : 'e'
    if (base === 'e') return 'e'
    return ''
}

/**
 * 词干的和谐组：从后往前找第一个能定组的元音（i 与附加符号跳过）。
 * 全都找不到时返回 'e'（只有 i 的词干按前元音处理）。
 */
export function harmonyOf(stem) {
    const chars = [...String(stem ?? '').normalize('NFD')]
    for (let i = chars.length - 1; i >= 0; i -= 1) {
        const ch = chars[i]
        if (COMBINING.test(ch)) continue
        const marks = []
        let j = i + 1
        while (j < chars.length && COMBINING.test(chars[j])) {
            marks.push(chars[j])
            j += 1
        }
        const g = groupOf(ch, marks)
        if (g) return g
    }
    return 'e'
}

/** 把后缀里的 `V` 换成与词干和谐的那个元音 */
export function harmonize(stem, suffix) {
    const text = String(suffix ?? '')
    if (!text.includes('V')) return text
    const vowel = harmonyOf(stem)
    return text.split('V').join(vowel)
}

/** 供界面/文档示例用：给一个词干，列出三种和谐结果 */
export function harmonizeOptions(suffix) {
    return ['a', 'e', 'o'].map((v) => String(suffix ?? '').split('V').join(v))
}

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
