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
    let pointerOverTrigger = false

    document.addEventListener('keydown', function () {
        lastInputWasKeyboard = true
        if (gitalkContainer) syncRing(gitalkContainer)
    }, true)
    document.addEventListener('pointerdown', function (e) {
        lastInputWasKeyboard = false
        pointerOverTrigger = !!(e.target && e.target.closest && e.target.closest('.gt-user-inner'))
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

    function syncPopupState(container) {
        const inner = container.querySelector('.gt-user-inner')
        if (!inner || inner.dataset.popupSynced === '1') return
        inner.dataset.popupSynced = '1'

        const name = container.querySelector('.gt-user-name')
        const hovered = pointerOverTrigger || (!!name && name.matches(':hover'))
        if (hovered && name) name.classList.add('is-hover')

        const popupOpen = !!container.querySelector('.gt-popup')
        inner.classList.toggle('is-popup-open', lastPopupOpen)
        void inner.offsetWidth
        requestAnimationFrame(function () {
            inner.classList.toggle('is-popup-open', popupOpen)
            lastPopupOpen = popupOpen
            if (hovered && name.isConnected) name.classList.remove('is-hover')
        })
    }

    function updateGitalk(container) {
        enhanceGitalk(container)
        syncPopupState(container)
        syncRing(container)
    }

    function enhanceGitalk(container) {
        const userName = container.querySelector('.gt-user-inner .gt-user-name')
        if (userName) makeButtonLike(userName)

        for (const action of container.querySelectorAll('.gt-popup .gt-action')) {
            makeButtonLike(action)
        }

        for (const icon of container.querySelectorAll('.gt-comment-like, .gt-comment-reply, .gt-comment-edit')) {
            makeButtonLike(icon)
        }

        for (const copyright of container.querySelectorAll('.gt-popup .gt-copyright')) {
            copyright.removeAttribute('role')
            copyright.removeAttribute('tabindex')
            const version = copyright.querySelector('.gt-version')
            if (version) version.removeAttribute('tabindex')
        }

        const meta = container.querySelector('.gt-meta')
        const popup = meta && meta.querySelector(':scope > .gt-popup')
        const user = meta && meta.querySelector(':scope > .gt-user')
        if (popup && user && popup !== user.nextElementSibling) {
            meta.insertBefore(popup, user.nextSibling)
        }
    }

    function observeGitalk(container) {
        if (!container || gitalkObserver) return

        gitalkObserver = new MutationObserver(function () {
            if (gitalkScheduled) return
            gitalkScheduled = true
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
        })

        container.addEventListener('pointerout', function (e) {
            if (!e.target.closest) return
            const inner = e.target.closest('.gt-user-inner')
            if (!inner) return
            if (e.relatedTarget && inner.contains(e.relatedTarget)) return
            pointerOverTrigger = false
        })

        container.addEventListener('focusin', function () {
            syncRing(container)
        })

        container.addEventListener('focusout', function (e) {
            syncRing(container)
            if (!container.querySelector('.gt-popup')) return
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
    })
}

window.$docsify['gitalkWithFooter'] = Object.assign(
    gitalkWithFooterOptions,
    window.$docsify['gitalkWithFooter']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
