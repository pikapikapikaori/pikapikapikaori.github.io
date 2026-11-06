/**
 * 古希腊语：修饰符（还原 / 气符 / 音符 / 音长 / 下标）+ 转写（grc/script.js）+ 键盘。
 *
 * 键盘是四行真实比例（每行 15 单位）：
 *   字母层  字母（q = Ϙ）+ 标点键放组合符（重音、气符、音长、iota）+ 数字行放数字
 *   Shift 层 字母大写；数字行与标点键放荷马及更早的字母
 *            （ϛ ϟ ϗ ϡ ϱ ϖ Ͳ Ϗ ⳤ Ϻϻ ϽϾϿ ϐϑ ϰϕ Ϝϝ）
 * 标点键上是组合符：键面按「样字 α/Α + 该符」显示，插进正文会与光标前的字母合成。
 */

const VOWELS = 'αεηιουω'
/** 有长短对立的只有 α ι υ；η ω 天然长、ε ο 天然短，不标音长 */
const LENGTH_VOWELS = 'αιυ'
const isVowel = (base) => VOWELS.includes(String(base || '').normalize('NFD')[0])
const isLengthVowel = (base) => LENGTH_VOWELS.includes(String(base || '').normalize('NFD')[0])
/** iota 下标只跟在 α η ω 后面（ᾳ ῃ ῳ） */
const IOTA_VOWELS = 'αηω'
const isIotaVowel = (base) => IOTA_VOWELS.includes(String(base || '').normalize('NFD')[0])
const isVowelOrRho = (base) => {
    const b = String(base || '').normalize('NFD')[0]
    return VOWELS.includes(b) || b === 'ρ'
}

export default {
    name: '古希腊语',
    placeholderBase: 'α',
    cased: true,
    marks: [
        // row 相同的组并排一行；restoreRow 指定「还原」并到哪一行
        {
            key: 'breath',
            label: '气符',
            row: 0,
            items: [
                { c: '\u0313', label: '柔气', applies: isVowelOrRho },
                { c: '\u0314', label: '刚气', applies: isVowelOrRho }
            ]
        },
        {
            key: 'accent',
            label: '音符',
            row: 0,
            items: [
                { c: '\u0301', label: '锐', applies: isVowel },
                { c: '\u0300', label: '钝', applies: isVowel },
                { c: '\u0342', label: '扬抑', applies: isVowel },
                { c: '\u0308', label: '分音', applies: (b) => 'ιυ'.includes(String(b || '').normalize('NFD')[0]) }
            ]
        },
        {
            key: 'length',
            label: '音长',
            row: 1,
            items: [
                { c: '\u0304', label: '长', applies: isLengthVowel },
                { c: '\u0306', label: '短', applies: isLengthVowel }
            ]
        },
        { key: 'iota', label: '下标', row: 1, items: [{ c: '\u0345', label: 'iota', applies: isIotaVowel }] }
    ],
    /* 「还原」并到音长/下标那一行 */
    restoreRow: 1,
    applies(base, group) {
        const b = String(base || '').normalize('NFD')[0]
        if (group === 'accent') return VOWELS.includes(b) || b === 'ι' || b === 'υ'
        if (group === 'length') return isLengthVowel(base)
        if (group === 'iota') return isIotaVowel(base)
        return isVowelOrRho(base)
    },
    keyboard: {
        rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
        map: {
            /* 字母 */
            q: 'Ϙ', w: 'ς', e: 'ε', r: 'ρ', t: 'τ', y: 'υ', u: 'θ', i: 'ι', o: 'ο', p: 'π',
            a: 'α', s: 'σ', d: 'δ', f: 'φ', g: 'γ', h: 'η', j: 'ξ', k: 'κ', l: 'λ',
            z: 'ζ', x: 'χ', c: 'ψ', v: 'ω', b: 'β', n: 'ν', m: 'μ',
            /* 数字行 */
            '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
            '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
            /* 标点键：组合符（键面显示成 α + 该符） */
            '[': '\u0301', ']': '\u0300', '\\': '\u0342',
            ';': '\u0314', '\'': '\u0313',
            aux1: '\u0345', aux2: '\u0308', aux3: '\u0304', aux4: '\u0306',
            /* 其余标点 */
            '`': 'ϻ', ',': ',', '.': '.', '/': 'ϝ'
        },
        shift: {
            q: 'ϙ', w: 'Σ', e: 'Ε', r: 'Ρ', t: 'Τ', y: 'Υ', u: 'Θ', i: 'Ι', o: 'Ο', p: 'Π',
            a: 'Α', s: 'Σ', d: 'Δ', f: 'Φ', g: 'Γ', h: 'Η', j: 'Ξ', k: 'Κ', l: 'Λ',
            z: 'Ζ', x: 'Χ', c: 'Ψ', v: 'Ω', b: 'Β', n: 'Ν', m: 'Μ',
            /* 数字行：古字母 */
            '1': 'ϛ', '2': 'ϟ', '3': 'ϗ', '4': 'ϡ', '5': '·',
            '6': 'Ͳ', '7': 'Ϗ', '8': 'ⳤ', '9': 'ϱ', '0': 'ϖ',
            /* 标点键：古字母（气符键与大写气符互换、分音与大写 iota 保持） */
            '[': 'Ͻ', ']': 'Ͼ', '\\': 'Ͽ',
            ';': 'ϐ', '\'': 'ϑ',
            aux1: '\u0345', aux2: '\u0308', aux3: 'ϰ', aux4: 'ϕ',
            '`': 'Ϻ', ',': ':', '.': ';', '/': 'Ϝ'
        }
    },
    translitHint: 'h + 元音 = 粗气（ho → ὁ），词首元音默认柔气；th/ph/kh/ch/ps/ks = θ/φ/χ/χ/ψ/ξ；ē/ō = η/ω'
}
