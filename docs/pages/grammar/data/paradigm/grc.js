/**
 * 古希腊语专用的后期处理：按音节指派重音。
 *
 * 通用部分（toUnits / fromUnits / hasAccentMark）在 models/paradigm-generate.js 里，
 * 这里只放希腊语自己的音节、长短音与限制法规则。
 */
import {
    toUnits,
    fromUnits,
    ACCENT_MARKS,
    LENGTH_MARKS,
    ACUTE,
    CIRCUMFLEX
} from '../../assets/js/models/paradigm-generate.js'

const VOWEL_LETTERS = new Set(['α', 'ε', 'η', 'ι', 'ο', 'υ', 'ω'])
const DIPHTHONGS = new Set(['αι', 'ει', 'οι', 'υι', 'αυ', 'ευ', 'ου', 'ηυ', 'ωυ'])
/** 词末的 αι / οι 按短音计算（希腊语重音法则） */
const FINAL_SHORT_DIPHTHONGS = new Set(['αι', 'οι'])
const DOUBLE_CONSONANTS = new Set(['ξ', 'ψ', 'ζ'])
/** 词末 -εως / -εων（i 词干的阿提卡式属格，如 πόλεως / πόλεων）在限制法里按短末音节算 */
const FINAL_SHORT_SEQUENCES = ['εως', 'εων']
const IOTA_SUBSCRIPT = '\u0345'
/** 分音符（ϊ / ϋ）：标明与前一元音不合为双元音 */
const DIALYTIKA = '\u0308'
const MACRON = '\u0304'

export const accentModes = ['recessive', 'penult', 'persistent', 'acute', 'none']

function isVowel(unit) {
    return VOWEL_LETTERS.has(unit.ch)
}

const GREEK_LETTER = /[\u0370-\u03ff\u1f00-\u1fff]/

/** 音节量只看希腊字母；括号、斜杠等标记不算辅音 */
function consonantWeight(ch) {
    if (!GREEK_LETTER.test(ch)) return 0
    return DOUBLE_CONSONANTS.has(ch) ? 2 : 1
}

/** 音节核：元音或双元音（双元音算一个核） */
function findNuclei(units) {
    const nuclei = []
    let i = 0
    while (i < units.length) {
        if (!isVowel(units[i])) { i += 1; continue }
        let end = i
        const noDiphthong = units[i].marks.includes(DIALYTIKA)
        if (!noDiphthong && i + 1 < units.length && isVowel(units[i + 1])
            && !units[i + 1].marks.includes(DIALYTIKA)
            && DIPHTHONGS.has(units[i].ch + units[i + 1].ch)) {
            end = i + 1
        }
        nuclei.push({ start: i, end, letters: units.slice(i, end + 1).map((u) => u.ch).join('') })
        i = end + 1
    }
    return nuclei
}

/** 音节切分（供调试与复用）：返回每个音节的核 */
export function splitSyllables(text) {
    const units = toUnits(text)
    const nuclei = findNuclei(units)
    return nuclei.map((nuc, i) => {
        const from = i === 0 ? 0 : nuclei[i - 1].end + 1
        return fromUnits(units.slice(from, nuc.end + 1), { stripLength: false })
    })
}

/*
 * 音节的量分两种，希腊语的重音法则对它们的用法不同：
 *   nature   —— 核本身（长元音 / 双元音 / 标了长音符）为长
 *   position —— 核后有两个以上辅音（或双辅音 ξ ψ ζ）为长
 * 限制法只要求「倒数第三音节的重音必须配短末音节」；而「倒数第二音节转弯曲重音」
 * 只在倒数第二是 nature 长时才发生（位置长不转，如 λυθέντος、ὄρνις）。
 */
function syllableWeights(units, nuclei) {
    return nuclei.map((nuc) => {
        let nature = 1
        if (nuc.end > nuc.start) nature = 2
        else if (nuc.letters === 'η' || nuc.letters === 'ω') nature = 2
        else if (units[nuc.start].marks.includes(MACRON)) nature = 2
        else if (units[nuc.start].marks.includes(IOTA_SUBSCRIPT)) nature = 2

        let position = 0
        for (let k = nuc.end + 1; k < units.length; k += 1) {
            if (isVowel(units[k])) break
            position += consonantWeight(units[k].ch)
        }
        return { nature, position }
    })
}

/**
 * 末音节是否算短。
 * 词末的 αι / οι 与 -εως / -εων 按短音算；但祈愿式的词尾 -οι / -αι 是长音
 * （λύοι 与 λύσαι 重音在倒数第二且为锐重音，对比不定式 λῦσαι 的弯曲重音），
 * 由 finalDiphthongLong 标出。
 */
function ultimaIsShort(nuclei, weights, shortFinal, finalDiphthongLong) {
    const last = nuclei.length - 1
    if (last < 0) return true
    if (shortFinal) return true
    const { nature, position } = weights[last]
    if (!position && FINAL_SHORT_DIPHTHONGS.has(nuclei[last].letters)) {
        return !finalDiphthongLong
    }
    return nature < 2 && position < 2
}

function accentKindOf(unit) {
    if (unit.marks.includes(ACUTE)) return 'acute'
    if (unit.marks.includes(CIRCUMFLEX)) return 'circumflex'
    return ''
}

/** 字符串里是否写了重音记号 */
export function hasAccentMark(text) {
    return toUnits(text).some((unit) => accentKindOf(unit))
}

/** 所有带重音的核，按从左到右排列 */
function findAccents(units, nuclei) {
    const out = []
    nuclei.forEach((nuc, index) => {
        for (let k = nuc.start; k <= nuc.end; k += 1) {
            const kind = accentKindOf(units[k])
            if (kind) { out.push({ index, kind }); return }
        }
    })
    return out
}

/**
 * 按音节指派重音。
 * @param {string} text   已经拼好的词形（可含重音与长音符）
 * @param {string} mode   'recessive' | 'persistent' | 'none'
 * @param {object} [options]
 * @param {boolean} [options.endingAccented] 词尾那一侧自带重音时置 true（优先取靠后的那个）
 * @param {boolean} [options.finalDiphthongLong] 词末的 αι / οι 算长音（祈愿式）
 */
export function applyAccent(text, mode, { endingAccented = false, finalDiphthongLong = false } = {}) {
    if (!mode || mode === 'none') return text
    const units = toUnits(text)
    const nuclei = findNuclei(units)
    const plain = () => fromUnits(units, { stripLength: true })
    if (!nuclei.length) return plain()

    const weights = syllableWeights(units, nuclei)
    const last = nuclei.length - 1
    const plainText = fromUnits(units)
    const shortFinal = FINAL_SHORT_SEQUENCES.some((seq) => plainText.endsWith(seq))
    const shortUltima = ultimaIsShort(nuclei, weights, shortFinal, finalDiphthongLong)
    let index = 0
    let kind = 'acute'

    if (mode === 'penult') {
        // 固定在倒数第二音节（不定式 -ναι / -σθαι、-μενος 分词等）
        index = Math.max(0, nuclei.length - 2)
        if (index === last - 1 && weights[index].nature >= 2 && shortUltima) kind = 'circumflex'
    } else if (mode === 'recessive') {
        // 退重音：在限制法允许的范围内尽量往前
        index = (nuclei.length >= 3 && shortUltima) ? nuclei.length - 3 : Math.max(0, nuclei.length - 2)
        if (index === last - 1 && weights[index].nature >= 2 && shortUltima) kind = 'circumflex'
    } else {
        // 持续重音：保持原有的那一侧，只做限制法校正
        const accents = findAccents(units, nuclei)
        if (!accents.length) return plain()
        const authored = endingAccented ? accents[accents.length - 1] : accents[0]
        const earliest = shortUltima ? Math.max(0, nuclei.length - 3) : Math.max(0, nuclei.length - 2)
        index = Math.min(last, Math.max(authored.index, earliest))
        if (index === last) kind = authored.kind
        else if (index === last - 1) {
            kind = (weights[index].nature >= 2 && shortUltima) ? 'circumflex' : 'acute'
        }
        // 个别形式（如 λυθείεν）固定在原音节但用锐重音
        if (mode === 'acute') kind = 'acute'
    }

    for (const unit of units) {
        unit.marks = unit.marks.filter((m) => !ACCENT_MARKS.includes(m) && !LENGTH_MARKS.includes(m))
    }
    units[nuclei[index].end].marks.push(kind === 'circumflex' ? CIRCUMFLEX : ACUTE)
    return fromUnits(units, { stripLength: true })
}


/** 统一入口：引擎按 profile.accent(text, mode, options) 调用 */
export function accent(text, mode, options = {}) {
    return applyAccent(text, mode, options)
}
