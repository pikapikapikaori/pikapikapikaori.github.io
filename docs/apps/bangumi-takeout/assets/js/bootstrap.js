import { tryCache } from './app.js'
import { loadDefaultSource, storagePrefix } from './config.js'
import { loadExternal } from './external.js'

// The shell shows before a user is chosen; the collection page draws its own welcome card.
export async function boot({ render }) {
    const appEl = document.getElementById('app')
    if (appEl) appEl.hidden = false

    await loadExternal({ storagePrefix })
    await loadDefaultSource()
    try {
        await tryCache()
    } catch {}

    await render()
}
