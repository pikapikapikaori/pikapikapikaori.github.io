export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        const host = url.hostname
        let filePath = url.pathname.substring(1)

        // rewrite host to corresponding domain
        switch (host) {
            case 'home.pikapikapi.com':
                filePath = filePath ? 'pages/homepage/' + filePath : 'pages/homepage/index.html'
                break

            case 'index.pikapikapi.com':
                filePath = filePath ? 'pages/indexpage/' + filePath : 'pages/indexpage/index.html'
                break

            case 'photo.pikapikapi.com':
                filePath = filePath ? 'pages/animepage/' + filePath : 'pages/animepage/index.html'
                break

            default:
                // base domain @ 
                if (!filePath) {
                    filePath = 'index.html'
                }
        }

        const object = await env.R2_BUCKET.get(filePath)
        if (!object) {
            return new Response('404 - File Not Found', { status: 404 })
        }
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)

        // ========== Browser Cache ==========
        const ext = filePath.split('.').pop()?.toLowerCase() || ''

        switch (ext) {
            // Font: 1 year
            case 'woff':
            case 'woff2':
            case 'ttf':
            case 'otf':
            case 'eot':
                headers.set('Cache-Control', 'public, max-age=31536000, immutable')
                break

            // HTML / Markdown: No cache
            case 'html':
            case 'md':
                headers.set('Cache-Control', 'no-store')
                break

            // Pic: 15 days
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'webp':
            case 'avif':
            case 'svg':
            case 'ico':
                headers.set('Cache-Control', 'public, max-age=1296000')
                break

            // JS / CSS / JSON / Source Map: 4 hours
            case 'js':
            case 'mjs':
            case 'css':
            case 'json':
            case 'map':
                headers.set('Cache-Control', 'public, max-age=14400')
                break

            // Other: 1 hour
            default:
                headers.set('Cache-Control', 'public, max-age=3600')
        }

        return new Response(object.body, { headers })
    }
}
