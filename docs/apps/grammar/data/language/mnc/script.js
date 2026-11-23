const LETTERS = [
    ['ts\'i', '\u186E\u185F'], ['cy', '\u1871\u1873'],
    ['jy', '\u1877\u1873'], ['sy', '\u1830\u185F'],
    ['k\'', '\u183A'], ['g\'', '\u186C'], ['h\'', '\u186D'],
    ['ts\'', '\u186E'], ['dz', '\u186F'], ['ž', '\u1870'],
    ['c\'', '\u1871'], ['j\'', '\u1877'],
    ['ng', '\u1829'],
    ['a', '\u1820'], ['e', '\u185D'], ['i', '\u1873'], ['o', '\u1823'],
    ['u', '\u1860'], ['ū', '\u1861'],
    ['n', '\u1828'], ['k', '\u1874'], ['g', '\u1864'], ['h', '\u1865'],
    ['b', '\u182A'], ['p', '\u1866'], ['s', '\u1830'], ['š', '\u1867'],
    ['t', '\u1868'], ['d', '\u1869'], ['m', '\u182E'], ['l', '\u182F'],
    ['r', '\u1875'], ['j', '\u1835'], ['c', '\u1834'], ['f', '\u1876'],
    ['w', '\u1838'], ['y', '\u1836']
]

const MAX_KEY = Math.max(...LETTERS.map(([roman]) => [...roman].length))

const SCRIPT_TABLE = [...LETTERS, ['y', '\u185F']]
    .sort((a, b) => [...b[1]].length - [...a[1]].length)
const MAX_SCRIPT = Math.max(...SCRIPT_TABLE.map(([, script]) => [...script].length))

export const SCRIPT_RANGE = /[\u1800-\u18AF]/

export const scriptRange = SCRIPT_RANGE

export function hasScript(text) {
    return SCRIPT_RANGE.test(String(text ?? ''))
}

function normalizeRoman(text) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/[–—]/g, '-')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.replace(/^-+|-+$/g, ''))
        .join(' ')
}

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

export function toRoman(text) {
    const chars = [...String(text ?? '')]
    let out = ''
    let i = 0
    while (i < chars.length) {
        let matched = false
        for (let len = MAX_SCRIPT; len >= 1; len -= 1) {
            const chunk = chars.slice(i, i + len).join('')
            const hit = SCRIPT_TABLE.find(([, script]) => script === chunk)
            if (hit) {
                out += hit[0]
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
