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
    let gitalkHadPopup = false
    let lastInputWasKeyboard = false

    document.addEventListener('keydown', function () { lastInputWasKeyboard = true }, true)
    document.addEventListener('pointerdown', function () { lastInputWasKeyboard = false }, true)

    function enhanceGitalk(container) {
        const inner = container.querySelector('.gt-user-inner')
        if (inner) makeButtonLike(inner)

        for (const action of container.querySelectorAll('.gt-popup .gt-action')) {
            makeButtonLike(action)
        }

        for (const icon of container.querySelectorAll('.gt-comment-like, .gt-comment-reply, .gt-comment-edit')) {
            makeButtonLike(icon)
        }

        for (const copyright of container.querySelectorAll('.gt-popup .gt-copyright')) {
            copyright.removeAttribute('role')
            copyright.removeAttribute('tabindex')
        }

        const meta = container.querySelector('.gt-meta')
        const popup = meta && meta.querySelector(':scope > .gt-popup')
        const user = meta && meta.querySelector(':scope > .gt-user')
        if (popup && user && popup !== user.nextElementSibling) {
            meta.insertBefore(popup, user.nextSibling)
        }

        const popupOpen = !!popup
        if (popupOpen && !gitalkHadPopup && lastInputWasKeyboard && document.activeElement === document.body) {
            const fresh = container.querySelector('.gt-user-inner')
            if (fresh) fresh.focus()
        }
        gitalkHadPopup = popupOpen
    }

    function observeGitalk(container) {
        if (!container || gitalkObserver) return

        gitalkObserver = new MutationObserver(function () {
            if (gitalkScheduled) return
            gitalkScheduled = true
            enhanceGitalk(container)
            gitalkScheduled = false
        })
        gitalkObserver.observe(container, { childList: true, subtree: true })

        container.addEventListener('focusout', function (e) {
            if (!container.querySelector('.gt-popup')) return
            if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.gt-meta')) return
            const inner = container.querySelector('.gt-user-inner')
            if (inner) inner.click()
        })
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
