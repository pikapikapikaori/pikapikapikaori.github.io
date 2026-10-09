import { TokenReplacer } from '../utils/tokenReplacer.js'
import { calLocalized } from '../utils/localization.js'

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

// Docsify plugin functions
function plugin(hook, vm) {
    const pluginIdentifier = 'gitalk_footer'

    const replacer = new TokenReplacer({
        prefix: pluginIdentifier,
    })

    let gitalkContainer, footerDiv

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
    })
}

// Docsify plugin options
window.$docsify['gitalkWithFooter'] = Object.assign(
    gitalkWithFooterOptions,
    window.$docsify['gitalkWithFooter']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
