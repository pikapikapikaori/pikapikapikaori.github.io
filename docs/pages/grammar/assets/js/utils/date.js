/**
 * 时间与复习间隔
 */

export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30]
export const MASTERY_MIN = 0
export const MASTERY_MAX = 5

export function nowIso() {
    return new Date().toISOString()
}

export function parseIso(iso) {
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
}

export function addDaysIso(iso, days) {
    const d = parseIso(iso) || new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString()
}

export function clampMastery(n) {
    const v = Math.round(Number(n) || 0)
    if (v < MASTERY_MIN) return MASTERY_MIN
    if (v > MASTERY_MAX) return MASTERY_MAX
    return v
}

/** 依据掌握度计算下次复习时间 */
export function nextReviewFrom(mastery, fromIso = nowIso()) {
    const idx = clampMastery(mastery)
    const days = REVIEW_INTERVALS_DAYS[idx] ?? 0
    return addDaysIso(fromIso, days)
}

const _dtf = (() => {
    try {
        return new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        })
    } catch { return null }
})()

export function formatDate(iso) {
    const d = parseIso(iso)
    if (!d) return ''
    if (_dtf) return _dtf.format(d)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateTime(iso) {
    const d = parseIso(iso)
    if (!d) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatRelative(iso) {
    const d = parseIso(iso)
    if (!d) return ''
    const diff = Date.now() - d.getTime()
    const abs = Math.abs(diff)
    const min = 60 * 1000, hour = 60 * min, day = 24 * hour
    const past = diff >= 0
    if (abs < min) return past ? '刚刚' : '马上'
    if (abs < hour) return past ? `${Math.floor(abs / min)} 分钟前` : `${Math.floor(abs / min)} 分钟后`
    if (abs < day) return past ? `${Math.floor(abs / hour)} 小时前` : `${Math.floor(abs / hour)} 小时后`
    if (abs < 30 * day) return past ? `${Math.floor(abs / day)} 天前` : `${Math.floor(abs / day)} 天后`
    return formatDate(iso)
}

export function isToday(iso) {
    const d = parseIso(iso)
    if (!d) return false
    const n = new Date()
    return d.getFullYear() === n.getFullYear()
      && d.getMonth() === n.getMonth()
      && d.getDate() === n.getDate()
}
