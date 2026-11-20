import {
    statusByType, categoryBySubjectType,
} from './config.js'

export function normalizeExport(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('数据格式错误')
    const meta = raw.meta || {}
    const user = meta.user || {}
    if (!isValidOwner(user.username)) throw new Error('缺少 meta.user.username，无法区分用户')
    if (!Array.isArray(raw.data) || raw.data.length === 0) throw new Error('收藏数据为空')

    const seen = new Set()
    const records = []
    let invalid = 0
    let duplicates = 0
    for (const entry of raw.data) {
        const record = toRecord(entry)
        if (!record) {
            invalid++
            continue
        }
        if (seen.has(record.subject_id)) {
            duplicates++
            continue
        }
        seen.add(record.subject_id)
        records.push(record)
    }
    if (!records.length) throw new Error(`没有可导入的条目，已过滤 ${invalid + duplicates} 条`)

    return {
        user: {
            id: user.id ?? null,
            username: user.username,
            nickname: user.nickname || '',
            avatar: user.avatar || null,
        },
        generatedAt: meta.generated_at || 0,
        records,
        report: {
            total: raw.data.length,
            stored: records.length,
            filtered: invalid + duplicates,
            invalid,
            duplicates,
        },
    }
}

// A null progress means it was never fetched; an empty object is a fetched result.
export function isProgressObject(progress) {
    return !!progress && typeof progress === 'object'
}

export function isValidOwner(owner) {
    return typeof owner === 'string' && owner.length > 0
}

export function isValidSubjectId(subjectId) {
    return Number.isInteger(subjectId) && subjectId > 0
}

function toRecord(entry) {
    const subject = entry?.subject
    if (!isValidSubjectId(subject?.id)) return null
    const record = { ...entry, subject_id: subject.id }
    if (!isProgressObject(entry.progress)) delete record.progress
    return record
}

export function toViewItems(records) {
    return records.map(toViewItem).filter(Boolean)
}

// Main episodes sit in the '0' bucket; a snapshot without types keeps them in
// 'unknown', so an empty '0' falls back to that bucket.
function pickMainEpisodes(epData) {
    if (Array.isArray(epData['0']) && epData['0'].length) return epData['0']
    if (Array.isArray(epData.unknown)) return epData.unknown
    return []
}

// Only what the collection view reads: the card, the search, the filters and
// the sorting. The detail record is not touched here.
function toViewItem(record) {
    const s = record.subject
    if (!s || !s.id) return null

    return {
        id: s.id,
        cat: categoryBySubjectType[s.type] || 'other',

        name: s.name || '',
        nameCn: s.name_cn || '',
        shortSummary: s.short_summary || '',
        date: s.date || '',
        images: s.images || {},
        publicScore: typeof s.score === 'number' ? s.score : null,
        rank: s.rank || 0,
        eps: s.eps || 0,
        volumes: s.volumes || 0,

        status: statusByType[record.type] || 'unknown',
        rate: typeof record.rate === 'number' ? record.rate : 0,
        volStatus: record.vol_status || 0,
        epStatus: record.ep_status || 0,
        comment: record.comment || '',
        myTags: Array.isArray(record.tags) ? record.tags : [],
        updatedAt: record.updated_at || '',
    }
}

// The detail page renders one merged record; episode objects are built here,
// once, instead of for every item of a list.
export function toDetailItem(record) {
    const view = toViewItem(record)
    if (!view) return null

    const sd = record.subject_data || {}
    const epData = record.ep_data || {}
    const mainEps = pickMainEpisodes(epData)
    const progress = record.progress || {}
    const progressFetched = isProgressObject(record.progress)
    const watched = new Set(
        (Array.isArray(progress.eps) ? progress.eps : [])
            .filter(x => x.status && x.status.id === 2)
            .map(x => x.id)
    )
    const watchedCount = watched.size
    const hasWatchRecords = progressFetched
        && (watchedCount > 0 || record.ep_status > 0 || record.vol_status > 0)

    return {
        ...view,
        summary: sd.summary || view.shortSummary || '',
        scoreDetails: sd.score_details || null,
        favorite: sd.favorite || null,
        infobox: sd.infobox || '',
        subjectTags: Array.isArray(record.subject?.tags) ? record.subject.tags : [],

        progressFetched,
        hasWatchRecords,
        watchedCount,
        episodes: mainEps
            .slice()
            .sort((a, b) => (a.sort || 0) - (b.sort || 0))
            .map(ep => ({
                id: ep.id,
                ep: ep.ep,
                name: ep.name || '',
                nameCn: ep.name_cn || '',
                airdate: ep.airdate || '',
                duration: ep.duration || '',
                desc: ep.desc || '',
                watched: watched.has(ep.id),
            })),
    }
}

function cmpStr(a, b) { return (a || '').localeCompare(b || '') }

export function sortItems(items, sortKey, direction = 'desc') {
    const arr = items.slice()
    const sign = direction === 'asc' ? 1 : -1
    // Unrated items and items without a time always sort last, regardless of
    // direction.
    const last = (missingA, missingB) => {
        if (missingA === missingB) return 0
        return missingA ? 1 : -1
    }
    if (sortKey === 'rate') {
        arr.sort((a, b) => {
            const skip = last(a.rate === 0, b.rate === 0)
            if (skip) return skip
            return (a.rate - b.rate) * sign || cmpStr(b.updatedAt, a.updatedAt)
        })
    } else {
        arr.sort((a, b) => {
            const skip = last(!a.updatedAt, !b.updatedAt)
            if (skip) return skip
            return cmpStr(a.updatedAt, b.updatedAt) * sign
        })
    }
    return arr
}

export function filterByRate(items, key) {
    if (!key || key === 'all') return items
    if (key === 'unrated') return items.filter(i => i.rate === 0)
    const n = Number(key)
    return items.filter(i => i.rate === n)
}

export function filterByTag(items, tag) {
    const keyword = String(tag ?? '').trim()
    if (!keyword) return items

    return items.filter(it => {
        const tags = Array.isArray(it.myTags) ? it.myTags : []
        return tags.some(t => String(t).trim() === keyword)
    })
}

export function matchQuery(item, q) {
    if (!q) return true
    const n = q.toLowerCase()
    return (
        (item.name && item.name.toLowerCase().includes(n)) ||
        (item.nameCn && item.nameCn.toLowerCase().includes(n)) ||
        (item.shortSummary && item.shortSummary.toLowerCase().includes(n))
    )
}

export function countByCategory(items) {
    const out = {}
    for (const it of items) {
        const bucket = out[it.cat] || (out[it.cat] = { total: 0, byStatus: {} })
        bucket.total++
        bucket.byStatus[it.status] = (bucket.byStatus[it.status] || 0) + 1
    }
    return out
}
