// default values
let footerOptions = {
    html: ''
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

        const footerInnerHtml = renderFooterDate(footerOptions.html)

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
    })
}

// Docsify plugin options
window.$docsify['footer'] = Object.assign(
    footerOptions,
    window.$docsify['footer']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
