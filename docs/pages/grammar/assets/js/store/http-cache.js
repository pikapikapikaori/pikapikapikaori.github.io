/**
 * 外部请求的响应缓存（IndexedDB）：键是完整请求 URL，值形如 `{ key, url, type, body, storedAt, expiresAt }`；
 * 只做读 / 写 / 清，什么时候用由 services/http.js 决定。
 */

import { STORE_HTTP_CACHE, get, put, withStore, clearStore } from './db.js'

/** 多久清一次过期条目（写入时顺带触发，避免每次请求都扫表） */
const PRUNE_EVERY = 60 * 1000
let lastPrune = 0

export async function readCache(key) {
    if (!key) return null
    const row = await get(STORE_HTTP_CACHE, key).catch(() => null)
    if (!row) return null
    if (row.expiresAt && row.expiresAt < Date.now()) return null
    return row
}

export async function writeCache(key, { url = '', type = 'json', body = '', ttl = 0 } = {}) {
    if (!key) return
    const now = Date.now()
    const row = { key, url, type, body, storedAt: now, expiresAt: ttl > 0 ? now + ttl : 0 }
    await put(STORE_HTTP_CACHE, row).catch(() => {})

    if (now - lastPrune > PRUNE_EVERY) {
        lastPrune = now
        pruneCache().catch(() => {})
    }
}

export async function pruneCache() {
    const now = Date.now()
    return withStore(STORE_HTTP_CACHE, 'readwrite', (store) => {
        const req = store.openCursor()
        req.onsuccess = () => {
            const cursor = req.result
            if (!cursor) return
            if (cursor.value && cursor.value.expiresAt && cursor.value.expiresAt < now) {
                cursor.delete()
            }
            cursor.continue()
        }
    })
}

export async function clearHttpCache() {
    return clearStore(STORE_HTTP_CACHE)
}
