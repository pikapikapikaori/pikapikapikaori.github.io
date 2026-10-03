// default values
let footerOptions = {
    html: ''
}

// Docsify plugin functions
function plugin(hook, vm) {
    hook.doneEach(function () {
        const main = document.getElementById('main')
        if (!main) return
        const parent = main.parentNode

        // 若没有footer，则在gitalk容器下方重新添加footer
        let previousFooter = document.getElementById('footer-bottom')
        if (!previousFooter) {
            let footer = document.createElement('footer')
            let footerDiv = document.createElement('div')
            footerDiv.id = 'footer-bottom'
            footerDiv.innerHTML = footerOptions.html
            footer.appendChild(footerDiv)
            parent.appendChild(footer)
        }
    })
}

// Docsify plugin options
window.$docsify['footer'] = Object.assign(
    footerOptions,
    window.$docsify['footer']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
