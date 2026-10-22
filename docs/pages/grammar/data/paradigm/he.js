/**
 * 圣经希伯来语专用的后期处理：骨架代入与重音。
 *
 * 通用部分（toUnits / fromUnits）在 models/paradigm-generate.js 里，
 * 这里只放希伯来语的音系与马索拉符号规则。
 *
 * 希伯来语的屈折不是「词干 + 词尾」，而是「三辅音词根嵌进元音骨架」，
 * 所以骨架表用四个占位符分别表示第 1–4 个词根辅音（占位符后面可以带 dagesh 等附加点）：
 *   `־`（מַקָּף）= 第 1 个，`׳`（גֵּרֵשׁ）= 第 2 个，`״`（גֵּרְשַׁיִם）= 第 3 个，
 *   `׀`（פָּסֵק）= 第 4 个（四辅音词根）。
 * 用固定符号而不是「按顺序自动编号 + 下标数字」，是因为数字夹在占位符和它的元音附标之间时，
 * 附标会挂到数字上、在 RTL 里叠成一团。
 */
/** 重音模式：末音节重音（מִלְרַע，默认）/ 倒数第二音节重音（מִלְּעֵיל） */
export const accentModes = ['he-milra', 'he-milel']

/** 词根占位符 */
/**
 * 词根占位符：下标 0–3 依次是第 1 / 2 / 3 / 4 个词根辅音。
 * 顺便导出第一个，供只关心「有没有占位符」的地方使用。
 */
export const ROOT_SLOTS = ['־', '׳', '״', '׀']
export const ROOT_SLOT = ROOT_SLOTS[0]

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
 * 骨架与词根无关，代入的词根辅音本身不带这个点，所以词首由这里统一补。
 * 词中要不要补取决于 שְׁוָא 是发声道还是静默（如 מַלְכוּת 的 שְׁוָא 发声道 → 不加点，
 * יִכְתְּבוּ 的静默 → 加点），无法从词形可靠推断，因此由骨架直接写点、
 * 用 `derive.post.leneSlots` 声明哪几个槽位的点是「条件 dagesh lene」。
 *
 * 已有 דָּגֵשׁ（קַל 或 חָזָק）的字母跳过。
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
 * 把词根辅音代入元音骨架。
 * `applySkeleton('קטל', '־ָ׳ַ״')` → `קָטַל`
 *
 * 记号：
 *   `־` / `׳` / `״` / `׀` —— 第 1 / 2 / 3 / 4 个词根辅音（弱根脱落时看符号就知道缺的是哪一个）
 *
 * 骨架里只有这四个占位符：元音点、dagesh 等附标直接写在占位符后面。
 * 词首的 dagesh lene 由 `dageshLene()` 补；词中的 dagesh lene 写在骨架里，并由
 * `options.leneSlots`（取自 `derive.post.leneSlots`，如 `['1']`）声明：代入的辅音若不属于
 * בגדכפת，就把这个点去掉（同一个骨架因此能同时服务 בנה 与 עשה）。
 */
export function applySkeleton(root, skeleton, options = {}) {
    const letters = [...String(root ?? '').replace(/[-\u2010-\u2015\s]/g, '')]
    const chars = [...String(skeleton ?? '')]

    const leneSlots = new Set((options?.leneSlots || []).map((x) => String(x)))

    // ---- 第一步：解析成单元。词根占位连同其后紧跟的组合记号算一个单元 ----
    const units = []
    for (let k = 0; k < chars.length; k += 1) {
        const ch = chars[k]
        const rootIndex = ROOT_SLOTS.indexOf(ch)
        if (rootIndex >= 0) {
            // 词根字母不够长时保留占位符本身，避免把数据错误悄悄吃掉
            const rootLetter = letters[rootIndex]
            const unit = { ch: rootLetter ?? ch, marks: [], fromRoot: true }
            // 骨架里紧跟占位符的组合记号（元音点、dagesh forte 等）归到这个词根字母上
            while (k + 1 < chars.length && COMBINING_CHAR.test(chars[k + 1])) {
                unit.marks.push(chars[k + 1])
                k += 1
            }
            // 条件 dagesh lene：该槽位声明为「条件点」、代入的辅音又不是 בגדכפת 时去掉
            if (leneSlots.has(String(rootIndex + 1)) && rootLetter && !BEGADKEFAT.has(rootLetter)) {
                unit.marks = unit.marks.filter((m) => m !== DAGESH)
            }
            units.push(unit)
            continue
        }
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
    units.forEach((u, index) => { if (!ROOT_SLOTS.includes(u.ch)) lastLetter = index })
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
    // 由 `dageshLene()` 按「词首 / 静默 shewa 之后」两条规则补，骨架里不写。
    let out = ''
    let letterIndex = 0
    for (const unit of units) {
        const isLetter = !ROOT_SLOTS.includes(unit.ch)
        const hasDagesh = unit.marks.includes(DAGESH)
        const addDagesh = isLetter
            && BEGADKEFAT.has(unit.ch)
            && !hasDagesh
            && letterIndex === 0
        out += unit.ch
        if (addDagesh) out += DAGESH
        for (const mark of unit.marks) out += mark
        if (isLetter) letterIndex += 1
    }
    return out.normalize('NFC')
}

/**
 * 骨架的反向运算：把 base 形态里的词根辅音换成对应位置的占位符，得到该形态的骨架。
 * 用于「由基本形态判定元音模式」：`toSkeleton('דָּבָר', 'דבר')` → `־ָ׳ָ״`
 */
export function toSkeleton(form, root) {
    // 词根里的 ן ף ץ ם ך 与词形中的词中形是同一个字母，比对前先统一成常规形
    const letters = [...String(root ?? '').replace(/[-\u2010-\u2015\s]/g, '')]
        .map((ch) => FINAL_TO_REGULAR[ch] || ch)
    const chars = [...String(form ?? '').normalize('NFC')]
    let from = 0
    let next = 0
    letters.forEach((letter, k) => {
        // 词根辅音可能在词形里缺席（弱根脱落），缺席就跳过，继续找下一个
        const at = chars.findIndex((ch, i) => i >= from && (FINAL_TO_REGULAR[ch] || ch) === letter)
        if (at < 0) return
        // 缺席的词根辅音不会被替换，剩下几个占位符就说明缺的是哪一个
        chars[at] = ROOT_SLOTS[k] ?? ROOT_SLOT
        from = at + 1
        next = k + 1
    })
    return chars.join('').normalize('NFC')
}

/** 比较用的骨架指纹：忽略 dagesh，便于用户少写一个点也能匹配上模式 */
export function skeletonKey(skeleton) {
    return String(skeleton ?? '').normalize('NFC')
        .split(DAGESH).join('')
}

/** 骨架里出现了几个词根占位 */
export function countSlots(skeleton) {
    return [...String(skeleton ?? '')].filter((ch) => ROOT_SLOTS.includes(ch)).length
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
export function realize(root, skeleton, options = {}) {
    return accent(dageshLene(applySkeleton(root, skeleton, options)), options.mode)
}

/** 只要词形、不标重音 */
export function spell(root, skeleton, options = {}) {
    return dageshLene(applySkeleton(root, skeleton, options))
}
