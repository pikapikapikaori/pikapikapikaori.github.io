/**
 * 古希腊语的「转写 ⇄ 希腊字母」档案（与 sa / mnc 的 script.js 同一套协议：toScript / toRoman / hasScript）。
 *
 * 输入方案：
 *   字母   a→α b→β g→γ d→δ e→ε z→ζ h→η q→θ i→ι k→κ l→λ m→μ n→ν x→ξ o→ο p→π
 *          r→ρ s→σ/ς t→τ u→υ f→φ c→χ y→ψ w→ω v→ϝ
 *   双字母 th→θ ph→φ kh→χ ch→χ ps→ψ ks→ξ rh→ῥ ē/ee→η ō/oo→ω
 *   气符   词首 h + 元音 = 粗气（ho → ὁ）；词首元音默认柔气（anthropos → ἀνθροπος）；
 *          其余位置的 h 就是 η（hmera → ἠμερα）
 *   重音 / 音长 / 分音 / iota 下标**不由转写处理**，交给输入助手的修饰符或键盘符号键。
 *
 * toRoman 供「显示转写」使用：还原字母与气符，丢掉重音等正字法附加信息。
 */

const VOWELS = 'αεηιουω'
const ROUGH = '\u0314'
const SMOOTH = '\u0313'
const GREEK = /[\u0370-\u03FF\u1F00-\u1FFF]/

/** 拉丁 → 希腊（长的先匹配） */
const TO_GREEK = [
    ['th', 'θ'], ['ph', 'φ'], ['kh', 'χ'], ['ch', 'χ'], ['ps', 'ψ'], ['ks', 'ξ'],
    ['ee', 'η'], ['oo', 'ω'], ['rh', 'ῥ'],
    ['ē', 'η'], ['ō', 'ω'],
    ['a', 'α'], ['b', 'β'], ['g', 'γ'], ['d', 'δ'], ['e', 'ε'], ['z', 'ζ'], ['h', 'η'],
    ['q', 'θ'], ['i', 'ι'], ['k', 'κ'], ['l', 'λ'], ['m', 'μ'], ['n', 'ν'], ['x', 'ξ'],
    ['o', 'ο'], ['p', 'π'], ['r', 'ρ'], ['s', 'σ'], ['t', 'τ'], ['u', 'υ'], ['f', 'φ'],
    ['c', 'χ'], ['y', 'ψ'], ['w', 'ω'], ['v', 'ϝ']
]

/** 希腊 → 拉丁（可读的转写；ς 也写 s） */
const TO_ROMAN = {
    α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'ē', θ: 'th', ι: 'i',
    κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'ks', ο: 'o', π: 'p', ρ: 'r', σ: 's',
    ς: 's', τ: 't', υ: 'u', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'ō', ῥ: 'rh',
    /* 古字母与变体（只出现在词典词条里，转写用惯例写法） */
    ϝ: 'w', Ϝ: 'W', ϛ: 'st', ϟ: 'q', ϙ: 'q', Ϙ: 'Q', ϡ: 'ss', Ͳ: 'SS',
    ϻ: 's', Ϻ: 'S', ϗ: 'k', Ϗ: 'K', ⳤ: 'K',
    ϐ: 'b', ϑ: 'th', ϰ: 'k', ϕ: 'ph', ϱ: 'r', ϖ: 'p',
    Ͻ: 'ss', Ͼ: 'ss', Ͽ: 'ss'
}

function tokenAt(word, index) {
    for (const [from, char] of TO_GREEK) {
        if (word.startsWith(from, index)) return { char, length: from.length }
    }
    return null
}

function convertWord(word) {
    let i = 0
    let rough = false

    // 词首：rh → ῥ（rh 本身带粗气）；h + 元音 → 粗气
    let rhoRough = false
    if (word.startsWith('rh')) { i = 2; rhoRough = true }
    else if (word[0] === 'h' && word.length > 1) {
        const next = tokenAt(word, 1)
        if (next && VOWELS.includes(next.char)) { rough = true; i = 1 }
    }

    let out = rhoRough ? 'ῥ' : ''
    let atStart = i === 0 || rough
    while (i < word.length) {
        const hit = tokenAt(word, i)
        if (!hit) { out += word[i]; i += 1; atStart = false; continue }
        let char = hit.char
        i += hit.length

        if (atStart && VOWELS.includes(char)) char = (char + (rough ? ROUGH : SMOOTH)).normalize('NFC')
        if (char === 'σ' && !/[a-zēō]/.test(word[i] || '')) char = 'ς'
        out += char
        atStart = false
    }
    return out
}

/** 拉丁转写 → 希腊字母（逐词替换，标点与空格原样保留） */
export function toScript(input) {
    // 只处理拉丁字母构成的词；已经是希腊文（含 Ϙ ϡ 这类古字母）的部分原样保留
    return String(input ?? '').replace(/[A-Za-zēō]+/g, (word) => convertWord(word.toLowerCase()))
}

/** 希腊字母 → 拉丁转写 */
export function toRoman(input) {
    const chars = [...String(input ?? '').normalize('NFD')]
    let out = ''
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]
        if (/\p{M}/u.test(ch)) continue
        const marks = []
        let j = i + 1
        while (j < chars.length && /\p{M}/u.test(chars[j])) { marks.push(chars[j]); j += 1 }
        const latin = TO_ROMAN[ch]
        if (!latin) { out += ch; continue }
        if (marks.includes(ROUGH) && ch === 'ρ') { out += 'rh'; continue }
        // 粗气写成 h 前缀
        if (marks.includes(ROUGH) && VOWELS.includes(ch)) out += 'h'
        out += latin
    }
    return out
}

export function hasScript(text) {
    return GREEK.test(String(text ?? ''))
}

export const scriptRange = GREEK
export const scriptRangeRegExp = GREEK
