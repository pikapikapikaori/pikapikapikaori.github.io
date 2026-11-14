/*
 * 照片读取、切片与预加载。清单、地址与数量在 config.js，三种语言共用同一组。
 * 路径以入口 index.html 为基准解析。
 */
(function () {
    'use strict'

    var App = window.App = window.App || {}
    var Photos = App.photos = {}

    var warmed = {}

    /* 全部照片，不截取，供不受 photoLimit 约束的布局读取。 */
    Photos.all = function () {
        return App.config.photos || []
    }

    /* 照片不足 photoLimit 时全部返回，超过才截取前 photoLimit 张。 */
    Photos.list = function () {
        var limit = App.config.photoLimit
        var list = Photos.all()

        return limit > 0 && list.length > limit ? list.slice(0, limit) : list
    }

    /* 预加载公共布局用到的图片；已请求过的不再重复创建。 */
    Photos.preload = function () {
        Photos.list().forEach(function (photo) {
            if (!photo.src || warmed[photo.src]) return

            warmed[photo.src] = true
            var img = new Image()
            img.decoding = 'async'
            img.src = photo.src
        })
    }
})()
