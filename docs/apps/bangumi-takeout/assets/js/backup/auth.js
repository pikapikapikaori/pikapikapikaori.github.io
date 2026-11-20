// Credentials live in the shared `credentials` store, keyed by the account name the
// token proves, so the backup page and the viewer see one login.
import {
    apiBase, authBase, proxyUrl, storagePrefix, storeCredentials, tokenRefreshMarginMs,
} from '../config.js'
import { runTransaction } from '../storage.js'
import { BangumiApi, fetchWithTimeout, proxied } from './api.js'

const oauthVerifierKey = storagePrefix + 'oauth-verifier'
const oauthStateKey = storagePrefix + 'oauth-state'

const proxyMarkerHeader = 'x-cross-origin'
const proxyPath = proxyUrl.split('?')[0]

const proxyProbeTimeoutMs = 8000

// storage.js owns the connection and its schema check, so credentials reuse both.
function credentialRequest(mode, fn) {
    return runTransaction(storeCredentials, mode, t => fn(t.objectStore(storeCredentials)))
}

function checkUsername(username) {
    if (typeof username !== 'string' || !username) throw new Error('凭证缺少用户名')
    return username
}

function getCredential(username) {
    if (!username) return Promise.resolve(null)
    return credentialRequest('readonly', store => store.get(username))
        .then(record => record || null)
}

export function listCredentials() {
    return credentialRequest('readonly', store => store.getAll()).then(list => list || [])
}

function saveCredential(record) {
    checkUsername(record?.username)
    if (typeof record.access_token !== 'string' || !record.access_token) {
        throw new Error('凭证缺少访问令牌')
    }
    return credentialRequest('readwrite', store => store.put(record))
}

export function removeCredential(username) {
    checkUsername(username)
    return credentialRequest('readwrite', store => store.delete(username))
}

function getRedirectUri() {
    return location.origin + location.pathname
}

function b64url(buffer) {
    const bytes = new Uint8Array(buffer)
    let text = ''
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i])
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randStr(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    let text = ''
    for (let i = 0; i < length; i++) text += chars[bytes[i] % chars.length]
    return text
}

function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
}

function clearPending() {
    sessionStorage.removeItem(oauthVerifierKey)
    sessionStorage.removeItem(oauthStateKey)
}

// Callback parameters are single-use and may carry an error text, so every OAuth name
// leaves the address bar once handled.
const oauthParamNames = [
    'code', 'state', 'error', 'error_description', 'error_uri',
    'scope', 'access_token', 'token_type', 'expires_in',
]

function clearOAuthParams() {
    try {
        const url = new URL(location.href)
        let found = false
        for (const name of oauthParamNames) {
            if (!url.searchParams.has(name)) continue
            url.searchParams.delete(name)
            found = true
        }
        if (!found) return
        const search = url.searchParams.toString()
        history.replaceState(history.state, '', url.pathname + (search ? '?' + search : '') + url.hash)
    } catch {}
}

function tokenRecord(username, data, previous = null) {
    const now = Date.now()
    const accessToken = data.access_token
    if (typeof accessToken !== 'string' || !accessToken) throw new Error('接口未返回访问令牌')
    const expiresIn = Number(data.expires_in)
    const expiresKnown = Number.isFinite(expiresIn) && expiresIn > 0
    return {
        username,
        access_token: accessToken,
        refresh_token: data.refresh_token || previous?.refresh_token || '',
        // A pasted token carries no expiry; only a 401 can prove it stale.
        token_expires_at: expiresKnown ? now + expiresIn * 1000 : null,
        last_refreshed_at: now,
    }
}

function tokenErrorForStatus(status) {
    if (status === 400) return '令牌请求被拒绝，请重新登录'
    if (status === 401 || status === 403) return '令牌无效或已过期，请重新登录'
    if (status >= 500) return '令牌接口暂时不可用，请稍后重试'
    return `令牌接口返回 HTTP ${status}`
}

async function requestToken(params, { signal = null } = {}) {
    const { response, text } = await fetchWithTimeout(proxied(`${authBase}/access_token`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    }, { signal })
    if (!response.ok) {
        throw new Error(tokenErrorForStatus(response.status))
    }
    try {
        return JSON.parse(text)
    } catch {
        throw new Error('令牌接口响应不是有效的 JSON')
    }
}

async function verifyToken(accessToken, { signal = null } = {}) {
    const api = new BangumiApi({ token: accessToken, interval: 0, maxRetries: 1, signal })
    const me = await api.getMe()
    if (!me || !me.username) throw new Error('无法确认令牌所属账号')
    return me
}

// The account name comes from the token: writing under the typed name could
// overwrite another account's credential.
async function storeVerified(data, { signal = null } = {}) {
    const me = await verifyToken(data.access_token, { signal })
    const record = tokenRecord(me.username, data)
    await saveCredential(record)
    return { username: me.username, user: me, credential: record }
}

function proxyMissingError(cause) {
    const error = new Error('OAuth 授权需要 Worker 代理，请部署 deploy/cloudflare/worker.js 并保留 /_cross_origin')
    error.code = 'PROXY_UNAVAILABLE'
    error.retryable = false
    if (cause) error.cause = cause
    return error
}

function proxyTimeoutError(cause) {
    const error = new Error('OAuth 代理探测超时，请检查网络后重试')
    error.code = 'PROXY_TIMEOUT'
    error.retryable = true
    if (cause) error.cause = cause
    return error
}

async function ensureProxy() {
    // A preflight answer proves the route exists and keeps the console free of a 400.
    const probe = proxyUrl + encodeURIComponent(apiBase + '/v0/me')
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, proxyProbeTimeoutMs)
    let response = null
    try {
        response = await fetch(probe, { method: 'OPTIONS', cache: 'no-store', signal: controller.signal })
    } catch (error) {
        if (timedOut) throw proxyTimeoutError(error)
        throw proxyMissingError(error)
    } finally {
        clearTimeout(timer)
    }
    if (!response.headers.get(proxyMarkerHeader)) throw proxyMissingError()
}

export async function beginAuthorization() {
    await ensureProxy()
    const verifier = randStr(64)
    const challenge = b64url(await sha256(verifier))
    const state = randStr(16)
    sessionStorage.setItem(oauthVerifierKey, verifier)
    sessionStorage.setItem(oauthStateKey, state)

    const params = new URLSearchParams({
        oauth: 'start',
        redirect_uri: getRedirectUri(),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
    })
    location.href = proxyPath + '?' + params
}

export async function finishAuthorization(search = location.search) {
    const params = new URLSearchParams(search)
    const error = params.get('error')
    const code = params.get('code')
    if (!error && !code) return null

    const state = params.get('state')
    const savedState = sessionStorage.getItem(oauthStateKey)
    if (!savedState || state !== savedState) {
        clearPending()
        clearOAuthParams()
        throw new Error('OAuth state 校验失败，请重新登录')
    }

    if (error) {
        clearPending()
        clearOAuthParams()
        const description = params.get('error_description') || ''
        throw new Error(`OAuth 授权失败: ${error} ${description}`.trim())
    }

    const verifier = sessionStorage.getItem(oauthVerifierKey)
    if (!verifier) {
        clearPending()
        clearOAuthParams()
        throw new Error('OAuth 会话已过期，请重新登录')
    }

    try {
        const data = await requestToken({
            grant_type: 'authorization_code',
            code,
            redirect_uri: getRedirectUri(),
            code_verifier: verifier,
        })
        return await storeVerified(data)
    } finally {
        // The code and verifier are single-use; drop them even when the exchange fails.
        clearPending()
        clearOAuthParams()
    }
}

export async function addAccessToken(token, { signal = null } = {}) {
    const clean = String(token || '').trim()
    if (!clean) throw new Error('访问令牌为空')
    return storeVerified({ access_token: clean }, { signal })
}

export async function refreshAccessToken(username, { signal = null } = {}) {
    if (!username) throw new Error('请先登录')
    const record = await getCredential(username)
    if (!record) throw new Error(`没有 ${username} 的登录凭证`)
    if (!record.refresh_token) throw new Error('登录已失效，请重新登录')

    const data = await requestToken({
        grant_type: 'refresh_token',
        refresh_token: record.refresh_token,
    }, { signal })
    const next = tokenRecord(username, data, record)
    await saveCredential(next)
    return next.access_token
}

export async function requireAccessToken(username, { signal = null } = {}) {
    if (!username) throw new Error('请先登录')
    const record = await getCredential(username)
    if (!record) throw new Error(`没有 ${username} 的登录凭证`)

    const expiresAt = Number(record.token_expires_at) || 0
    if (!expiresAt) return record.access_token
    if (Date.now() < expiresAt - tokenRefreshMarginMs) return record.access_token
    if (!record.refresh_token) throw new Error('访问令牌已过期，且没有刷新令牌，请重新登录')
    return refreshAccessToken(username, { signal })
}
