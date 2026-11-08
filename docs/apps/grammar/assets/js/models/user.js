/** User 模型与导出 JSON 顶层结构 */

import { DEFAULT_SETTINGS } from '../config/config.js'
import { normalizeSettings } from '../store/settings-store.js'

export const EXPORT_KIND = 'langnotebook-user'
export const CURRENT_VERSION = 1

export function isUserShape(obj) {
    return obj
    && typeof obj === 'object'
    && typeof obj.id === 'string'
    && obj.id.startsWith('u_')
    && typeof obj.name === 'string'
}

export function buildExportPayload({ user, settings, words, notes }) {
    return {
        version: CURRENT_VERSION,
        kind: EXPORT_KIND,
        user: { ...user },
        settings: normalizeSettings(settings || DEFAULT_SETTINGS),
        words: Array.isArray(words) ? words : [],
        notes: Array.isArray(notes) ? notes : []
    }
}

export function validateExportPayload(payload) {
    const errors = []
    if (!payload || typeof payload !== 'object') {
        return { ok: false, errors: ['文件内容不是 JSON 对象'] }
    }
    if (payload.kind !== EXPORT_KIND) {
        errors.push(`kind 不匹配，期望 "${EXPORT_KIND}"，实际 "${payload.kind}"`)
    }
    if (payload.version !== CURRENT_VERSION) {
        errors.push(`version 不匹配，期望 ${CURRENT_VERSION}，实际 ${payload.version}`)
    }
    if (!isUserShape(payload.user)) {
        errors.push('user 字段缺失或格式不正确')
    }
    if (payload.settings && typeof payload.settings !== 'object') {
        errors.push('settings 应为对象')
    }
    if (!Array.isArray(payload.words)) {
        errors.push('words 应为数组')
    }
    // notes 是后来加的：旧文件没有这一段，照样能导入
    if (payload.notes != null && !Array.isArray(payload.notes)) {
        errors.push('notes 应为数组')
    }
    return { ok: errors.length === 0, errors }
}
