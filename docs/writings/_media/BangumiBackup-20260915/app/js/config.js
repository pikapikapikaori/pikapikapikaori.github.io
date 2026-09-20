// ============================================================
//  全局配置 —— 所有可调常量集中于此
// ============================================================

// ---------- 数据源 ----------
export const DEFAULT_DATA_URL = '../../PersonalRecordsBackup/bgm-20260906.json.zip';
export const CORS_PROXY = '';

// ---------- 缓存 ----------
export const DB_NAME = 'bgm-viewer';
export const DB_VERSION = 1;
export const STORE_NAME = 'collections';
export const CACHE_KEY_PREFIX = 'user:';

// ---------- 版权 ----------
export const COPYRIGHT_START_YEAR = 2026;
export const COPYRIGHT_HOLDER = '李亦杨';

// ---------- 状态映射 ----------
export const STATUS_BY_TYPE = {
    1: 'wish',
    2: 'done',
    3: 'doing',
    4: 'onhold',
    5: 'dropped',
};

// ---------- 类别映射 ----------
export const CATEGORY_BY_SUBJECT_TYPE = {
    1: 'book',
    2: 'anime',
    3: 'music',
    4: 'game',
    6: 'real',
};

// ---------- 一级 tab ----------
export const CATEGORIES = [
    { key: 'anime', label: '动画' },
    { key: 'book', label: '书籍' },
    { key: 'game', label: '游戏' },
    { key: 'music', label: '音乐' },
    { key: 'real', label: '三次元' },
];

// ---------- 二级 tab ----------
export const STATUS_ORDER = ['doing', 'done', 'wish', 'onhold', 'dropped'];

export const STATUS_LABELS = {
    anime: { doing: '在看', done: '已看', wish: '想看' },
    real: { doing: '在看', done: '已看', wish: '想看' },
    book: { doing: '在读', done: '已读', wish: '想读' },
    game: { doing: '在玩', done: '已玩', wish: '想玩' },
    music: { doing: '在听', done: '已听', wish: '想听' },
};

export const COMMON_STATUS_LABELS = {
    onhold: '搁置',
    dropped: '抛弃',
};

// ---------- 排序 ----------
export const SORT_OPTIONS = [
    { key: 'updated_desc', label: '更新时间 ↓' },
    { key: 'updated_asc', label: '更新时间 ↑' },
    { key: 'rate_desc', label: '评分 ↓' },
    { key: 'rate_asc', label: '评分 ↑' },
    { key: 'date_desc', label: '作品日期 ↓' },
    { key: 'date_asc', label: '作品日期 ↑' },
];
export const DEFAULT_SORT = 'updated_desc';

// ---------- 评分筛选（精确匹配） ----------
export const RATE_FILTER_OPTIONS = [
    { key: 'all', label: '全部' },
    { key: 'unrated', label: '未评分' },
    { key: '1', label: '=1' }, { key: '2', label: '=2' },
    { key: '3', label: '=3' }, { key: '4', label: '=4' },
    { key: '5', label: '=5' }, { key: '6', label: '=6' },
    { key: '7', label: '=7' }, { key: '8', label: '=8' },
    { key: '9', label: '=9' }, { key: '10', label: '=10' },
];
export const DEFAULT_RATE_FILTER = 'all';

// ---------- 分页 ----------
export const PAGE_SIZE_OPTIONS = [30, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;

// ---------- 主题 ----------
export const THEME_STORAGE_KEY = 'bgm-viewer:theme';
export const THEME_MODES = ['auto', 'light', 'dark'];
export const THEME_LABELS = { auto: '自动', light: '明亮', dark: '黑暗' };

// ---------- 引导界面 ----------
export const ACCEPT_FILE_TYPES = '.json,.zip,application/json,application/zip';
export const MAX_FILE_SIZE = 200 * 1024 * 1024;
