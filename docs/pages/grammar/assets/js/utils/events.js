/**
 * 极简发布订阅
 */

export function createEmitter() {
    /** @type {Map<string, Set<Function>>} */
    const map = new Map()

    function on(type, fn) {
        if (typeof fn !== 'function') return () => {}
        let set = map.get(type)
        if (!set) { set = new Set(); map.set(type, set) }
        set.add(fn)
        return () => off(type, fn)
    }

    function off(type, fn) {
        const set = map.get(type)
        if (!set) return
        set.delete(fn)
        if (set.size === 0) map.delete(type)
    }

    function once(type, fn) {
        const un = on(type, (...args) => { un(); fn(...args) })
        return un
    }

    function emit(type, ...args) {
        const set = map.get(type)
        if (!set) return
        // 复制一份，避免回调里 off 导致迭代异常
        for (const fn of Array.from(set)) {
            try { fn(...args) }
            catch (err) { console.error(`[emitter] listener error on "${type}"`, err) }
        }
    }

    function clear(type) {
        if (type) map.delete(type)
        else map.clear()
    }

    return { on, off, once, emit, clear }
}

export function createStore(initialState) {
    let state = { ...initialState }
    const bus = createEmitter()

    return {
        get() { return state },
        set(patch) {
            const next = typeof patch === 'function' ? patch(state) : patch
            if (!next) return state
            let changed = false
            for (const k of Object.keys(next)) {
                if (state[k] !== next[k]) { changed = true; break }
            }
            if (!changed) return state
            state = { ...state, ...next }
            bus.emit('change', state, next)
            return state
        },
        subscribe(fn) { return bus.on('change', fn) },
        /** 不触发变更通知的读取式更新，用于内部缓存 */
        _raw() { return state }
    }
}
