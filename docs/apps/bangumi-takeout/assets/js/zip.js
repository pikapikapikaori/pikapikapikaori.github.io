import { zipMaxOutputBytes } from './config.js'
import { createAbortError } from './abort.js'

const eocdSig = 0x06054b50
const cdfhSig = 0x02014b50
const lfhSig = 0x04034b50
const maxComment = 0xFFFF
const allJsonExtensions = ['.json', '.jsonl']

function abortError() {
    return createAbortError('已取消导入', 'AbortError')
}

function tooLargeError(maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024)
    return new Error(`ZIP 解压输出超过 ${mb} MB 上限`)
}

function throwIfAborted(signal) {
    if (signal?.aborted) throw abortError()
}

function asBytes(arrayBuffer) {
    if (arrayBuffer instanceof Uint8Array) return arrayBuffer
    if (arrayBuffer instanceof ArrayBuffer) return new Uint8Array(arrayBuffer)
    throw new Error('ZIP 数据格式不正确')
}

async function inflateRaw(bytes, {
    signal = null, maxBytes = zipMaxOutputBytes, limitBytes = maxBytes,
} = {}) {
    throwIfAborted(signal)
    if (maxBytes < 0) throw tooLargeError(limitBytes)
    const ds = new DecompressionStream('deflate-raw')
    const stream = new Blob([bytes]).stream().pipeThrough(ds)
    const reader = stream.getReader()
    const chunks = []
    let total = 0
    let complete = false
    try {
        for (;;) {
            throwIfAborted(signal)
            const { done, value } = await reader.read()
            if (done) {
                complete = true
                break
            }
            total += value.byteLength
            if (total > maxBytes) throw tooLargeError(limitBytes)
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
    return out
}

function extensionOf(name) {
    const base = name.slice(name.lastIndexOf('/') + 1).toLowerCase()
    const dot = base.lastIndexOf('.')
    return dot < 1 ? '' : base.slice(dot)
}

function readDirectory(arrayBuffer) {
    const bytes = asBytes(arrayBuffer)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const dec = new TextDecoder('utf-8')

    let eocd = -1
    const minPos = Math.max(0, bytes.length - maxComment - 22)
    for (let i = bytes.length - 22; i >= minPos; i--) {
        if (view.getUint32(i, true) === eocdSig) { eocd = i; break }
    }
    if (eocd < 0) throw new Error('不是有效的 ZIP 文件')

    const entryCount = view.getUint16(eocd + 10, true)
    const cdOffset = view.getUint32(eocd + 16, true)
    if (cdOffset + 46 > bytes.length && entryCount > 0) throw new Error('ZIP 中央目录越界')

    const entries = []
    let p = cdOffset
    for (let i = 0; i < entryCount; i++) {
        if (p + 46 > bytes.length) throw new Error('ZIP 中央目录损坏')
        if (view.getUint32(p, true) !== cdfhSig) throw new Error('ZIP 中央目录损坏')
        const method = view.getUint16(p + 10, true)
        const compSize = view.getUint32(p + 20, true)
        const size = view.getUint32(p + 24, true)
        const nameLen = view.getUint16(p + 28, true)
        const extraLen = view.getUint16(p + 30, true)
        const commentLen = view.getUint16(p + 32, true)
        const localOffset = view.getUint32(p + 42, true)
        const end = p + 46 + nameLen + extraLen + commentLen
        if (end > bytes.length) throw new Error('ZIP 中央目录损坏')
        const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
        p = end
        if (!name.endsWith('/')) entries.push({ name, method, compSize, size, localOffset })
    }
    return { bytes, view, entries }
}

async function readEntry(bytes, view, entry, { signal, maxOutputBytes, limitBytes = maxOutputBytes }) {
    throwIfAborted(signal)
    if (entry.localOffset + 30 > bytes.length) throw new Error('ZIP 本地头越界')
    if (view.getUint32(entry.localOffset, true) !== lfhSig) throw new Error('ZIP 本地头损坏')
    const nameLen = view.getUint16(entry.localOffset + 26, true)
    const extraLen = view.getUint16(entry.localOffset + 28, true)
    const dataStart = entry.localOffset + 30 + nameLen + extraLen
    if (dataStart + entry.compSize > bytes.length) throw new Error('ZIP 数据越界')

    const compData = bytes.subarray(dataStart, dataStart + entry.compSize)
    if (entry.method === 0) {
        if (compData.byteLength > maxOutputBytes) throw tooLargeError(limitBytes)
        return compData.slice()
    }
    if (entry.method === 8) {
        return inflateRaw(compData, { signal, maxBytes: maxOutputBytes, limitBytes })
    }
    throw new Error(`ZIP 使用了不支持的压缩方式: ${entry.method}`)
}

function normalizeExtensions(extensions) {
    return (extensions || []).map(value => String(value).toLowerCase())
}

export async function unzip(arrayBuffer, {
    signal = null, maxOutputBytes = zipMaxOutputBytes,
    extensions = allJsonExtensions,
} = {}) {
    throwIfAborted(signal)
    const { bytes, view, entries } = readDirectory(arrayBuffer)
    const wanted = normalizeExtensions(extensions)
    const selected = []
    let declaredTotal = 0
    for (const entry of entries) {
        if (!wanted.includes(extensionOf(entry.name))) continue
        selected.push(entry)
        if (entry.size !== 0xFFFFFFFF) declaredTotal += entry.size
    }
    if (declaredTotal > maxOutputBytes) throw tooLargeError(maxOutputBytes)

    const files = new Map()
    let total = 0
    for (const entry of selected) {
        throwIfAborted(signal)
        const remaining = maxOutputBytes - total
        if (remaining < 0) throw tooLargeError(maxOutputBytes)
        const content = await readEntry(bytes, view, entry, {
            signal, maxOutputBytes: remaining, limitBytes: maxOutputBytes,
        })
        total += content.byteLength
        if (total > maxOutputBytes) throw tooLargeError(maxOutputBytes)
        files.set(entry.name, content)
    }
    return files
}

async function unzipFirst(arrayBuffer, {
    signal = null, maxOutputBytes = zipMaxOutputBytes,
    extensions = ['.jsonl', '.json'],
} = {}) {
    throwIfAborted(signal)
    const { bytes, view, entries } = readDirectory(arrayBuffer)
    const wanted = normalizeExtensions(extensions)
    for (const extension of wanted) {
        const entry = entries.find(item => extensionOf(item.name) === extension)
        if (!entry) continue
        if (entry.size !== 0xFFFFFFFF && entry.size > maxOutputBytes) {
            throw tooLargeError(maxOutputBytes)
        }
        const content = await readEntry(bytes, view, entry, { signal, maxOutputBytes })
        throwIfAborted(signal)
        return { name: entry.name, bytes: content }
    }
    throw new Error('ZIP 中没有找到 JSON 数据')
}

export async function extractShardText(arrayBuffer, {
    signal = null, maxOutputBytes = zipMaxOutputBytes,
} = {}) {
    throwIfAborted(signal)
    const entry = await unzipFirst(asBytes(arrayBuffer), { signal, maxOutputBytes })
    return new TextDecoder('utf-8').decode(entry.bytes)
}

export function pickJson(files) {
    const jsons = [...files.keys()].filter(n => extensionOf(n) === '.json')
    if (!jsons.length) throw new Error('ZIP 中没有找到 json 文件')
    const root = jsons.filter(n => !n.includes('/') && !n.includes('\\'))
    return (root[0] || jsons[0])
}
