export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'
    }[c]))
}

export function unique(list) {
    return Array.from(new Set(list.filter(Boolean)))
}

export function makeMenuButton(label, { disabled = false } = {}) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'menu-btn'
    button.setAttribute('aria-haspopup', 'listbox')
    button.setAttribute('aria-expanded', 'false')
    button.disabled = disabled
    paintMenuButton(button, label)
    return button
}

export function paintMenuButton(button, label) {
    button.innerHTML = `${escapeHtml(label)}<span class="menu-caret" aria-hidden="true"></span>`
}
