(function () {
    'use strict'

    var App = window.App = window.App || {}
    var S = App.storage = {}

    var PREFIX = 'pikapikapi:'
    var SUFFIX = ':homepage'

    S.NAMES = {
        theme: 'theme',
        lang: 'lang',
        layout: 'layout'
    }

    S.KEYS = {
        theme: 'pikapikapi:theme:homepage',
        lang: 'pikapikapi:lang:homepage',
        layout: 'pikapikapi:layout:homepage'
    }

    function keyOf(name) {
        return S.KEYS[name] || PREFIX + name + SUFFIX
    }

    S.get = function (name) {
        try {
            return window.localStorage.getItem(keyOf(name))
        } catch (e) {
            return null
        }
    }

    S.set = function (name, value) {
        try {
            window.localStorage.setItem(keyOf(name), String(value))
            return true
        } catch (e) {
            return false
        }
    }

    S.remove = function (name) {
        try {
            window.localStorage.removeItem(keyOf(name))
            return true
        } catch (e) {
            return false
        }
    }

    S.getEnum = function (name, allowed, fallback) {
        try {
            var value = S.get(name)
            return allowed.indexOf(value) === -1 ? fallback : value
        } catch (e) {
            return fallback
        }
    }

    S.getBool = function (name, fallback) {
        try {
            var value = S.get(name)

            if (value === 'true' || value === '1') return true
            if (value === 'false' || value === '0') return false

            return fallback
        } catch (e) {
            return fallback
        }
    }

    S.setBool = function (name, value) {
        return S.set(name, value ? 'true' : 'false')
    }

    S.getJSON = function (name, fallback) {
        try {
            var raw = S.get(name)

            return raw === null ? fallback : JSON.parse(raw)
        } catch (e) {
            return fallback
        }
    }

    S.setJSON = function (name, value) {
        try {
            return S.set(name, JSON.stringify(value))
        } catch (e) {
            return false
        }
    }
})()
