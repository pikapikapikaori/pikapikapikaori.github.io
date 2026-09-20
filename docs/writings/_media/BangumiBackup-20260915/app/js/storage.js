import { DB_NAME, DB_VERSION, STORE_NAME, CACHE_KEY_PREFIX } from './config.js';

let _dbPromise = null;

function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        console.log('[idb] opening', DB_NAME, 'v' + DB_VERSION);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            console.log('[idb] onupgradeneeded');
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
                console.log('[idb] created store', STORE_NAME);
            }
        };
        req.onsuccess = () => {
            console.log('[idb] opened, stores =', [...req.result.objectStoreNames]);
            resolve(req.result);
        };
        req.onerror = () => { console.error('[idb] open error', req.error); reject(req.error); };
        req.onblocked = () => { console.warn('[idb] open blocked'); };
    });
    return _dbPromise;
}

function tx(mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const t = db.transaction(STORE_NAME, mode);
        const store = t.objectStore(STORE_NAME);
        let result;
        try { result = fn(store); } catch (e) {
            console.error('[idb] tx fn error', e);
            reject(e); return;
        }
        t.oncomplete = () => {
            console.log('[idb] tx complete', mode, '->', result && result.result);
            resolve(result && result.result);
        };
        t.onerror = () => { console.error('[idb] tx error', t.error); reject(t.error); };
        t.onabort = () => { console.error('[idb] tx abort', t.error); reject(t.error); };
    }));
}

export const cache = {
    set(userId, payload) {
        const key = CACHE_KEY_PREFIX + userId;
        console.log('[idb] set', key, 'items=', payload?.items?.length);
        return tx('readwrite', s => s.put(payload, key));
    },

    get(userId) {
        return tx('readonly', s => s.get(CACHE_KEY_PREFIX + userId));
    },

    remove(userId) {
        return tx('readwrite', s => s.delete(CACHE_KEY_PREFIX + userId));
    },

    listAll() {
        return openDB().then(db => new Promise((resolve, reject) => {
            const t = db.transaction(STORE_NAME, 'readonly');
            const store = t.objectStore(STORE_NAME);
            const keysReq = store.getAllKeys();
            const valsReq = store.getAll();
            t.oncomplete = () => {
                const keys = keysReq.result || [];
                const vals = valsReq.result || [];
                console.log('[idb] listAll', keys.length, 'records');
                resolve(keys.map((k, i) => ({ key: k, value: vals[i] })));
            };
            t.onerror = () => { console.error('[idb] listAll error', t.error); reject(t.error); };
            t.onabort = () => { console.error('[idb] listAll abort', t.error); reject(t.error); };
        }));
    },

    async latest() {
        const all = await this.listAll();
        if (!all.length) return null;
        all.sort((a, b) => (b.value?.savedAt || 0) - (a.value?.savedAt || 0));
        return all[0].value;
    },

    clearAll() {
        console.log('[idb] clearAll');
        return tx('readwrite', s => s.clear());
    },
};
