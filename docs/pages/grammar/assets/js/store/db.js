/** IndexedDB 封装：库名 langnotebook，当前版本 2；store 与索引都在 upgrade() 里创建 */

export const DB_NAME = 'langnotebook'
export const DB_VERSION = 2

export const STORE_USERS = 'users'
export const STORE_WORDS = 'words'
export const STORE_SETTINGS = 'settings'
export const STORE_HTTP_CACHE = 'httpCache'

let _dbPromise = null

export function openDB() {
    if (_dbPromise) return _dbPromise

    _dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('当前浏览器不支持 IndexedDB'))
            return
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = (e) => {
            const db = req.result
            const oldV = e.oldVersion || 0
            upgrade(db, oldV)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'))
        req.onblocked = () => {
            console.warn('[db] 有其它标签页正在使用旧版本，请关闭后重试')
        }
    })

    return _dbPromise
}

function upgrade(db, oldVersion) {
    if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_USERS)) {
            const s = db.createObjectStore(STORE_USERS, { keyPath: 'id' })
            s.createIndex('name', 'name', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_WORDS)) {
            const s = db.createObjectStore(STORE_WORDS, { keyPath: 'id' })
            s.createIndex('userId', 'userId', { unique: false })
            s.createIndex('userId_language', ['userId', 'language'], { unique: false })
            s.createIndex('uniq_user_lang_lemma_pos',
                ['userId', 'language', 'lemma', 'pos'],
                { unique: true }
            )
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS, { keyPath: 'userId' })
        }
    }
    if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_HTTP_CACHE)) {
            const s = db.createObjectStore(STORE_HTTP_CACHE, { keyPath: 'key' })
            s.createIndex('storedAt', 'storedAt', { unique: false })
        }
    }
    // 新增版本时在此追加 if (oldVersion < 3) {...}
}

/* ---------- 基础请求封装 ---------- */

function reqToPromise(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export async function withStore(storeName, mode, fn) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        let out
        let tx
        try {
            tx = db.transaction(storeName, mode)
        } catch (err) {
            reject(err)
            return
        }
        tx.oncomplete = () => resolve(out)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error || new Error('事务被中止'))
        try {
            out = fn(tx.objectStore(storeName), tx)
        } catch (err) {
            try { tx.abort() } catch { /* ignore */ }
            reject(err)
        }
    })
}

export async function put(storeName, value) {
    return withStore(storeName, 'readwrite', (s) => reqToPromise(s.put(value)))
}

export async function bulkPut(storeName, values) {
    return withStore(storeName, 'readwrite', (s, tx) => {
        for (const v of values) s.put(v)
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(values.length)
            tx.onerror = () => reject(tx.error)
            tx.onabort = () => reject(tx.error)
        })
    })
}

export async function get(storeName, key) {
    return withStore(storeName, 'readonly', (s) => reqToPromise(s.get(key)))
}

export async function getAll(storeName) {
    return withStore(storeName, 'readonly', (s) => reqToPromise(s.getAll()))
}

export async function getAllByIndex(storeName, indexName, query) {
    return withStore(storeName, 'readonly', (s) => {
        const idx = s.index(indexName)
        return reqToPromise(idx.getAll(query))
    })
}

export async function getOneByIndex(storeName, indexName, query) {
    return withStore(storeName, 'readonly', (s) => {
        const idx = s.index(indexName)
        return reqToPromise(idx.get(query))
    })
}

export async function countByIndex(storeName, indexName, query) {
    return withStore(storeName, 'readonly', (s) => {
        const idx = s.index(indexName)
        return reqToPromise(idx.count(query))
    })
}

export async function remove(storeName, key) {
    return withStore(storeName, 'readwrite', (s) => reqToPromise(s.delete(key)))
}

export async function removeByIndex(storeName, indexName, query) {
    return withStore(storeName, 'readwrite', (s) => {
        const idx = s.index(indexName)
        return new Promise((resolve, reject) => {
            const req = idx.openCursor(query)
            let n = 0
            req.onsuccess = () => {
                const cur = req.result
                if (!cur) { resolve(n); return }
                cur.delete()
                n += 1
                cur.continue()
            }
            req.onerror = () => reject(req.error)
        })
    })
}

export async function clearStore(storeName) {
    return withStore(storeName, 'readwrite', (s) => reqToPromise(s.clear()))
}

export async function deleteDB() {
    const db = await openDB()
    db.close()
    _dbPromise = null
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME)
        req.onsuccess = () => resolve(true)
        req.onerror = () => reject(req.error)
        req.onblocked = () => resolve(false)
    })
}
