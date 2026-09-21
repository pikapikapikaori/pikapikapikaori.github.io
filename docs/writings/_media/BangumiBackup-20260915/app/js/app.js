import { cache } from './storage.js';
import { normalize } from './model.js';

export const state = {
    data: null,
    saving: false,
};

export async function tryCache() {
    const hit = await cache.latest();
    if (!hit) return null;
    state.data = hit;
    return hit;
}

export async function commitRaw(raw) {
    const norm = normalize(raw);
    const payload = { ...norm, savedAt: Date.now() };
    await cache.set(norm.user.id, payload);
    state.data = payload;
    return payload;
}
