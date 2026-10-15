/**
 * Hash 路由
 *
 * 用法：
 *   const router = createRouter([{ path: '/lang/:lang/words', view: () => import(...) }]);
 *   router.start();
 *   router.navigate('/lang/la/words');
 */

import { createEmitter } from './utils/events.js'

export function createRouter(routes) {
    const bus = createEmitter()
    let current = null
    let stopped = false

    function parseHash() {
        const raw = location.hash.replace(/^#/, '') || '/welcome'
        const [pathPart, queryPart] = raw.split('?')
        const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
        const query = {}
        if (queryPart) {
            for (const kv of queryPart.split('&')) {
                if (!kv) continue
                const [k, v = ''] = kv.split('=')
                query[decodeURIComponent(k)] = decodeURIComponent(v)
            }
        }
        return { path: path.replace(/\/+$/, '') || '/', query }
    }

    function match(path) {
        for (const r of routes) {
            const params = matchPattern(r.path, path)
            if (params) return { route: r, params }
        }
        return null
    }

    function matchPattern(pattern, path) {
        if (pattern === path) return {}
        const pp = pattern.split('/').filter(Boolean)
        const xp = path.split('/').filter(Boolean)
        if (pp.length !== xp.length) return null
        const params = {}
        for (let i = 0; i < pp.length; i++) {
            const a = pp[i]
            const b = xp[i]
            if (a.startsWith(':')) params[a.slice(1)] = decodeURIComponent(b)
            else if (a !== b) return null
        }
        return params
    }

    async function resolve() {
        if (stopped) return
        const { path, query } = parseHash()
        const hit = match(path)
        if (!hit) {
            current = null
            bus.emit('notfound', { path, query })
            return
        }
        const ctx = { path, query, params: hit.params || {} }
        current = ctx
        bus.emit('before', ctx)
        try {
            await hit.route.view(ctx)
        } catch (err) {
            console.error('[router] 视图加载失败', err)
            bus.emit('error', { error: err, ctx })
        }
        bus.emit('after', ctx)
    }

    function onHashChange() { resolve() }

    return {
        start() {
            stopped = false
            window.addEventListener('hashchange', onHashChange)
            if (!location.hash) {
                location.replace('#/welcome')
            } else {
                resolve()
            }
            return this
        },
        stop() {
            stopped = true
            window.removeEventListener('hashchange', onHashChange)
        },
        navigate(to, { replace = false } = {}) {
            const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : '/' + to}`
            if (replace) location.replace(target)
            else location.hash = target
        },
        back() { history.back() },
        getCurrent() { return current },
        onChange(fn) { return bus.on('after', fn) },
        onBefore(fn) { return bus.on('before', fn) },
        onNotFound(fn) { return bus.on('notfound', fn) },
        onError(fn) { return bus.on('error', fn) }
    }
}
