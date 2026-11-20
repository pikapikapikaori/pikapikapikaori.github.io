import {
    DB_NAME, DB_VERSION, STORE_ITEMS, STORE_META, STORE_CREDENTIALS,
    INFO_SCOPE, LEGACY_DB_NAME, LEGACY_CLEANUP_KEY,
} from './config.js'
import {
    isProgressObject, isValidOwner, isValidSubjectId,
} from './model.js'

let _dbPromise = null
let _currentDB = null

function createSchema(db) {
    if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const store = db.createObjectStore(STORE_ITEMS, { keyPath: ['owner', 'subject_id'] })
        store.createIndex('owner', 'owner')
    }
    if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'username' })
    }
    if (!db.objectStoreNames.contains(STORE_CREDENTIALS)) {
        db.createObjectStore(STORE_CREDENTIALS, { keyPath: 'username' })
    }
}

function hasSchema(db) {
    const stores = Array.from(db.objectStoreNames)
    if (!stores.includes(STORE_ITEMS)
        || !stores.includes(STORE_META)
        || !stores.includes(STORE_CREDENTIALS)) return false
    const store = db.transaction(STORE_ITEMS, 'readonly').objectStore(STORE_ITEMS)
    return Array.from(store.indexNames).includes('owner')
}

function closeDB(db) {
    return new Promise(resolve => {
        if (!db) { resolve(); return }
        const timer = setTimeout(resolve, 50)
        const done = () => { clearTimeout(timer); resolve() }
        db.onclose = done
        try { db.close() } catch { done() }
    })
}

function deleteDatabase(name, { timeout = 3000, onLateSuccess } = {}) {
    return new Promise((resolve, reject) => {
        let settled = false
        let blocked = false
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            reject(new Error(blocked ? '数据库删除被阻塞' : '数据库删除超时'))
        }, timeout)
        let req
        try {
            req = indexedDB.deleteDatabase(name)
        } catch (e) {
            clearTimeout(timer)
            reject(e)
            return
        }
        req.onblocked = () => { blocked = true }
        req.onsuccess = () => {
            clearTimeout(timer)
            if (!settled) {
                settled = true
                resolve()
                return
            }
            onLateSuccess?.()
        }
        req.onerror = () => {
            clearTimeout(timer)
            if (settled) return
            settled = true
            reject(req.error || new Error('数据库删除失败'))
        }
    })
}

function openChecked() {
    return new Promise((resolve, reject) => {
        let abandoned = false
        let req
        try {
            req = indexedDB.open(DB_NAME, DB_VERSION)
        } catch (e) {
            reject(e)
            return
        }
        req.onupgradeneeded = () => createSchema(req.result)
        req.onsuccess = () => {
            const db = req.result
            if (abandoned) {
                db.close()
                return
            }
            if (!hasSchema(db)) {
                closeDB(db)
                    .then(() => deleteDatabase(DB_NAME, { timeout: 3000 }))
                    .then(openChecked)
                    .then(resolve, reject)
                return
            }
            _currentDB = db
            db.onversionchange = () => {
                db.close()
                releaseDB(db)
            }
            db.onclose = () => releaseDB(db)
            resolve(db)
        }
        req.onerror = () => reject(req.error)
        req.onblocked = () => {
            abandoned = true
            _dbPromise = null
            reject(new Error('IndexedDB open blocked'))
        }
    })
}

function releaseDB(db) {
    if (_currentDB !== db) return
    _currentDB = null
    _dbPromise = null
}

function openDB() {
    if (_dbPromise) return _dbPromise
    _dbPromise = openChecked().catch(error => {
        _dbPromise = null
        throw error
    })
    return _dbPromise
}

// Exposed so modules with their own stores (auth.js credentials) reuse this
// connection, its schema check and its transaction error handling.
export function runTransaction(storeNames, mode, fn) {
    return run(storeNames, mode, fn)
}

function run(storeNames, mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const t = db.transaction(storeNames, mode)
        let settled = false
        const fail = error => {
            if (settled) return
            settled = true
            try { t.abort() } catch {}
            reject(error)
        }
        let request
        try {
            request = fn(t, fail)
        } catch (e) {
            fail(e)
            return
        }
        t.oncomplete = () => {
            if (settled) return
            settled = true
            resolve(request?.result)
        }
        t.onerror = event => {
            if (settled) return
            settled = true
            reject(t.error || event?.target?.error)
        }
        t.onabort = () => {
            if (settled) return
            settled = true
            reject(t.error || new Error('IndexedDB transaction aborted'))
        }
    }))
}

const LEGACY_CLEANUP_STATE = {
    IDLE: 'idle',
    RUNNING: 'running',
    DONE: 'done',
    FAILED: 'failed',
}

let _legacyCleanup = null
let _legacyCleanupPromise = null

function readCleanupStatus() {
    if (_legacyCleanup) return { ..._legacyCleanup }
    try {
        const raw = localStorage.getItem(LEGACY_CLEANUP_KEY)
        if (raw) return JSON.parse(raw)
    } catch {}
    return { state: LEGACY_CLEANUP_STATE.IDLE, error: '', updated_at: 0 }
}

function saveCleanupStatus(state, error = '') {
    _legacyCleanup = { state, error, updated_at: Date.now() }
    try {
        localStorage.setItem(LEGACY_CLEANUP_KEY, JSON.stringify(_legacyCleanup))
    } catch {}
    try {
        window.dispatchEvent(new CustomEvent('bgm:legacy-cleanup', {
            detail: { ..._legacyCleanup },
        }))
    } catch {}
    return { ..._legacyCleanup }
}

export function cleanupLegacyStorage() {
    if (_legacyCleanupPromise) return _legacyCleanupPromise
    const current = readCleanupStatus()
    if (current.state === LEGACY_CLEANUP_STATE.DONE) return Promise.resolve(current)

    _legacyCleanupPromise = (async () => {
        saveCleanupStatus(LEGACY_CLEANUP_STATE.RUNNING)
        try {
            removeLegacyKeys()
            await deleteDatabase(LEGACY_DB_NAME, {
                timeout: 3000,
                onLateSuccess: () => saveCleanupStatus(LEGACY_CLEANUP_STATE.DONE),
            })
            return saveCleanupStatus(LEGACY_CLEANUP_STATE.DONE)
        } catch (e) {
            return saveCleanupStatus(LEGACY_CLEANUP_STATE.FAILED, e?.message || String(e))
        } finally {
            _legacyCleanupPromise = null
        }
    })()
    return _legacyCleanupPromise
}

function requireScope(options) {
    const scope = options?.infoScope
    if (scope !== INFO_SCOPE.PRIVATE && scope !== INFO_SCOPE.PUBLIC) {
        throw new Error('缺少有效的 infoScope')
    }
    return scope
}

function requireOwner(owner) {
    if (!isValidOwner(owner)) throw new Error('owner 必须为非空字符串')
}

export function assertCounts(value, label) {
    if (!value
        || !Number.isInteger(value.done)
        || !Number.isInteger(value.total)
        || value.done < 0
        || value.total < 0
        || value.done > value.total) {
        throw new Error(`${label}必须为非负整数且完成数不超过总数`)
    }
}

function validateMetaRecord(record) {
    if (!record || typeof record !== 'object') throw new Error('用户资料格式错误')
    if (!isValidOwner(record.username)) throw new Error('username 必须为非空字符串')
    assertCounts(record.completeness, '完成度')
    if (record.task?.progress !== undefined) assertCounts(record.task.progress, '任务进度')
}

function recordFetched(record) {
    return record.progress_fetched === true
        || (record.progress_fetched === undefined && isProgressObject(record.progress))
}

function prepareRecord(owner, record, infoScope) {
    if (!record || typeof record !== 'object') throw new Error('条目格式错误')
    const subjectId = record.subject_id ?? record.subject?.id
    if (!isValidSubjectId(subjectId)) throw new Error('subject_id 类型无效')
    const { progress, ...rest } = record
    const out = { ...rest, owner, subject_id: subjectId }
    const fetched = recordFetched(record)
    if (infoScope === INFO_SCOPE.PRIVATE) {
        out.progress_fetched = fetched
        if (fetched) out.progress = isProgressObject(progress) ? progress : {}
        else delete out.progress
    } else {
        out.progress_fetched = false
        delete out.progress
    }
    return out
}

// Public data keeps progress fetched earlier; ep_status and vol_status still update.
function keepProgress(record, previous) {
    if (!previous) return record
    const out = { ...previous, ...record }
    const fetched = recordFetched(previous)
    out.progress_fetched = fetched
    if (fetched) out.progress = isProgressObject(previous.progress) ? previous.progress : {}
    else delete out.progress
    return out
}

function writeRecords(store, owner, records, infoScope, previousMap) {
    for (const record of records) {
        const prepared = prepareRecord(owner, record, infoScope)
        store.put(infoScope === INFO_SCOPE.PUBLIC
            ? keepProgress(prepared, previousMap?.get(prepared.subject_id))
            : prepared)
    }
}

// Merge one freshly obtained record into a record read inside the same
// transaction, so a concurrent import or clear cannot be overwritten by stale
// data from the start of the run.
function mergeRecords(previous, record) {
    if (!previous) return record
    const merged = { ...previous, ...record }
    for (const key of ['subject_data', 'ep_data', 'progress']) {
        if (merged[key] == null && previous[key] != null) merged[key] = previous[key]
    }
    if (recordFetched(previous) && record.progress_fetched !== true) {
        merged.progress_fetched = true
        merged.progress = previous.progress
    }
    if (merged.progress_fetched !== true) delete merged.progress
    return merged
}

function taskMatches(metaRecord, taskId) {
    const task = metaRecord?.task
    return !!(task && task.task_id === taskId && task.incomplete)
}

function removeLegacyKeys() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith(LEGACY_DB_NAME)) localStorage.removeItem(key)
    }
}

export const items = {
    replaceOwner(owner, records, options) {
        requireOwner(owner)
        const infoScope = requireScope(options)
        const taskId = options?.taskId || ''
        const stores = taskId ? [STORE_ITEMS, STORE_META] : [STORE_ITEMS]
        return run(stores, 'readwrite', (t, fail) => {
            const store = t.objectStore(STORE_ITEMS)
            const previous = infoScope === INFO_SCOPE.PUBLIC ? new Map() : null
            let current = true
            const replace = () => {
                const req = store.index('owner').openCursor(IDBKeyRange.only(owner))
                req.onsuccess = () => {
                    try {
                        const cursor = req.result
                        if (cursor) {
                            if (previous) previous.set(cursor.value.subject_id, cursor.value)
                            store.delete(cursor.primaryKey)
                            cursor.continue()
                            return
                        }
                        writeRecords(store, owner, records, infoScope, previous)
                    } catch (e) {
                        fail(e)
                    }
                }
            }
            if (taskId) {
                const check = t.objectStore(STORE_META).get(owner)
                check.onsuccess = () => {
                    current = taskMatches(check.result, taskId)
                    if (current) replace()
                }
            } else {
                replace()
            }
            return {
                get result() {
                    return current
                },
            }
        })
    },

    // One item, one read-write transaction: the existing record is read here,
    // not in an earlier transaction that a concurrent import could invalidate.
    merge(owner, record, options) {
        requireOwner(owner)
        const infoScope = requireScope(options)
        const taskId = options?.taskId || ''
        const stores = taskId ? [STORE_ITEMS, STORE_META] : [STORE_ITEMS]
        return run(stores, 'readwrite', (t, fail) => {
            const store = t.objectStore(STORE_ITEMS)
            let prepared
            let current = true
            try {
                prepared = prepareRecord(owner, record, infoScope)
            } catch (e) {
                fail(e)
                return null
            }
            const write = () => {
                const req = store.get([owner, prepared.subject_id])
                req.onsuccess = () => {
                    try {
                        store.put(mergeRecords(req.result, prepared))
                    } catch (e) {
                        fail(e)
                    }
                }
            }
            if (taskId) {
                const check = t.objectStore(STORE_META).get(owner)
                check.onsuccess = () => {
                    current = taskMatches(check.result, taskId)
                    if (current) write()
                }
            } else {
                write()
            }
            return {
                get result() {
                    return current
                },
            }
        })
    },

    put(owner, records, options) {
        requireOwner(owner)
        const infoScope = requireScope(options)
        return run([STORE_ITEMS], 'readwrite', (t, fail) => {
            const store = t.objectStore(STORE_ITEMS)
            if (infoScope === INFO_SCOPE.PRIVATE) {
                try {
                    writeRecords(store, owner, records, infoScope, null)
                } catch (e) {
                    fail(e)
                }
                return
            }
            for (const record of records) {
                try {
                    const prepared = prepareRecord(owner, record, infoScope)
                    const req = store.get([owner, prepared.subject_id])
                    req.onsuccess = () => {
                        try {
                            store.put(keepProgress(prepared, req.result))
                        } catch (e) {
                            fail(e)
                        }
                    }
                } catch (e) {
                    fail(e)
                    return
                }
            }
        })
    },

    getByOwner(owner) {
        requireOwner(owner)
        return run([STORE_ITEMS], 'readonly', t =>
            t.objectStore(STORE_ITEMS).index('owner').getAll(IDBKeyRange.only(owner)))
    },

    countByOwner(owner) {
        requireOwner(owner)
        return run([STORE_ITEMS], 'readonly', t =>
            t.objectStore(STORE_ITEMS).index('owner').count(IDBKeyRange.only(owner)))
    },
}

// Reads the meta record and every item of one user inside a single transaction,
// so an export sees one consistent snapshot.
export function readUserExport(username) {
    requireOwner(username)
    return run([STORE_ITEMS, STORE_META], 'readonly', (t, fail) => {
        try {
            const metaRequest = t.objectStore(STORE_META).get(username)
            const itemsRequest = t.objectStore(STORE_ITEMS)
                .index('owner').getAll(IDBKeyRange.only(username))
            return {
                get result() {
                    return {
                        meta: metaRequest.result || null,
                        items: itemsRequest.result || [],
                    }
                },
            }
        } catch (e) {
            fail(e)
            return null
        }
    })
}

// Replaces items and meta in one transaction.
export function replaceUser(username, metaRecord, records, options) {
    requireOwner(username)
    const infoScope = requireScope(options)
    if (!metaRecord || metaRecord.username !== username) throw new Error('用户资料不匹配')
    if (!Array.isArray(records)) throw new Error('条目列表格式错误')
    validateMetaRecord(metaRecord)
    return run([STORE_ITEMS, STORE_META], 'readwrite', (t, fail) => {
        const itemStore = t.objectStore(STORE_ITEMS)
        const metaStore = t.objectStore(STORE_META)
        const req = itemStore.index('owner').openCursor(IDBKeyRange.only(username))
        const previous = infoScope === INFO_SCOPE.PUBLIC ? new Map() : null
        req.onsuccess = () => {
            try {
                const cursor = req.result
                if (cursor) {
                    if (previous) previous.set(cursor.value.subject_id, cursor.value)
                    itemStore.delete(cursor.primaryKey)
                    cursor.continue()
                    return
                }
                writeRecords(itemStore, username, records, infoScope, previous)
                metaStore.put(metaRecord)
            } catch (e) {
                fail(e)
            }
        }
    })
}

export const meta = {
    get(username) {
        return run([STORE_META], 'readonly', t => t.objectStore(STORE_META).get(username))
    },

    put(record) {
        return run([STORE_META], 'readwrite', (t, fail) => {
            try {
                validateMetaRecord(record)
                t.objectStore(STORE_META).put(record)
            } catch (e) {
                fail(e)
            }
        })
    },

    list() {
        return run([STORE_META], 'readonly', t => t.objectStore(STORE_META).getAll())
    },
}

// Read and write one meta record inside a single transaction.
export function updateMeta(username, mutate) {
    requireOwner(username)
    let value
    return run([STORE_META], 'readwrite', (t, fail) => {
        const store = t.objectStore(STORE_META)
        const req = store.get(username)
        req.onsuccess = () => {
            try {
                const change = mutate(req.result)
                if (change && typeof change.then === 'function') {
                    change.catch?.(() => {})
                }
                if (!change || typeof change !== 'object' || Array.isArray(change)
                    || typeof change.then === 'function') {
                    throw new Error('修改函数必须同步返回对象')
                }
                if (change.record) {
                    validateMetaRecord(change.record)
                    store.put(change.record)
                }
                value = change.value
            } catch (e) {
                fail(e)
            }
        }
    }).then(() => value)
}

function minimalMetaRecord(record) {
    const username = record.username
    const user = record.user && typeof record.user === 'object'
        ? { ...record.user, username }
        : { username }
    return {
        username,
        user,
        generated_at: 0,
        updated_at: Date.now(),
        completeness: { total: 0, done: 0 },
        task: null,
    }
}

// Cache clearing removes collection data and task checkpoints. A credential is
// an account, not cache, so accounts that still have one keep a minimal meta
// record; this keeps the users page, export targets and credential dropdowns
// describing the same set of accounts.
export async function clearCachedData() {
    if (_legacyCleanupPromise) await _legacyCleanupPromise
    saveCleanupStatus(LEGACY_CLEANUP_STATE.RUNNING)
    try {
        await deleteDatabase(LEGACY_DB_NAME, {
            timeout: 3000,
            onLateSuccess: () => saveCleanupStatus(LEGACY_CLEANUP_STATE.DONE),
        })
        removeLegacyKeys()
        await run([STORE_ITEMS, STORE_META, STORE_CREDENTIALS], 'readwrite', t => {
            const itemStore = t.objectStore(STORE_ITEMS)
            const metaStore = t.objectStore(STORE_META)
            const credentialStore = t.objectStore(STORE_CREDENTIALS)
            const credentialsRequest = credentialStore.getAll()
            const metaRequest = metaStore.getAll()
            let credentials = null
            let metas = null

            const settle = () => {
                if (!credentials || !metas) return
                const names = new Set(credentials.map(record => record.username).filter(Boolean))
                for (const record of metas) {
                    if (names.has(record.username)) metaStore.put(minimalMetaRecord(record))
                    else metaStore.delete(record.username)
                }
                const known = new Set(metas.map(record => record.username))
                for (const name of names) {
                    if (!known.has(name)) metaStore.put(minimalMetaRecord({ username: name }))
                }
            }

            credentialsRequest.onsuccess = () => {
                credentials = credentialsRequest.result || []
                settle()
            }
            metaRequest.onsuccess = () => {
                metas = metaRequest.result || []
                settle()
            }
            itemStore.clear()
        })
        saveCleanupStatus(LEGACY_CLEANUP_STATE.DONE)
    } catch (e) {
        saveCleanupStatus(LEGACY_CLEANUP_STATE.FAILED, e?.message || String(e))
        throw e
    }
}
