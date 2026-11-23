
const VOWELS = {
    a: 'अ', ā: 'आ', i: 'इ', ī: 'ई', u: 'उ', ū: 'ऊ',
    ṛ: 'ऋ', ṝ: 'ॠ', ḷ: 'ऌ', ḹ: 'ॡ',
    e: 'ए', ai: 'ऐ', o: 'ओ', au: 'औ'
}

const MATRAS = {
    a: '', ā: 'ा', i: 'ि', ī: 'ी', u: 'ु', ū: 'ू',
    ṛ: 'ृ', ṝ: 'ॄ', ḷ: 'ॢ', ḹ: 'ॣ',
    e: 'े', ai: 'ै', o: 'ो', au: 'ौ'
}

const CONSONANTS = {
    k: 'क', kh: 'ख', g: 'ग', gh: 'घ', ṅ: 'ङ',
    c: 'च', ch: 'छ', j: 'ज', jh: 'झ', ñ: 'ञ',
    ṭ: 'ट', ṭh: 'ठ', ḍ: 'ड', ḍh: 'ढ', ṇ: 'ण',
    t: 'त', th: 'थ', d: 'द', dh: 'ध', n: 'न',
    p: 'प', ph: 'फ', b: 'ब', bh: 'भ', m: 'म',
    y: 'य', r: 'र', l: 'ल', v: 'व',
    ś: 'श', ṣ: 'ष', s: 'स', h: 'ह'
}

const SIGNS = {
    ṃ: 'ं',
    ṁ: 'ँ',
    m̐: 'ँ',
    ḥ: 'ः',
    '\u2019': 'ऽ',
    '\'': 'ऽ'
}

const UPPER = {
    Ā: 'ā', Ī: 'ī', Ū: 'ū', Ṛ: 'ṛ', Ṝ: 'ṝ', Ḷ: 'ḷ', Ḹ: 'ḹ',
    Ṃ: 'ṃ', Ḥ: 'ḥ', Ś: 'ś', Ṣ: 'ṣ', Ṭ: 'ṭ', Ḍ: 'ḍ', Ṇ: 'ṇ', Ñ: 'ñ', Ṅ: 'ṅ'
}

const ACUTE_VOWELS = {
    á: 'a\u0301', í: 'i\u0301', ú: 'u\u0301', é: 'e\u0301', ó: 'o\u0301'
}
const COMBINING_ACUTE = '\u0301'
const UDATTA = '॑'

const VIRAMA = '्'
const DEVANAGARI = /[\u0900-\u097F]/

const IAST_KEYS = [
    ...Object.keys(CONSONANTS),
    ...Object.keys(VOWELS),
    ...Object.keys(SIGNS)
].sort((a, b) => b.length - a.length)

const charCache = new Map()

function readToken(text, index) {
    for (const key of IAST_KEYS) {
        if (text.startsWith(key, index)) return key
    }
    return null
}

export const scriptRange = /[\u0900-\u097F]/

export function hasScript(text) {
    return DEVANAGARI.test(String(text ?? ''))
}

export function toScript(input) {
    let text = String(input ?? '')
    if (!text) return ''
    text = [...text].map((ch) => UPPER[ch] ?? ACUTE_VOWELS[ch] ?? ch).join('')
    const cached = charCache.get(text)
    if (cached !== undefined) return cached

    let out = ''
    let pendingConsonant = false

    for (let i = 0; i < text.length;) {
        const token = readToken(text, i)
        if (token && CONSONANTS[token]) {
            if (pendingConsonant) out += VIRAMA
            out += CONSONANTS[token]
            pendingConsonant = true
            i += token.length
            continue
        }
        if (token && Object.prototype.hasOwnProperty.call(VOWELS, token)) {
            if (pendingConsonant) {
                out += MATRAS[token]
                pendingConsonant = false
            } else {
                out += VOWELS[token]
            }
            i += token.length
            continue
        }
        if (text[i] === COMBINING_ACUTE) {
            out += UDATTA
            i += 1
            continue
        }
        if (token && SIGNS[token]) {
            if (pendingConsonant) {
                out += MATRAS.a
                pendingConsonant = false
            }
            out += SIGNS[token]
            i += token.length
            continue
        }
        if (pendingConsonant) {
            out += VIRAMA
            pendingConsonant = false
        }
        out += text[i]
        i += 1
    }
    if (pendingConsonant) out += VIRAMA

    out = out.replace(/ओं/g, 'ॐ')
    if (charCache.size < 5000) charCache.set(text, out)
    return out
}


const DEV_CONSONANTS = new Map(Object.entries(CONSONANTS).map(([roman, dev]) => [dev, roman]))
const DEV_VOWELS = new Map(Object.entries(VOWELS).map(([roman, dev]) => [dev, roman]))
const DEV_MATRAS = new Map(Object.entries(MATRAS).map(([roman, dev]) => [dev, roman]))
const DEV_SIGNS = new Map([
    ['ं', 'ṃ'], ['ँ', 'm̐'], ['ः', 'ḥ'], ['ऽ', '\''], ['ॐ', 'oṃ'],
    ['।', '|'], ['॥', '||'], ['॑', '\u0301']
])

export function toRoman(input) {
    const text = String(input ?? '')
    if (!text) return ''

    let out = ''
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (DEV_CONSONANTS.has(ch)) {
            out += DEV_CONSONANTS.get(ch)
            const next = text[i + 1]
            if (next && DEV_MATRAS.has(next)) {
                out += DEV_MATRAS.get(next)
                i += 1
            } else if (next === VIRAMA) {
                i += 1
            } else {
                out += 'a'
            }
            continue
        }
        if (DEV_VOWELS.has(ch)) { out += DEV_VOWELS.get(ch); continue }
        if (DEV_SIGNS.has(ch)) { out += DEV_SIGNS.get(ch); continue }
        if (DEV_MATRAS.has(ch)) { out += DEV_MATRAS.get(ch); continue }
        if (ch === VIRAMA) continue
        out += ch
    }
    return out
}
