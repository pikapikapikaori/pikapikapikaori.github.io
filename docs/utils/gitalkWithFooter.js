// default values
let gitalkWithFooterOptions = {
    footerInnerHtml: '',
    gitalkConfig: {
        clientID: '',
        clientSecret: '',
        repo: 'pikapikapi-blog',
        owner: 'pikapikapikaori',
        admin: ['pikapikapikaori',],
        // facebook-like distraction free mode
        distractionFreeMode: false,
    },
}

// Docsify plugin functions
function plugin(hook, vm) {
    function renderFooterDate(input, date = new Date()) {
        const pad = n => String(n).padStart(2, '0')

        const replacements = {
            yyyy: String(date.getFullYear()),
            mm: pad(date.getMonth() + 1), // 月份
            dd: pad(date.getDate()),
        }

        return input.replace(/\{gitalk-footer-([^}]+)\}/g, (_, expr) => {
            return expr.replace(
                /(?<![a-zA-Z])(yyyy|mm|dd)(?![a-zA-Z])/g,
                key => replacements[key]
            )
        })
    }

    hook.doneEach(function () {
        const main = document.getElementById('main')
        if (!main) return
        const parent = main.parentNode

        // 若没有gitalk容器，则添加gitalk容器重新
        let previousGitalk = document.getElementById('gitalk-container')
        if (!previousGitalk) {
            let gitalkContainer = document.createElement('div')
            gitalkContainer.id = 'gitalk-container'
            parent.appendChild(gitalkContainer)
        }

        const footerInnerHtml = renderFooterDate(gitalkWithFooterOptions.footerInnerHtml)

        // 若没有footer，则在gitalk容器下方重新添加footer
        let previousFooter = document.getElementById('footer-under-gitalk')
        if (!previousFooter) {
            let footer = document.createElement('footer')
            let footerDiv = document.createElement('div')
            footerDiv.id = 'footer-under-gitalk'
            footerDiv.innerHTML = `<div>${footerInnerHtml}</div>`
            footer.appendChild(footerDiv)
            parent.appendChild(footer)
        }

        if (typeof Gitalk === 'undefined') return

        // render gitalk
        document.getElementById('gitalk-container').innerHTML = ''
        let gitalk = new Gitalk({
            clientID: gitalkWithFooterOptions.gitalkConfig.clientID,
            clientSecret: gitalkWithFooterOptions.gitalkConfig.clientSecret,
            repo: gitalkWithFooterOptions.gitalkConfig.repo,
            owner: gitalkWithFooterOptions.gitalkConfig.owner,
            admin: gitalkWithFooterOptions.gitalkConfig.admin,
            // facebook-like distraction free mode
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
