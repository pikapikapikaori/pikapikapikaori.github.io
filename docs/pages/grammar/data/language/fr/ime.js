/** 法语：重音、软音符、连字。 */
const ACUTE = '\u0301'
const GRAVE = '\u0300'
const CIRC = '\u0302'
const DIA = '\u0308'
const CEDILLA = '\u0327'

export default {
    name: '法语',
    placeholderBase: 'a',
    cased: true,
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
        { key: 'cedilla', label: '软音符', row: 0, items: [{ c: CEDILLA, label: 'ç' }] },
        {
            key: 'ligature',
            label: '连字',
            row: 0,
            insert: true,
            items: [
                { c: '\u0153', label: 'œ' }, { c: '\u00E6', label: 'æ' },
                { c: '\u0152', label: 'Œ' }, { c: '\u00C6', label: 'Æ' }
            ]
        }
    ],
    applies: (base, group) => {
        const b = String(base || '').normalize('NFD')[0]?.toLowerCase() || ''
        if (group === 'accent') return 'aeiou'.includes(b)
        if (group === 'cedilla') return b === 'c'
        if (group === 'ligature') return 'oa'.includes(b)
        return true
    },
    keyboard: null,
    translitHint: 'oe → œ　ae → æ（大写 OE / AE 同样转成 Œ / Æ）'
}
