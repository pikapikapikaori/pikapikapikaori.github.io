/** 德语：变音与 ß。 */
const UMLAUT = '\u0308'

export default {
    name: '德语',
    placeholderBase: 'a',
    cased: true,
    marks: [
        { key: 'umlaut', label: '变音', row: 0, items: [{ c: UMLAUT, label: 'ä ö ü' }] },
        { key: 'eszett', label: 'ß', row: 0, items: [{ c: '\u00DF', label: 'ß' }] }
    ],
    applies: (base, group) => {
        const b = String(base || '').normalize('NFD')[0]?.toLowerCase() || ''
        if (group === 'umlaut') return 'aou'.includes(b)
        if (group === 'eszett') return b === 's'
        return true
    },
    keyboard: null,
    translitHint: '长音与复合元音后的 ss 写成 ß（heißen、außer；短元音的 dass 不变）'
}
