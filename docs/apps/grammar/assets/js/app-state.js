/** 全局 UI 状态（非持久数据）；持久数据走各自的 store。 */

import { createStore } from './utils/events.js'

export const appStore = createStore({
    userId: null,
    user: null,
    language: null,
    route: null,
    prevRoute: null,
    /** 顶栏按哪个上下文导航：'user' = 语言列表 / 设置，'welcome' = 首页（从欢迎页进来的文档页） */
    navContext: 'user',
    params: {},
    query: {},
    settings: null
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
    const prevRoute = appStore.get().route
    appStore.set({ route, prevRoute, params: params || {}, query: query || {} })
}

export function setNavContext(navContext) {
    appStore.set({ navContext: navContext === 'welcome' ? 'welcome' : 'user' })
}
