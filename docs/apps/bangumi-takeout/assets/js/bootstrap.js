import { tryCache } from './app.js'
import { loadDefaultSource } from './config.js'

// The shell is always shown, even without a selected user: the collection page
// draws its own welcome card so navigation stays identical before and after a
// user is chosen.
export async function boot({ render }) {
    const appEl = document.getElementById('app')
    if (appEl) appEl.hidden = false

    await loadDefaultSource()
    try {
        await tryCache()
    } catch {}

    await render()
}
