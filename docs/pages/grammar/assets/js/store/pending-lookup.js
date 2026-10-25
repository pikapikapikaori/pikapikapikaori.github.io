/**
 * 形态分析浮层 → 新建生词表单 的一次性交接：表单挂载时取一次并清空，
 * 只在内存里，刷新页面就没了。
 */

let pending = null

/** @param {{ langCode: string, lemma: string, patch: object } | null} value */
export function setPendingLookup(value) {
    pending = value || null
}

export function takePendingLookup() {
    const value = pending
    pending = null
    return value
}
