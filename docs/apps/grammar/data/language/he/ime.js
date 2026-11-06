/**
 * 圣经希伯来语：修饰符（元音点 / dagesh / shin-sin）+ 转写（he/script.js）+ 键盘。
 * 键盘 Shift 切词尾形（ך ם ן ף ץ）。
 */
export default {
    name: '圣经希伯来语',
    placeholderBase: 'א',
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
        // 以转写为准：字母键即其拉丁转写；元音点按 aeiou 排；Shift 取另一档（长元音、词尾形）
        map: {
            '`': 'ע',
            '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
            '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
            '-': 'א', '=': '\u05BC',
            q: 'ק', w: 'ו', e: '\u05B6', r: 'ר', t: 'ת', y: 'י', u: '\u05BB',
            i: '\u05B4', o: '\u05B9', p: 'פ',
            '[': '\u05B0', ']': '\u05B1', '\\': '\u05C3',
            a: '\u05B7', s: 'ס', d: 'ד', f: 'ח', g: 'ג', h: 'ה', j: '\u05C1',
            k: 'כ', l: 'ל', ';': '\u05F3', '\'': '\u05F4',
            aux1: '\u05B2', aux2: '\u05B3',
            z: 'ז', x: 'ש', c: 'צ', v: 'ט', b: 'ב', n: 'נ', m: 'מ',
            ',': ',', '.': '.', '/': '\u05BE'
        },
        shift: {
            a: '\u05B8', e: '\u05B5', j: '\u05C2',
            k: 'ך', m: 'ם', n: 'ן', p: 'ף', c: 'ץ'
        }
    },
}
