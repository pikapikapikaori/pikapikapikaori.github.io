import * as grammar from './grammar.js'
import { appStore } from '../app-state.js'
import { deleteDB } from '../store/db.js'
import { clearHttpCache } from '../store/http-cache.js'
import { languageStats } from '../services/word-service.js'
import { GRAMMAR_FILES } from '../config/config.js'

export function createDevTools() {
    return {
        ...grammar,
        state: () => JSON.parse(JSON.stringify(appStore.get())),
        route: () => location.hash,
        deleteDB: async () => {
            await deleteDB()
            location.reload()
        },
        clearHttpCache,
        stats: async (userId = appStore.get().userId, langs = GRAMMAR_FILES) => {
            const out = {}
            for (const code of langs) out[code] = await languageStats(userId, code)
            return out
        }
    }
}
