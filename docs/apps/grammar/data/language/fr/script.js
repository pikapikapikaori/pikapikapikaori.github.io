
const LIGATURES = [
    ['OE', '\u0152'],
    ['oe', '\u0153'],
    ['AE', '\u00C6'],
    ['ae', '\u00E6']
]

export function toScript(input) {
    let out = String(input ?? '')
    for (const [from, to] of LIGATURES) out = out.split(from).join(to)
    return out
}
