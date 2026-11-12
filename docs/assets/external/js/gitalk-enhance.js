import { makeButtonLike } from '../../js/utils/common.js'

const gitalkBaseUrl = new URL('../../sources/npm/gitalk/dist/', import.meta.url).href
const gitalkCssUrl = new URL('gitalk.css', gitalkBaseUrl).href
const gitalkEnhanceCssUrl = new URL('../css/gitalk-enhance.css', import.meta.url).href
const gitalkJsUrl = new URL('gitalk.min.js', gitalkBaseUrl).href

let gitalkLoadPromise = null
let detachInteraction = null

function loadCss(href) {
    const loaded = document.querySelector('link[data-comment-stylesheet="' + href + '"]')
    if (loaded) return Promise.resolve(true)

    return new Promise(resolve => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.dataset.commentStylesheet = href
        link.onload = () => resolve(true)
        link.onerror = () => resolve(false)
        document.head.appendChild(link)
    })
}

function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(true)

    const loaded = document.querySelector('script[data-comment-script="' + src + '"]')
    if (loaded) {
        if (loaded.dataset.loaded === '1') {
            return Promise.resolve(globalName ? !!window[globalName] : true)
        }

        return new Promise(resolve => {
            loaded.addEventListener('load', () => resolve(true), { once: true })
            loaded.addEventListener('error', () => resolve(false), { once: true })
        })
    }

    return new Promise(resolve => {
        const script = document.createElement('script')
        script.src = src
        script.dataset.commentScript = src
        script.onload = () => {
            script.dataset.loaded = '1'
            resolve(true)
        }
        script.onerror = () => resolve(false)
        document.head.appendChild(script)
    })
}

function loadGitalk() {
    if (gitalkLoadPromise) return gitalkLoadPromise

    gitalkLoadPromise = Promise.all([
        loadCss(gitalkCssUrl),
        loadCss(gitalkEnhanceCssUrl),
        loadScript(gitalkJsUrl, 'Gitalk')
    ]).then(() => {
        if (!window.Gitalk) return null

        return {
            Gitalk: window.Gitalk
        }
    }).catch(() => null)

    return gitalkLoadPromise
}

function attachGitalkInteraction(container) {
    if (!container) return function () {}

    const controller = new AbortController()
    const signal = controller.signal

    const popupTimers = new Set()

    let observer = null
    let scheduled = false
    let lastInputWasKeyboard = false
    let lastPopupOpen = false
    let lastPopupSnapshot = null
    let pointerOverTrigger = false

    document.addEventListener('keydown', function () {
        lastInputWasKeyboard = true
        syncRing()
    }, { capture: true, signal })

    document.addEventListener('pointerdown', function (e) {
        lastInputWasKeyboard = false
        pointerOverTrigger = !!(e.target && e.target.closest && e.target.closest('.gt-user-inner'))
        syncHover()

        for (const ring of container.querySelectorAll('.gt-focus-ring.is-keyboard')) {
            ring.classList.remove('is-keyboard')
        }
    }, { capture: true, signal })

    function syncRing() {
        const meta = container.querySelector('.gt-meta')
        const name = container.querySelector('.gt-user-name')
        if (!meta || !name) return

        let ring = meta.querySelector(':scope > .gt-focus-ring')
        if (!ring) {
            ring = document.createElement('span')
            ring.className = 'gt-focus-ring'
            meta.appendChild(ring)
        }

        const metaRect = meta.getBoundingClientRect()
        const nameRect = name.getBoundingClientRect()
        ring.style.setProperty('--gitalk-ring-top', (nameRect.top - metaRect.top) + 'px')
        ring.style.setProperty('--gitalk-ring-left', (nameRect.left - metaRect.left) + 'px')
        ring.style.setProperty('--gitalk-ring-width', nameRect.width + 'px')
        ring.style.setProperty('--gitalk-ring-height', nameRect.height + 'px')

        const focused = document.activeElement === name
        ring.classList.toggle('is-keyboard', focused && lastInputWasKeyboard)
    }

    function capturePopupSnapshot() {
        const popup = container.querySelector('.gt-popup:not(.is-leaving)')
        if (!popup || !popup.querySelector('.gt-action')) return
        lastPopupSnapshot = popup.cloneNode(true)
    }

    function spawnPopupGhost(node, parent) {
        if (!parent || !parent.isConnected) return

        const source = lastPopupSnapshot && lastPopupSnapshot.querySelector('.gt-action')
            ? lastPopupSnapshot
            : node
        const ghost = source.cloneNode(true)
        ghost.classList.add('is-leaving')
        ghost.setAttribute('aria-hidden', 'true')
        ghost.setAttribute('inert', '')
        ghost.style.pointerEvents = 'none'

        for (const el of ghost.querySelectorAll('[tabindex], [role], [id]')) {
            el.removeAttribute('tabindex')
            el.removeAttribute('role')
            el.removeAttribute('id')
        }

        parent.appendChild(ghost)

        let done = false
        let timer = null
        const drop = function () {
            if (done) return
            done = true
            if (timer !== null) popupTimers.delete(timer)
            ghost.remove()
        }

        ghost.addEventListener('animationend', drop)
        timer = setTimeout(drop, 600)
        popupTimers.add(timer)
    }

    function harvestRemovedPopups(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node.nodeType === 1 && node.classList.contains('gt-popup') && !node.classList.contains('is-leaving')) {
                    spawnPopupGhost(node, mutation.target)
                }
            }
        }
    }

    function dropPopupGhosts() {
        for (const ghost of container.querySelectorAll('.gt-popup.is-leaving')) {
            ghost.remove()
        }
    }

    function syncPopupState() {
        const inner = container.querySelector('.gt-user-inner')
        const meta = container.querySelector('.gt-meta')
        if (!inner) return

        const popupOpen = !!container.querySelector('.gt-popup:not(.is-leaving)')
        if (popupOpen) dropPopupGhosts()
        if (meta) meta.classList.toggle('is-popup-open', popupOpen)

        if (inner.dataset.popupSynced === '1') return
        inner.dataset.popupSynced = '1'

        inner.classList.toggle('is-popup-open', lastPopupOpen)
        void inner.offsetWidth
        requestAnimationFrame(function () {
            inner.classList.toggle('is-popup-open', popupOpen)
            lastPopupOpen = popupOpen
        })
    }

    function syncHover() {
        const meta = container.querySelector('.gt-meta')
        if (!meta) return
        const hovered = pointerOverTrigger || meta.contains(container.querySelector('.gt-user-name:hover'))
        meta.classList.toggle('is-hover', hovered)
    }

    function updateGitalk() {
        enhanceGitalk()
        syncHover()
        syncPopupState()
        syncRing()
        capturePopupSnapshot()
    }

    function enhanceGitalk() {
        const userName = container.querySelector('.gt-user-inner .gt-user-name')
        if (userName) makeButtonLike(userName)

        for (const action of container.querySelectorAll('.gt-popup:not(.is-leaving) .gt-action')) {
            makeButtonLike(action)
        }

        for (const icon of container.querySelectorAll('.gt-comment-like, .gt-comment-reply, .gt-comment-edit')) {
            makeButtonLike(icon)
        }

        for (const copyright of container.querySelectorAll('.gt-popup:not(.is-leaving) .gt-copyright')) {
            copyright.removeAttribute('role')
            copyright.removeAttribute('tabindex')
            const version = copyright.querySelector('.gt-version')
            if (version) version.removeAttribute('tabindex')
        }

        const meta = container.querySelector('.gt-meta')
        const popup = meta && meta.querySelector(':scope > .gt-popup:not(.is-leaving)')
        const user = meta && meta.querySelector(':scope > .gt-user')
        if (popup && user && popup !== user.nextElementSibling) {
            meta.insertBefore(popup, user.nextSibling)
        }
    }

    observer = new MutationObserver(function (mutations) {
        if (scheduled) return
        scheduled = true
        harvestRemovedPopups(mutations)
        updateGitalk()
        scheduled = false
    })
    observer.observe(container, { childList: true, subtree: true })

    container.addEventListener('pointerover', function (e) {
        if (!e.target.closest) return
        const inner = e.target.closest('.gt-user-inner')
        if (!inner) return
        if (e.relatedTarget && inner.contains(e.relatedTarget)) return
        pointerOverTrigger = true
        syncHover()
    }, { signal })

    container.addEventListener('pointerout', function (e) {
        if (!e.target.closest) return
        const inner = e.target.closest('.gt-user-inner')
        if (!inner) return
        if (e.relatedTarget && inner.contains(e.relatedTarget)) return
        if (!inner.isConnected) return
        pointerOverTrigger = false
        syncHover()
    }, { signal })

    container.addEventListener('focusin', function () {
        syncRing()
    }, { signal })

    container.addEventListener('focusout', function (e) {
        syncRing()
        if (!container.querySelector('.gt-popup:not(.is-leaving)')) return
        if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.gt-meta')) return
        const inner = container.querySelector('.gt-user-inner')
        if (inner) inner.click()
    }, { signal })

    container.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return
        if (!e.target.closest || !e.target.closest('.gt-user-name')) return
        setTimeout(function () {
            const fresh = container.querySelector('.gt-user-name')
            if (!fresh) return
            if (document.activeElement !== fresh) fresh.focus()
            syncRing()
        }, 0)
    }, { signal })

    window.addEventListener('resize', function () {
        syncRing()
    }, { signal })

    updateGitalk()

    return function detach() {
        controller.abort()
        if (observer) observer.disconnect()
        for (const timer of popupTimers) clearTimeout(timer)
        popupTimers.clear()

        for (const el of container.querySelectorAll('.gt-focus-ring, .gt-popup.is-leaving')) {
            el.remove()
        }

        const meta = container.querySelector('.gt-meta')
        if (meta) meta.classList.remove('is-hover', 'is-popup-open')
    }
}

const gitalkProvider = {
    type: 'gitalk',

    preload() {
        loadGitalk()
    },

    mount(container, ctx) {
        if (!container) return

        loadGitalk().then(api => {
            if (!api) return
            if (ctx.isStale()) return
            if (!container.isConnected) return

            container.innerHTML = ''

            const gitalkConfig = ctx.config.gitalkConfig || {}
            const gitalk = new api.Gitalk({
                clientID: gitalkConfig.clientID,
                clientSecret: gitalkConfig.clientSecret,
                repo: gitalkConfig.repo,
                owner: gitalkConfig.owner,
                admin: gitalkConfig.admin,
                distractionFreeMode: gitalkConfig.distractionFreeMode,
                id: ctx.vm.route.path,
            })
            gitalk.render(container.id)

            detachInteraction = attachGitalkInteraction(container)
        })
    },

    destroy(container) {
        if (detachInteraction) {
            detachInteraction()
            detachInteraction = null
        }

        if (container) {
            container.innerHTML = ''
        }
    }
}

export default gitalkProvider
