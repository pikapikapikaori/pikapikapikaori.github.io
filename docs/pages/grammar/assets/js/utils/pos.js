/** 词性枚举：全局清单是 `config.js` 的 `POS_LIST`，语言可用 JSON 顶层的 `pos` 只开放其中一部分 */

import { POS_LIST } from '../config/config.js'

/** 某个语言可用的词性（JSON 顶层 `pos` 数组；缺省用全局清单） */
export function posOptions(posValues) {
    const values = Array.isArray(posValues) && posValues.length
        ? posValues
        : POS_LIST.map((p) => p.value)
    const set = new Set(values)
    return POS_LIST.filter((p) => set.has(p.value))
}
