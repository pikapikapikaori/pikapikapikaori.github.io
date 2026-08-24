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
    hook.doneEach(function () {
        // 若没有gitalk容器，则添加gitalk容器重新
        let previousGitalk = document.getElementById('gitalk-container')
        if (!previousGitalk) {
            let gitalkContainer = document.createElement('div')
            gitalkContainer.id = 'gitalk-container'
            gitalkContainer.style.maxWidth = '800px'
            gitalkContainer.style.width = '80%'
            gitalkContainer.style.margin = '0px auto 20px'
            gitalkContainer.style.padding = '0 15px 0'
            document.getElementById('main').parentNode.insertBefore(gitalkContainer, undefined)
        }

        // 若没有footer，则在gitalk容器下方重新添加footer
        let previousFooter = document.getElementById('footer-under-gitalk')
        if (!previousFooter) {
            let footer = document.createElement('footer')
            let footerDiv = document.createElement('div')
            footerDiv.id = 'footer-under-gitalk'
            footerDiv.innerHTML = gitalkWithFooterOptions.footerInnerHtml
            footer.appendChild(footerDiv)
            document.getElementById('main').parentNode.insertBefore(footer, undefined)
        }

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
            id: location.href.split('#')[1].split('?')[0],
        })
        gitalk.render('gitalk-container')
    })
}

// Docsify plugin options
window.$docsify['gitalkWithFooter'] = Object.assign(
    gitalkWithFooterOptions,
    window.$docsify['gitalkWithFooter']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
