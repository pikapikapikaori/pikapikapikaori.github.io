/**
 * 统一 HTTP 层：超时 / 重试 / 按站点节流 / 响应缓存
 *
 * 与具体数据源无关——调用方（各外部源）自己声明参数：
 *
 *   await requestJSON(url, {
 *       query: { action: 'parse', page: 'amo' },
 *       timeout: 15000,          // 单次超时（ms）
 *       retries: 2,              // 失败最多再试几次
 *       minInterval: 250,        // 同站点相邻请求的最小间隔（ms）
 *       concurrency: 1,          // 同站点并发数
 *       cacheTtl: 7 * 86400000,  // >0 时把响应缓存到 IndexedDB
 *   })
 *
 * 节流按 origin 全局生效：不同源请求同一个站点也会排队。
 */

import { readCache, writeCache } from '../store/http-cache.js'

const DEFAULT_TIMEOUT = 15000
const DEFAULT_RETRIES = 2

/* ---------------- 同站点队列 ---------------- */

const queues = new Map()   // origin -> OriginQueue

class OriginQueue {
    constructor() {
        this.concurrency = 1
        this.minInterval = 0
        this.active = 0
        this.lastStart = 0
        this.items = []
        this.timer = null
    }

    /** 按调用方声明的更保守值取大（同一个站点被多个源请求时） */
    configure({ concurrency, minInterval }) {
        if (concurrency > 0) this.concurrency = Math.max(this.concurrency, concurrency)
        if (minInterval > 0) this.minInterval = Math.max(this.minInterval, minInterval)
    }

    run(task) {
        return new Promise((resolve, reject) => {
            this.items.push({ task, resolve, reject })
            this.pump()
        })
    }

    pump() {
        clearTimeout(this.timer)
        this.timer = null

        while (this.active < this.concurrency && this.items.length) {
            const wait = this.lastStart + this.minInterval - Date.now()
            if (wait > 0) {
                this.timer = setTimeout(() => this.pump(), wait)
                return
            }
            const item = this.items.shift()
            this.active += 1
            this.lastStart = Date.now()
            item.task()
                .then(item.resolve, item.reject)
                .finally(() => {
                    this.active -= 1
                    this.pump()
                })
        }
    }
}

function queueFor(url) {
    const origin = new URL(url).origin
    if (!queues.has(origin)) queues.set(origin, new OriginQueue())
    return queues.get(origin)
}

/* ---------------- 单次请求 ---------------- */

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/** `Retry-After` 支持秒数与 HTTP-date */
function parseRetryAfter(value) {
    if (!value) return 0
    const seconds = Number(value)
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
    const at = Date.parse(value)
    return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0
}

function httpError(message, extra) {
    return Object.assign(new Error(message), extra)
}

async function fetchOnce(url, { timeout, signal, headers }) {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, timeout)

    const onAbort = () => controller.abort()
    if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener('abort', onAbort, { once: true })
    }

    try {
        const init = { signal: controller.signal }
        if (headers) init.headers = headers
        const res = await fetch(url, init)
        if (!res.ok) {
            throw httpError(`HTTP ${res.status}`, {
                status: res.status,
                retryable: res.status === 429 || res.status >= 500,
                retryAfter: parseRetryAfter(res.headers.get('retry-after'))
            })
        }
        return res
    } catch (err) {
        if (err && err.name === 'AbortError') {
            throw httpError(timedOut ? `请求超时（${timeout}ms）` : '请求已取消', {
                retryable: timedOut
            })
        }
        if (err && err.status) throw err
        // 网络错误（断网、连接被重置…）
        throw httpError(err?.message || '网络错误', { retryable: true })
    } finally {
        clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
    }
}

async function request(url, { timeout, retries, headers, minInterval, concurrency, signal, parse }) {
    const queue = queueFor(url)
    queue.configure({ concurrency, minInterval })

    let attempt = 0
    for (;;) {
        try {
            const res = await queue.run(() => fetchOnce(url, { timeout, signal, headers }))
            return await parse(res)
        } catch (err) {
            const canRetry = err?.retryable && attempt < retries && !signal?.aborted
            if (!canRetry) throw err

            const backoff = err.retryAfter || Math.min(8000, 400 * 2 ** attempt)
            await sleep(backoff + Math.random() * 200)
            attempt += 1
        }
    }
}

/* ---------------- 对外接口 ---------------- */

function buildUrl(url, query) {
    const u = new URL(url)
    for (const [k, v] of Object.entries(query || {})) {
        if (v !== undefined && v !== null) u.searchParams.set(k, v)
    }
    return u.toString()
}

function cacheKey(url) {
    const u = new URL(url)
    u.searchParams.sort()
    u.hash = ''
    return u.toString()
}

function normalizeOptions(options) {
    return {
        query: options.query || null,
        timeout: Number(options.timeout) > 0 ? Number(options.timeout) : DEFAULT_TIMEOUT,
        retries: Number.isFinite(options.retries) ? Math.max(0, options.retries) : DEFAULT_RETRIES,
        minInterval: Number(options.minInterval) || 0,
        concurrency: Number(options.concurrency) || 1,
        cacheTtl: Number(options.cacheTtl) || 0,
        headers: options.headers || null,
        signal: options.signal || null
    }
}

async function readCached(key, type) {
    const row = await readCache(key)
    if (!row || row.type !== type) return null
    return row.body
}

export async function requestJSON(url, options = {}) {
    const opts = normalizeOptions(options)
    const full = buildUrl(url, opts.query)
    const key = opts.cacheTtl > 0 ? cacheKey(full) : ''

    const cached = await readCached(key, 'json')
    if (cached != null) {
        try { return JSON.parse(cached) } catch { /* 缓存坏了就重新请求 */ }
    }

    const data = await request(full, {
        ...opts,
        parse: async (res) => res.json()
    })

    if (key) await writeCache(key, { url: full, type: 'json', body: JSON.stringify(data), ttl: opts.cacheTtl })
    return data
}

export async function requestText(url, options = {}) {
    const opts = normalizeOptions(options)
    const full = buildUrl(url, opts.query)
    const key = opts.cacheTtl > 0 ? cacheKey(full) : ''

    const cached = await readCached(key, 'text')
    if (cached != null) return cached

    const text = await request(full, {
        ...opts,
        parse: async (res) => res.text()
    })

    if (key) await writeCache(key, { url: full, type: 'text', body: text, ttl: opts.cacheTtl })
    return text
}
