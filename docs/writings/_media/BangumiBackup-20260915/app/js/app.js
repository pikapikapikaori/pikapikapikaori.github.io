import { cache } from './storage.js';
import { normalize } from './model.js';
import { CURRENT_USER_KEY } from './config.js';

export const state = {
    data: null,
    saving: false,
};

export async function tryCache() {
    const savedId = localStorage.getItem(CURRENT_USER_KEY);
    if (savedId) {
        const hit = await cache.get(Number(savedId));
        if (hit) {
            state.data = hit;
            return hit;
        }
    }
    const hit = await cache.latest();
    if (!hit) return null;
    state.data = hit;
    localStorage.setItem(CURRENT_USER_KEY, String(hit.user.id));
    return hit;
}

export async function commitRaw(raw) {
    const norm = normalize(raw);
    const payload = { ...norm, savedAt: Date.now() };
    await cache.set(norm.user.id, payload);
    localStorage.setItem(CURRENT_USER_KEY, String(norm.user.id));
    state.data = payload;
    return payload;
}
