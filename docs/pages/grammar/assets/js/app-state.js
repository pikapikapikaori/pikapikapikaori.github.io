/** 全局 UI 状态（非持久数据）；持久数据走各自的 store。 */

import { createStore } from './utils/events.js'

export const appStore = createStore({
    userId: null,
    user: null,
    language: null,
    route: null,
    params: {},
    query: {},
    settings: null,
    ready: false
})

export function setUser(user) {
    appStore.set({ user, userId: user ? user.id : null })
}

export function setLanguage(lang) {
    appStore.set({ language: lang || null })
}

export function setSettings(settings) {
    appStore.set({ settings })
}

export function setRoute(route, params, query) {
    appStore.set({ route, params: params || {}, query: query || {} })
}
