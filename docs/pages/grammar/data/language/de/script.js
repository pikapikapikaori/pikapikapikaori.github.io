/**
 * 德语「文字档案」：原文还是拉丁字母，只处理输入侧的 ß。
 *
 * ß 只出现在**长元音或复合元音**之后，短元音后仍写 ss（dass、muss、Fluss），
 * 所以只在前面的音节确实是长音 / 复元音时才替换：
 *   复合元音与长音拼写：ei ai au äu eu ie oi ui / aa ee oo / 元音 + h
 * 大写同理（SS → ẞ）。故意不导出 `toRoman`：德语没有转写，也就不该出现「显示转写」。
 */

/** ß 前面的长音 / 复元音拼写 */
const LONG_BEFORE_SS = /(aa|ee|oo|ah|eh|ih|oh|uh|äh|öh|üh|ei|ai|au|äu|eu|ie|oi|ui)ss/gi

/** 拉丁输入 → 德语写法（空格转写与失焦转写都用它） */
export function toScript(input) {
    return String(input ?? '').replace(LONG_BEFORE_SS, (match, head) => {
        const upper = match.slice(-2) === 'SS'
        return head + (upper ? '\u1E9E' : '\u00DF')
    })
}
