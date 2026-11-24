(function () {
    'use strict'

    const App = window.App = window.App || {}
    const S = App.storage = {}

    const PREFIX = 'pikapikapi:homepage:'

    S.NAMES = {
        theme: 'theme',
        lang: 'lang',
        layout: 'layout'
    }

    S.KEYS = {
        theme: 'pikapikapi:homepage:theme',
        lang: 'pikapikapi:homepage:lang',
        layout: 'pikapikapi:homepage:layout'
    }

    function keyOf(name) {
        return S.KEYS[name] || PREFIX + name
    }

    S.get = function (name) {
        try {
            return window.localStorage.getItem(keyOf(name))
        } catch {
            return null
        }
    }

    S.set = function (name, value) {
        try {
            window.localStorage.setItem(keyOf(name), String(value))
            return true
        } catch {
            return false
        }
    }

    S.remove = function (name) {
        try {
            window.localStorage.removeItem(keyOf(name))
            return true
        } catch {
            return false
        }
    }

    S.getEnum = function (name, allowed, fallback) {
        try {
            const value = S.get(name)
            return allowed.indexOf(value) === -1 ? fallback : value
        } catch {
            return fallback
        }
    }

})()
