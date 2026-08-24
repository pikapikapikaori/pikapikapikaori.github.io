import pathNameData from '../config/tocdata.json.js'

function plugin(hook, vm) {
    hook.afterEach(async function (html, next) {

        let updated = '---'

        let path = vm.route.file.split('.')[0].replace(/(?:^|\/)(README)$/, '/')

        let file = path === '/' ? '/' : '/' + path

        let matched = pathNameData.find(item => item.href === file)

        updated = matched ? matched.editedTime : '---'

        next(html.replace(/{docsify-last-updated}/g, updated))
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
