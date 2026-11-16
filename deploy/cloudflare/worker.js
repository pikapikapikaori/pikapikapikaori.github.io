// ========== 1. Host 重写 ==========

// host -> R2 前缀（默认域名不在这里，走 DIR_INDEX_PATHS）
const HOST_PREFIX = {
    'home.pikapikapi.com': 'pages/homepage/',
    'index.pikapikapi.com': 'pages/indexpage/',
    'bgmtv.pikapikapi.com': 'apps/bangumi-takeout/web/',
}

// 需要自动补 index.html 的目录路径（含默认域名和子域名下的相对路径）
const DIR_INDEX_PATHS = new Set([
    'pages/light/',
])

function rewriteHost(host, filePath) {
    const prefix = HOST_PREFIX[host]

    // ---- 默认域名（base domain @）----
    if (!prefix) {
        if (filePath === '') {
            return 'index.html'
        }
        if (DIR_INDEX_PATHS.has(filePath)) {
            return filePath + 'index.html'
        }
        return filePath
    }

    // ---- 子域名 ----
    if (filePath === '') {
        return prefix + 'index.html'
    }

    if (DIR_INDEX_PATHS.has(filePath)) {
        return prefix + filePath + 'index.html'
    }

    return prefix + filePath
}

// ========== 2. 浏览器缓存策略 ==========
function applyCacheControl(headers, filePath) {
    const file = filePath.split('/').pop()?.toLowerCase() || ''

    // SW 脚本与缓存清单文件不进 HTTP 缓存，保证更新检查总能拿到最新
    if (file === 'sw.js' || file === 'file-cache.json') {
        headers.set('Cache-Control', 'no-store')
        return
    }

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

        // MD / HTML / CSS / JS: 3 hours
        case 'md':
        case 'html':
        case 'css':
        case 'js':
        case 'mjs':
            headers.set('Cache-Control', 'public, max-age=10800')
            break

        // Other: 1 day
        default:
            headers.set('Cache-Control', 'public, max-age=86400')
    }
}

// ========== 3. 内容替换 ==========
function rewriteContent(filePath, text) {
    switch (filePath) {
        // ---- indexpage ----
        case 'pages/indexpage/data/apps.json':
            return text
                .replaceAll('"../homepage/index.html?lang=zh-Hans"', '"https://home.pikapikapi.com/?lang=zh-Hans"')
                .replaceAll('"../../#/"', '"https://pikapikapi.com/#/"')

        // ---- homepage ----
        case 'pages/homepage/assets/js/config.js':
            return text.replaceAll("'../../", "'https://pikapikapi.com/")

        case 'pages/homepage/assets/js/i18n.js':
            return text.replaceAll("'../../", "'https://pikapikapi.com/")

        default:
            return text
    }
}

// 需要做内容替换的文件清单
const REWRITE_PATHS = new Set([
    'pages/indexpage/data/apps.json',
    'pages/homepage/assets/js/config.js',
    'pages/homepage/assets/js/i18n.js',
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
