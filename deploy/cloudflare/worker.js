// /_cross_origin 为保留路径，只发起授权与转发 Bangumi 接口，不读 R2。

// ========== 0. Bangumi 接口转发 ==========
const CROSS_ORIGIN_PATH = '/_cross_origin'

// 前端据这个头区分中转响应；缺失该头的 404 与 5xx 视为代理不可达。
const CROSS_ORIGIN_HEADER = 'x-cross-origin'

const PROXY_PREFIX = 'https://api.bgm.tv/'

const PROXY_TOKEN_URL = 'https://bgm.tv/oauth/access_token'

const PROXY_AUTHORIZE_URL = 'https://bgm.tv/oauth/authorize'

const PROXY_METHODS = new Set(['GET', 'HEAD', 'POST', 'OPTIONS'])

// 5 次跳转足够 OAuth 端点使用；越过即停止。
const PROXY_REDIRECT_LIMIT = 5

// 这些头按上游站点写就，转发到本站源会让浏览器误信。
const PROXY_STRIPPED_HEADERS = [
    'set-cookie',
    'clear-site-data',
    'www-authenticate',
    'refresh',
    'content-security-policy-report-only',
]

const PROXY_CLIENT_ID = 'bgm71356aa8a71822b75'

const PROXY_CLIENT_SECRET = '84b443fcb27f06906a7cce10eca9aa7a'

function proxyError(message, status) {
    return new Response(message, {
        status,
        headers: {
            'Access-Control-Allow-Origin': '*',
            [CROSS_ORIGIN_HEADER]: '1',
        },
    })
}

function isRedirectStatus(status) {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function relayResponse(response, { stripLocation = false } = {}) {
    const headers = new Headers(response.headers)
    for (const name of PROXY_STRIPPED_HEADERS) headers.delete(name)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Headers', '*')
    headers.set('Access-Control-Expose-Headers', '*')
    headers.set(CROSS_ORIGIN_HEADER, '1')
    // 中转内容只作数据读取，禁嗅探并让文档失去同源身份。
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Content-Security-Policy', 'sandbox')
    if (stripLocation) headers.delete('Location')
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    })
}

function isAllowedTarget(target) {
    if (target.username || target.password) return false
    if (target.origin + target.pathname === PROXY_TOKEN_URL) return true
    return target.href.startsWith(PROXY_PREFIX)
}

function isNavigation(request) {
    const destination = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase()
    if (destination === 'document' || destination === 'iframe') return true
    const mode = (request.headers.get('Sec-Fetch-Mode') || '').toLowerCase()
    if (mode === 'navigate') return true
    const accept = request.headers.get('Accept') || ''
    return accept.split(',')[0].split(';')[0].trim().toLowerCase() === 'text/html'
}

// 授权页由本站发起，浏览器随后回到 redirect_uri，故只接受与请求同源的地址。
function oauthStart(url) {
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const challenge = url.searchParams.get('code_challenge') || ''
    const state = url.searchParams.get('state') || ''
    if (!redirectUri || !challenge || !state) {
        return proxyError('missing oauth parameter', 400)
    }
    let redirect
    try {
        redirect = new URL(redirectUri)
    } catch {
        return proxyError('forbidden', 403)
    }
    if (redirect.origin !== url.origin) {
        return proxyError('forbidden', 403)
    }
    redirect.hash = ''
    redirect.username = ''
    redirect.password = ''
    const params = new URLSearchParams({
        client_id: PROXY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirect.href,
        code_challenge: challenge,
        // 只接受 S256，请求无法把挑战方法降级成 plain。
        code_challenge_method: 'S256',
        state,
    })
    return new Response(null, {
        status: 302,
        headers: {
            Location: PROXY_AUTHORIZE_URL + '?' + params,
            'Access-Control-Allow-Origin': '*',
            [CROSS_ORIGIN_HEADER]: '1',
        },
    })
}

async function crossOrigin(request, url) {
    if (!PROXY_METHODS.has(request.method)) {
        return proxyError('method not allowed', 405)
    }
    // 授权入口本身就是页面跳转，须在拦截文档导航之前处理。
    if (url.searchParams.get('oauth') === 'start') {
        return oauthStart(url)
    }
    if (isNavigation(request)) {
        return proxyError('navigation not allowed', 400)
    }

    const target = url.searchParams.get('url')
    if (!target) {
        return proxyError('missing url', 400)
    }

    let current
    try {
        current = new URL(target)
    } catch {
        return proxyError('forbidden', 403)
    }
    if (current.protocol !== 'https:' || !isAllowedTarget(current)) {
        return proxyError('forbidden', 403)
    }

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                [CROSS_ORIGIN_HEADER]: '1',
            },
        })
    }

    const isTokenEndpoint = current.origin + current.pathname === PROXY_TOKEN_URL

    const headers = new Headers()
    const authorization = isTokenEndpoint ? null : request.headers.get('Authorization')
    if (authorization) headers.set('Authorization', authorization)
    const accept = request.headers.get('Accept')
    if (accept) headers.set('Accept', accept)
    headers.set('User-Agent', 'bangumi-takeout-web/1.0')

    let method = request.method
    let body
    if (method !== 'GET' && method !== 'HEAD') {
        const incomingType = request.headers.get('Content-Type') || ''
        const incomingBody = await request.arrayBuffer()
        // 令牌交换必须带应用身份，故只在这一端点改写表单，请求体里的同名字段被覆盖。
        if (isTokenEndpoint) {
            const params = new URLSearchParams(new TextDecoder().decode(incomingBody))
            params.set('client_id', PROXY_CLIENT_ID)
            params.set('client_secret', PROXY_CLIENT_SECRET)
            body = params.toString()
            headers.set('Content-Type', 'application/x-www-form-urlencoded')
        } else {
            body = incomingBody
            if (incomingType) headers.set('Content-Type', incomingType)
        }
    }

    let redirects = 0
    for (;;) {
        const response = await fetch(current.href, {
            method,
            headers,
            body,
            // 手动跟跳转，才能逐个检查目标主机并控制授权头与请求体的去向。
            redirect: 'manual',
        })

        if (!isRedirectStatus(response.status)) {
            return relayResponse(response)
        }

        const location = response.headers.get('Location')
        if (!location) {
            return relayResponse(response, { stripLocation: true })
        }

        let next
        try {
            next = new URL(location, current)
        } catch {
            return relayResponse(response, { stripLocation: true })
        }

        if (redirects >= PROXY_REDIRECT_LIMIT
            || next.origin !== current.origin
            || !isAllowedTarget(next)) {
            return relayResponse(response, { stripLocation: true })
        }

        redirects += 1
        if ((response.status === 303 || response.status === 301 || response.status === 302)
            && method !== 'GET' && method !== 'HEAD') {
            method = 'GET'
            body = undefined
            headers.delete('Content-Type')
        }
        if (response.body) {
            try {
                await response.body.cancel()
            } catch {}
        }
        current = next
    }
}

// ========== 1. Host 重写 ==========

const HOST_PREFIX = {
    'home.pikapikapi.com': 'pages/homepage/',
    'index.pikapikapi.com': 'pages/indexpage/',
    'bgmtv.pikapikapi.com': 'apps/bangumi-takeout/',
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

        // ---- bangumi-takeout ----
        case 'apps/bangumi-takeout/assets/resources/meta/default-source.json':
            return text.replaceAll('"../../../../', '"https://pikapikapi.com/')

        default:
            return text
    }
}

// 需要做内容替换的文件清单
const REWRITE_PATHS = new Set([
    'pages/indexpage/data/apps.json',
    'pages/homepage/assets/js/config.js',
    'pages/homepage/assets/js/i18n.js',
    'apps/bangumi-takeout/assets/resources/meta/default-source.json',
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

        if (url.pathname === CROSS_ORIGIN_PATH) {
            return crossOrigin(request, url)
        }
        const encodedFilePath = url.pathname.substring(1)
        const rawPath = decodeURIComponent(encodedFilePath)

        // 1. 按域名映射到 R2 里的实际路径
        const filePath = rewriteHost(host, rawPath)

        // 2. 从 R2 取文件
        const object = await env.R2_BUCKET.get(filePath)
        if (!object) {
            // no-store 防止中间缓存把一次缺失固化成长期 404，前端以裸 404 判定代理不存在。
            return new Response('404 - File Not Found', {
                status: 404,
                headers: {
                    'Cache-Control': 'no-store',
                    'Access-Control-Allow-Origin': '*',
                },
            })
        }

        // 3. 组装响应头
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Access-Control-Allow-Origin', '*')
        applyCacheControl(headers, filePath)

        // 4. 需要的话做内容替换
        const result = await prepareResponse(filePath, object, headers)

        return new Response(result.body, { headers: result.headers })
    }
}
