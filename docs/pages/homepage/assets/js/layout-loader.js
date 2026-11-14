(function () {
    'use strict'

    var App = window.App = window.App || {}
    var L = App.layouts = {}

    var STORAGE_KEY = 'pikapikapi:layout:homepage'
    var current = null
    var requestSeq = 0
    var listeners = []
    /* 动态 import 失败后浏览器会记住失败结果，重试时换一个地址才能重新拉取。 */
    var retryImports = Object.create(null)

    function normalize(id) {
        return App.config.layouts.indexOf(id) === -1 ? null : id
    }

    function readSaved() {
        try {
            return normalize(localStorage.getItem(STORAGE_KEY))
        } catch (e) {
            return null
        }
    }

    function writeSaved(id) {
        try { localStorage.setItem(STORAGE_KEY, id) } catch (e) { /* 忽略：隐私模式下不可写 */ }
    }

    function layoutUrl(id, file) {
        return new URL('./assets/layout/' + id + '/' + file, document.baseURI).href
    }

    function fetchHtml(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.text()
        })
    }

    /* 先以 media="not all" 预载，避免新布局样式在切换完成前生效。 */
    function loadCss(url) {
        return new Promise(function (resolve, reject) {
            var link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = url
            link.media = 'not all'
            link.onload = function () { resolve(link) }
            link.onerror = function () {
                link.remove()
                reject(new Error('CSS load failed: ' + url))
            }
            document.head.appendChild(link)
        })
    }

    function removeLink(link) {
        if (link && link.parentNode) link.parentNode.removeChild(link)
    }

    L.initId = function () {
        return readSaved() || normalize(App.config.defaultLayout) || App.config.layouts[0]
    }

    L.currentId = function () {
        return current ? current.id : null
    }

    /* 布局切换完成后通知监听者，地址栏主题色据此重算。 */
    L.onChange = function (fn) {
        listeners.push(fn)

        return function () {
            var i = listeners.indexOf(fn)
            if (i !== -1) listeners.splice(i, 1)
        }
    }

    function notify() {
        listeners.slice().forEach(function (fn) {
            try { fn(L.currentId()) } catch (e) { /* 忽略单个监听器的错误 */ }
        })
    }

    function setLayoutAttr(value) {
        if (value) {
            document.documentElement.dataset.layout = value
        } else {
            delete document.documentElement.dataset.layout
        }
    }

    /* 失败落点：说明文字与控件槽分离，切换语言只替换文字节点，不会销毁控件。 */
    function renderFallback(root) {
        root.innerHTML =
            '<div class="layout-fallback" role="alert">' +
                '<div class="layout-fallback-text" data-i18n="layout.loadFailed"></div>' +
                '<div class="layout-fallback-controls" data-slot="controls"></div>' +
            '</div>'

        App.i18n.refresh()
        App.controls.attach(root.querySelector('.layout-fallback-controls'))
        App.controls.refresh()
    }

    /* 挂载与度量都要 data-layout 先生效，失败时由调用方回滚该属性。 */
    function mountLayout(instance, root, id, link) {
        link.media = 'all'
        setLayoutAttr(id)
        App.i18n.refresh()
        App.site.apply(root)

        var handle = instance.mount(root)

        if (!handle || typeof handle.unmount !== 'function') {
            throw new Error('Layout mount() returned no handle: ' + id)
        }

        /* 此处 current 尚未更新，控件名称会滞后一个布局；切换提交后在 load 内再刷新一次。 */
        App.controls.attach(root.querySelector('[data-slot="controls"]'))
        App.controls.refresh()

        return handle
    }

    L.load = function (id) {
        id = normalize(id)

        if (!id) {
            return Promise.resolve({ id: L.currentId(), ok: false })
        }

        if (current && current.id === id) {
            return Promise.resolve({ id: id, ok: true, same: true })
        }

        var root = document.getElementById('layoutRoot')

        if (!root) {
            return Promise.resolve({ id: L.currentId(), ok: false })
        }

        var request = ++requestSeq
        var cancelled = false
        var newLink = null
        var jsUrl = layoutUrl(id, 'js/main.js')

        if (retryImports[id]) jsUrl += '?retry=' + retryImports[id]

        function releaseNewLink() {
            cancelled = true
            removeLink(newLink)
            newLink = null
        }

        return Promise.all([
            fetchHtml(layoutUrl(id, 'html/index.html')),
            loadCss(layoutUrl(id, 'css/main.css')).then(function (link) {
                newLink = link
                if (cancelled) removeLink(link)
                return link
            }),
            import(jsUrl)
        ]).then(function (values) {
            var html = values[0]
            var link = values[1]
            var module = values[2]
            var instance = module && module.default ? module.default : module

            if (request !== requestSeq) {
                releaseNewLink()
                return { id: L.currentId(), ok: false, stale: true }
            }

            if (!instance || typeof instance.mount !== 'function') {
                releaseNewLink()
                throw new Error('Layout module has no mount(): ' + id)
            }

            /* 旧 DOM 与旧 link 在挂载成功前保留，失败时回插并重新挂载旧布局。 */
            var previous = current
            var previousNodes = Array.prototype.slice.call(root.childNodes)
            var previousLayout = document.documentElement.dataset.layout || ''
            var handle = null

            try {
                if (previous && previous.handle &&
                    typeof previous.handle.unmount === 'function') {
                    previous.handle.unmount()
                }

                root.innerHTML = html
                handle = mountLayout(instance, root, id, link)
            } catch (err) {
                /* 挂载失败也要换地址重试，否则同 id 重试仍命中浏览器缓存的模块结果。 */
                retryImports[id] = (retryImports[id] || 0) + 1

                if (handle && typeof handle.unmount === 'function') {
                    try { handle.unmount() } catch (e) { /* 忽略回滚中的二次错误 */ }
                }

                releaseNewLink()
                root.innerHTML = ''
                previousNodes.forEach(function (node) { root.appendChild(node) })
                setLayoutAttr(previousLayout)

                if (previous) {
                    try {
                        previous.handle = mountLayout(
                            previous.instance, root, previous.id, previous.link
                        )
                    } catch (e) {
                        previous.handle = null
                        renderFallback(root)
                    }
                } else {
                    renderFallback(root)
                }

                return { id: L.currentId(), ok: false, error: err }
            }

            if (previous) removeLink(previous.link)

            current = { id: id, link: link, instance: instance, handle: handle }
            /* current 与 data-layout 已提交且控件已挂到新布局，此处刷新才能与当前布局一致。 */
            App.controls.refresh()
            /* 仅切换成功回页顶；失败回滚路径不调用，与语言切换共用同一实现。 */
            if (previous) App.utils.scrollToTopInstant()
            notify()

            return { id: id, ok: true }
        }).catch(function (err) {
            releaseNewLink()

            if (request === requestSeq) {
                retryImports[id] = (retryImports[id] || 0) + 1
                console.warn('[layout] 加载失败，保留当前布局：' + id, err.message)

                if (!current) renderFallback(root)
            }

            return { id: L.currentId(), ok: false, error: err }
        })
    }

    L.select = function (id) {
        return L.load(id).then(function (result) {
            if (result.ok) writeSaved(result.id)
            return result
        })
    }
})()
