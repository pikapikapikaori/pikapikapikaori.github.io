'use strict';

// ============================================================
// 用户配置（按需修改）
// ============================================================
const CONFIG = {
    CLIENT_ID: 'bgm71356aa8a71822b75',
    API_BASE: 'https://api.bgm.tv',
    AUTH_BASE: 'https://bgm.tv/oauth',
    PROXY_URL: 'https://bangumi-takeout-web.pikapikapi-kaori.workers.dev/?url=',

    // 问题反馈地址
    ISSUE_URL: 'https://github.com/pikapikapikaori/pikapikapikaori.github.io/issues/445',

    // BGM 数据分片源（相对于当前页面）
    BGM_DATA_BASE: 'bgm-data',

    // 缓存有效期：6 个月（180 天）
    CACHE_TTL_MS: 180 * 24 * 60 * 60 * 1000,

    // 批处理参数
    BATCH_SIZE: 40,
    FLUSH_INTERVAL_MS: 30000,
    RETRY_WAIT_MS: 5000,

    DB_NAME: 'bangumi-takeout',
    DB_VERSION: 4,
    STORE: 'items',
    COLLECTIONS_STORE: 'collections',
    BGM_MANIFEST_STORE: 'bgm_manifest',
    BGM_CHUNKS_STORE: 'bgm_chunks',
};

// ============================================================
// Episode 类型映射
// 注意：/v0/episodes 的 type 参数只接受 0,1,2,3,4,6
// 5 (MAD) 是展示层映射，API 不支持，拉取时需跳过
// ============================================================
const EP_TYPE = {
    0: '本篇',
    1: 'SP',
    2: 'OP',
    3: 'ED',
    4: '预告/宣传/广告',
    6: '其他',
};
const EP_TYPE_KEYS = Object.keys(EP_TYPE).map(Number);

// ============================================================
// 请求设置下拉选项
// ============================================================
const INTERVAL_OPTIONS = [
    { value: 300, label: '300ms（不推荐）' },
    { value: 500, label: '500ms' },
    { value: 700, label: '700ms（默认）' },
    { value: 1000, label: '1000ms' },
    { value: 1500, label: '1500ms' },
    { value: 2000, label: '2000ms' },
];
const RETRY_OPTIONS = [
    { value: 2, label: '2 次' },
    { value: 3, label: '3 次' },
    { value: 5, label: '5 次（默认）' },
    { value: 8, label: '8 次' },
    { value: 10, label: '10 次' },
];

// ============================================================
// 运行时状态
// ============================================================
let accessToken = null;
let refreshToken = null;
let tokenExpiresAt = 0;
let currentUser = null;
let db = null;
let isRunning = false;
let abortFlag = false;
let abortCtrl = null;

// ============================================================
// 基础工具
// ============================================================
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg, type = 'info') {
    const el = document.getElementById('log');
    const line = document.createElement('div');
    line.className = 'log-' + type;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
}

function setStatus(msg, type = 'info') {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + type;
}

function clearStatus() {
    const el = document.getElementById('status');
    el.className = 'status';
    el.textContent = '';
}

function getRedirectUri() {
    return location.origin + location.pathname;
}

function b64url(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randStr(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let s = '';
    for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
    return s;
}

async function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

function loadSetting(key, dflt) {
    const v = localStorage.getItem('bgm_' + key);
    return v != null ? v : dflt;
}
function saveSetting(key, value) {
    localStorage.setItem('bgm_' + key, String(value));
}

function formatDuration(ms) {
    if (!isFinite(ms) || ms < 0) return '--';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    if (m < 60) return `${m}m ${rs}s`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
}

function proxied(url) {
    if (!CONFIG.PROXY_URL) return url;
    let base = CONFIG.PROXY_URL;
    if (!base.includes('?url=') && !base.includes('?target=')) {
        base = base.replace(/\?$/, '') + (base.includes('?') ? '&' : '?') + 'url=';
    }
    return base + encodeURIComponent(url);
}

// ============================================================
// 进度追踪
// ============================================================
const progressState = {
    stage: '就绪',
    total: 0,
    done: 0,
    stageStartTime: 0,
    interval: 0,
    maxRetries: 0,
};

function resetProgress() {
    progressState.stage = '就绪';
    progressState.total = 0;
    progressState.done = 0;
    progressState.stageStartTime = 0;
    renderProgress();
}

function setStage(stage, total) {
    progressState.stage = stage;
    progressState.total = total || 0;
    progressState.done = 0;
    progressState.stageStartTime = Date.now();
    renderProgress();
}

function setProgressInterval(interval, maxRetries) {
    progressState.interval = interval;
    progressState.maxRetries = maxRetries;
    renderProgress();
}

function incProgress(n = 1) {
    progressState.done += n;
    renderProgress();
}

function estimateRemainingMs() {
    if (progressState.done === 0 || progressState.total <= 0) return null;
    const elapsed = Date.now() - progressState.stageStartTime;
    const avgPerItem = elapsed / progressState.done;
    return avgPerItem * (progressState.total - progressState.done);
}

function renderProgress() {
    const pct = progressState.total > 0
        ? Math.min(100, Math.round(progressState.done / progressState.total * 100))
        : 0;
    document.getElementById('fill').style.width = pct + '%';
    document.getElementById('progressStage').textContent = progressState.stage;
    document.getElementById('progressPercent').textContent = pct + '%';
    document.getElementById('progressCount').textContent =
        progressState.total > 0
            ? `${progressState.done} / ${progressState.total} 条`
            : (progressState.done > 0 ? `${progressState.done} 条` : '0 / 0');
    document.getElementById('progressInterval').textContent =
        progressState.interval
            ? `间隔 ${progressState.interval}ms · 重试 ${progressState.maxRetries}`
            : '间隔 --';

    const eta = estimateRemainingMs();
    document.getElementById('progressETA').textContent =
        eta != null ? `剩余 ${formatDuration(eta)}` : '剩余 --';
}

// ============================================================
// 中止控制
// ============================================================
function makeAbortError() {
    const e = new Error('__ABORTED__');
    e.name = 'AbortedError';
    return e;
}
function isAbortError(e) {
    return e && (e.name === 'AbortedError' || e.name === 'AbortError' || e.message === '__ABORTED__');
}
function throwIfAborted() {
    if (abortFlag) throw makeAbortError();
}
function abortedSleep(ms) {
    return new Promise((resolve, reject) => {
        if (abortFlag) return reject(makeAbortError());
        const t = setTimeout(resolve, ms);
        if (abortCtrl && abortCtrl.signal) {
            abortCtrl.signal.addEventListener('abort', () => {
                clearTimeout(t);
                reject(makeAbortError());
            }, { once: true });
        }
    });
}

// ============================================================
// UI 锁定 / 解锁
// ============================================================
function lockInputs() {
    document.querySelectorAll('.lockable').forEach(el => {
        if (el.tagName === 'LABEL') el.classList.add('locked');
        else el.disabled = true;
    });
    document.getElementById('btnStop').disabled = false;
}
function unlockInputs() {
    document.querySelectorAll('.lockable').forEach(el => {
        if (el.tagName === 'LABEL') el.classList.remove('locked');
        else el.disabled = false;
    });
    document.getElementById('btnStop').disabled = true;
    updateAuthUI();
}

// ============================================================
// IndexedDB
// ============================================================
function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
        req.onupgradeneeded = e => {
            const d = e.target.result;

            // v1 → v2：items 结构变化，重建（会丢 v1 数据，一次性）
            if (e.oldVersion < 2 && d.objectStoreNames.contains(CONFIG.STORE)) {
                d.deleteObjectStore(CONFIG.STORE);
            }

            if (!d.objectStoreNames.contains(CONFIG.STORE)) {
                const store = d.createObjectStore(CONFIG.STORE, {
                    keyPath: ['owner', 'subject_id'],
                });
                store.createIndex('owner', 'owner');
                store.createIndex('expiresAt', 'expiresAt');
            }

            // v2 → v3：新增 collections store
            if (!d.objectStoreNames.contains(CONFIG.COLLECTIONS_STORE)) {
                const cs = d.createObjectStore(CONFIG.COLLECTIONS_STORE, {
                    keyPath: 'username',
                });
                cs.createIndex('expiresAt', 'expiresAt');
            }

            // v3 → v4：新增 BGM 数据 store
            if (!d.objectStoreNames.contains(CONFIG.BGM_MANIFEST_STORE)) {
                d.createObjectStore(CONFIG.BGM_MANIFEST_STORE, { keyPath: 'kind' });
            }
            if (!d.objectStoreNames.contains(CONFIG.BGM_CHUNKS_STORE)) {
                d.createObjectStore(CONFIG.BGM_CHUNKS_STORE, { keyPath: 'key' });
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

function dbGetByOwner(owner) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE, 'readonly');
        const idx = tx.objectStore(CONFIG.STORE).index('owner');
        const req = idx.getAll(IDBKeyRange.only(owner));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbBulkPut(items) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE, 'readwrite');
        const store = tx.objectStore(CONFIG.STORE);
        for (const it of items) store.put(it);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function dbClearExpired() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE, 'readwrite');
        const idx = tx.objectStore(CONFIG.STORE).index('expiresAt');
        const range = IDBKeyRange.upperBound(Date.now());
        let count = 0;
        idx.openCursor(range).onsuccess = e => {
            const c = e.target.result;
            if (c) { c.delete(); count++; c.continue(); }
        };
        tx.oncomplete = () => resolve(count);
        tx.onerror = () => reject(tx.error);
    });
}

function dbClearCollectionsOnly() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.COLLECTIONS_STORE, 'readwrite');
        tx.objectStore(CONFIG.COLLECTIONS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function dbClearByOwner(owner) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([CONFIG.STORE, CONFIG.COLLECTIONS_STORE], 'readwrite');
        const idx = tx.objectStore(CONFIG.STORE).index('owner');
        const req = idx.openCursor(IDBKeyRange.only(owner));
        req.onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        tx.objectStore(CONFIG.COLLECTIONS_STORE).delete(owner);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function dbClearExpiredByOwner(owner) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE, 'readwrite');
        const idx = tx.objectStore(CONFIG.STORE).index('owner');
        let count = 0;
        idx.openCursor(IDBKeyRange.only(owner)).onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
                if (cursor.value.expiresAt && cursor.value.expiresAt <= Date.now()) {
                    cursor.delete();
                    count++;
                }
                cursor.continue();
            }
        };
        tx.oncomplete = () => resolve(count);
        tx.onerror = () => reject(tx.error);
    });
}

// ---------- collections 缓存 ----------
function dbGetCollections(username) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.COLLECTIONS_STORE, 'readonly');
        const req = tx.objectStore(CONFIG.COLLECTIONS_STORE).get(username);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

function dbSaveCollections(username, items, total, complete) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.COLLECTIONS_STORE, 'readwrite');
        const store = tx.objectStore(CONFIG.COLLECTIONS_STORE);

        const getReq = store.get(username);
        getReq.onsuccess = () => {
            const existing = getReq.result;
            const record = {
                username,
                items,
                total: total || items.length,
                incomplete: !complete,
                fetched_at: (complete || !existing) ? Date.now() : (existing.fetched_at || Date.now()),
                expiresAt: Date.now() + CONFIG.CACHE_TTL_MS,
            };
            store.put(record);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ---------- BGM 数据缓存 ----------
function dbGetBgmManifest(kind) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.BGM_MANIFEST_STORE, 'readonly');
        const req = tx.objectStore(CONFIG.BGM_MANIFEST_STORE).get(kind);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

function dbSaveBgmManifest(kind, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.BGM_MANIFEST_STORE, 'readwrite');
        tx.objectStore(CONFIG.BGM_MANIFEST_STORE).put(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function dbGetBgmChunk(key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.BGM_CHUNKS_STORE, 'readonly');
        const req = tx.objectStore(CONFIG.BGM_CHUNKS_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

function dbSaveBgmChunk(key, kind, file, text) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.BGM_CHUNKS_STORE, 'readwrite');
        tx.objectStore(CONFIG.BGM_CHUNKS_STORE).put({
            key, kind, file, text, fetched_at: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function dbClearBgmData() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([CONFIG.BGM_MANIFEST_STORE, CONFIG.BGM_CHUNKS_STORE], 'readwrite');
        tx.objectStore(CONFIG.BGM_MANIFEST_STORE).clear();
        tx.objectStore(CONFIG.BGM_CHUNKS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ============================================================
// BGM 数据模块
// ============================================================
async function updateBgmStatus() {
    try {
        const sm = await dbGetBgmManifest('subject');
        const em = await dbGetBgmManifest('episode');
        const parts = [];
        parts.push(sm ? `subject ${sm.chunks.length} 片` : 'subject 未加载');
        parts.push(em ? `episode ${em.chunks.length} 片` : 'episode 未加载');
        document.getElementById('bgmStatus').textContent = parts.join(' · ');
    } catch (e) {
        document.getElementById('bgmStatus').textContent = '读取状态失败';
    }
}

function bgmDir(kind) {
    return kind === 'subject' ? 'subjects' : 'episodes';
}

async function getBgmManifest(kind) {
    const cached = await dbGetBgmManifest(kind);
    if (cached && Array.isArray(cached.chunks) && cached.chunks.length > 0) {
        return cached;
    }
    const url = `${CONFIG.BGM_DATA_BASE}/${bgmDir(kind)}/manifest.json`;
    log(`下载 BGM ${kind} manifest`);
    const resp = await fetch(url);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`manifest HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || !Array.isArray(data.chunks)) {
        throw new Error('manifest 格式不正确');
    }
    data.kind = kind;
    data.fetched_at = Date.now();
    await dbSaveBgmManifest(kind, data);
    return data;
}

function binarySearchChunk(chunks, id, minKey, maxKey) {
    let lo = 0, hi = chunks.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const c = chunks[mid];
        if (id < c[minKey]) hi = mid - 1;
        else if (id > c[maxKey]) lo = mid + 1;
        else return mid;
    }
    return -1;
}

function locateChunks(manifest, ids, minKey, maxKey) {
    const result = new Set();
    for (const id of ids) {
        const idx = binarySearchChunk(manifest.chunks, id, minKey, maxKey);
        if (idx >= 0) result.add(manifest.chunks[idx]);
    }
    return Array.from(result);
}

async function loadChunks(kind, chunks, idSet, idKey) {
    const result = new Map();
    setStage(`下载 BGM ${kind} 分片`, chunks.length);
    let downloaded = 0, cached = 0;

    for (const chunk of chunks) {
        throwIfAborted();
        const key = `${kind}:${chunk.file}`;
        let text = null;

        const record = await dbGetBgmChunk(key);
        if (record && record.text) {
            text = record.text;
            cached++;
        } else {
            const url = `${CONFIG.BGM_DATA_BASE}/${bgmDir(kind)}/${chunk.file}`;
            const resp = await fetch(url);
            if (!resp.ok) {
                log(`下载 ${kind} 分片 ${chunk.file} 失败: HTTP ${resp.status}`, 'warn');
                incProgress(1);
                continue;
            }
            text = await resp.text();
            await dbSaveBgmChunk(key, kind, chunk.file, text);
            downloaded++;
        }

        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let obj;
            try { obj = JSON.parse(trimmed); } catch (e) { continue; }
            const sid = obj[idKey];
            if (sid == null || !idSet.has(sid)) continue;
            if (kind === 'episode') {
                if (!result.has(sid)) result.set(sid, []);
                result.get(sid).push(obj);
            } else {
                result.set(sid, obj);
            }
        }
        incProgress(1);
    }

    log(`BGM ${kind}：${cached} 片来自缓存，${downloaded} 片新下载，命中 ${result.size} 条`, 'info');
    return result;
}

function groupEpisodesByType(episodes) {
    const grouped = {};
    for (const ep of episodes) {
        const type = ep.type;
        if (type == null) continue;
        const key = String(type);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ep);
    }
    return grouped;
}

async function tryFillFromBgmData(items) {
    const needSubject = new Set();
    const needEp = new Set();
    for (const it of items) {
        if (it.subject_data == null) needSubject.add(it.subject_id);
        if (it.ep_data == null) needEp.add(it.subject_id);
    }
    if (needSubject.size === 0 && needEp.size === 0) return 0;

    log(`尝试从本地 BGM 数据读取：subject ${needSubject.size} 条，episode ${needEp.size} 条`);
    let subjectHit = 0;
    let epHit = 0;

    // subject
    if (needSubject.size > 0) {
        try {
            const manifest = await getBgmManifest('subject');
            if (manifest) {
                const chunks = locateChunks(manifest, needSubject, 'min_id', 'max_id');
                log(`subject 需要 ${chunks.length} 个分片`);
                const map = await loadChunks('subject', chunks, needSubject, 'id');
                for (const it of items) {
                    if (it.subject_data == null && map.has(it.subject_id)) {
                        it.subject_data = map.get(it.subject_id);
                        subjectHit++;
                    }
                }
            } else {
                log('无 subject manifest，跳过本地 BGM 数据', 'warn');
            }
        } catch (e) {
            log('读取 subject BGM 数据失败: ' + e.message, 'warn');
        }
    }

    // episode
    if (needEp.size > 0) {
        try {
            const manifest = await getBgmManifest('episode');
            if (manifest) {
                const chunks = locateChunks(manifest, needEp, 'min_subject_id', 'max_subject_id');
                log(`episode 需要 ${chunks.length} 个分片`);
                const map = await loadChunks('episode', chunks, needEp, 'subject_id');
                for (const it of items) {
                    if (it.ep_data == null && map.has(it.subject_id)) {
                        it.ep_data = groupEpisodesByType(map.get(it.subject_id));
                        epHit++;
                    }
                }
            } else {
                log('无 episode manifest，跳过本地 BGM 数据', 'warn');
            }
        } catch (e) {
            log('读取 episode BGM 数据失败: ' + e.message, 'warn');
        }
    }

    if (subjectHit > 0 || epHit > 0) {
        log(`本地 BGM 数据：subject 命中 ${subjectHit} 条，episode 命中 ${epHit} 条`, 'success');
    } else {
        log('本地 BGM 数据未命中任何条目', 'info');
    }
    // 返回值语义改为"至少命中一条的条目数"意义不大，改为返回总数仅供调用者参考
    return subjectHit + epHit;
}

async function refreshBgmData() {
    if (isRunning) return;
    if (!confirm('确定刷新 BGM 数据索引？\n\n这会清空本地已下载的分片和索引，下次备份时会重新从服务端按需下载。')) return;

    if (!db) db = await openDb();
    await dbClearBgmData();
    log('BGM 数据缓存已清空', 'warn');

    try {
        setStatus('正在刷新 BGM 数据索引...', 'info');
        const sm = await getBgmManifest('subject');
        const em = await getBgmManifest('episode');
        const sCount = sm ? sm.chunks.length : 0;
        const eCount = em ? em.chunks.length : 0;
        const msg = `BGM 数据索引已更新：subject ${sCount} 片，episode ${eCount} 片`;
        log(msg, 'success');
        setStatus(msg, 'success');
        await updateBgmStatus();
    } catch (e) {
        log('刷新 BGM 数据索引失败: ' + e.message, 'error');
        setStatus('刷新失败: ' + e.message, 'error');
    }
}

// ============================================================
// BatchWriter
// ============================================================
class BatchWriter {
    constructor({ batchSize = CONFIG.BATCH_SIZE, interval = CONFIG.FLUSH_INTERVAL_MS, onFlush } = {}) {
        this.batchSize = batchSize;
        this.interval = interval;
        this.onFlush = onFlush;
        this.buffer = [];
        this.lastFlush = Date.now();
        this.written = 0;
    }
    async add(item) {
        item.expiresAt = Date.now() + CONFIG.CACHE_TTL_MS;
        this.buffer.push(item);
        const reachedCount = this.buffer.length >= this.batchSize;
        const reachedTime = Date.now() - this.lastFlush >= this.interval;
        if (reachedCount || reachedTime) await this.flush();
    }
    async flush() {
        if (!this.buffer.length) return;
        const batch = this.buffer;
        this.buffer = [];
        try {
            await dbBulkPut(batch);
            this.written += batch.length;
            this.lastFlush = Date.now();
            if (this.onFlush) this.onFlush(this.written);
        } catch (e) {
            this.buffer.unshift(...batch);
            throw e;
        }
    }
}

// ============================================================
// BangumiApiService
// ============================================================
class BangumiApiService {
    constructor(token, { interval, maxRetries }) {
        this.token = token;
        this.interval = interval;
        this.maxRetries = maxRetries;
    }

    async _getJson(path, params) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            throwIfAborted();
            try {
                await abortedSleep(this.interval);
                let url = CONFIG.API_BASE + path;
                if (params) {
                    const qs = new URLSearchParams(params).toString();
                    url += (url.includes('?') ? '&' : '?') + qs;
                }
                const resp = await fetch(proxied(url), {
                    signal: abortCtrl ? abortCtrl.signal : undefined,
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'Accept': 'application/json',
                    },
                });
                if (!resp.ok) {
                    const text = await resp.text().catch(() => '');
                    throw new Error(`HTTP ${resp.status} ${path} ${text.slice(0, 120)}`);
                }
                return await resp.json();
            } catch (e) {
                if (isAbortError(e)) throw makeAbortError();
                lastError = e;
                if (attempt < this.maxRetries) {
                    log(`请求失败: ${e.message} — ${CONFIG.RETRY_WAIT_MS / 1000}s 后重试 (${attempt}/${this.maxRetries})`, 'warn');
                    await abortedSleep(CONFIG.RETRY_WAIT_MS);
                }
            }
        }
        throw lastError || new Error('请求失败');
    }

    getMe() { return this._getJson('/v0/me'); }
    getUserInfo(username) {
        return this._getJson(`/v0/users/${encodeURIComponent(username)}`);
    }
    getUserCollectionsPage(username, offset = 0, limit = 30) {
        return this._getJson(`/v0/users/${encodeURIComponent(username)}/collections`, { limit, offset });
    }
    getSubject(id) { return this._getJson(`/v0/subjects/${id}`); }
    getEpisodesPage(subjectId, typeKey, offset = 0, limit = 100) {
        return this._getJson('/v0/episodes', { subject_id: subjectId, type: typeKey, limit, offset });
    }
    getUserProgress(username, subjectId) {
        return this._getJson(`/user/${encodeURIComponent(username)}/progress`, { subject_id: subjectId });
    }
}

// ============================================================
// 核心逻辑
// ============================================================
async function resolveUserMeta(service, username) {
    if (currentUser && currentUser.username === username) return currentUser;

    const stored = localStorage.getItem(`meta_user_${username}`);
    if (stored) { try { return JSON.parse(stored); } catch (e) { } }

    if (service) {
        try {
            const info = await service.getUserInfo(username);
            if (info && info.username) {
                try { localStorage.setItem(`meta_user_${username}`, JSON.stringify(info)); } catch (e) { }
                return info;
            }
        } catch (e) {
            log(`获取 ${username} 的用户信息失败: ${e.message}`, 'warn');
        }
    }

    return { username };
}

async function fetchUserCollections(service, username, limit = 30) {
    const now = Date.now();
    const cached = await dbGetCollections(username);

    if (cached && cached.expiresAt > now && !cached.incomplete && Array.isArray(cached.items)) {
        const when = new Date(cached.fetched_at).toLocaleString();
        log(`从缓存读取收藏列表（${cached.items.length} 条，拉取于 ${when}）`, 'success');
        setStage('读取收藏列表缓存', cached.items.length);
        progressState.total = cached.items.length;
        progressState.done = cached.items.length;
        renderProgress();
        return cached.items;
    }

    let items = [];
    let total = 0;
    const canResume = cached && cached.expiresAt > now && cached.incomplete
        && Array.isArray(cached.items) && cached.items.length > 0;

    if (canResume) {
        items = cached.items;
        total = cached.total || 0;
        log(`发现中断的拉取（${items.length}/${total || '?'}），从 offset=${items.length} 继续`, 'warn');
        setStage('继续拉取收藏列表', total || 0);
        progressState.total = total;
        progressState.done = items.length;
        renderProgress();
    } else {
        log(`拉取收藏列表: ${username}`);
        setStage('拉取收藏列表', 0);
    }

    if (items.length === 0) {
        const page = await service.getUserCollectionsPage(username, 0, limit);
        if (!page || page.total == null || !page.data) {
            throw new Error('收藏列表响应异常: ' + JSON.stringify(page).slice(0, 200));
        }
        total = page.total;
        items = page.data;
        progressState.total = total;
        progressState.done = items.length;
        renderProgress();
        await dbSaveCollections(username, items, total, items.length >= total);
    }

    let pageCount = 0;
    try {
        while (items.length < total) {
            throwIfAborted();
            const offset = items.length;
            const page = await service.getUserCollectionsPage(username, offset, limit);
            if (!page || !page.data) break;
            items = items.concat(page.data);
            progressState.done = items.length;
            renderProgress();
            pageCount++;
            if (pageCount % 10 === 0) {
                await dbSaveCollections(username, items, total, items.length >= total);
            }
        }
    } catch (e) {
        await dbSaveCollections(username, items, total, false);
        log(`收藏列表拉取中断，已保存进度 ${items.length}/${total}`, 'warn');
        throw e;
    }

    await dbSaveCollections(username, items, total, true);
    log(`收藏列表完成: ${items.length} 条（已写入缓存）`, 'success');
    return items;
}

async function fetchEpisodeType(service, subjectId, typeKey, limit = 100) {
    let page = await service.getEpisodesPage(subjectId, typeKey, 0, limit);
    if (!page || page.total == null || !page.data) return null;
    let items = page.data;
    while (items.length < page.total) {
        throwIfAborted();
        const offset = items.length;
        page = await service.getEpisodesPage(subjectId, typeKey, offset, limit);
        if (!page || !page.data) break;
        items = items.concat(page.data);
    }
    return items;
}

async function fetchEpisodeData(service, subjectId) {
    const result = {};
    for (const key of EP_TYPE_KEYS) {
        try {
            const eps = await fetchEpisodeType(service, subjectId, key);
            if (eps !== null) result[key] = eps;
        } catch (e) {
            if (/not valid episode type/i.test(e.message)) {
                log(`跳过不支持的 episode type=${key}`, 'warn');
                continue;
            }
            throw e;
        }
    }
    return result;
}

function mergeFreshWithCache(freshItems, cachedItems) {
    const cached = new Map();
    for (const it of cachedItems) {
        if (it && it.subject_id != null) cached.set(it.subject_id, it);
    }
    return freshItems.map(entry => {
        const item = { ...entry };
        const prior = cached.get(item.subject_id);
        if (prior && prior.updated_at === item.updated_at) {
            for (const key of ['subject_data', 'ep_data', 'progress']) {
                if (prior[key] != null) item[key] = prior[key];
            }
        }
        return item;
    });
}

async function fillSubjectAndEpData(service, items, save) {
    const missing = items.filter(it => it.subject_data == null || it.ep_data == null);
    setStage('拉取 subject / episode 数据', missing.length);

    if (!missing.length) {
        log('所有条目已缓存 subject / episode 数据，跳过 API 拉取', 'success');
        return;
    }
    log(`需从 API 拉取 subject / episode: ${missing.length} 条`);

    for (const item of missing) {
        throwIfAborted();
        let changed = false;
        if (item.subject_data == null) {
            item.subject_data = await service.getSubject(item.subject_id);
            changed = true;
        }
        if (item.ep_data == null) {
            item.ep_data = await fetchEpisodeData(service, item.subject_id);
            changed = true;
        }
        if (changed && save) await save(item);
        incProgress(1);
    }
    log('subject / episode 数据拉取完成', 'success');
}

function copyProgressFromCache(items, cachedItems) {
    const known = new Map();
    for (const it of cachedItems) {
        if (it && it.progress != null) {
            known.set(it.subject_id, [it.updated_at, it.progress]);
        }
    }
    const pending = [];
    for (const item of items) {
        if (item.progress != null) continue;
        const old = known.get(item.subject_id);
        if (old && old[0] === item.updated_at) item.progress = old[1];
        else pending.push(item);
    }
    return pending;
}

async function loadProgressData(service, username, items, cachedItems, save) {
    const pending = copyProgressFromCache(items, cachedItems);
    setStage('拉取观看进度', pending.length);
    log(`进度复用 ${items.length - pending.length} 条，待拉取 ${pending.length} 条`);

    for (const item of pending) {
        throwIfAborted();
        let prog = await service.getUserProgress(username, item.subject_id);
        // API 对无进度 / 非动画 / 跨用户作品返回 null
        // 统一转成 {eps:[]} 便于下次复用，否则每次都被判为"未拉取"
        if (prog == null || !Array.isArray(prog.eps)) prog = { eps: [] };
        item.progress = prog;
        if (save) await save(item);
        incProgress(1);
    }
    log('进度数据拉取完成', 'success');
}

// ============================================================
// 导出
// ============================================================
function buildTakeoutBlob(user, items) {
    const meta = { generated_at: Date.now() / 1000, user };
    const chunks = ['{"meta":', JSON.stringify(meta), ',"data":['];
    for (let i = 0; i < items.length; i++) {
        if (i > 0) chunks.push(',');
        const { owner, expiresAt, ...rest } = items[i];
        chunks.push(JSON.stringify(rest));
    }
    chunks.push(']}');
    return new Blob(chunks, { type: 'application/json' });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function makeFilename(username) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `takeout_${username}_${ts}.json`;
}

// ============================================================
// OAuth PKCE
// ============================================================
async function startAuth() {
    const verifier = randStr(64);
    const challenge = b64url(await sha256(verifier));
    const state = randStr(16);
    sessionStorage.setItem('oauth_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
        client_id: CONFIG.CLIENT_ID,
        response_type: 'code',
        redirect_uri: getRedirectUri(),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
    });
    location.href = `${CONFIG.AUTH_BASE}/authorize?${params}`;
}

async function handleCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const err = params.get('error');

    if (err) {
        log('OAuth 错误: ' + err + ' ' + (params.get('error_description') || ''), 'error');
        history.replaceState({}, '', location.pathname);
        return;
    }
    if (!code) return;

    const savedState = sessionStorage.getItem('oauth_state');
    const verifier = sessionStorage.getItem('oauth_verifier');

    if (state !== savedState) {
        log('State 校验失败（CSRF 风险）', 'error');
        setStatus('State 校验失败，请重新登录', 'error');
        history.replaceState({}, '', location.pathname);
        return;
    }
    if (!verifier) {
        log('OAuth 会话已过期，请重新登录', 'error');
        history.replaceState({}, '', location.pathname);
        return;
    }

    setStatus('换取 token 中...', 'info');
    try {
        const resp = await fetch(proxied(`${CONFIG.AUTH_BASE}/access_token`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: CONFIG.CLIENT_ID,
                code,
                redirect_uri: getRedirectUri(),
                code_verifier: verifier,
            }),
        });
        if (!resp.ok) {
            const t = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${t.slice(0, 200)}`);
        }
        saveTokens(await resp.json());
        sessionStorage.removeItem('oauth_verifier');
        sessionStorage.removeItem('oauth_state');
        log('OAuth 登录成功', 'success');
        setStatus('登录成功', 'success');
        await refreshCurrentUser();
    } catch (e) {
        log('换取 token 失败: ' + e.message, 'error');
        setStatus('换取 token 失败: ' + e.message, 'error');
    }
    history.replaceState({}, '', location.pathname);
}

function saveTokens(data) {
    accessToken = data.access_token;
    refreshToken = data.refresh_token || null;
    tokenExpiresAt = Date.now() + (data.expires_in || 604800) * 1000;
    sessionStorage.setItem('access_token', accessToken);
    sessionStorage.setItem('token_expires', String(tokenExpiresAt));
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
}

function loadTokens() {
    accessToken = sessionStorage.getItem('access_token') || null;
    tokenExpiresAt = parseInt(sessionStorage.getItem('token_expires') || '0', 10);
    refreshToken = localStorage.getItem('refresh_token') || null;
}

async function ensureFreshToken() {
    if (!accessToken) return false;
    if (tokenExpiresAt && Date.now() > tokenExpiresAt - 60000) {
        if (refreshToken) {
            try {
                const resp = await fetch(proxied(`${CONFIG.AUTH_BASE}/access_token`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        client_id: CONFIG.CLIENT_ID,
                        refresh_token: refreshToken,
                    }),
                });
                if (resp.ok) {
                    saveTokens(await resp.json());
                    log('Token 已自动刷新', 'success');
                    return true;
                }
            } catch (e) {
                log('Token 刷新失败: ' + e.message, 'warn');
            }
        }
        return false;
    }
    return true;
}

async function refreshCurrentUser() {
    try {
        if (!abortCtrl) abortCtrl = new AbortController();
        const svc = new BangumiApiService(accessToken, { interval: 0, maxRetries: 1 });
        currentUser = await svc.getMe();
        log(`OAuth 账户: ${currentUser.username} (uid=${currentUser.id})`, 'success');
        const input = document.getElementById('username');
        if (!input.value.trim()) input.value = currentUser.username;
    } catch (e) {
        log('获取用户信息失败: ' + e.message, 'warn');
        currentUser = null;
    }
    updateAuthUI();
}

function logout() {
    accessToken = null;
    refreshToken = null;
    tokenExpiresAt = 0;
    currentUser = null;
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('token_expires');
    localStorage.removeItem('refresh_token');
    log('已退出登录');
    updateAuthUI();
}

function updateAuthUI() {
    const status = document.getElementById('tokenStatus');
    const btnLogout = document.getElementById('btnLogout');
    const btnFetch = document.getElementById('btnFetch');

    if (accessToken) {
        const name = currentUser ? currentUser.username : '(加载中)';
        const exp = tokenExpiresAt ? new Date(tokenExpiresAt).toLocaleString() : '未知';
        status.textContent = `已登录: ${name} · Token 过期: ${exp}`;
        status.className = 'token-status valid';
        btnLogout.style.display = '';
    } else {
        status.textContent = '未登录';
        status.className = 'token-status';
        btnLogout.style.display = 'none';
    }

    if (!isRunning) btnFetch.disabled = !accessToken;
}

function pasteToken() {
    const t = prompt('粘贴你的 Bangumi Access Token（从 Python 版 .bgm_token 里复制）：');
    if (!t) return;
    accessToken = t.trim();
    tokenExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    sessionStorage.setItem('access_token', accessToken);
    sessionStorage.setItem('token_expires', String(tokenExpiresAt));
    log('Token 已保存', 'success');
    refreshCurrentUser();
}

// ============================================================
// 上传 takeout.json
// ============================================================
async function handleFileUpload(file) {
    const info = document.getElementById('fileInfo');
    try {
        const text = await file.text();
        let data;
        try { data = JSON.parse(text); } catch (e) {
            throw new Error('不是合法的 JSON：' + e.message);
        }

        // 格式校验
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('顶层必须是对象');
        }
        if (!data.meta || typeof data.meta !== 'object') {
            throw new Error('缺少 meta 字段');
        }
        if (!data.meta.user || typeof data.meta.user !== 'object') {
            throw new Error('缺少 meta.user');
        }
        if (!data.meta.user.username) {
            throw new Error('缺少 meta.user.username');
        }
        if (!Array.isArray(data.data)) {
            throw new Error('缺少 data 数组');
        }
        if (data.data.length === 0) {
            throw new Error('data 数组为空');
        }

        const rawItems = data.data.filter(it => it && typeof it === 'object' && it.subject_id != null);
        if (rawItems.length === 0) {
            throw new Error('data 数组中没有有效条目（均缺少 subject_id）');
        }
        const skipped = data.data.length - rawItems.length;
        if (skipped > 0) {
            log(`警告：${skipped} 条缺少 subject_id，已忽略`, 'warn');
        }

        // 以文件里的 user 为准
        const fileUser = data.meta.user.username;
        document.getElementById('username').value = fileUser;
        saveSetting('username', fileUser);
        log(`从文件中读取到用户: ${fileUser}`, 'info');
        const owner = fileUser;

        if (!db) db = await openDb();

        await dbClearByOwner(owner);
        log(`已清除 ${owner} 的旧缓存`, 'warn');

        const now = Date.now();
        const ttl = CONFIG.CACHE_TTL_MS;
        const toWrite = rawItems.map(raw => {
            const { owner: _, expiresAt: __, ...rest } = raw;
            return { ...rest, owner, expiresAt: now + ttl };
        });

        for (let i = 0; i < toWrite.length; i += 100) {
            await dbBulkPut(toWrite.slice(i, i + 100));
        }

        try { localStorage.setItem(`meta_user_${owner}`, JSON.stringify(data.meta.user)); } catch (e) { }

        const ttlDays = Math.round(ttl / 86400000);
        log(`导入 ${toWrite.length} 条（${owner}，有效期 ${ttlDays} 天）`, 'success');
        info.textContent = `${file.name} · ${rawItems.length} 条 · ${(file.size / 1024 / 1024).toFixed(1)} MB · 已重置缓存并导入 ${toWrite.length} 条`;
        setStatus(`已重置 ${owner} 的缓存，导入 ${toWrite.length} 条数据`, 'success');
    } catch (e) {
        log('导入失败: ' + e.message, 'error');
        setStatus('导入失败: ' + e.message, 'error');
        info.textContent = '选择 takeout.json 以复用旧数据';
    }
}

// ============================================================
// 主流程
// ============================================================
async function runBackup() {
    if (isRunning) return;

    const interval = parseInt(document.getElementById('intervalSelect').value, 10);
    const maxRetries = parseInt(document.getElementById('retrySelect').value, 10);

    if (!(await ensureFreshToken())) {
        setStatus('Token 已过期或未登录，请重新登录', 'error');
        return;
    }
    if (!currentUser) await refreshCurrentUser();

    let username = document.getElementById('username').value.trim();
    if (!username && currentUser) username = currentUser.username;
    if (!username) {
        setStatus('请填写 Bangumi 用户名，或先 OAuth 登录', 'error');
        return;
    }

    isRunning = true;
    abortFlag = false;
    abortCtrl = new AbortController();
    lockInputs();
    clearStatus();
    setStatus('备份进行中...', 'info');
    resetProgress();
    setProgressInterval(interval, maxRetries);
    setStage('准备中', 0);
    log(`开始备份 ${username} · 间隔 ${interval}ms · 重试 ${maxRetries} 次`);

    try {
        if (!db) db = await openDb();

        const expired = await dbClearExpiredByOwner(username);
        if (expired > 0) log(`清理过期条目缓存 ${expired} 条`, 'warn');

        const cachedItems = await dbGetByOwner(username);
        log(`本地缓存（${username}）: ${cachedItems.length} 条`);

        const service = new BangumiApiService(accessToken, { interval, maxRetries });

        // 1. 收藏列表
        const collections = await fetchUserCollections(service, username);
        throwIfAborted();

        // 2. 合并
        setStage('合并缓存数据', collections.length);
        const items = mergeFreshWithCache(collections, cachedItems);
        progressState.done = collections.length;
        renderProgress();
        log(`合并完成: 共 ${items.length} 条`);

        // 2.5 从本地 BGM 数据填充
        await tryFillFromBgmData(items);
        throwIfAborted();

        // 3. BatchWriter
        const writer = new BatchWriter({
            onFlush: n => log(`已写入缓存 ${n} 条`),
        });
        const save = async item => {
            item.owner = username;
            await writer.add(item);
        };

        // 4. subject / ep（剩下的走 API）
        await fillSubjectAndEpData(service, items, save);

        // 5. progress
        const isSelf = currentUser && currentUser.username === username;
        if (isSelf) {
            await loadProgressData(service, username, items, cachedItems, save);
        } else {
            log(`目标用户 ${username} 不是当前登录账户 ${currentUser ? currentUser.username : '(未登录)'}，跳过进度拉取`, 'warn');
            // 把剩余无 progress 的条目标记为空进度，避免下次重复尝试
            for (const item of items) {
                if (item.progress == null) {
                    item.progress = { eps: [] };
                    if (save) await save(item);
                }
            }
        }

        // 6. flush 尾批
        setStage('写入缓存', 1);
        await writer.flush();
        progressState.done = 1;
        renderProgress();
        throwIfAborted();
        log(`缓存写入完成，共 ${writer.written} 条`, 'success');

        // 7. 解析并缓存 meta.user
        setStage('导出文件', 1);
        const userMeta = await resolveUserMeta(service, username);
        try { localStorage.setItem(`meta_user_${username}`, JSON.stringify(userMeta)); } catch (e) { }

        // 8. 导出
        const blob = buildTakeoutBlob(userMeta, items);
        downloadBlob(blob, makeFilename(username));
        progressState.done = 1;
        renderProgress();
        log(`已导出（${(blob.size / 1024 / 1024).toFixed(1)} MB）`, 'success');

        setStage('完成', 1);
        progressState.done = 1;
        renderProgress();
        setStatus(`备份完成：${items.length} 条数据`, 'success');
    } catch (e) {
        if (isAbortError(e)) {
            log('备份已停止（已写入的缓存保留）', 'warn');
            setStatus('备份已停止。已写入的缓存保留，可稍后再次备份继续。', 'warn');
            setStage('已停止', progressState.total || 1);
        } else {
            log('备份失败: ' + e.message, 'error');
            setStatus('备份失败: ' + e.message, 'error');
            setStage('失败', progressState.total || 1);
            console.error(e);
        }
    } finally {
        isRunning = false;
        abortFlag = false;
        abortCtrl = null;
        unlockInputs();
    }
}

function stopBackup() {
    if (!isRunning) return;
    if (!confirm('确定停止备份？已写入的缓存会保留。')) return;
    abortFlag = true;
    if (abortCtrl) abortCtrl.abort();
    log('正在停止...', 'warn');
}

async function exportFromCache() {
    if (!db) db = await openDb();
    const username = document.getElementById('username').value.trim() ||
        (currentUser && currentUser.username);
    if (!username) {
        setStatus('请填写 Bangumi 用户名以确定导出对象', 'error');
        return;
    }
    const items = await dbGetByOwner(username);
    if (!items.length) {
        setStatus(`缓存中无 ${username} 的数据`, 'error');
        return;
    }

    let service = null;
    try {
        service = new BangumiApiService(accessToken, { interval: 0, maxRetries: 1 });
    } catch (e) { }
    const userMeta = service
        ? await resolveUserMeta(service, username)
        : (currentUser && currentUser.username === username)
            ? currentUser
            : (() => {
                const s = localStorage.getItem(`meta_user_${username}`);
                if (s) { try { return JSON.parse(s); } catch (e) { } }
                return { username };
            })();

    const blob = buildTakeoutBlob(userMeta, items);
    downloadBlob(blob, makeFilename(username));
    log(`已从缓存导出 ${items.length} 条（${username}，${(blob.size / 1024 / 1024).toFixed(1)} MB）`, 'success');
    setStatus(`已导出 ${items.length} 条`, 'success');
}

async function clearCache() {
    if (!confirm('确定清除缓存？\n\n- 清空「收藏列表缓存」\n- 清理「所有已过期的条目缓存」\n\n未过期的条目缓存会保留。BGM 数据不受影响。\n\n下次备份会重新拉取收藏列表。')) return;
    if (!db) db = await openDb();
    await dbClearCollectionsOnly();
    const cleared = await dbClearExpired();
    log(`收藏列表缓存已清空，另清理过期条目 ${cleared} 条`, 'warn');
    setStatus(`已清空收藏列表缓存，清理过期条目 ${cleared} 条`, 'success');
}

// ============================================================
// 初始化
// ============================================================
function initSelects() {
    const iSel = document.getElementById('intervalSelect');
    for (const opt of INTERVAL_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label;
        iSel.appendChild(o);
    }
    iSel.value = String(loadSetting('interval', 700));
    iSel.addEventListener('change', e => saveSetting('interval', e.target.value));

    const rSel = document.getElementById('retrySelect');
    for (const opt of RETRY_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label;
        rSel.appendChild(o);
    }
    rSel.value = String(loadSetting('retry', 5));
    rSel.addEventListener('change', e => saveSetting('retry', e.target.value));
}

document.getElementById('btnAuth').onclick = startAuth;
document.getElementById('btnPaste').onclick = pasteToken;
document.getElementById('btnLogout').onclick = logout;
document.getElementById('btnFetch').onclick = runBackup;
document.getElementById('btnStop').onclick = stopBackup;
document.getElementById('btnExport').onclick = exportFromCache;
document.getElementById('btnClear').onclick = clearCache;
document.getElementById('btnRefreshBgm').onclick = refreshBgmData;

document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
});

document.getElementById('username').addEventListener('change', e => {
    saveSetting('username', e.target.value.trim());
});

window.addEventListener('beforeunload', e => {
    if (isRunning) { e.preventDefault(); e.returnValue = ''; }
});

(async function init() {
    // 填充配置相关 UI
    document.getElementById('issueLink').href = CONFIG.ISSUE_URL;
    document.querySelectorAll('.ttl-inline').forEach(el => {
        el.textContent = Math.round(CONFIG.CACHE_TTL_MS / 86400000) + ' 天';
    });

    initSelects();

    const savedName = loadSetting('username', '');
    if (savedName) document.getElementById('username').value = savedName;

    loadTokens();
    await handleCallback();

    if (accessToken && !currentUser) await refreshCurrentUser();
    else updateAuthUI();

    try {
        db = await openDb();
    } catch (e) {
        log('IndexedDB 初始化失败: ' + e.message, 'error');
    }

    if (navigator.storage && navigator.storage.persist) {
        try {
            const granted = await navigator.storage.persist();
            log(granted ? '已获得持久化存储授权' : '未取得持久化存储授权，浏览器可能根据磁盘情况自动清理',
                granted ? 'success' : 'warn');
        } catch (e) { }
    }

    resetProgress();
    updateBgmStatus();
    log('准备就绪', 'info');
})();
