// ========== 1. Host 重写 ==========
function rewriteHost(host, filePath) {
    switch (host) {
        case 'home.pikapikapi.com':
            return filePath ? 'pages/mondrian/' + filePath : 'pages/mondrian/index.html'

        case 'index.pikapikapi.com':
            return filePath ? 'pages/indexpage/' + filePath : 'pages/indexpage/index.html'

        case 'photo.pikapikapi.com':
            return filePath ? 'pages/animepage/' + filePath : 'pages/animepage/index.html'

        default:
            // base domain @
            return filePath || 'index.html'
    }
}

// ========== 2. 浏览器缓存策略 ==========
function applyCacheControl(headers, filePath) {
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
}

// ========== 3. 内容替换 ==========
function rewriteContent(filePath, text) {
    switch (filePath) {
        // ---- indexpage ----
        case 'pages/indexpage/apps.json':
            return text
                .replaceAll('"../mondrian/index.html"', '"https://home.pikapikapi.com/"')
                .replaceAll('"../../#/"', '"https://www.pikapikapi.com/#/"')
                .replaceAll('"../animepage/index.html"', '"https://photo.pikapikapi.com/"')

        // ---- mondrian ----
        case 'pages/mondrian/index.html':
            return text
                .replaceAll('href="../../#/"', 'href="https://www.pikapikapi.com/#/"')
                .replaceAll('href="../animepage/index.html"', 'href="https://photo.pikapikapi.com/"')

        case 'pages/mondrian/i18n/en-us.html':
            return text
                .replaceAll('href="../../../#/en-us/"', 'href="https://www.pikapikapi.com/#/en-us/"')
                .replaceAll('href="../../animepage/i18n/en-us.html"', 'href="https://photo.pikapikapi.com/i18n/en-us.html"')

        case 'pages/mondrian/i18n/jp.html':
            return text
                .replaceAll('href="../../../#/jp/"', 'href="https://www.pikapikapi.com/#/jp/"')
                .replaceAll('href="../../animepage/i18n/jp.html"', 'href="https://photo.pikapikapi.com/i18n/jp.html"')

        // ---- animepage ----
        case 'pages/animepage/index.html':
            return text
                .replaceAll('href="../../#/', 'href="https://www.pikapikapi.com/#/')

        case 'pages/animepage/i18n/en-us.html':
            return text
                .replaceAll('href="../../../#/', 'href="https://www.pikapikapi.com/#/')

        case 'pages/animepage/i18n/jp.html':
            return text
                .replaceAll('href="../../../#/', 'href="https://www.pikapikapi.com/#/')

        default:
            return text
    }
}

// 需要做内容替换的文件清单
const REWRITE_PATHS = new Set([
    'pages/indexpage/apps.json',
    'pages/mondrian/index.html',
    'pages/mondrian/i18n/en-us.html',
    'pages/mondrian/i18n/jp.html',
    'pages/animepage/index.html',
    'pages/animepage/i18n/en-us.html',
    'pages/animepage/i18n/jp.html',
])

// ========== 4. 生成 etag ==========
async function makeEtag(text) {
    const data = new TextEncoder().encode(text)
    const hash = await crypto.subtle.digest('SHA-1', data)
    const hex = [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    return `"${hex.slice(0, 16)}"`
}

// ========== 5. 统一入口：body in / body out，headers in / headers out ==========
async function prepareResponse(filePath, object, headers) {
    if (!REWRITE_PATHS.has(filePath)) {
        return { body: object.body, headers }
    }

    const text = await object.text()
    const body = rewriteContent(filePath, text)

    // 内容变了，这几个头不能再沿用
    const newHeaders = new Headers(headers)
    newHeaders.delete('content-length')
    newHeaders.delete('content-encoding')
    newHeaders.set('etag', await makeEtag(body))

    return { body, headers: newHeaders }
}

// ========== Worker ==========
export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        const host = url.hostname
        const encodedFilePath = url.pathname.substring(1)
        const rawPath = decodeURIComponent(encodedFilePath)

        // 1. 按域名映射到 R2 里的实际路径
        const filePath = rewriteHost(host, rawPath)

        // 2. 从 R2 取文件
        const object = await env.R2_BUCKET.get(filePath)
        if (!object) {
            return new Response('404 - File Not Found', { status: 404 })
        }

        // 3. 组装响应头
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        applyCacheControl(headers, filePath)

        // 4. 需要的话做内容替换
        const result = await prepareResponse(filePath, object, headers)

        return new Response(result.body, { headers: result.headers })
    }
}
