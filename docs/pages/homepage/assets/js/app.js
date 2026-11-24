(function () {
    'use strict'

    const App = window.App

    function syncMeta() {
        const id = App.layouts.currentId() || App.layouts.initId()
        const theme = App.theme.effective()
        const colors = App.config.metaColors || {}
        const color = colors[id] ? colors[id][theme] : null

        const meta = document.getElementById('themeColorMeta')
        if (meta && color) meta.setAttribute('content', color)
    }

    function boot() {
        App.theme.init()
        App.i18n.init()
        App.controls.create()

        App.i18n.onChange(function () {
            App.controls.refresh()
        })

        App.theme.onChange(function () {
            App.controls.refresh()
            syncMeta()
        })

        App.layouts.onChange(syncMeta)
        syncMeta()

        App.layouts.load(App.layouts.initId())
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot)
    } else {
        boot()
    }
})()
