/**
 * 圣经希伯来语的「转写 ⇄ 希伯来字母」档案（与 sa / mnc / grc 的 script.js 同一套协议）。
 *
 * 输入方案（元音点默认**短**音，点错了用户自己在「修饰符」里改）：
 *   辅音  b→ב g→ג d→ד h→ה v/w→ו z→ז kh→ח t→ט y→י k→כ l→ל m→מ n→נ s→ס `→ע
 *         p→פ ts→צ q→ק r→ר sh→ש th→ת（t 也写作 ת）
 *   元音  a→ַ e→ֶ i→ִ o→ֹ u→ֻ ə→ְ
 *   词尾形 词末的 k/m/n/p/ts 自动写成 ך ם ן ף ץ
 *
 * 重音（连重音）、dagesh、shin/sin 点**不由转写处理**，交给修饰符或键盘符号键。
 */

const CONSONANTS = [
    ['sh', 'ש'], ['kh', 'ח'], ['ts', 'צ'], ['th', 'ת'],
    ['b', 'ב'], ['g', 'ג'], ['d', 'ד'], ['h', 'ה'], ['v', 'ו'], ['w', 'ו'],
    ['z', 'ז'], ['t', 'ט'], ['y', 'י'], ['k', 'כ'], ['l', 'ל'], ['m', 'מ'],
    ['n', 'נ'], ['s', 'ס'], ['p', 'פ'], ['q', 'ק'], ['r', 'ר'], ['`', 'ע']
]

const VOWELS = {
    a: '\u05B7', e: '\u05B6', i: '\u05B4', o: '\u05B9', u: '\u05BB', '\u0259': '\u05B0'
}

const FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' }

const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/

const TO_ROMAN_CONSONANT = {
    'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'kh',
    'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
    'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': '`', 'פ': 'p', 'ף': 'p', 'צ': 'ts',
    'ץ': 'ts', 'ק': 'q', 'ר': 'r', 'ש': 'sh', 'ת': 'th'
}

const TO_ROMAN_VOWEL = {
    '\u05B0': '\u0259', '\u05B4': 'i', '\u05B5': 'e', '\u05B6': 'e',
    '\u05B7': 'a', '\u05B8': 'a', '\u05B9': 'o', '\u05BB': 'u'
}

function consonantAt(word, i) {
    for (const [latin, char] of CONSONANTS) {
        if (word.startsWith(latin, i)) return { char, length: latin.length }
    }
    return null
}

function convertWord(word) {
    let out = ''
    let i = 0
    while (i < word.length) {
        const letter = consonantAt(word, i)
        if (letter) {
            out += letter.char
            i += letter.length
            continue
        }
        const vowel = VOWELS[word[i]]
        if (vowel) { out += vowel; i += 1; continue }
        out += word[i]
        i += 1
    }
    // 词尾形
    const chars = [...out]
    for (let k = chars.length - 1; k >= 0; k--) {
        const base = chars[k].normalize('NFD')[0]
        if (VOWELS && /[\u05B0-\u05BD]/.test(chars[k])) continue
        if (FINAL[base]) { chars[k] = FINAL[base]; break }
        break
    }
    return chars.join('')
}

/** 拉丁转写 → 希伯来字母 + 元音点 */
export function toScript(input) {
    return String(input ?? '').replace(/[A-Za-z`\u0259]+/g, (word) => convertWord(word.toLowerCase()))
}

/** 希伯来字母 + 元音点 → 拉丁转写 */
export function toRoman(input) {
    const nfd = [...String(input ?? '').normalize('NFD')]
    let out = ''
    for (const ch of nfd) {
        if (TO_ROMAN_VOWEL[ch]) { out += TO_ROMAN_VOWEL[ch]; continue }
        if (TO_ROMAN_CONSONANT[ch]) { out += TO_ROMAN_CONSONANT[ch]; continue }
        if (/\p{M}/u.test(ch)) continue
        out += ch
    }
    return out
}

export function hasScript(text) {
    return HEBREW.test(String(text ?? ''))
}

export const scriptRange = HEBREW
export const scriptRangeRegExp = HEBREW
