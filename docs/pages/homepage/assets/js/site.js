/*
 * 站点地址只从 config.js 读取：布局用 data-link 标记邮箱，
 * 用 data-logo 标记图片，模板里不写死地址。
 */
(function () {
    'use strict'

    var App = window.App = window.App || {}
    var S = App.site = {}
    var CFG = App.config

    S.apply = function (root) {
        if (!root) return

        root.querySelectorAll('[data-link]').forEach(function (el) {
            if (el.dataset.link === 'email' && CFG.emailHref) {
                el.setAttribute('href', CFG.emailHref)
            }
        })

        root.querySelectorAll('[data-logo]').forEach(function (el) {
            if (CFG.logoSrc) el.setAttribute('src', CFG.logoSrc)
        })
    }
})()
