import { tryCache } from './app.js'
import { loadDefaultSource } from './config.js'

// The shell shows before a user is chosen; the collection page draws its own welcome card.
export async function boot({ render }) {
    const appEl = document.getElementById('app')
    if (appEl) appEl.hidden = false

    await loadDefaultSource()
    try {
        await tryCache()
    } catch {}

    await render()
}
