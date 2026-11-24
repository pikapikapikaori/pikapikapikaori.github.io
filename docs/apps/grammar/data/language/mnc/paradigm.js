const MACRON = '\u0304'
const COMBINING = /\p{M}/u

function groupOf(base, marks) {
    if (base === 'a') return 'a'
    if (base === 'o') return 'o'
    if (base === 'u') return marks.includes(MACRON) ? 'a' : 'e'
    if (base === 'e') return 'e'
    return ''
}

export function harmonyOf(stem) {
    const chars = [...String(stem ?? '').normalize('NFD')]
    for (let i = chars.length - 1; i >= 0; i -= 1) {
        const ch = chars[i]
        if (COMBINING.test(ch)) continue
        const marks = []
        let j = i + 1
        while (j < chars.length && COMBINING.test(chars[j])) {
            marks.push(chars[j])
            j += 1
        }
        const g = groupOf(ch, marks)
        if (g) return g
    }
    return 'e'
}

export function harmonize(stem, suffix) {
    const text = String(suffix ?? '')
    if (!text.includes('V')) return text
    const vowel = harmonyOf(stem)
    return text.split('V').join(vowel)
}
