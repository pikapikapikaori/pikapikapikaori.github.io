
let pending = null

export function setPendingLookup(value) {
    pending = value || null
}

export function takePendingLookup() {
    const value = pending
    pending = null
    return value
}
