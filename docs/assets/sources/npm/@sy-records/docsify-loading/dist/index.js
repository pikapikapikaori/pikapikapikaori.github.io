(function () {
function loading(hook) {
    hook.afterEach((html, next) => {
        html = html.replace(/<img\s+([^>]*?)>/g, (match, attrs) => {
            if (attrs.includes('loading=') || /src=["'][^"']+\.svg["']/.test(attrs)) {
                return match;
            }
            return `<img ${attrs} loading="lazy">`;
        });
        next(html);
    });
}

window.$docsify = window.$docsify || {};
$docsify.plugins = [...($docsify.plugins || []), loading];

})();