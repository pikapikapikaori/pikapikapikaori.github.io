import { TokenReplacer } from '../utils/tokenReplacer.js'
import { calLocalized } from '../utils/localization.js'

let commentWithFooterOptions = {
    use: 'gitalk',
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

const commentContainerId = 'comment-container'
const footerId = 'footer-under-comment'

const providerFileNames = {
    gitalk: 'gitalk-enhance.js'
}

const providerCache = new Map()

function resolveProviderUrl(name) {
    const fileName = providerFileNames[name]
    if (!fileName) return null
    return new URL('../../external/js/' + fileName, import.meta.url).href
}

function loadProvider(name) {
    if (providerCache.has(name)) return providerCache.get(name)

    const url = resolveProviderUrl(name)
    if (!url) return Promise.resolve(null)

    const promise = import(/* @vite-ignore */ url)
        .then(mod => mod.default || mod.gitalkProvider || null)
        .catch(err => {
            providerCache.delete(name)
            console.warn('[commentWithFooter] failed to load provider:', name, err)
            return null
        })

    providerCache.set(name, promise)
    return promise
}

function plugin(hook, vm) {
    const pluginIdentifier = 'comment_footer'

    const replacer = new TokenReplacer({
        prefix: pluginIdentifier,
    })

    let commentContainer = null
    let footerDiv = null
    let renderSeq = 0
    let activeProvider = null

    function ensureLayout() {
        const main = document.getElementById('main')
        if (!main || !main.parentNode) return null

        if (!footerDiv || !footerDiv.isConnected) {
            footerDiv = document.getElementById(footerId)
            if (!footerDiv) {
                const footer = document.createElement('footer')
                footerDiv = document.createElement('div')
                footerDiv.id = footerId
                footer.appendChild(footerDiv)
                main.parentNode.appendChild(footer)
            }
        }

        const footer = footerDiv.closest('footer')
        if (footer.parentNode !== main.parentNode) {
            main.parentNode.appendChild(footer)
        }

        if (!commentContainer || !commentContainer.isConnected) {
            const containers = document.querySelectorAll('#' + commentContainerId)
            commentContainer = containers[0] || null

            for (let i = 1; i < containers.length; i++) {
                containers[i].remove()
            }

            if (!commentContainer) {
                commentContainer = document.createElement('div')
                commentContainer.id = commentContainerId
            }
        }

        if (commentContainer.parentNode !== footer.parentNode || commentContainer.nextElementSibling !== footer) {
            footer.parentNode.insertBefore(commentContainer, footer)
        }

        return footerDiv
    }

    function destroyComment() {
        if (activeProvider && activeProvider.destroy) {
            activeProvider.destroy(commentContainer)
        } else if (commentContainer) {
            commentContainer.innerHTML = ''
        }
        activeProvider = null
    }

    function renderFooter(input) {
        const tmpLocalization = calLocalized(commentWithFooterOptions.localization)
        Object.keys(tmpLocalization).forEach(key => {
            replacer.unregisterToken(key)
            replacer.registerToken(key, tmpLocalization[key])
        })
        return replacer.replace(input)
    }

    function renderComment() {
        const name = commentWithFooterOptions.use
        const seq = ++renderSeq
        const routePath = vm.route.path
        const isStale = () => seq !== renderSeq || routePath !== vm.route.path

        if (!providerFileNames[name]) {
            destroyComment()
            return
        }

        loadProvider(name).then(provider => {
            if (isStale()) return
            if (!provider) {
                destroyComment()
                return
            }

            if (provider.preload) {
                provider.preload(commentWithFooterOptions)
            }

            destroyComment()
            activeProvider = provider
            provider.mount(commentContainer, {
                vm,
                config: commentWithFooterOptions,
                isStale
            })
        })
    }

    hook.mounted(function () {
        const footer = ensureLayout()
        if (!footer) return

        const name = commentWithFooterOptions.use
        if (!providerFileNames[name]) return

        loadProvider(name).then(provider => {
            if (provider && provider.preload) {
                provider.preload(commentWithFooterOptions)
            }
        })
    })

    hook.doneEach(function () {
        const footer = ensureLayout()
        if (!footer) return

        const footerInnerHtml = renderFooter(commentWithFooterOptions.footerInnerHtml)
        footer.innerHTML = '<div>' + footerInnerHtml + '</div>'

        renderComment()
    })
}

window.$docsify['commentWithFooter'] = Object.assign(
    commentWithFooterOptions,
    window.$docsify['commentWithFooter']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
