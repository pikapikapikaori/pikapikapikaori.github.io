
import { POS_LIST } from '../config/config.js'

export function posOptions(posValues) {
    const values = Array.isArray(posValues) && posValues.length
        ? posValues
        : POS_LIST.map((p) => p.value)
    const set = new Set(values)
    return POS_LIST.filter((p) => set.has(p.value))
}
