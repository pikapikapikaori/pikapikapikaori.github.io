/**
 * 梵语的「天城文 ⇄ IAST」档案（与 data/paradigm/ 同一套加载方式）。
 *
 * 这里是梵语专用的字母表与转换算法，别的语言不共享：
 *   - 生成变格变位表时，引擎先在 IAST 上算连声，再用 toScript() 转成天城体；
 *   - 「显示转写」开关与检索用 toRoman() 转回 IAST。
 *
 * 转换逐字符进行，不做语法判断：词干末尾的辅音会带 virama（राज्），
 * 连字符、空格、标点、√ 之类原样保留。悉昙文（Siddham）不在这里处理。
 *
 * 导出的档案接口（`toScript` / `toRoman` / `hasScript`）与 data/script/mnc.js 一致。
 */

/** 独立元音 */
const VOWELS = {
    a: 'अ', ā: 'आ', i: 'इ', ī: 'ई', u: 'उ', ū: 'ऊ',
    ṛ: 'ऋ', ṝ: 'ॠ', ḷ: 'ऌ', ḹ: 'ॡ',
    e: 'ए', ai: 'ऐ', o: 'ओ', au: 'औ'
}

/** 元音附标（跟在辅音后） */
const MATRAS = {
    a: '', ā: 'ा', i: 'ि', ī: 'ी', u: 'ु', ū: 'ू',
    ṛ: 'ृ', ṝ: 'ॄ', ḷ: 'ॢ', ḹ: 'ॣ',
    e: 'े', ai: 'ै', o: 'ो', au: 'ौ'
}

/** 辅音 */
const CONSONANTS = {
    k: 'क', kh: 'ख', g: 'ग', gh: 'घ', ṅ: 'ङ',
    c: 'च', ch: 'छ', j: 'ज', jh: 'झ', ñ: 'ञ',
    ṭ: 'ट', ṭh: 'ठ', ḍ: 'ड', ḍh: 'ढ', ṇ: 'ण',
    t: 'त', th: 'थ', d: 'द', dh: 'ध', n: 'न',
    p: 'प', ph: 'फ', b: 'ब', bh: 'भ', m: 'म',
    y: 'य', r: 'र', l: 'ल', v: 'व',
    ś: 'श', ṣ: 'ष', s: 'स', h: 'ह'
}

/** 附加符号 */
const SIGNS = {
    ṃ: 'ं',
    ṁ: 'ँ',
    m̐: 'ँ',
    ḥ: 'ः',
    '\u2019': 'ऽ',   // ’ 当作 avagraha
    '\'': 'ऽ'
}

/** 大写 IAST（句首、专名）→ 小写；只收带变音符号的字母，普通大写（IAST 这类缩写）不动 */
const UPPER = {
    Ā: 'ā', Ī: 'ī', Ū: 'ū', Ṛ: 'ṛ', Ṝ: 'ṝ', Ḷ: 'ḷ', Ḹ: 'ḹ',
    Ṃ: 'ṃ', Ḥ: 'ḥ', Ś: 'ś', Ṣ: 'ṣ', Ṭ: 'ṭ', Ḍ: 'ḍ', Ṇ: 'ṇ', Ñ: 'ñ', Ṅ: 'ṅ'
}

/** 吠陀锐重音（á → अ + ॑）：先拆成「元音 + 组合锐音符」，再在循环里补 udātta 记号 */
const ACUTE_VOWELS = {
    á: 'a\u0301', í: 'i\u0301', ú: 'u\u0301', é: 'e\u0301', ó: 'o\u0301'
}
const COMBINING_ACUTE = '\u0301'
const UDATTA = '॑'

const VIRAMA = '्'
const DEVANAGARI = /[\u0900-\u097F]/

/** 按最长匹配拆出 IAST 的音位（多字符的 kh / ai 等优先） */
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

/** 天城体的字符范围（「显示转写」开关按它切分原文片段） */
export const scriptRange = /[\u0900-\u097F]/

/** 是否含有天城体字符 */
export function hasScript(text) {
    return DEVANAGARI.test(String(text ?? ''))
}

/** IAST → 天城体 */
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
        // 其它字符（空格、标点、连字符、中文、√ 等）：结束当前辅音
        if (pendingConsonant) {
            out += VIRAMA
            pendingConsonant = false
        }
        out += text[i]
        i += 1
    }
    if (pendingConsonant) out += VIRAMA

    // oṃ 有专用字符
    out = out.replace(/ओं/g, 'ॐ')
    if (charCache.size < 5000) charCache.set(text, out)
    return out
}

/* ---------------- 反向：天城体 → IAST ---------------- */

const DEV_CONSONANTS = new Map(Object.entries(CONSONANTS).map(([roman, dev]) => [dev, roman]))
const DEV_VOWELS = new Map(Object.entries(VOWELS).map(([roman, dev]) => [dev, roman]))
const DEV_MATRAS = new Map(Object.entries(MATRAS).map(([roman, dev]) => [dev, roman]))
const DEV_SIGNS = new Map([
    ['ं', 'ṃ'], ['ँ', 'm̐'], ['ः', 'ḥ'], ['ऽ', '\''], ['ॐ', 'oṃ'],
    ['।', '|'], ['॥', '||'], ['॑', '\u0301']
])

/** 天城体 → IAST */
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
