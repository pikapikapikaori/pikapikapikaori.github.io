(function () {
    'use strict'

    if (!('serviceWorker' in navigator) || !window.isSecureContext) return

    import('./client.js').then(function (mod) {
        mod.connect({ swUrl: './sw.js' })
    }).catch(function () {})
})()
