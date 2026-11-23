import {
    toUnits,
    fromUnits,
    ACCENT_MARKS,
    LENGTH_MARKS,
    ACUTE,
    CIRCUMFLEX
} from '../../../assets/js/models/paradigm-generate.js'

const VOWEL_LETTERS = new Set(['α', 'ε', 'η', 'ι', 'ο', 'υ', 'ω'])
const DIPHTHONGS = new Set(['αι', 'ει', 'οι', 'υι', 'αυ', 'ευ', 'ου', 'ηυ', 'ωυ'])
const FINAL_SHORT_DIPHTHONGS = new Set(['αι', 'οι'])
const DOUBLE_CONSONANTS = new Set(['ξ', 'ψ', 'ζ'])
const FINAL_SHORT_SEQUENCES = ['εως', 'εων']
const IOTA_SUBSCRIPT = '\u0345'
const DIALYTIKA = '\u0308'
const MACRON = '\u0304'

export const accentModes = ['recessive', 'penult', 'persistent', 'acute', 'none']

function isVowel(unit) {
    return VOWEL_LETTERS.has(unit.ch)
}

const GREEK_LETTER = /[\u0370-\u03ff\u1f00-\u1fff]/

function consonantWeight(ch) {
    if (!GREEK_LETTER.test(ch)) return 0
    return DOUBLE_CONSONANTS.has(ch) ? 2 : 1
}

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
        index = Math.max(0, nuclei.length - 2)
        if (index === last - 1 && weights[index].nature >= 2 && shortUltima) kind = 'circumflex'
    } else if (mode === 'recessive') {
        index = (nuclei.length >= 3 && shortUltima) ? nuclei.length - 3 : Math.max(0, nuclei.length - 2)
        if (index === last - 1 && weights[index].nature >= 2 && shortUltima) kind = 'circumflex'
    } else {
        const accents = findAccents(units, nuclei)
        if (!accents.length) return plain()
        const authored = endingAccented ? accents[accents.length - 1] : accents[0]
        const earliest = shortUltima ? Math.max(0, nuclei.length - 3) : Math.max(0, nuclei.length - 2)
        index = Math.min(last, Math.max(authored.index, earliest))
        if (index === last) kind = authored.kind
        else if (index === last - 1) {
            kind = (weights[index].nature >= 2 && shortUltima) ? 'circumflex' : 'acute'
        }
        if (mode === 'acute') kind = 'acute'
    }

    for (const unit of units) {
        unit.marks = unit.marks.filter((m) => !ACCENT_MARKS.includes(m) && !LENGTH_MARKS.includes(m))
    }
    units[nuclei[index].end].marks.push(kind === 'circumflex' ? CIRCUMFLEX : ACUTE)
    return fromUnits(units, { stripLength: true })
}


export function accent(text, mode, options = {}) {
    return applyAccent(text, mode, options)
}


const BREVE = '\u0306'

const LENGTH_VOWELS = 'αιυ'
function toClusters(text) {
    const out = []
    for (const ch of text) {
        if (/\p{M}/u.test(ch) && out.length) out[out.length - 1].marks += ch
        else out.push({ base: ch, marks: '' })
    }
    return out
}

export function canonicalize(text) {
    const src = String(text ?? '')
    if (!src) return src
    const clusters = toClusters(src.normalize('NFD'))
    const inDiphthong = new Set()

    for (let i = 0; i < clusters.length - 1; i++) {
        const a = clusters[i]
        const b = clusters[i + 1]
        const pair = a.base + b.base
        if (!DIPHTHONGS.has(pair)) continue
        if (a.marks.includes(DIALYTIKA) || b.marks.includes(DIALYTIKA)) continue
        if (pair === 'υι' && (b.marks.includes('\u0313') || b.marks.includes('\u0314'))) continue
        inDiphthong.add(i)
        inDiphthong.add(i + 1)
    }

    const out = clusters.map((cluster, index) => {
        const { base, marks } = cluster
        const keep = base + marks.split(BREVE).join('')
        if (!LENGTH_VOWELS.includes(base) || inDiphthong.has(index)) return keep
        if (marks.includes(MACRON)) return keep
        if (marks.includes(IOTA_SUBSCRIPT)) return keep
        return base + marks + (marks.includes(BREVE) ? '' : BREVE)
    })

    return out.join('').normalize('NFC')
}
