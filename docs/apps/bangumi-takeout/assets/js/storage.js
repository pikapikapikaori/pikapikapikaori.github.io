import {
    dbName, dbVersion, storeItems, storeMeta, storeCredentials, infoScopes,
} from './config.js'
import {
    isProgressObject, isValidOwner, isValidSubjectId,
} from './model.js'

// The list of an unfinished task lives outside the meta record, one page per record,
// so a checkpoint writes task fields and one page, not the whole list.
const storeTaskList = 'task_list'
const taskTokenIndex = 'task_id'

const listKey = ['task_id', 'offset']

// Finished ids are chunked too, so a checkpoint rewrites one chunk instead of a set
// that grows with the stage.
const storeTaskDone = 'task_done'
const taskStageIndex = 'task_stage'
const doneKey = ['task_id', 'stage', 'chunk']
const taskStageKey = ['task_id', 'stage']
const taskDoneChunkSize = 200

const itemKey = ['owner', 'subject_id']

// An item is two records under one key: the display half the collection view reads
// and the detail half. Both are written in one transaction.
const storeItemDetail = 'item_detail'

// Fields only the detail page renders. They are most of a record's bytes, so
// leaving them out of the list read is what makes switching users cheap.
const detailFields = ['subject_data', 'ep_data', 'progress']

let _dbPromise = null
let _currentDB = null

function sameKeyPath(actual, expected) {
    const left = Array.isArray(actual) ? actual : [actual]
    const right = Array.isArray(expected) ? expected : [expected]
    return left.length === right.length && left.every((part, index) => part === right[index])
}

function hasIndex(store, name, keyPath) {
    if (!Array.from(store.indexNames).includes(name)) return false
    return sameKeyPath(store.index(name).keyPath, keyPath)
}

function createSchema(db) {
    if (!db.objectStoreNames.contains(storeItems)) {
        const store = db.createObjectStore(storeItems, { keyPath: itemKey })
        store.createIndex('owner', 'owner')
    }
    if (!db.objectStoreNames.contains(storeItemDetail)) {
        const store = db.createObjectStore(storeItemDetail, { keyPath: itemKey })
        store.createIndex('owner', 'owner')
    }
    if (!db.objectStoreNames.contains(storeMeta)) {
        db.createObjectStore(storeMeta, { keyPath: 'username' })
    }
    if (!db.objectStoreNames.contains(storeTaskList)) {
        const store = db.createObjectStore(storeTaskList, { keyPath: listKey })
        store.createIndex(taskTokenIndex, taskTokenIndex)
    }
    if (!db.objectStoreNames.contains(storeTaskDone)) {
        const store = db.createObjectStore(storeTaskDone, { keyPath: doneKey })
        store.createIndex(taskTokenIndex, taskTokenIndex)
        store.createIndex(taskStageIndex, taskStageKey)
    }
    if (!db.objectStoreNames.contains(storeCredentials)) {
        db.createObjectStore(storeCredentials, { keyPath: 'username' })
    }
}

// A schema that differs in stores, key paths or indexes is deleted and rebuilt empty:
// indexes cannot be added in place. The check runs after every open.
function hasSchema(db) {
    const names = Array.from(db.objectStoreNames)
    if (!names.includes(storeItems)
        || !names.includes(storeItemDetail)
        || !names.includes(storeMeta)
        || !names.includes(storeTaskList)
        || !names.includes(storeTaskDone)
        || !names.includes(storeCredentials)) return false
    const view = name => db.transaction(name, 'readonly').objectStore(name)
    const itemStore = view(storeItems)
    const detailStore = view(storeItemDetail)
    const listStore = view(storeTaskList)
    const doneStore = view(storeTaskDone)
    return sameKeyPath(itemStore.keyPath, itemKey)
        && hasIndex(itemStore, 'owner', 'owner')
        && sameKeyPath(detailStore.keyPath, itemKey)
        && hasIndex(detailStore, 'owner', 'owner')
        && sameKeyPath(view(storeMeta).keyPath, 'username')
        && sameKeyPath(listStore.keyPath, listKey)
        && hasIndex(listStore, taskTokenIndex, taskTokenIndex)
        && sameKeyPath(doneStore.keyPath, doneKey)
        && hasIndex(doneStore, taskTokenIndex, taskTokenIndex)
        && hasIndex(doneStore, taskStageIndex, taskStageKey)
        && sameKeyPath(view(storeCredentials).keyPath, 'username')
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

function deleteDatabase(name, { timeout = 3000 } = {}) {
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
            if (settled) return
            settled = true
            resolve()
        }
        req.onerror = () => {
            clearTimeout(timer)
            if (settled) return
            settled = true
            reject(req.error || new Error('数据库删除失败'))
        }
    })
}

function rebuildDatabase(db) {
    return closeDB(db)
        .then(() => deleteDatabase(dbName, { timeout: 3000 }))
        .then(openChecked)
}

function openChecked() {
    return new Promise((resolve, reject) => {
        let abandoned = false
        let req
        try {
            req = indexedDB.open(dbName, dbVersion)
        } catch (e) {
            reject(e)
            return
        }
        req.onupgradeneeded = () => {
            createSchema(req.result)
        }
        req.onsuccess = () => {
            const db = req.result
            if (abandoned) {
                db.close()
                return
            }
            if (!hasSchema(db)) {
                rebuildDatabase(db).then(resolve, reject)
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
        req.onerror = () => {
            const error = req.error
            // A database left at a higher version fails before any check, so it never reaches
            // the branch above; rebuild it the same way.
            if (!abandoned && error?.name === 'VersionError') {
                rebuildDatabase().then(resolve, reject)
                return
            }
            reject(error)
        }
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

function requireScope(options) {
    const scope = options?.infoScope
    if (scope !== infoScopes.private && scope !== infoScopes.public) {
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
    if (record.task?.collection_total !== undefined
        && (!Number.isInteger(record.task.collection_total) || record.task.collection_total < 0)) {
        throw new Error('任务收藏总数必须为非负整数')
    }
    if (record.task?.done_count !== undefined
        && (!Number.isInteger(record.task.done_count) || record.task.done_count < 0)) {
        throw new Error('任务已完成条数必须为非负整数')
    }
}

// A stored progress belongs to the collection state it was read from, the record's
// own `updated_at`; every merge that changes the version drops it.
function prepareRecord(owner, record, infoScope) {
    if (!record || typeof record !== 'object') throw new Error('条目格式错误')
    const subjectId = record.subject_id ?? record.subject?.id
    if (!isValidSubjectId(subjectId)) throw new Error('subject_id 类型无效')
    const { progress, ...rest } = record
    const out = { ...rest, owner, subject_id: subjectId }
    if (infoScope === infoScopes.private && isProgressObject(progress)) out.progress = progress
    else delete out.progress
    return out
}

// Public data keeps progress read earlier; ep_status and vol_status still update.
function keepProgress(record, previous) {
    if (!previous) return record
    const out = { ...previous, ...record }
    if (previous.updated_at === record.updated_at && isProgressObject(previous.progress)) {
        out.progress = previous.progress
    } else {
        delete out.progress
    }
    return out
}

// One batch may not repeat a subject_id: the later record would overwrite the
// earlier one and the stored count would disagree with the list.
function prepareBatch(owner, records, infoScope) {
    if (!Array.isArray(records)) throw new Error('条目列表格式错误')
    const seen = new Set()
    const out = []
    for (const record of records) {
        const prepared = prepareRecord(owner, record, infoScope)
        if (seen.has(prepared.subject_id)) {
            throw new Error(`条目批次 subject_id 重复: ${prepared.subject_id}`)
        }
        seen.add(prepared.subject_id)
        out.push(prepared)
    }
    return out
}

function writeRecords(listStore, detailStore, owner, records, infoScope, previousMap) {
    for (const prepared of prepareBatch(owner, records, infoScope)) {
        putSplit(listStore, detailStore, infoScope === infoScopes.public
            ? keepProgress(prepared, previousMap?.get(prepared.subject_id))
            : prepared)
    }
}

// The list record carries the display fields, the detail record the rest. The caller's
// record stays untouched: a backup run reuses it in later stages.
function splitRecord(record) {
    const { subject_data, ep_data, progress, ...list } = record
    const detail = { owner: record.owner, subject_id: record.subject_id }
    if (subject_data !== undefined) detail.subject_data = subject_data
    if (ep_data !== undefined) detail.ep_data = ep_data
    if (progress !== undefined) detail.progress = progress
    // The work tags are drawn on the detail page only, and the array is long,
    // so it travels with the detail record.
    if (Array.isArray(list.subject?.tags)) {
        detail.subject_tags = list.subject.tags
        list.subject = { ...list.subject }
        delete list.subject.tags
    }
    // `progress_at` stays on the list half so an incremental run decides without the detail.
    if (progress !== undefined) list.progress_at = record.updated_at ?? ''
    return { list, detail }
}

// The record as the export and the detail page need it, rebuilt from the two
// stored halves.
function joinRecord(list, detail) {
    if (!list) return null
    const out = { ...list }
    delete out.progress_at
    if (detail) {
        for (const key of detailFields) {
            if (detail[key] !== undefined) out[key] = detail[key]
        }
        if (detail.subject_tags !== undefined) {
            out.subject = { ...(out.subject || {}), tags: detail.subject_tags }
        }
    }
    return out
}

function putSplit(listStore, detailStore, record) {
    const { list, detail } = splitRecord(record)
    listStore.put(list)
    detailStore.put(detail)
}

// Merge into a record read in the same transaction, so a concurrent import or clear
// cannot be overwritten by data from the start of the run.
function mergeRecords(previous, record) {
    if (!previous) return record
    const merged = { ...previous, ...record }
    for (const key of ['subject_data', 'ep_data']) {
        if (merged[key] == null && previous[key] != null) merged[key] = previous[key]
    }
    if (record.progress == null) {
        if (previous.updated_at === record.updated_at && isProgressObject(previous.progress)) {
            merged.progress = previous.progress
        } else {
            delete merged.progress
        }
    } else if (!isProgressObject(merged.progress)) {
        delete merged.progress
    }
    return merged
}

function taskMatches(metaRecord, taskId) {
    const task = metaRecord?.task
    return !!(task && task.task_id === taskId && task.incomplete)
}

function validateTaskPage(page) {
    if (!page || typeof page !== 'object') throw new Error('收藏列表分页格式错误')
    if (!page.task_id) throw new Error('收藏列表分页缺少任务令牌')
    if (!Number.isInteger(page.offset) || page.offset < 0) {
        throw new Error('收藏列表分页位置必须为非负整数')
    }
    if (!Array.isArray(page.items) || !page.items.length) {
        throw new Error('收藏列表分页条目格式错误')
    }
    // A repeated subject_id would be written twice in the item store, so the
    // page is refused before anything is saved.
    const seen = new Set()
    for (const entry of page.items) {
        if (!entry || typeof entry !== 'object') throw new Error('收藏列表条目格式错误')
        if (!Number.isInteger(entry.subject_id) || entry.subject_id <= 0) {
            throw new Error('收藏条目的 subject_id 类型无效')
        }
        if (seen.has(entry.subject_id)) {
            throw new Error(`收藏列表分页内 subject_id 重复: ${entry.subject_id}`)
        }
        seen.add(entry.subject_id)
    }
}

function dropTaskDone(t, taskId) {
    if (!taskId) return
    const store = t.objectStore(storeTaskDone)
    const req = store.index(taskTokenIndex).openCursor(IDBKeyRange.only(taskId))
    req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        store.delete(cursor.primaryKey)
        cursor.continue()
    }
}

function dropTaskPages(t, taskId) {
    if (!taskId) return
    const store = t.objectStore(storeTaskList)
    const req = store.index(taskTokenIndex).openCursor(IDBKeyRange.only(taskId))
    req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        store.delete(cursor.primaryKey)
        cursor.continue()
    }
}

// A task is a token plus everything stored under it: the collection pages and
// the finished-id chunks of every stage.
function dropTaskData(t, taskId) {
    if (!taskId) return
    dropTaskPages(t, taskId)
    dropTaskDone(t, taskId)
}

// The count and the chunk commit in the same transaction, so a resumed task
// never reads a count without its ids.
function appendDoneSubject(t, fail, task, subjectId) {
    const count = Number.isInteger(task.done_count) && task.done_count >= 0 ? task.done_count : 0
    const chunk = Math.floor(count / taskDoneChunkSize)
    const store = t.objectStore(storeTaskDone)
    const key = [task.task_id, task.stage, chunk]
    task.done_count = count + 1
    if (count % taskDoneChunkSize === 0) {
        store.put({ task_id: task.task_id, stage: task.stage, chunk, ids: [subjectId] })
        return
    }
    const req = store.get(key)
    req.onsuccess = () => {
        try {
            const ids = Array.isArray(req.result?.ids) ? req.result.ids.slice() : []
            if (!ids.includes(subjectId)) ids.push(subjectId)
            store.put({ task_id: task.task_id, stage: task.stage, chunk, ids })
        } catch (e) {
            fail(e)
        }
    }
}

// Keyed by token and offset, so a new task need not wait for old pages. The token
// check and the duplicate scan run in the same transaction.
export const taskList = {
    put(username, taskId, offset, entries) {
        requireOwner(username)
        if (!taskId) throw new Error('缺少任务令牌')
        const page = { task_id: taskId, offset, items: entries }
        let written = false
        return run([storeTaskList, storeMeta], 'readwrite', (t, fail) => {
            validateTaskPage(page)
            const store = t.objectStore(storeTaskList)
            let storedPages = null
            let current = false
            const write = () => {
                if (!storedPages || !current) return
                try {
                    const seen = new Set()
                    for (const stored of storedPages) {
                        if (stored.offset === offset) continue
                        for (const item of stored.items || []) seen.add(item.subject_id)
                    }
                    for (const item of page.items) {
                        if (seen.has(item.subject_id)) {
                            throw new Error(`收藏列表 subject_id 与已存分页重复: ${item.subject_id}`)
                        }
                    }
                    store.put(page)
                    written = true
                } catch (e) {
                    fail(e)
                }
            }
            const check = t.objectStore(storeMeta).get(username)
            check.onsuccess = () => {
                current = taskMatches(check.result, taskId)
                write()
            }
            const pages = store.index(taskTokenIndex).getAll(IDBKeyRange.only(taskId))
            pages.onsuccess = () => {
                storedPages = pages.result || []
                write()
            }
            return {
                get result() {
                    return written
                },
            }
        })
    },

    read(taskId) {
        if (!taskId) throw new Error('缺少任务令牌')
        return run([storeTaskList], 'readonly', t =>
            t.objectStore(storeTaskList)
                .index(taskTokenIndex).getAll(IDBKeyRange.only(taskId)))
            .then(pages => pages.slice().sort((a, b) => a.offset - b.offset))
    },
}

// The stage's chunks are read back as one set.
export const taskDone = {
    read(taskId, stage) {
        if (!taskId) throw new Error('缺少任务令牌')
        if (!stage) throw new Error('缺少任务阶段')
        return run([storeTaskDone], 'readonly', t =>
            t.objectStore(storeTaskDone)
                .index(taskStageIndex).getAll(IDBKeyRange.only([taskId, stage])))
            .then(records => {
                const ids = new Set()
                for (const record of records) {
                    for (const id of record.ids || []) {
                        if (Number.isInteger(id) && id > 0) ids.add(id)
                    }
                }
                return ids
            })
    },
}

export const items = {
    // One item, one read-write transaction: the existing record is read here,
    // not in an earlier transaction that a concurrent import could invalidate.
    merge(owner, record, options) {
        requireOwner(owner)
        const infoScope = requireScope(options)
        const taskId = options?.taskId || ''
        const stores = taskId
            ? [storeItems, storeItemDetail, storeMeta]
            : [storeItems, storeItemDetail]
        return run(stores, 'readwrite', (t, fail) => {
            const store = t.objectStore(storeItems)
            const detailStore = t.objectStore(storeItemDetail)
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
                    const previous = req.result
                    const detailReq = detailStore.get([owner, prepared.subject_id])
                    detailReq.onsuccess = () => {
                        try {
                            putSplit(store, detailStore,
                                mergeRecords(joinRecord(previous, detailReq.result), prepared))
                        } catch (e) {
                            fail(e)
                        }
                    }
                }
            }
            if (taskId) {
                const check = t.objectStore(storeMeta).get(owner)
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

    getByOwner(owner) {
        requireOwner(owner)
        return run([storeItems], 'readonly', t =>
            t.objectStore(storeItems).index('owner').getAll(IDBKeyRange.only(owner)))
    },

    // `hasDetail` keeps "never stored" apart from "stored, progress never fetched";
    // the detail page shows a different state for each.
    getWithDetail(owner, subjectId) {
        requireOwner(owner)
        if (!isValidSubjectId(subjectId)) throw new Error('subject_id 类型无效')
        return run([storeItems, storeItemDetail], 'readonly', t => {
            const listRequest = t.objectStore(storeItems).get([owner, subjectId])
            const detailRequest = t.objectStore(storeItemDetail).get([owner, subjectId])
            return {
                get result() {
                    return {
                        record: joinRecord(listRequest.result, detailRequest.result),
                        hasDetail: !!detailRequest.result,
                    }
                },
            }
        })
    },

    // A detail half that is gone leaves `progress_at` a claim nothing backs, and an
    // incremental run would reuse it, so the claim is dropped here.
    clearProgressValidity(owner, subjectId) {
        requireOwner(owner)
        if (!isValidSubjectId(subjectId)) throw new Error('subject_id 类型无效')
        return run([storeItems], 'readwrite', (t, fail) => {
            const store = t.objectStore(storeItems)
            const req = store.get([owner, subjectId])
            req.onsuccess = () => {
                try {
                    const record = req.result
                    if (!record || record.progress_at === undefined) return
                    delete record.progress_at
                    store.put(record)
                } catch (e) {
                    fail(e)
                }
            }
            return null
        })
    },

    countByOwner(owner) {
        requireOwner(owner)
        return run([storeItems], 'readonly', t =>
            t.objectStore(storeItems).index('owner').count(IDBKeyRange.only(owner)))
    },
}

// Sweeping extra records, writing the completed state and dropping the task data
// must be one transaction, or items vanish from a task that can resume.
export function finalizeBackup(username, {
    taskId, keep, user, completeness, now,
} = {}) {
    requireOwner(username)
    if (!taskId) throw new Error('缺少任务令牌')
    if (!(keep instanceof Set)) throw new Error('保留条目集合格式错误')
    assertCounts(completeness, '完成度')
    const stamp = Number.isFinite(now) ? now : Date.now()
    return run([storeItems, storeItemDetail, storeMeta, storeTaskList, storeTaskDone], 'readwrite', (t, fail) => {
        const metaStore = t.objectStore(storeMeta)
        const itemStore = t.objectStore(storeItems)
        const detailStore = t.objectStore(storeItemDetail)
        let removed = 0
        let current = true
        const check = metaStore.get(username)
        check.onsuccess = () => {
            try {
                const record = check.result
                const task = record?.task
                if (!task || task.task_id !== taskId || !task.incomplete) {
                    current = false
                    return
                }
                const complete = () => {
                    try {
                        task.incomplete = false
                        task.updated_at = stamp
                        if (user) record.user = user
                        record.generated_at = Math.floor(stamp / 1000)
                        record.updated_at = stamp
                        record.completeness = {
                            total: completeness.total,
                            done: completeness.done,
                        }
                        validateMetaRecord(record)
                        metaStore.put(record)
                        dropTaskData(t, taskId)
                    } catch (e) {
                        fail(e)
                    }
                }
                // The list records decide which item exists; a task can name an id the collection no
                // longer holds, so only ids found in the store are kept.
                const kept = new Set()
                const pending = []
                const sweepItems = () => {
                    const req = itemStore.index('owner').openCursor(IDBKeyRange.only(username))
                    req.onsuccess = () => {
                        try {
                            const cursor = req.result
                            if (cursor) {
                                const list = cursor.value
                                if (keep.has(list.subject_id)) {
                                    kept.add(list.subject_id)
                                    if (list.progress_at !== undefined) pending.push(list)
                                } else {
                                    itemStore.delete(cursor.primaryKey)
                                    removed += 1
                                }
                                cursor.continue()
                                return
                            }
                            sweepDetails()
                        } catch (e) {
                            fail(e)
                        }
                    }
                }
                // A detail record without its list record is reachable from no page. A kept list
                // whose detail is gone drops `progress_at`, so the progress is fetched again.
                const sweepDetails = () => {
                    const detailIds = new Set()
                    const req = detailStore.index('owner').openCursor(IDBKeyRange.only(username))
                    req.onsuccess = () => {
                        try {
                            const cursor = req.result
                            if (cursor) {
                                const id = cursor.value.subject_id
                                if (kept.has(id)) {
                                    detailIds.add(id)
                                } else {
                                    detailStore.delete(cursor.primaryKey)
                                }
                                cursor.continue()
                                return
                            }
                            for (const list of pending) {
                                if (!detailIds.has(list.subject_id)) {
                                    delete list.progress_at
                                    itemStore.put(list)
                                }
                            }
                            complete()
                        } catch (e) {
                            fail(e)
                        }
                    }
                }
                sweepItems()
            } catch (e) {
                fail(e)
            }
        }
        return {
            get result() {
                return current ? removed : null
            },
        }
    })
}

// The meta record and every item of one user are read in one transaction, so an
// export sees one snapshot; the halves are joined here.
export function readUserExport(username) {
    requireOwner(username)
    return run([storeItems, storeItemDetail, storeMeta], 'readonly', (t, fail) => {
        try {
            const metaRequest = t.objectStore(storeMeta).get(username)
            const itemsRequest = t.objectStore(storeItems)
                .index('owner').getAll(IDBKeyRange.only(username))
            const detailRequest = t.objectStore(storeItemDetail)
                .index('owner').getAll(IDBKeyRange.only(username))
            return {
                get result() {
                    const details = new Map()
                    for (const record of detailRequest.result || []) {
                        details.set(record.subject_id, record)
                    }
                    return {
                        meta: metaRequest.result || null,
                        items: (itemsRequest.result || []).map(record =>
                            joinRecord(record, details.get(record.subject_id))),
                    }
                },
            }
        } catch (e) {
            fail(e)
            return null
        }
    })
}

export function replaceUser(username, metaRecord, records, options) {
    requireOwner(username)
    const infoScope = requireScope(options)
    if (!metaRecord || metaRecord.username !== username) throw new Error('用户资料不匹配')
    if (!Array.isArray(records)) throw new Error('条目列表格式错误')
    validateMetaRecord(metaRecord)
    return run([storeItems, storeItemDetail, storeMeta, storeTaskList, storeTaskDone], 'readwrite', (t, fail) => {
        const itemStore = t.objectStore(storeItems)
        const detailStore = t.objectStore(storeItemDetail)
        const metaStore = t.objectStore(storeMeta)
        const previous = infoScope === infoScopes.public ? new Map() : null
        const metaRequest = metaStore.get(username)
        metaRequest.onsuccess = () => {
            try {
                const previousTaskId = metaRequest.result?.task?.task_id || ''
                const req = itemStore.index('owner').openCursor(IDBKeyRange.only(username))
                req.onsuccess = () => {
                    try {
                        const cursor = req.result
                        if (!cursor) {
                            writeRecords(itemStore, detailStore, username, records, infoScope, previous)
                            metaStore.put(metaRecord)
                            dropTaskData(t, previousTaskId)
                            return
                        }
                        const key = cursor.primaryKey
                        const value = cursor.value
                        if (previous) {
                            const detailReq = detailStore.get(key)
                            detailReq.onsuccess = () => {
                                try {
                                    previous.set(value.subject_id, joinRecord(value, detailReq.result))
                                    itemStore.delete(key)
                                    detailStore.delete(key)
                                    cursor.continue()
                                } catch (e) {
                                    fail(e)
                                }
                            }
                            return
                        }
                        itemStore.delete(key)
                        detailStore.delete(key)
                        cursor.continue()
                    } catch (e) {
                        fail(e)
                    }
                }
            } catch (e) {
                fail(e)
            }
        }
    })
}

export const meta = {
    get(username) {
        return run([storeMeta], 'readonly', t => t.objectStore(storeMeta).get(username))
    },

    put(record) {
        return run([storeMeta], 'readwrite', (t, fail) => {
            try {
                validateMetaRecord(record)
                t.objectStore(storeMeta).put(record)
            } catch (e) {
                fail(e)
            }
        })
    },

    list() {
        return run([storeMeta], 'readonly', t => t.objectStore(storeMeta).getAll())
    },
}

// `mutate` gets a context that writes or drops this task's chunks inside the
// caller's transaction.
function taskContext(t, fail, record) {
    return {
        appendDone(subjectId) {
            const task = record?.task
            if (!task) throw new Error('没有可记录的任务')
            appendDoneSubject(t, fail, task, subjectId)
        },
        // A new stage starts empty: the stage is part of every chunk key.
        resetDone() {
            const task = record?.task
            if (!task) return
            task.done_count = 0
        },
    }
}

// One meta record is read and written in one transaction; records of a task the
// record no longer names are dropped here.
export function updateMeta(username, mutate) {
    requireOwner(username)
    let value
    return run([storeMeta, storeTaskList, storeTaskDone], 'readwrite', (t, fail) => {
        const store = t.objectStore(storeMeta)
        const req = store.get(username)
        req.onsuccess = () => {
            try {
                const previousTaskId = req.result?.task?.task_id || ''
                const change = mutate(req.result, taskContext(t, fail, req.result))
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
                    const nextTaskId = change.record.task?.task_id || ''
                    if (previousTaskId && previousTaskId !== nextTaskId) {
                        dropTaskData(t, previousTaskId)
                    }
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

// A credential is an account, not cache: accounts keeping one keep a minimal meta
// record, so the users page, exports and dropdowns describe one set.
export async function clearCachedData() {
    await run([storeItems, storeItemDetail, storeMeta, storeTaskList, storeTaskDone, storeCredentials], 'readwrite', t => {
        const itemStore = t.objectStore(storeItems)
        const metaStore = t.objectStore(storeMeta)
        const credentialStore = t.objectStore(storeCredentials)
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
        t.objectStore(storeItemDetail).clear()
        t.objectStore(storeTaskList).clear()
        t.objectStore(storeTaskDone).clear()
    })
}
