import { THEME_STORAGE_KEY, THEME_MODES } from './config.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

function resolve(mode) {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    return mq.matches ? 'dark' : 'light';
}

export function applyTheme(mode) {
    if (!THEME_MODES.includes(mode)) mode = 'auto';
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    const real = resolve(mode);
    document.documentElement.dataset.theme = real;
    document.documentElement.dataset.themeMode = mode;
}

export function getTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(saved) ? saved : 'auto';
}

export function initTheme() {
    applyTheme(getTheme());
    mq.addEventListener('change', () => {
        if (getTheme() === 'auto') applyTheme('auto');
    });
}
