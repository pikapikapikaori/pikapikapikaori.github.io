
import { LS_KEYS } from '../config/config.js'

export { LS_KEYS }

export const imeEnabledKey = 'grammar:ime:enabled'
export const imeFollowKey = 'grammar:ime:follow'

export function romanKey(lang) {
    return lang ? `grammar:roman:${lang}` : null
}

export function breveKey(lang) {
    return lang ? `grammar:breve:${lang}` : null
}

export function imeModeKey(code) {
    return code ? `grammar:ime:mode:${code}` : null
}

export function getString(key, fallback = '') {
    if (!key) return fallback
    try {
        const value = localStorage.getItem(key)
        return value === null ? fallback : value
    } catch {
        return fallback
    }
}

export function setString(key, value) {
    if (!key || value === null || value === undefined) return false
    try {
        localStorage.setItem(key, String(value))
        return true
    } catch {
        return false
    }
}

export function remove(key) {
    if (!key) return false
    try {
        localStorage.removeItem(key)
        return true
    } catch {
        return false
    }
}

export function getBool(key, fallback = false) {
    switch (getString(key, null)) {
        case '1': return true
        case '0': return false
        default: return fallback
    }
}

export function setBool(key, value) {
    return setString(key, value ? '1' : '0')
}

export function getEnum(key, allowed, fallback = null) {
    const value = getString(key, null)
    return Array.isArray(allowed) && allowed.includes(value) ? value : fallback
}

export function setEnum(key, allowed, value) {
    if (!Array.isArray(allowed) || !allowed.includes(value)) return false
    return setString(key, value)
}

export function getNumber(key, fallback = 0) {
    const value = getString(key, null)
    if (value === null) return fallback
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

export function setNumber(key, value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return false
    return setString(key, String(n))
}
