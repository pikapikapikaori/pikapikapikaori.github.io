import { boot } from './bootstrap.js'
import { renderLayout } from './layout.js'
import { startRouter } from './router.js'

// Single entry point: startup work runs once, then the router owns the main
// region for the rest of the session.
boot({
    render: async () => {
        renderLayout()
        startRouter()
    },
})
