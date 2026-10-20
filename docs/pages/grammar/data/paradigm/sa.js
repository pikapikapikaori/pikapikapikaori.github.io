/**
 * 梵语专用的后期处理：连声（sandhi）与重音（svara）。
 *
 * 通用部分（toUnits / fromUnits）在 models/paradigm-generate.js 里，
 * 这里只放梵语的音系规则。
 */
import { toUnits, fromUnits, ACUTE, CIRCUMFLEX } from '../../assets/js/models/paradigm-generate.js'

export const accentModes = ['sa', 'sa-vedic']


const SA_VOWEL = 'aāiīuūṛ'
const SA_ACCENTED = 'āīūṛ'
const SVARITA = '\u0302'
const ANUDATTA = '\u0331'

/** 词尾弱化：浊 / 送气 → 同部位清不送气；咝音与 r → visarga；m → anusvāra */
const SA_FINAL = {
    g: 'k', gh: 'k', k: 'k', kh: 'k',
    j: 'k', jh: 'k', c: 'k', ch: 'k', ñ: 'ṅ',
    ḍ: 'ṭ', ḍh: 'ṭ', ṭ: 'ṭ', ṭh: 'ṭ',
    d: 't', dh: 't', t: 't', th: 't',
    b: 'p', bh: 'p', p: 'p', ph: 'p',
    ś: 'ḥ', ṣ: 'ḥ', s: 'ḥ', r: 'ḥ', ḥ: 'ḥ',
    m: 'ṃ', ṃ: 'ṃ',
}

/**
 * 词内连声：把左段末尾与右段开头按梵语规则合并
 * 只处理最常见的一组（元音连声 + 唇 / 齿鼻音不变），其余原样拼接。
 */
function saJoin(left, right) {
    const L = String(left ?? '')
    const R = String(right ?? '')
    if (!L || !R) return L + R

    const l = L.slice(-1)
    const r = R[0]
    const rest = R.slice(1)

    // 双元音：a/ā + e/ai / o/au
    const diph = R.slice(0, 2)
    if ('aā'.includes(l) && (diph === 'ai' || diph === 'au')) {
        return L.slice(0, -1) + diph + R.slice(2)
    }

    if (SA_VOWEL.includes(l) && (SA_VOWEL + 'eo').includes(r)) {
        const aGrade = 'aā'
        if (aGrade.includes(l)) {
            if (aGrade.includes(r)) return L.slice(0, -1) + 'ā' + rest
            if ('iī'.includes(r)) return L.slice(0, -1) + 'e' + rest
            if ('uū'.includes(r)) return L.slice(0, -1) + 'o' + rest
            if (r === 'ṛ') return L.slice(0, -1) + 'ar' + rest
        }
        if ('iī'.includes(l)) {
            if ('iī'.includes(r)) return L.slice(0, -1) + 'ī' + rest
            // i / ī 变成半元音 y（不是「保留 i 再加 y」）
            return L.slice(0, -1) + 'y' + R
        }
        if ('uū'.includes(l)) {
            if ('uū'.includes(r)) return L.slice(0, -1) + 'ū' + rest
            return L.slice(0, -1) + 'v' + R
        }
        if (l === 'ṛ') return L.slice(0, -1) + 'r' + R
    }
    return L + R
}

/** 词尾停顿式：把词末辅音按 padasandhi 弱化 */
function saWordFinal(text) {
    const s = String(text ?? '')
    if (!s) return s
    const last = s.slice(-1)
    const mapped = SA_FINAL[last]
    if (!mapped || mapped === last) return s
    return s.slice(0, -1) + mapped
}

/** 梵语重音：保持词干原有的锐重音；sa-vedic 另给 udātta 之后的音节补 svarita */
function applySaAccent(text, mode) {
    const s = String(text ?? '')
    if (!s || !mode || mode === 'none') return s
    if (mode !== 'sa-vedic') return s

    const units = toUnits(s)
    const vowels = []
    units.forEach((u, i) => {
        if (SA_VOWEL.includes(u.ch) || SA_ACCENTED.includes(u.ch)) vowels.push(i)
    })
    if (!vowels.length) return s

    let udatta = -1
    vowels.forEach((idx, k) => {
        if (units[idx].marks.includes(ACUTE)) udatta = k
    })
    if (udatta < 0 || udatta + 1 >= vowels.length) return s

    const next = units[vowels[udatta + 1]]
    if (next.marks.includes(ACUTE)) return s
    next.marks = next.marks.filter((m) => m !== CIRCUMFLEX && m !== ANUDATTA)
    next.marks.push(SVARITA)
    return fromUnits(units)
}

/** 梵语档案：derive.post.sandhi 用到 join / wordFinal，derive.post.accent 用到 accent */
export const sandhi = { join: saJoin, wordFinal: saWordFinal }

export function accent(text, mode) {
    return applySaAccent(text, mode)
}
