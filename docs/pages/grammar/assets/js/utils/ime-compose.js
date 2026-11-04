/**
 * 输入助手的文本合成：把一个基字与若干组合符号合成一个字形。
 *
 * 希腊语这类有预组合字符的文字，`NFC` 会把「基字 + 气符 + 重音」合成一个码位（ἄ）；
 * 希伯来语的元音点是纯组合符，NFC 后仍是「辅音 + 点」，这是该文字正确的存储形态。
 * 因此三种输入模式（修饰符 / 转写 / 键盘）都只调这里的函数，结果完全一致。
 */

/** 是否组合符（元音点、重音、气符…） */
export const isMark = (ch) => /\p{M}/u.test(ch)

/**
 * 把文本尾部拆成「前面部分 + 基字 + 已有的组合符」。
 * 先 NFD：预组合的 ἄ 会拆成 α + 气符 + 重音，这样才知道当前已挂了哪些符号。
 * @returns {{ head: string, base: string, marks: string }}
 */
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

/** 符号在「书写顺序」里的名次：没列进去的排最后 */
function rank(ch, order) {
    const i = order.indexOf(ch)
    return i < 0 ? order.length : i
}

/**
 * 给光标前的字挂一个符号：同组的旧符号先去掉，再叠上新的，最后 NFC。
 * @param {string} value  整段文本
 * @param {number} caret  光标位置
 * @param {string} groupChars 同组所有符号（用来替换）
 * @param {string} markChar 要加的符号；空串表示「去掉这一组」
 * @param {string} markOrder 所有符号按「组顺序」拼成的串。同一组合类的符号 Unicode 不重排，
 *   只能靠这个把气符排到重音前面，`α + 柔气 + 锐` 才合成得出 ἄ 而不是 ά̓。
 * @returns {{ value: string, caret: number } | null} 光标前没有基字时返回 null
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

/**
 * 在光标处插入文本。插入的是组合符时（希腊语的气符 / 重音、梵语的附标），
 * 要和前一个字母合成一个码位（α + 粗气 → ἁ），所以插入后整段做一次 NFC。
 */
export function insertAt(value, caret, text) {
    const v = String(value ?? '')
    const head = (v.slice(0, caret) + String(text ?? '')).normalize('NFC')
    return { value: (head + v.slice(caret)).normalize('NFC'), caret: head.length }
}

/** 删除光标前一个字形（连同它的组合符） */
export function deleteBefore(value, caret) {
    const v = String(value ?? '')
    if (caret <= 0) return { value: v, caret }
    const { head, base, marks } = splitTail(v.slice(0, caret))
    const cut = (base + marks).normalize('NFC').length || 1
    return { value: v.slice(0, caret - cut) + v.slice(caret), caret: caret - cut }
}

/** 修饰符按钮上显示的预览字：当前基字 + 该符号 */
export function previewChar(base, markChar, fallback = '') {
    const b = base || fallback
    if (!b) return '·'
    return (b + (markChar || '')).normalize('NFC')
}

/**
 * 原文输入框里的明显误输入：数字与中文标点。只在「不含中日韩文字」的输入框里清理，
 * 这样「含义 / 备注 / 标签」这类要写中文的框不会被误伤。
 */
const ILLEGAL_IN_ORIGINAL = /[0-9０-９，。、；：""''‘’“”【】〔〕（）《》〈〉？！…—－]/g
const CJK = /[\u3400-\u9FFF]/

export function sanitizeOriginal(text) {
    const value = String(text ?? '')
    if (!value || CJK.test(value)) return value
    return value.replace(ILLEGAL_IN_ORIGINAL, '')
}

/** 词尾正则：字母 + 组合符（转写模式用它取「当前这个词」） */
export const WORD_TAIL = /[\p{L}\p{M}'’]+$/u
