import { boot } from './bootstrap.js'
import { renderLayout } from './layout.js'
import { startRouter } from './router.js'

boot({
    render: async () => {
        renderLayout()
        startRouter()
    },
})
