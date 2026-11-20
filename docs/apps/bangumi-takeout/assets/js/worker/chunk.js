import { extractShardText } from '../zip.js'

// Parsing a shard off the main thread keeps an 11 MB response from stalling
// the page. Only the entries the backup asked for are cloned back.
export async function parseShard(arrayBuffer, {
    ids = [], idKey = 'id', maxOutputBytes,
} = {}) {
    const text = await extractShardText(arrayBuffer, { maxOutputBytes })
    const wanted = ids instanceof Set ? ids : new Set(ids)
    const entries = []
    let parseFailures = 0
    for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let entry
        try {
            entry = JSON.parse(trimmed)
        } catch {
            parseFailures += 1
            continue
        }
        // A line that parses to an array or a primitive is a broken record,
        // not a row without a matching id; counting it keeps the failure
        // visible instead of silently dropping the line.
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            parseFailures += 1
            continue
        }
        const id = entry[idKey]
        if (id == null || !wanted.has(id)) continue
        entries.push(entry)
    }
    return { entries, parseFailures }
}

const isWorker = typeof document === 'undefined' && typeof self !== 'undefined'
    && typeof self.postMessage === 'function'

if (isWorker) {
    self.onmessage = event => {
        const { id, buffer, ids, idKey, maxOutputBytes } = event.data || {}
        parseShard(buffer, { ids, idKey, maxOutputBytes }).then(
            result => self.postMessage({ id, ok: true, ...result }),
            error => self.postMessage({ id, ok: false, message: error?.message || String(error) }),
        )
    }
}
