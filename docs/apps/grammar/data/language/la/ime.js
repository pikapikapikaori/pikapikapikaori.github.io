/** 拉丁语：只需要长短音符号。 */
const LONG = '\u0304'
const SHORT = '\u0306'
const VOWELS = 'aeiouy'

export default {
    name: '拉丁语',
    placeholderBase: 'a',
    cased: true,
    marks: [
        { key: 'length', label: '音长', row: 0, items: [{ c: LONG, label: '长音' }, { c: SHORT, label: '短音' }] }
    ],
    applies: (base, group) => group === 'length' && VOWELS.includes(String(base || '').normalize('NFD')[0]?.toLowerCase() || ''),
    keyboard: null,
}
