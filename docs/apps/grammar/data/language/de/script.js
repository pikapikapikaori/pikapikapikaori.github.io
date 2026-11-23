
const LONG_BEFORE_SS = /(aa|ee|oo|ah|eh|ih|oh|uh|äh|öh|üh|ei|ai|au|äu|eu|ie|oi|ui)ss/gi

export function toScript(input) {
    return String(input ?? '').replace(LONG_BEFORE_SS, (match, head) => {
        const upper = match.slice(-2) === 'SS'
        return head + (upper ? '\u1E9E' : '\u00DF')
    })
}
