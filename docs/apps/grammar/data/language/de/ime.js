/** 德语：变音与 ß。 */
const UMLAUT = '\u0308'

export default {
    name: '德语',
    placeholderBase: 'a',
    cased: true,
    marks: [
        { key: 'umlaut', label: '变音', row: 0, items: [{ c: UMLAUT, label: 'ä ö ü' }] }
    ],
    applies: (base, group) => {
        const b = String(base || '').normalize('NFD')[0]?.toLowerCase() || ''
        if (group === 'umlaut') return 'aou'.includes(b)
        return true
    },
    keyboard: null,
}
