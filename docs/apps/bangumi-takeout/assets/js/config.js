// The app is a single page now, so the root is derived from this module rather
// than from the current document path.
const APP_ROOT_URL = new URL('../../', import.meta.url)

const FALLBACK_DEFAULT_SOURCE = {
    username: 'inuyasha559',
    dataPath: '../../writings/_media/PersonalRecordsBackup/bgm-20260906.json.zip',
}
const DEFAULT_SOURCE_FILE = new URL('../resources/meta/default-source.json', import.meta.url)

let defaultSource = resolveDefaultSource(FALLBACK_DEFAULT_SOURCE)
let defaultSourcePromise = null

function resolveDefaultSource(source) {
    const value = source && typeof source === 'object' ? source : {}
    return {
        username: String(value.username || FALLBACK_DEFAULT_SOURCE.username),
        // dataPath is written relative to the app root.
        dataUrl: new URL(value.dataPath || FALLBACK_DEFAULT_SOURCE.dataPath, APP_ROOT_URL).href,
    }
}

export function getDefaultSource() {
    return defaultSource
}

// One fetch per page; a broken or missing file keeps the fallback values.
export function loadDefaultSource() {
    if (!defaultSourcePromise) {
        defaultSourcePromise = fetch(DEFAULT_SOURCE_FILE, { cache: 'no-store' })
            .then(response => {
                if (!response.ok) throw new Error('default source ' + response.status)
                return response.json()
            })
            .then(data => {
                defaultSource = resolveDefaultSource(data)
                return defaultSource
            })
            .catch(() => defaultSource)
    }
    return defaultSourcePromise
}

export const CORS_PROXY = ''

// Every page is a hash route; the router renders the matching page module.
export const href = {
    index: '#/',
    about: '#/about',
    detail: '#/detail',
    backup: '#/backup',
    import: '#/import',
    users: '#/users',
    data: '#/data',
}

// Identity is username: some accounts have no uid.
export const DB_NAME = 'bangumi-takeout'
export const DB_VERSION = 1
export const STORE_ITEMS = 'items'
export const STORE_META = 'meta'
export const STORE_CREDENTIALS = 'credentials'

export const LEGACY_DB_NAME = 'bangumi-takeout:view'

export const TASK_MODES = ['full', 'incremental']
export const TASK_RESUME = 'resume'
export const TASK_STAGE = {
    COLLECTIONS: 'collections',
    SUBJECTS: 'subjects',
    EPISODES: 'episodes',
    PROGRESS: 'progress',
    FINALIZE: 'finalize',
}
// runner.js walks these in order; each stage keeps its own done subject_id
// set, so an unfinished task survives a reordered collection list.
export const TASK_STAGES = Object.values(TASK_STAGE)
export const INFO_SCOPE = { PRIVATE: 'private', PUBLIC: 'public' }

export const STORAGE_PREFIX = 'bangumi-takeout:'
export const LEGACY_CLEANUP_KEY = STORAGE_PREFIX + 'legacy-cleanup'

export const API_BASE = 'https://api.bgm.tv'
export const AUTH_BASE = 'https://bgm.tv/oauth'
export const PROXY_URL = 'https://bangumi-takeout-web.pikapikapi-kaori.workers.dev/?url='
export const BANGUMI_CLIENT_ID = 'bgm71356aa8a71822b75'
export const RETRY_WAIT_MS = 5000
// Every request carries a deadline so a stalled proxy cannot hang a backup.
export const REQUEST_TIMEOUT_MS = 30000
// A Retry-After value beyond this is clamped; a mistaken or hostile header
// must not park a run for hours.
export const RETRY_AFTER_MAX_MS = 60000
// Static chunks reach ~11 MB. Time them by idle gap, not by total transfer
// time, so a slow but still-moving download is not cut off at 30s.
export const STATIC_DATA_IDLE_TIMEOUT_MS = 60000

// Refreshing shortly before expiry avoids a request failing mid-backup.
export const TOKEN_REFRESH_MARGIN_MS = 60000

export const REQUEST_INTERVAL_LIMITS = { min: 300, max: 2000, fallback: 700 }
export const REQUEST_RETRY_LIMITS = { min: 2, max: 10, fallback: 5 }
export const REQUEST_INTERVAL_KEY = STORAGE_PREFIX + 'request-interval'
export const REQUEST_RETRY_KEY = STORAGE_PREFIX + 'request-retries'

export const REQUEST_INTERVAL_OPTIONS = [
    { value: 300, label: '300ms（不推荐）' },
    { value: 500, label: '500ms' },
    { value: 700, label: '700ms（默认）' },
    { value: 1000, label: '1000ms' },
    { value: 1500, label: '1500ms' },
    { value: 2000, label: '2000ms' },
]
export const REQUEST_RETRY_OPTIONS = [
    { value: 2, label: '2 次' },
    { value: 3, label: '3 次' },
    { value: 5, label: '5 次（默认）' },
    { value: 8, label: '8 次' },
    { value: 10, label: '10 次' },
]

export const BGM_DATA_URL = new URL('data/bgm-data', APP_ROOT_URL).href

export const COPYRIGHT_START_YEAR = 2026
export const COPYRIGHT_HOLDER = '李亦杨'

export const STATUS_BY_TYPE = {
    1: 'wish',
    2: 'done',
    3: 'doing',
    4: 'onhold',
    5: 'dropped',
}

export const CATEGORY_BY_SUBJECT_TYPE = {
    1: 'book',
    2: 'anime',
    3: 'music',
    4: 'game',
    6: 'real',
}

export const CATEGORIES = [
    { key: 'anime', label: '动画' },
    { key: 'book', label: '书籍' },
    { key: 'game', label: '游戏' },
    { key: 'music', label: '音乐' },
    { key: 'real', label: '三次元' },
]

export const STATUS_ORDER = ['doing', 'done', 'wish', 'onhold', 'dropped']

export const STATUS_LABELS = {
    anime: { doing: '在看', done: '已看', wish: '想看' },
    real: { doing: '在看', done: '已看', wish: '想看' },
    book: { doing: '在读', done: '已读', wish: '想读' },
    game: { doing: '在玩', done: '已玩', wish: '想玩' },
    music: { doing: '在听', done: '已听', wish: '想听' },
}

export const COMMON_STATUS_LABELS = {
    onhold: '搁置',
    dropped: '抛弃',
}

export const SORT_OPTIONS = [
    { key: 'rate', label: '评分' },
    { key: 'updated', label: '时间' },
]
export const DEFAULT_SORT = 'updated'

export const SORT_DIRECTION_LABELS = { desc: '降序', asc: '升序' }
export const DEFAULT_SORT_DIRECTION = 'desc'

const SORT_ICON_SIZE = '1em'

export const SORT_DIRECTION_ICONS = {
    desc: `<svg xmlns="http://www.w3.org/2000/svg" width="${SORT_ICON_SIZE}" height="${SORT_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"></path><path d="m6 14 6 6 6-6"></path></svg>`,
    asc: `<svg xmlns="http://www.w3.org/2000/svg" width="${SORT_ICON_SIZE}" height="${SORT_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4"></path><path d="m6 10 6-6 6 6"></path></svg>`,
}

export const RATE_FILTER_OPTIONS = [
    { key: 'all', label: '全部' },
    { key: 'unrated', label: '未评分' },
    { key: '1', label: '=1' }, { key: '2', label: '=2' },
    { key: '3', label: '=3' }, { key: '4', label: '=4' },
    { key: '5', label: '=5' }, { key: '6', label: '=6' },
    { key: '7', label: '=7' }, { key: '8', label: '=8' },
    { key: '9', label: '=9' }, { key: '10', label: '=10' },
]
export const DEFAULT_RATE_FILTER = 'all'

export const DEFAULT_TAG_FILTER = ''

export const PAGE_SIZE_OPTIONS = [30, 60, 90, 150]
export const DEFAULT_PAGE_SIZE = 30

// Holds the selected username, not a uid.
export const CURRENT_USER_KEY = STORAGE_PREFIX + 'current-user'
// Set when the viewer leaves a user explicitly, so boot does not silently
// fall back to the most recently updated cached user.
export const VIEW_CLEARED_KEY = STORAGE_PREFIX + 'view-cleared'
export const STATE_KEY = STORAGE_PREFIX + 'overview-state'

export const THEME_STORAGE_KEY = STORAGE_PREFIX + 'theme'
export const THEME_MODES = ['auto', 'light', 'dark']
export const THEME_LABELS = { auto: '自动', light: '明亮', dark: '黑暗' }

const THEME_ICON_SIZE = '1em'

export const THEME_ICONS = {
    auto: `<svg xmlns="http://www.w3.org/2000/svg" width="${THEME_ICON_SIZE}" height="${THEME_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"><defs><clipPath id="sysClip"><polygon points="24,0 24,24 0,24"></polygon></clipPath></defs><g transform="translate(1 1.5) scale(0.5)" stroke-width="1"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"></path><path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"></path><path d="M19 11h2m-1 -1v2"></path></g><g clip-path="url(#sysClip)"><g transform="translate(9 9) scale(0.5)" stroke-width="1"><path d="M14.828 14.828a4 4 0 1 0 -5.656 -5.656a4 4 0 0 0 5.656 5.656z"></path><path d="M6.343 17.657l-1.414 1.414"></path><path d="M6.343 6.343l-1.414 -1.414"></path><path d="M17.657 6.343l1.414 -1.414"></path><path d="M17.657 17.657l1.414 1.414"></path><path d="M4 12h-2"></path><path d="M12 4v-2"></path><path d="M20 12h2"></path><path d="M12 20v2"></path></g></g><path d="M22 2 2 22"></path></svg>`,
    light: `<svg xmlns="http://www.w3.org/2000/svg" width="${THEME_ICON_SIZE}" height="${THEME_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.828 14.828a4 4 0 1 0 -5.656 -5.656a4 4 0 0 0 5.656 5.656z"></path><path d="M6.343 17.657l-1.414 1.414"></path><path d="M6.343 6.343l-1.414 -1.414"></path><path d="M17.657 6.343l1.414 -1.414"></path><path d="M17.657 17.657l1.414 1.414"></path><path d="M4 12h-2"></path><path d="M12 4v-2"></path><path d="M20 12h2"></path><path d="M12 20v2"></path></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" width="${THEME_ICON_SIZE}" height="${THEME_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"></path><path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"></path><path d="M19 11h2m-1 -1v2"></path></svg>`
}

export const MAX_FILE_SIZE = 1024 * 1024 * 1024
// One import request may not run forever: the fetch is aborted after this
// deadline and the caller may abort earlier through its own signal.
export const IMPORT_TIMEOUT_MS = 60000
// A ZIP may expand far beyond its compressed size; cap the sum of all JSON
// entries so a crafted archive cannot exhaust memory.
export const ZIP_MAX_OUTPUT_BYTES = 1536 * 1024 * 1024
// Static shards stay below about 11 MB. These caps only stop a damaged or
// crafted response before it can consume the tab's memory.
export const STATIC_CHUNK_MAX_BYTES = 64 * 1024 * 1024
export const STATIC_CHUNK_MAX_OUTPUT_BYTES = 128 * 1024 * 1024
