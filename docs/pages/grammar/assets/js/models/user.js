/**
 * User 模型与导出 JSON 顶层结构
 */

import { userId as genUserId } from '../utils/id.js'
import { nowIso } from '../utils/date.js'
import { DEFAULT_SETTINGS, normalizeSettings } from '../store/settings-store.js'

export const EXPORT_KIND = 'langnotebook-user'
export const CURRENT_VERSION = 1

export function createUser(name) {
    const t = nowIso()
    return {
        id: genUserId(),
        name: String(name || '').trim() || '未命名用户',
        createdAt: t,
        updatedAt: t
    }
}

export function isUserShape(obj) {
    return obj
    && typeof obj === 'object'
    && typeof obj.id === 'string'
    && obj.id.startsWith('u_')
    && typeof obj.name === 'string'
}

/** 组装导出对象 */
export function buildExportPayload({ user, settings, words }) {
    return {
        version: CURRENT_VERSION,
        kind: EXPORT_KIND,
        user: { ...user },
        settings: normalizeSettings(settings || DEFAULT_SETTINGS),
        words: Array.isArray(words) ? words : []
    }
}

/** 校验导入对象顶层结构 */
export function validateExportPayload(payload) {
    const errors = []
    if (!payload || typeof payload !== 'object') {
        return { ok: false, errors: ['文件内容不是 JSON 对象'] }
    }
    if (payload.kind !== EXPORT_KIND) {
        errors.push(`kind 不匹配，期望 "${EXPORT_KIND}"，实际 "${payload.kind}"`)
    }
    if (!Number.isInteger(payload.version) || payload.version < 1) {
        errors.push(`version 无效：${payload.version}`)
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
    return { ok: errors.length === 0, errors }
}
