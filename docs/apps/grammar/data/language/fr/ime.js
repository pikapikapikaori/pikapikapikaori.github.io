/** 法语：重音、软音符。 */
const ACUTE = '\u0301'
const GRAVE = '\u0300'
const CIRC = '\u0302'
const DIA = '\u0308'
const CEDILLA = '\u0327'

export default {
    name: '法语',
    placeholderBase: 'a',
    cased: true,
    // 软音符只接 c、分音按 ï 的写法：样字各自指定，不然会显示成 a̧ / ä
    samples: { [CEDILLA]: 'c', [DIA]: 'i' },
    marks: [
        {
            key: 'accent',
            label: '音符',
            row: 0,
            items: [
                { c: ACUTE, label: 'é' }, { c: GRAVE, label: 'è à ù' },
                { c: CIRC, label: 'ê â î ô û' }, { c: DIA, label: 'ë ï ü' }
            ]
        },
        { key: 'cedilla', label: '软音符', row: 0, items: [{ c: CEDILLA, label: 'ç' }] }
    ],
    applies: (base, group) => {
        const b = String(base || '').normalize('NFD')[0]?.toLowerCase() || ''
        if (group === 'accent') return 'aeiou'.includes(b)
        if (group === 'cedilla') return b === 'c'
        return true
    },
    keyboard: null
}
