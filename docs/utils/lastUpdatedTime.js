function plugin(hook, vm) {
    hook.afterEach(async function (html, next) {
        const getJson = (fileName) => {
            let xhttp = new XMLHttpRequest()
            xhttp.open('GET', `${fileName}.json`, false)
            xhttp.send(null)
            return JSON.parse(xhttp.response)
        }

        var updated = '---'

        let pathNameData = getJson('config/tocdata')

        let path = vm.route.file.split('.')[0].replace(/(?:^|\/)(README)$/, '/')

        let file = path === '/' ? '/' : '/' + path

        var matched = pathNameData.find(item => item.href === file)

        updated = matched ? matched.editedTime : '---'

        next(html.replace(/{docsify-last-updated}/g, updated))
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
