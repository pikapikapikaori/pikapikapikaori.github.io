/** 形态分析浮层到新建生词表单的一次性交接。 */

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
