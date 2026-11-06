/** 调试入口：把辅助函数挂到 window.__ln.dev。 */

import * as grammar from './grammar.js'
import { appStore } from '../app-state.js'
import { deleteDB } from '../store/db.js'
import { clearHttpCache } from '../store/http-cache.js'
import { languageStats } from '../services/word-service.js'
import { GRAMMAR_FILES } from '../config/config.js'

export function createDevTools() {
    return {
        ...grammar,
        /** 当前 UI 状态（深拷贝，改了不影响应用） */
        state: () => JSON.parse(JSON.stringify(appStore.get())),
        /** 当前路由 */
        route: () => location.hash,
        /** 删掉整个 IndexedDB 库（含用户、词条、设置、HTTP 缓存），调试用 */
        deleteDB: async () => {
            await deleteDB()
            location.reload()
        },
        /** 清外部源的 HTTP 响应缓存 */
        clearHttpCache,
        /** 某个用户在若干语言下的词条统计 */
        stats: async (userId = appStore.get().userId, langs = GRAMMAR_FILES) => {
            const out = {}
            for (const code of langs) out[code] = await languageStats(userId, code)
            return out
        }
    }
}
