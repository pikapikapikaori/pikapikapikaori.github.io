(function () {
    'use strict'

    var App = window.App

    function syncMeta() {
        var id = App.layouts.currentId() || App.layouts.initId()
        var theme = App.theme.effective()
        var colors = App.config.metaColors || {}
        var color = colors[id] ? colors[id][theme] : null

        var meta = document.getElementById('themeColorMeta')
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
