/**
 * 圣经希伯来语专用的后期处理：骨架代入与重音。
 *
 * 通用部分（toUnits / fromUnits）在 models/paradigm-generate.js 里，
 * 这里只放希伯来语的音系与马索拉符号规则。
 *
 * 希伯来语的屈折不是「词干 + 词尾」，而是「三辅音词根嵌进元音骨架」，
 * 所以骨架表用 `_` 表示一个词根辅音占位（占位后可以带 dagesh 等附加点）。
 */
/** 重音模式：末音节重音（מִלְרַע，默认）/ 倒数第二音节重音（מִלְּעֵיל） */
export const accentModes = ['he-milra', 'he-milel']

/** 词根占位符 */
export const ROOT_SLOT = '_'

/**
 * 「条件 dagesh」标记：写在 `_` 之后（`_~`），表示**若该词根辅音属于 בגדכפת** 就补 דָּגֵשׁ קַל。
 * 用于词中 dagesh lene 不确定的格子：同一个骨架配 ל/מ/ש 等词根时不会误加 dagesh（那会变成 dagesh forte）。
 */
export const DAGESH_SLOT = '~'

/** 词尾形 ↔ 词中形：ץ ף ן ם ך ↔ צ פ נ מ כ */
const FINAL_TO_REGULAR = { 'ץ': 'צ', 'ף': 'פ', 'ן': 'נ', 'ם': 'מ', 'ך': 'כ' }
const REGULAR_TO_FINAL = { 'צ': 'ץ', 'פ': 'ף', 'נ': 'ן', 'מ': 'ם', 'כ': 'ך' }

/** מֶתֶג（meteg，U+05BD）：标在重读音节的元音之后，马索拉文本的惯例符号 */
const METEG = '\u05BD'
const SHEWA = '\u05B0'
/** 完整元音（可承载重音）：חִירִק צֵרֵי סֶגוֹל פַּתַח קָמָץ חוֹלָם קִבּוּץ */
const FULL_VOWELS = new Set(['\u05B4', '\u05B5', '\u05B6', '\u05B7', '\u05B8', '\u05B9', '\u05BB'])
/** שׁוּרֶק 写作 וֹ 的 דָּגֵשׁ 形式：带 dagesh 的 ו 也算一个元音 */
const VAV = 'ו'
const DAGESH = '\u05BC'


const COMBINING_CHAR = /\p{M}/u
/** ב ג ד כ פ ת：在音节开头读塞音，要带 דָּגֵשׁ קַל */
const BEGADKEFAT = new Set(['ב', 'ג', 'ד', 'כ', 'פ', 'ת'])

/**
 * 补 דָּגֵשׁ קַל（dagesh lene）：ב ג ד כ פ ת 在**词首**读塞音，要带点。
 *
 * 骨架是与词根无关的，代入的词根辅音本身不带这个点，所以由这一步统一处理；
 * 已有 דָּגֵשׁ（קַל 或 חָזָק）的字母跳过。
 *
 * 局限：词中「שְׁוָא נָח 之后」的 dagesh lene（如 יִכְתְּבוּ 的 ת）依赖词根字母的发音位置，
 * 目前不做自动判定 —— 需要时在骨架里把该格写成 `_` + דָּגֵשׁ。见 docs/TODO.md。
 */
export function dageshLene(text) {
    const chars = [...String(text ?? '').normalize('NFC')]
    const out = []
    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i]
        const marks = []
        while (i + 1 < chars.length && COMBINING_CHAR.test(chars[i + 1])) {
            marks.push(chars[i + 1])
            i += 1
        }
        if (out.length === 0 && BEGADKEFAT.has(ch) && !marks.includes(DAGESH)) {
            marks.unshift(DAGESH)
        }
        out.push(ch, ...marks)
    }
    return out.join('').normalize('NFC')
}

/**
 * 把三辅音词根代入元音骨架。
 * `applySkeleton('קטל', '_ָ_ַ_')` → `קָטַל`
 *
 * 支持两种后缀记号：
 *   `_1` / `_2` / `_3` —— 显式指定第几个词根辅音（弱根脱落时用，避免顺序错位）
 *   `_~`              —— 该词根辅音若是 בגדכפת 就补 דָּגֵשׁ קַל（词中 dagesh lene）
 */
export function applySkeleton(root, skeleton) {
    const letters = [...String(root ?? '').replace(/[-\u2010-\u2015\s]/g, '')]
    const chars = [...String(skeleton ?? '')]

    // ---- 第一步：解析成单元。词根占位连同其后紧跟的组合记号算一个单元 ----
    const units = []
    let slot = 0
    for (let k = 0; k < chars.length; k += 1) {
        const ch = chars[k]
        if (ch === ROOT_SLOT) {
            let index = slot
            const next = chars[k + 1]
            if (next && next >= '1' && next <= '9') {
                index = Number(next) - 1
                slot = index + 1
                k += 1
            } else {
                slot += 1
            }
            let forceDagesh = false
            if (chars[k + 1] === DAGESH_SLOT) {
                forceDagesh = true
                k += 1
            }
            const unit = { ch: letters[index] ?? ROOT_SLOT, marks: [], fromRoot: true, forceDagesh }
            // 骨架里紧跟的组合记号归到这个词根字母上
            while (k + 1 < chars.length && COMBINING_CHAR.test(chars[k + 1])) {
                unit.marks.push(chars[k + 1])
                k += 1
            }
            units.push(unit)
            continue
        }
        if (ch === DAGESH_SLOT) continue
        if (COMBINING_CHAR.test(ch)) {
            // 骨架里独立书写的组合记号：挂到前一个字母上
            const prev = units[units.length - 1]
            if (prev) prev.marks.push(ch)
            continue
        }
        units.push({ ch, marks: [], fromRoot: false })
    }

    // ---- 第二步：词尾形归一。只有「后面再没有字母」的那个字母才用词尾形 ----
    let lastLetter = -1
    units.forEach((u, index) => { if (u.ch !== ROOT_SLOT) lastLetter = index })
    units.forEach((u, index) => {
        if (index === lastLetter) {
            if (REGULAR_TO_FINAL[u.ch]) u.ch = REGULAR_TO_FINAL[u.ch]
        } else if (FINAL_TO_REGULAR[u.ch]) {
            u.ch = FINAL_TO_REGULAR[u.ch]
        }
    })

    // ---- 第三步：补 דָּגֵשׁ קַל ----
    // 词首的 בגדכפת 一律补（等同于 dageshLene 的词首规则）。
    // 词中的 dagesh lene **不自动判定**：שְׁוָא 是发声道还是静默取决于词形本身
    // （מַלְכוּת 的 שְׁוָא 发声道 → 不加点；יִכְתְּבוּ 的是静默 → 加点），
    // 因此由骨架里的 `~` 显式声明（见 docs/TODO.md E3）。
    let out = ''
    let letterIndex = 0
    for (const unit of units) {
        const isLetter = unit.ch !== ROOT_SLOT
        const hasDagesh = unit.marks.includes(DAGESH)
        const addDagesh = isLetter
            && BEGADKEFAT.has(unit.ch)
            && !hasDagesh
            && (letterIndex === 0 || unit.forceDagesh)
        out += unit.ch
        if (addDagesh) out += DAGESH
        for (const mark of unit.marks) out += mark
        if (isLetter) letterIndex += 1
    }
    return out.normalize('NFC')
}

/**
 * 骨架的反向运算：把 base 形态里的词根辅音依次换成 `_`，得到该形态的骨架。
 * 用于「由基本形态判定元音模式」：`toSkeleton('דָּבָר', 'דבר')` → `_ָ_ָ_`
 */
export function toSkeleton(form, root) {
    const letters = [...String(root ?? '').replace(/[-\u2010-\u2015\s]/g, '')]
    const chars = [...String(form ?? '').normalize('NFC')]
    let from = 0
    let next = 0
    letters.forEach((letter, k) => {
        // 词根辅音可能在词形里缺席（弱根脱落），缺席就跳过，继续找下一个
        const at = chars.findIndex((ch, i) => i >= from && ch === letter)
        if (at < 0) return
        // 跳过了前面的词根辅音时改用显式下标（`_2` = 第 2 个辅音）
        chars[at] = k === next ? ROOT_SLOT : `${ROOT_SLOT}${k + 1}`
        from = at + 1
        next = k + 1
    })
    return chars.join('').normalize('NFC')
}

/** 比较用的骨架指纹：忽略 dagesh，便于用户少写一个点也能匹配上模式 */
export function skeletonKey(skeleton) {
    return String(skeleton ?? '').normalize('NFC')
        .split(DAGESH).join('')
        .split(DAGESH_SLOT).join('')
}

/** 骨架里出现了几个词根占位 */
export function countSlots(skeleton) {
    return [...String(skeleton ?? '')].filter((ch) => ch === ROOT_SLOT).length
}

/**
 * 标出每个可承载重音的元音在字串中的位置（码点下标）。
 * שׁוּרֶק 的 וּ 与普通元音点都算。
 */
function vowelPositions(text) {
    const chars = [...String(text ?? '').normalize('NFC')]
    const out = []
    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i]
        if (FULL_VOWELS.has(ch)) {
            out.push(i)
            continue
        }
        if (ch === VAV) {
            const next = chars[i + 1]
            if (next === DAGESH) out.push(i + 1)
        }
    }
    return { chars, positions: out }
}

/**
 * 按马索拉惯例给重读音节加 מֶתֶג。
 * mode: `he-milra`（末音节）/ `he-milel`（倒数第二音节）
 */
export function accent(text, mode) {
    const src = String(text ?? '').normalize('NFC')
    if (!src || mode === 'none' || !mode) return src
    if (mode !== 'he-milra' && mode !== 'he-milel') return src
    if (src.includes(METEG)) return src

    const { chars, positions } = vowelPositions(src)
    if (!positions.length) return src

    const index = mode === 'he-milel'
        ? (positions.length >= 2 ? positions[positions.length - 2] : positions[0])
        : positions[positions.length - 1]

    // 插在重读元音之后（元音点本身，或 שׁוּרֶק 的 dagesh 之后）
    chars.splice(index + 1, 0, METEG)
    return chars.join('').normalize('NFC')
}

/** 去掉已有的重音记号，方便反复重算 */
export function stripAccent(text) {
    return String(text ?? '').normalize('NFC').split(METEG).join('')
}

/** 供界面/校验用：骨架 + 词根 → 词形（补 dagesh lene；mode 为空时不标重音，交给 post.accent） */
export function realize(root, skeleton, mode = 'none') {
    return accent(dageshLene(applySkeleton(root, skeleton)), mode)
}

/** 只要词形、不标重音 */
export function spell(root, skeleton) {
    return dageshLene(applySkeleton(root, skeleton))
}
