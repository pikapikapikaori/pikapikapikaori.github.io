// Writes one user as the takeout.json file shared with the bangumi-takeout-py
// project. One transaction reads the list records, the detail records and the
// meta record, so the file is one consistent snapshot, and the two halves of
// each item are joined back into one entry. `progress` stays in the file
// because the format carries it; `owner` is local bookkeeping. The `progress_at`
// stamp that says whether a stored progress is still current belongs to the
// list half, so the join drops it and it never reaches the file.
import { readUserExport } from '../storage.js'

const internalFields = ['owner']

function toExportEntry(record) {
    const entry = { ...record }
    for (const field of internalFields) delete entry[field]
    return entry
}

function makeFilename(username) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    return `takeout_${username}_${stamp}.json`
}

function buildBlob(user, generatedAt, records) {
    const head = { generated_at: generatedAt, user }
    const chunks = ['{"meta":', JSON.stringify(head), ',"data":[']
    for (let i = 0; i < records.length; i++) {
        if (i > 0) chunks.push(',')
        chunks.push(JSON.stringify(toExportEntry(records[i])))
    }
    chunks.push(']}')
    return new Blob(chunks, { type: 'application/json' })
}

export async function exportUserData(username) {
    const name = String(username || '').trim()
    if (!name) throw new Error('缺少导出用户名')

    // One transaction for both stores: the export never mixes a meta record
    // with items written by a concurrent backup.
    const { meta: record, items: records } = await readUserExport(name)
    if (!records.length) throw new Error(`本地没有 ${name} 的数据`)

    const user = record?.user || { username: name }
    const generatedAt = record?.generated_at || 0
    return {
        user,
        generatedAt,
        count: records.length,
        filename: makeFilename(name),
        blob: buildBlob(user, generatedAt, records),
    }
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    setTimeout(() => URL.revokeObjectURL(url), 1500)
}
