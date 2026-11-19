(function () {
    'use strict'

    const App = window.App = window.App || {}
    const Photos = App.photos = {}

    const warmed = {}

    Photos.all = function () {
        return App.config.photos || []
    }

    Photos.list = function () {
        const limit = App.config.photoLimit
        const list = Photos.all()

        return limit > 0 && list.length > limit ? list.slice(0, limit) : list
    }

    /* 预加载公共布局用到的图片；已请求过的不再重复创建。 */
    Photos.preload = function () {
        Photos.list().forEach(function (photo) {
            if (!photo.src || warmed[photo.src]) return

            warmed[photo.src] = true
            const img = new Image()
            img.decoding = 'async'
            img.src = photo.src
        })
    }
})()
