export function escapeHtml (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[char]
    })
}

export function pad (value) {
    return String(value).padStart(2, '0')
}

export function formatText (template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (match, key) {
        return key in values ? String(values[key]) : match
    })
}

export function hostName (url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch (error) {
        return ''
    }
}

export function isEditable (target) {
    if (!target || !target.tagName) return false
    return ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(target.tagName) !== -1 || target.isContentEditable
}

export function announce (text) {
    const live = document.getElementById('live-region')
    if (!live) return
    live.textContent = ''
    window.setTimeout(function () {
        live.textContent = text
    }, 30)
}

/* 外链只允许 http 与 https；相对地址按当前页面解析。非法地址返回空串。 */
export function safeUrl (value) {
    const text = String(value == null ? '' : value).trim()
    if (!text) return ''
    try {
        const url = new URL(text, window.location.href)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
        return url.href
    } catch (error) {
        return ''
    }
}

export function openUrl (url, invalidMessage) {
    const target = safeUrl(url)
    if (!target) {
        announce(invalidMessage)
        return false
    }
    window.open(target, '_blank', 'noopener,noreferrer')
    return true
}

export function captureFocus (entries) {
    const active = document.activeElement
    if (!active || !active.closest) return null
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index]
        if (!entry.root.contains(active)) continue
        return { name: entry.name, attribute: entry.attribute, value: active.getAttribute(entry.attribute) }
    }
    return null
}

export function restoreFocus (focus, entries) {
    if (!focus || !focus.value) return
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index]
        if (entry.name !== focus.name) continue
        const button = entry.root.querySelector('[' + entry.attribute + '="' + CSS.escape(focus.value) + '"]')
        if (button) button.focus({ preventScroll: true })
        return
    }
}
