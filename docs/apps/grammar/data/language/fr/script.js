/**
 * 法语「文字档案」：原文就是拉丁字母，没有真正的转写，只处理输入侧的连字。
 *
 * 故意不导出 `toRoman` / `scriptRange`：法语不需要「显示转写」，
 * 导出了只会让页面上多出一个没有意义的转写开关。
 */

/** 连字：oe / OE → œ / Œ，ae / AE → æ / Æ */
const LIGATURES = [
    ['OE', '\u0152'],
    ['oe', '\u0153'],
    ['AE', '\u00C6'],
    ['ae', '\u00E6']
]

/** 拉丁输入 → 法语写法（空格转写用） */
export function toScript(input) {
    let out = String(input ?? '')
    for (const [from, to] of LIGATURES) out = out.split(from).join(to)
    return out
}
