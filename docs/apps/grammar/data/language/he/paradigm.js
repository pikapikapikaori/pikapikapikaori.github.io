/**
 * 用固定符号而不是「按顺序自动编号 + 下标数字」，是因为数字夹在占位符和它的元音附标之间时，
 * 附标会挂到数字上、在 RTL 里叠成一团。
 */
export const accentModes = ['he-milra', 'he-milel']

/**
 * 词根占位符：下标 0–3 依次是第 1 / 2 / 3 / 4 个词根辅音。
 * 顺便导出第一个，供只关心「有没有占位符」的地方使用。
 */
export const ROOT_SLOTS = ['־', '׳', '״', '׀']
export const ROOT_SLOT = ROOT_SLOTS[0]

const FINAL_TO_REGULAR = { 'ץ': 'צ', 'ף': 'פ', 'ן': 'נ', 'ם': 'מ', 'ך': 'כ' }
const REGULAR_TO_FINAL = { 'צ': 'ץ', 'פ': 'ף', 'נ': 'ן', 'מ': 'ם', 'כ': 'ך' }

const METEG = '\u05BD'
const SHEWA = '\u05B0'
const FULL_VOWELS = new Set(['\u05B4', '\u05B5', '\u05B6', '\u05B7', '\u05B8', '\u05B9', '\u05BB'])
const VAV = 'ו'
const DAGESH = '\u05BC'


const COMBINING_CHAR = /\p{M}/u
const BEGADKEFAT = new Set(['ב', 'ג', 'ד', 'כ', 'פ', 'ת'])

export function dageshLene(text) {
    const chars = [...String(text ?? '').normalize('NFC')]
    const out = []
    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i]
        const marks = []
        while (i + 1 < chars.length && COMBINING_CHAR.test(chars[i + 1])) {
            marks.push(chars[i + 1])
            i += 1
        }
        if (out.length === 0 && BEGADKEFAT.has(ch) && !marks.includes(DAGESH)) {
            marks.unshift(DAGESH)
        }
        out.push(ch, ...marks)
    }
    return out.join('').normalize('NFC')
}

export function applySkeleton(root, skeleton, options = {}) {
    const letters = [...String(root ?? '').replace(/[-\u2010-\u2015\s]/g, '')]
    const chars = [...String(skeleton ?? '')]

    const leneSlots = new Set((options?.leneSlots || []).map((x) => String(x)))

    const units = []
    for (let k = 0; k < chars.length; k += 1) {
        const ch = chars[k]
        const rootIndex = ROOT_SLOTS.indexOf(ch)
        if (rootIndex >= 0) {
            const rootLetter = letters[rootIndex]
            const unit = { ch: rootLetter ?? ch, marks: [], fromRoot: true }
            while (k + 1 < chars.length && COMBINING_CHAR.test(chars[k + 1])) {
                unit.marks.push(chars[k + 1])
                k += 1
            }
            if (leneSlots.has(String(rootIndex + 1)) && rootLetter && !BEGADKEFAT.has(rootLetter)) {
                unit.marks = unit.marks.filter((m) => m !== DAGESH)
            }
            units.push(unit)
            continue
        }
        if (COMBINING_CHAR.test(ch)) {
            const prev = units[units.length - 1]
            if (prev) prev.marks.push(ch)
            continue
        }
        units.push({ ch, marks: [], fromRoot: false })
    }

    let lastLetter = -1
    units.forEach((u, index) => { if (!ROOT_SLOTS.includes(u.ch)) lastLetter = index })
    units.forEach((u, index) => {
        if (index === lastLetter) {
            if (REGULAR_TO_FINAL[u.ch]) u.ch = REGULAR_TO_FINAL[u.ch]
        } else if (FINAL_TO_REGULAR[u.ch]) {
            u.ch = FINAL_TO_REGULAR[u.ch]
        }
    })

    let out = ''
    let letterIndex = 0
    for (const unit of units) {
        const isLetter = !ROOT_SLOTS.includes(unit.ch)
        const hasDagesh = unit.marks.includes(DAGESH)
        const addDagesh = isLetter
            && BEGADKEFAT.has(unit.ch)
            && !hasDagesh
            && letterIndex === 0
        out += unit.ch
        if (addDagesh) out += DAGESH
        for (const mark of unit.marks) out += mark
        if (isLetter) letterIndex += 1
    }
    return out.normalize('NFC')
}

export function toSkeleton(form, root) {
    const letters = [...String(root ?? '').replace(/[-\u2010-\u2015\s]/g, '')]
        .map((ch) => FINAL_TO_REGULAR[ch] || ch)
    const chars = [...String(form ?? '').normalize('NFC')]
    let from = 0
    let next = 0
    letters.forEach((letter, k) => {
        const at = chars.findIndex((ch, i) => i >= from && (FINAL_TO_REGULAR[ch] || ch) === letter)
        if (at < 0) return
        chars[at] = ROOT_SLOTS[k] ?? ROOT_SLOT
        from = at + 1
        next = k + 1
    })
    return chars.join('').normalize('NFC')
}

export function skeletonKey(skeleton) {
    return String(skeleton ?? '').normalize('NFC')
        .split(DAGESH).join('')
}

function vowelPositions(text) {
    const chars = [...String(text ?? '').normalize('NFC')]
    const out = []
    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i]
        if (FULL_VOWELS.has(ch)) {
            out.push(i)
            continue
        }
        if (ch === VAV) {
            const next = chars[i + 1]
            if (next === DAGESH) out.push(i + 1)
        }
    }
    return { chars, positions: out }
}

export function accent(text, mode) {
    const src = String(text ?? '').normalize('NFC')
    if (!src || mode === 'none' || !mode) return src
    if (mode !== 'he-milra' && mode !== 'he-milel') return src
    if (src.includes(METEG)) return src

    const { chars, positions } = vowelPositions(src)
    if (!positions.length) return src

    const index = mode === 'he-milel'
        ? (positions.length >= 2 ? positions[positions.length - 2] : positions[0])
        : positions[positions.length - 1]

    chars.splice(index + 1, 0, METEG)
    return chars.join('').normalize('NFC')
}

export function realize(root, skeleton, options = {}) {
    return accent(dageshLene(applySkeleton(root, skeleton, options)), options.mode)
}
