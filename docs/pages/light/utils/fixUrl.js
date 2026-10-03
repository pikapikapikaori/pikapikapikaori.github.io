// Docsify plugin functions
function plugin(hook, vm) {
    const query = 'a,img,iframe'

    function fixRelativeUrls(el, prefix = '../../') {
        // 支持传字符串选择器或 DOM 元素
        if (typeof el === 'string') {
            el = document.querySelector(el);
        }
        if (!el || el.nodeType !== 1) {
            console.warn('fixRelativeUrls: 传入的不是有效 DOM 元素', el);
            return el;
        }

        const protocolRe = /^(?:[a-zA-Z][a-zA-Z0-9+.\-]*:|\/\/|#)/;

        // 处理元素自身 + 所有后代
        const nodes = [el, ...el.querySelectorAll('[src], [href]')];

        nodes.forEach(node => {
            for (const attr of ['src', 'href']) {
                if (!node.hasAttribute(attr)) continue;
                const v = node.getAttribute(attr);
                const stripped = (v || '').trim();
                if (!stripped) continue;
                if (protocolRe.test(stripped)) continue;
                if (stripped.startsWith(prefix)) continue;
                node.setAttribute(attr, prefix + v);
            }
        });

        return el;
    }

    hook.doneEach(() => {
        Array.from(document.querySelectorAll(query)).forEach(el => {
            fixRelativeUrls(el)
        })
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
