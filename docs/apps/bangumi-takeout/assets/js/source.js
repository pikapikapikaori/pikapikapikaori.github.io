import {
    corsProxy, importTimeoutMs, maxFileSize, zipMaxOutputBytes,
} from './config.js'
import { unzip, pickJson } from './zip.js'

function proxy(url) {
    if (!corsProxy) return url
    return corsProxy.replace('{url}', encodeURIComponent(url))
}

function abortError(message = '已取消导入') {
    const error = new Error(message)
    error.name = 'AbortError'
    return error
}

function tooLargeError() {
    const mb = Math.round(maxFileSize / 1024 / 1024)
    return new Error(`文件超过 ${mb} MB 大小上限`)
}

// File.arrayBuffer() has no cancel point, so the file is read through its stream;
// cancelling the reader settles the pending read.
async function readFileBytes(file, { signal = null } = {}) {
    if (signal?.aborted) throw abortError()
    if (typeof file.stream !== 'function') {
        const buffer = await file.arrayBuffer()
        if (signal?.aborted) throw abortError()
        return buffer
    }
    const reader = file.stream().getReader()
    const chunks = []
    let total = 0
    let complete = false
    const onAbort = () => reader.cancel().catch(() => {})
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
        for (;;) {
            if (signal?.aborted) throw abortError()
            const { done, value } = await reader.read()
            if (signal?.aborted) throw abortError()
            if (done) {
                complete = true
                break
            }
            total += value.byteLength
            if (total > maxFileSize) throw tooLargeError()
            chunks.push(value)
        }
    } catch (error) {
        if (signal?.aborted) throw abortError()
        throw error
    } finally {
        signal?.removeEventListener('abort', onAbort)
        if (!complete) reader.cancel().catch(() => {})
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.byteLength
    }
    return out.buffer
}

function looksLikeZip(buf) {
    if (buf.byteLength < 4) return false
    const b = new Uint8Array(buf, 0, 2)
    return b[0] === 0x50 && b[1] === 0x4B
}

// Content-Length is only a hint: a missing or lying header is handled by
// counting every received chunk and aborting as soon as the budget is spent.
async function readLimitedBody(response, { signal }) {
    const header = Number(response.headers.get('content-length'))
    if (Number.isFinite(header) && header > maxFileSize) throw tooLargeError()

    if (!response.body || typeof response.body.getReader !== 'function') {
        const buf = await response.arrayBuffer()
        if (buf.byteLength > maxFileSize) throw tooLargeError()
        return buf
    }

    const reader = response.body.getReader()
    const chunks = []
    let total = 0
    let complete = false
    try {
        for (;;) {
            if (signal?.aborted) throw abortError()
            const { done, value } = await reader.read()
            if (done) {
                complete = true
                break
            }
            total += value.byteLength
            if (total > maxFileSize) throw tooLargeError()
            chunks.push(value)
        }
    } catch (error) {
        if (signal?.aborted) throw abortError()
        throw error
    } finally {
        if (!complete) reader.cancel().catch(() => {})
    }

    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.byteLength
    }
    return out.buffer
}

async function fetchBinary(url, { signal = null } = {}) {
    const controller = new AbortController()
    let timedOut = false
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, importTimeoutMs)
    try {
        const res = await fetch(proxy(url), {
            credentials: 'omit', redirect: 'follow', signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
        return await readLimitedBody(res, { signal: controller.signal })
    } catch (error) {
        if (signal?.aborted) throw abortError()
        if (timedOut) throw new Error(`请求超时（${Math.round(importTimeoutMs / 1000)} 秒）`)
        if (error?.name === 'AbortError') throw abortError()
        throw error
    } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
    }
}

async function parseBinary(buf, { signal = null } = {}) {
    if (signal?.aborted) throw abortError()
    let jsonBytes
    if (looksLikeZip(buf)) {
        const files = await unzip(buf, {
            signal, maxOutputBytes: zipMaxOutputBytes, extensions: ['.json'],
        })
        const name = pickJson(files)
        jsonBytes = files.get(name)
    } else {
        jsonBytes = new Uint8Array(buf)
    }
    if (signal?.aborted) throw abortError()
    const text = new TextDecoder('utf-8').decode(jsonBytes)
    try {
        return JSON.parse(text)
    } catch (e) {
        throw new Error('JSON 解析失败：' + e.message)
    }
}

export async function loadFromFile(file, { signal = null } = {}) {
    if (file.size > maxFileSize) throw tooLargeError()
    return parseBinary(await readFileBytes(file, { signal }), { signal })
}

export async function loadFromUrl(url, { signal = null } = {}) {
    if (!/^https?:\/\//i.test(url)) throw new Error('请输入 http(s) 开头的地址')
    return parseBinary(await fetchBinary(url, { signal }), { signal })
}
