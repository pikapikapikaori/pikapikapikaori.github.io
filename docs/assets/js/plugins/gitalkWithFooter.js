import { TokenReplacer } from '../utils/tokenReplacer.js'
import { calLocalized } from '../utils/localization.js'
import { makeButtonLike } from '../utils/common.js'

let gitalkWithFooterOptions = {
    footerInnerHtml: '',
    localization: {
        info: {
            '/en-us/': 'Yi-Yang Li',
            '/jp/': '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
            default: '李亦杨'
        },
        copy: {
            '/en-us/': 'All Rights Reserved.',
            '/jp/': '無断転載を禁じます',
            default: '版权所有'
        },
        divider: {
            '/en-us/': ' · ',
            '/jp/': ' ・ ',
            default: ' · '
        }
    },
    gitalkConfig: {
        clientID: '',
        clientSecret: '',
        repo: 'pikapikapi-blog',
        owner: 'pikapikapikaori',
        admin: ['pikapikapikaori',],
        distractionFreeMode: false,
    },
}

function plugin(hook, vm) {
    const pluginIdentifier = 'gitalk_footer'

    const replacer = new TokenReplacer({
        prefix: pluginIdentifier,
    })

    let gitalkContainer, footerDiv

    let gitalkObserver = null
    let gitalkScheduled = false
    let lastInputWasKeyboard = false
    let lastPopupOpen = false
    let lastPopupSnapshot = null
    let pointerOverTrigger = false

    document.addEventListener('keydown', function () {
        lastInputWasKeyboard = true
        if (gitalkContainer) syncRing(gitalkContainer)
    }, true)
    document.addEventListener('pointerdown', function (e) {
        lastInputWasKeyboard = false
        pointerOverTrigger = !!(e.target && e.target.closest && e.target.closest('.gt-user-inner'))
        if (gitalkContainer) syncHover(gitalkContainer)
        for (const ring of document.querySelectorAll('.gt-focus-ring.is-keyboard')) {
            ring.classList.remove('is-keyboard')
        }
    }, true)

    function syncRing(container) {
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

    function capturePopupSnapshot(container) {
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
        const drop = function () {
            if (done) return
            done = true
            ghost.remove()
        }

        ghost.addEventListener('animationend', drop)
        setTimeout(drop, 600)
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

    function dropPopupGhosts(container) {
        for (const ghost of container.querySelectorAll('.gt-popup.is-leaving')) {
            ghost.remove()
        }
    }

    function syncPopupState(container) {
        const inner = container.querySelector('.gt-user-inner')
        const meta = container.querySelector('.gt-meta')
        if (!inner) return

        const popupOpen = !!container.querySelector('.gt-popup:not(.is-leaving)')
        if (popupOpen) dropPopupGhosts(container)
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

    function syncHover(container) {
        const meta = container.querySelector('.gt-meta')
        if (!meta) return
        const hovered = pointerOverTrigger || meta.contains(document.querySelector('.gt-user-name:hover'))
        meta.classList.toggle('is-hover', hovered)
    }

    function updateGitalk(container) {
        enhanceGitalk(container)
        syncHover(container)
        syncPopupState(container)
        syncRing(container)
        capturePopupSnapshot(container)
    }

    function enhanceGitalk(container) {
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

    function observeGitalk(container) {
        if (!container || gitalkObserver) return

        gitalkObserver = new MutationObserver(function (mutations) {
            if (gitalkScheduled) return
            gitalkScheduled = true
            harvestRemovedPopups(mutations)
            updateGitalk(container)
            gitalkScheduled = false
        })
        gitalkObserver.observe(container, { childList: true, subtree: true })

        container.addEventListener('pointerover', function (e) {
            if (!e.target.closest) return
            const inner = e.target.closest('.gt-user-inner')
            if (!inner) return
            if (e.relatedTarget && inner.contains(e.relatedTarget)) return
            pointerOverTrigger = true
            syncHover(container)
        })

        container.addEventListener('pointerout', function (e) {
            if (!e.target.closest) return
            const inner = e.target.closest('.gt-user-inner')
            if (!inner) return
            if (e.relatedTarget && inner.contains(e.relatedTarget)) return
            if (!inner.isConnected) return
            pointerOverTrigger = false
            syncHover(container)
        })

        container.addEventListener('focusin', function () {
            syncRing(container)
        })

        container.addEventListener('focusout', function (e) {
            syncRing(container)
            if (!container.querySelector('.gt-popup:not(.is-leaving)')) return
            if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.gt-meta')) return
            const inner = container.querySelector('.gt-user-inner')
            if (inner) inner.click()
        })

        container.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return
            if (!e.target.closest || !e.target.closest('.gt-user-name')) return
            setTimeout(function () {
                const fresh = container.querySelector('.gt-user-name')
                if (!fresh) return
                if (document.activeElement !== fresh) fresh.focus()
                syncRing(container)
            }, 0)
        })

        window.addEventListener('resize', function () { syncRing(container) })
    }

    function renderFooter(input) {
        const tmpLocalization = calLocalized(gitalkWithFooterOptions.localization)
        Object.keys(tmpLocalization).forEach(key => {
            replacer.unregisterToken(key)
            replacer.registerToken(key, tmpLocalization[key])
        })
        return replacer.replace(input)
    }

    hook.mounted(function () {
        const main = document.getElementById('main')
        if (!main) return
        const parent = main.parentNode

        footerDiv = document.getElementById('footer-under-gitalk')
        if (!footerDiv) {
            let footer = document.createElement('footer')
            footerDiv = document.createElement('div')
            footerDiv.id = 'footer-under-gitalk'
            footer.appendChild(footerDiv)
            parent.appendChild(footer)
        }

        if (typeof Gitalk === 'undefined') return

        gitalkContainer = document.getElementById('gitalk-container')
        if (!gitalkContainer) {
            gitalkContainer = document.createElement('div')
            gitalkContainer.id = 'gitalk-container'
            footerDiv.parentNode.before(gitalkContainer)
        }

        observeGitalk(gitalkContainer)
    })

    hook.doneEach(function () {
        if (!footerDiv) {
            footerDiv = document.getElementById('footer-under-gitalk')
            if (!footerDiv) return
        }

        const footerInnerHtml = renderFooter(gitalkWithFooterOptions.footerInnerHtml)

        footerDiv.innerHTML = `<div>${footerInnerHtml}</div>`

        if (typeof Gitalk === 'undefined') return

        if (!gitalkContainer) {
            gitalkContainer = document.getElementById('gitalk-container')
            if (!gitalkContainer) return
        }

        // render gitalk
        gitalkContainer.innerHTML = ''
        let gitalk = new Gitalk({
            clientID: gitalkWithFooterOptions.gitalkConfig.clientID,
            clientSecret: gitalkWithFooterOptions.gitalkConfig.clientSecret,
            repo: gitalkWithFooterOptions.gitalkConfig.repo,
            owner: gitalkWithFooterOptions.gitalkConfig.owner,
            admin: gitalkWithFooterOptions.gitalkConfig.admin,
            distractionFreeMode: gitalkWithFooterOptions.gitalkConfig.distractionFreeMode,
            id: vm.route.path,
        })
        gitalk.render('gitalk-container')
        enhanceGitalk(gitalkContainer)
        capturePopupSnapshot(gitalkContainer)
    })
}

window.$docsify['gitalkWithFooter'] = Object.assign(
    gitalkWithFooterOptions,
    window.$docsify['gitalkWithFooter']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
