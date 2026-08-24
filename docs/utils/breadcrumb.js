function plugin(hook, vm) {
    let isReadme = false
    
    hook.afterEach(function (html, next) {

        const curTitleMarkup = '<!-- toc -->'

        const i18nPathList = ['en-us', 'jp',]

        const getJson = (fileName) => {
            let xhttp = new XMLHttpRequest()
            xhttp.open('GET', `${fileName}.json`, false)
            xhttp.send(null)
            return JSON.parse(xhttp.response)
        }

        let parts = location.href.split('#')[1].split('/').slice(1)
        let breadcrumb = '<ul class=\'breadcrumb\'>'
        let curPath = '/'

        let pathNameData = getJson('config/breadcrumbData')

        if (!i18nPathList.includes(parts[0])) {
            if (parts.length == 1 && parts[0] == '') {
                breadcrumb += '<li class=\'active\'>首页</li>'
            }
            else {
                breadcrumb += '<li><a href=\'' + '#' + curPath + '\'>首页</a></li>'
            }
        }

        if (parts[parts.length - 1] === '') {
            parts = parts.slice(0, -1)
            isReadme = true
        }
        else {
            isReadme = false
        }

        parts.forEach(function (part, index) {
            curPath += part + '/'
            let curHrefPath = '#' + curPath

            let matched = pathNameData.find(item => item.path === curPath)

            let secondaryText = part.replace(/\.md$/, '').replace(/[_-]/g, ' ')

            let displayText = matched ? matched.name : secondaryText.charAt(0).toUpperCase() + secondaryText.slice(1)

            if (index < parts.length - 1) {
                breadcrumb += '<li><a href=\'' + curHrefPath + '\'>' + displayText + '</a></li>'
            } else {
                breadcrumb += '<li class=\'active\'>' + displayText + '</li>'
            }
        })

        breadcrumb += '</ul>'

        next(breadcrumb + html)
    })

    hook.doneEach(function () {
        if (!isReadme) {
            document.getElementsByClassName('breadcrumb')[0].getElementsByClassName('active')[0].innerHTML = document.getElementById('main').getElementsByTagName('h1')[0].childNodes[0].childNodes[0].innerHTML
        }
    })
}

if (window) {
    window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
}
