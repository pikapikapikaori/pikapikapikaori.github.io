let CONFIG = {
    auto: true,
    text: 'Top',
    right: 15,
    top: 165,
    offset: 500,
}

function plugin (hook, vm) {
    let opts = vm.config.scrollToTop || CONFIG
    CONFIG.auto = opts.auto && typeof opts.auto === 'boolean' ? opts.auto : CONFIG.auto
    CONFIG.text = opts.text && typeof opts.text === 'string' ? opts.text : CONFIG.text
    CONFIG.right = opts.right && typeof opts.right === 'number' ? opts.right : CONFIG.right
    CONFIG.top = opts.top && typeof opts.top === 'number' ? opts.top : CONFIG.top
    CONFIG.offset = opts.offset && typeof opts.offset === 'number' ? opts.offset : CONFIG.offset

    let onScroll = function (e) {
        if (!CONFIG.auto) {
            return
        }
        let offset = window.document.documentElement.scrollTop
        let $scrollBtn = Docsify.dom.find('span.scroll-to-top')
        $scrollBtn.style.display = offset >= CONFIG.offset ? 'block' : 'none'
    }

    hook.mounted(function () {
        let scrollBtn = document.createElement('span')
        scrollBtn.className = 'scroll-to-top'
        scrollBtn.style.display = CONFIG.auto ? 'none' : 'block'
        scrollBtn.style.overflow = 'hidden'
        scrollBtn.style.position = 'fixed'
        scrollBtn.style.right = CONFIG.right + 'px'
        scrollBtn.style.top = CONFIG.top + 'px'
        scrollBtn.style.color = '#666'
        scrollBtn.style.borderRadius = '4px'
        scrollBtn.style.lineHeight = '42px'
        scrollBtn.style.textAlign = 'center'
        scrollBtn.style.cursor = 'pointer'
        scrollBtn.innerHTML = CONFIG.text
        document.body.appendChild(scrollBtn)
        window.addEventListener('scroll', onScroll)
        scrollBtn.onclick = function (e) {
            e.stopPropagation()
            let step = window.scrollY / 15
            let scroll = function () {
                window.scrollTo(0, window.scrollY - step)
                if (window.scrollY > 0) {
                    setTimeout(scroll, 15)
                }
            }
            scroll()
        }
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
