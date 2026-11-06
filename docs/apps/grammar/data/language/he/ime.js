/**
 * 圣经希伯来语：修饰符（元音点 / dagesh / shin-sin）+ 转写（he/script.js）+ 键盘。
 * 键盘 Shift 切词尾形（ך ם ן ף ץ）。
 */
export default {
    name: '圣经希伯来语',
    placeholderBase: 'א',
    cased: false,
    marks: [
        {
            key: 'vowel',
            label: '元音',
            row: 1,
            items: [
                { c: '\u05B0', label: 'sheva' }, { c: '\u05B1', label: 'hatef' }, { c: '\u05B2', label: 'hatef-p' },
                { c: '\u05B3', label: 'hatef-q' }, { c: '\u05B4', label: 'hiriq' }, { c: '\u05B5', label: 'tsere' },
                { c: '\u05B6', label: 'segol' }, { c: '\u05B7', label: 'patah' }, { c: '\u05B8', label: 'qamats' },
                { c: '\u05B9', label: 'holam' }, { c: '\u05BB', label: 'qubbuts' }
            ]
        },
        { key: 'dagesh', label: 'dagesh', row: 0, items: [{ c: '\u05BC', label: 'ּ' }] },
        { key: 'shin', label: 'shin/sin', row: 0, items: [{ c: '\u05C1', label: 'ׁ' }, { c: '\u05C2', label: 'ׂ' }] }
    ],
    /* 中点托在 ב 上，ש 的两个点托在 ש 上（其余用默认样字 א） */
    samples: { '\u05BC': 'ב', '\u05C1': 'ש', '\u05C2': 'ש' },
    applies(base, group) {
        const b = String(base || '').normalize('NFD')[0]
        if (group === 'dagesh') return 'בגדכפת'.includes(b)
        if (group === 'shin') return b === 'ש'
        return true
    },
    keyboard: {
        rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
        map: {
            a: 'א', b: 'ב', g: 'ג', d: 'ד', h: 'ה', v: 'ו', z: 'ז', j: 'ח', t: 'ט', y: 'י',
            k: 'כ', l: 'ל', m: 'מ', n: 'נ', s: 'ס', e: 'ע', p: 'פ', c: 'צ', q: 'ק', r: 'ר', w: 'ש', u: 'ת',
            i: '־', o: '׳', f: '״', x: '׃',
            '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
            '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
            ';': '\u05B4', "'": '\u05B5', '[': '\u05B7', ']': '\u05B8',
            '\\': '\u05BC', ',': '\u05B6', '.': '\u05B9', '/': '\u05B0',
            aux1: '׳', aux2: '״', aux3: '־', aux4: '׃'
        },
        shift: {
            k: 'ך', m: 'ם', n: 'ן', p: 'ף', c: 'ץ',
            '[': '\u05C1', ']': '\u05C2', '\\': '\u05BC',
            ';': '\u05B1', "'": '\u05B2', ',': '\u05B3', '.': '\u05BB', '/': '\u05B0',
            aux1: '\u05C1', aux2: '\u05C2', aux3: '־', aux4: '׃'
        }
    },
    translitHint: '元音默认短音（dabar → דַּבַר），点错了在修饰符里换；词尾 k/m/n/p/ts 自动写词尾形'
}
