export const isMark = (ch) => /\p{M}/u.test(ch)

export function splitTail(text) {
    const nfd = String(text ?? '').normalize('NFD')
    let i = nfd.length
    while (i > 0 && isMark(nfd[i - 1])) i -= 1
    return {
        head: nfd.slice(0, Math.max(0, i - 1)),
        base: nfd.slice(Math.max(0, i - 1), i),
        marks: nfd.slice(i)
    }
}

function rank(ch, order) {
    const i = order.indexOf(ch)
    return i < 0 ? order.length : i
}

/**
 * 给光标前的字挂一个符号：同组旧符号先去掉，叠上新的，最后 NFC。
 * `markOrder` 决定叠加顺序 —— 同一组合类的符号 Unicode 不重排，气符不排在重音前面就合成不出 ἄ。
 * 光标前没有基字时返回 null。
 */
export function applyMark(value, caret, groupChars, markChar, markOrder = '') {
    const before = String(value ?? '').slice(0, caret)
    const { head, base, marks } = splitTail(before)
    if (!base) return null

    const kept = [...marks].filter((m) => !groupChars.includes(m))
    if (markChar) kept.push(markChar)
    const ordered = markOrder
        ? kept.slice().sort((a, b) => rank(a, markOrder) - rank(b, markOrder))
        : kept
    const next = (base + ordered.join('')).normalize('NFC')
    return {
        value: (head + next + String(value ?? '').slice(caret)).normalize('NFC'),
        caret: (head + next).normalize('NFC').length
    }
}

export function insertAt(value, caret, text) {
    const v = String(value ?? '')
    const head = (v.slice(0, caret) + String(text ?? '')).normalize('NFC')
    return { value: (head + v.slice(caret)).normalize('NFC'), caret: head.length }
}

export function deleteBefore(value, caret) {
    const v = String(value ?? '')
    if (caret <= 0) return { value: v, caret }
    const { head, base, marks } = splitTail(v.slice(0, caret))
    const cut = (base + marks).normalize('NFC').length || 1
    return { value: v.slice(0, caret - cut) + v.slice(caret), caret: caret - cut }
}

export function previewChar(base, markChar, fallback = '') {
    const b = base || fallback
    if (!b) return '·'
    return (b + (markChar || '')).normalize('NFC')
}

const ILLEGAL_IN_ORIGINAL = /[0-9０-９，。、；：""''‘’“”【】〔〕（）《》〈〉？！…—－]/g
const CJK = /[\u3400-\u9FFF]/

export function sanitizeOriginal(text) {
    const value = String(text ?? '')
    if (!value || CJK.test(value)) return value
    return value.replace(ILLEGAL_IN_ORIGINAL, '')
}

export const WORD_TAIL = /[\p{L}\p{M}'’]+$/u
