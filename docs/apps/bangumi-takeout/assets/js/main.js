import { boot } from './bootstrap.js'
import { renderLayout } from './layout.js'
import { startRouter } from './router.js'

// Startup runs once; the router owns the main region afterwards.
boot({
    render: async () => {
        renderLayout()
        startRouter()
    },
})
