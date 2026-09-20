import {
    STATUS_BY_TYPE, CATEGORY_BY_SUBJECT_TYPE, STATUS_ORDER,
} from './config.js';

// ---------- 入口：把原始 JSON 变成内部结构 ----------
export function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('数据格式错误');
    const meta = raw.meta || {};
    const user = meta.user || {};
    if (!user.id) throw new Error('缺少 meta.user.id，无法区分用户');
    const list = Array.isArray(raw.data) ? raw.data : [];

    return {
        user: {
            id: user.id,
            username: user.username || '',
            nickname: user.nickname || '',
            avatar: user.avatar || null,
        },
        generatedAt: meta.generated_at || 0,
        items: list.map(normalizeItem).filter(Boolean),
    };
}

function normalizeItem(e) {
    const s = e.subject;
    if (!s || !s.id) return null;

    const sd = e.subject_data || {};
    const epData = e.ep_data || {};
    const mainEps = Array.isArray(epData['0']) ? epData['0'] : [];
    const progress = e.progress || {};
    const watched = new Set(
        (progress.eps || [])
            .filter(x => x.status && x.status.id === 2)
            .map(x => x.id)
    );

    return {
        // 身份
        id: s.id,
        cat: CATEGORY_BY_SUBJECT_TYPE[s.type] || 'other',
        subjectType: s.type,

        // 显示
        name: s.name || '',
        nameCn: s.name_cn || '',
        summary: sd.summary || s.short_summary || '',
        shortSummary: s.short_summary || '',
        date: s.date || '',
        images: s.images || {},
        publicScore: typeof s.score === 'number' ? s.score : null,
        scoreDetails: sd.score_details || null,
        favorite: sd.favorite || null,
        rank: s.rank || 0,
        eps: s.eps || 0,
        volumes: s.volumes || 0,
        collectionTotal: s.collection_total || 0,
        subjectTags: Array.isArray(s.tags) ? s.tags : [],
        metaTags: Array.isArray(sd.meta_tags) ? sd.meta_tags : [],
        nsfw: !!sd.nsfw,
        infobox: sd.infobox || '',

        // 我的收藏
        status: STATUS_BY_TYPE[e.type] || 'unknown',
        rate: typeof e.rate === 'number' ? e.rate : 0,
        volStatus: e.vol_status || 0,
        epStatus: e.ep_status || 0,
        comment: e.comment || '',
        myTags: Array.isArray(e.tags) ? e.tags : [],
        updatedAt: e.updated_at || '',

        // 剧集
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
    };
}

// ---------- 排序 ----------
function cmpStr(a, b) { return (a || '').localeCompare(b || ''); }

export function sortItems(items, sortKey) {
    const arr = items.slice();
    switch (sortKey) {
        case 'updated_desc': arr.sort((a, b) => cmpStr(b.updatedAt, a.updatedAt)); break;
        case 'updated_asc': arr.sort((a, b) => cmpStr(a.updatedAt, b.updatedAt)); break;
        case 'rate_desc': arr.sort((a, b) => (b.rate - a.rate) || cmpStr(b.updatedAt, a.updatedAt)); break;
        case 'rate_asc': arr.sort((a, b) => (a.rate - b.rate) || cmpStr(b.updatedAt, a.updatedAt)); break;
        case 'date_desc': arr.sort((a, b) => cmpStr(b.date, a.date)); break;
        case 'date_asc': arr.sort((a, b) => cmpStr(a.date, b.date)); break;
    }
    return arr;
}

// ---------- 筛选（按评分精确匹配） ----------
export function filterByRate(items, key) {
    if (!key || key === 'all') return items;
    if (key === 'unrated') return items.filter(i => i.rate === 0);
    const n = Number(key);
    return items.filter(i => i.rate === n);
}

// ---------- 搜索 ----------
export function matchQuery(item, q) {
    if (!q) return true;
    const n = q.toLowerCase();
    return (
        (item.name && item.name.toLowerCase().includes(n)) ||
        (item.nameCn && item.nameCn.toLowerCase().includes(n)) ||
        (item.shortSummary && item.shortSummary.toLowerCase().includes(n))
    );
}

// ---------- 统计 ----------
export function countByCategory(items) {
    const out = {};
    for (const it of items) {
        const bucket = out[it.cat] || (out[it.cat] = { total: 0, byStatus: {} });
        bucket.total++;
        bucket.byStatus[it.status] = (bucket.byStatus[it.status] || 0) + 1;
    }
    return out;
}

// ---------- 二级 tab 完整列表 ----------
export function statusesFor(cat) {
    return STATUS_ORDER.map(k => ({
        key: k,
        label: STATUS_LABELS[cat]?.[k] || COMMON_STATUS_LABELS[k] || k,
    }));
}
