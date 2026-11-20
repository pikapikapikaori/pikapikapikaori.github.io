// Credentials live in the shared `credentials` store keyed by the verified
// account name, so the export page and the viewer always see the same login.
import {
    AUTH_BASE, BANGUMI_CLIENT_ID, STORAGE_PREFIX, STORE_CREDENTIALS,
    TOKEN_REFRESH_MARGIN_MS,
} from '../config.js'
import { runTransaction } from '../storage.js'
import { BangumiApi, fetchWithTimeout, proxied } from './api.js'

const OAUTH_VERIFIER_KEY = STORAGE_PREFIX + 'oauth-verifier'
const OAUTH_STATE_KEY = STORAGE_PREFIX + 'oauth-state'

// storage.js owns the connection and recreates the database when a store is
// missing, so credentials share one schema check and one transaction helper.
function credentialRequest(mode, fn) {
    return runTransaction(STORE_CREDENTIALS, mode, t => fn(t.objectStore(STORE_CREDENTIALS)))
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
    sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
    sessionStorage.removeItem(OAUTH_STATE_KEY)
}

// The callback URL keeps `code` and `state`; both are single-use secrets, so
// they are removed from the address bar once the exchange is handled.
function clearOAuthParams() {
    try {
        const url = new URL(location.href)
        if (!url.searchParams.has('code') && !url.searchParams.has('state')) return
        url.searchParams.delete('code')
        url.searchParams.delete('state')
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

async function requestToken(params, { signal = null } = {}) {
    const { response, text } = await fetchWithTimeout(proxied(`${AUTH_BASE}/access_token`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    }, { signal })
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`)
    }
    try {
        return JSON.parse(text)
    } catch {
        const type = response.headers.get('content-type') || '(none)'
        throw new Error(`令牌接口响应不是 JSON: HTTP ${response.status} · Content-Type: ${type} · ${text.slice(0, 120)}`)
    }
}

async function verifyToken(accessToken, { signal = null } = {}) {
    const api = new BangumiApi({ token: accessToken, interval: 0, maxRetries: 1, signal })
    const me = await api.getMe()
    if (!me || !me.username) throw new Error('无法确认令牌所属账号')
    return me
}

// The account name comes from the token itself: writing under the typed name
// could overwrite another account's credential.
async function storeVerified(data, { signal = null } = {}) {
    const me = await verifyToken(data.access_token, { signal })
    const record = tokenRecord(me.username, data)
    await saveCredential(record)
    return { username: me.username, user: me, credential: record }
}

export async function beginAuthorization() {
    const verifier = randStr(64)
    const challenge = b64url(await sha256(verifier))
    const state = randStr(16)
    sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier)
    sessionStorage.setItem(OAUTH_STATE_KEY, state)

    const params = new URLSearchParams({
        client_id: BANGUMI_CLIENT_ID,
        response_type: 'code',
        redirect_uri: getRedirectUri(),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
    })
    location.href = `${AUTH_BASE}/authorize?${params}`
}

export async function finishAuthorization(search = location.search) {
    const params = new URLSearchParams(search)
    const error = params.get('error')
    if (error) {
        clearPending()
        clearOAuthParams()
        const description = params.get('error_description') || ''
        throw new Error(`OAuth 授权失败: ${error} ${description}`.trim())
    }
    const code = params.get('code')
    if (!code) return null

    const state = params.get('state')
    const verifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY)
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY)
    if (!savedState || state !== savedState) {
        clearPending()
        clearOAuthParams()
        throw new Error('OAuth state 校验失败，请重新登录')
    }
    if (!verifier) {
        clearPending()
        clearOAuthParams()
        throw new Error('OAuth 会话已过期，请重新登录')
    }

    try {
        const data = await requestToken({
            grant_type: 'authorization_code',
            client_id: BANGUMI_CLIENT_ID,
            code,
            redirect_uri: getRedirectUri(),
            code_verifier: verifier,
        })
        return await storeVerified(data)
    } finally {
        // The code and verifier are single-use secrets: drop them even when the
        // token exchange fails, so a retry starts from a clean session.
        clearPending()
        clearOAuthParams()
    }
}

export async function addAccessToken(token, { signal = null } = {}) {
    const clean = String(token || '').trim()
    if (!clean) throw new Error('访问令牌为空')
    // No expiry is known for a pasted token: a 401 triggers the re-login flow.
    return storeVerified({ access_token: clean }, { signal })
}

export async function refreshAccessToken(username, { signal = null } = {}) {
    if (!username) throw new Error('请先登录')
    const record = await getCredential(username)
    if (!record) throw new Error(`没有 ${username} 的登录凭证`)
    if (!record.refresh_token) throw new Error('登录已失效，请重新登录')

    const data = await requestToken({
        grant_type: 'refresh_token',
        client_id: BANGUMI_CLIENT_ID,
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
    // A pasted token has no known expiry; keep using it until the API answers 401.
    if (!expiresAt) return record.access_token
    if (Date.now() < expiresAt - TOKEN_REFRESH_MARGIN_MS) return record.access_token
    if (!record.refresh_token) throw new Error('访问令牌已过期，且没有刷新令牌，请重新登录')
    return refreshAccessToken(username, { signal })
}
