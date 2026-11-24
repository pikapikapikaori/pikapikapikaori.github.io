import { h, qs } from '../utils/dom.js'

export function showToast(message, { type = 'info', duration = 2400 } = {}) {
    const root = qs('#toast-root')
    if (!root) return

    const el = h('div', {
        class: `toast toast--${type}`,
        role: 'status'
    }, message instanceof Node ? message : String(message))

    root.appendChild(el)

    let removed = false
    const remove = () => {
        if (removed) return
        removed = true
        el.style.transition = 'opacity .18s'
        el.style.opacity = '0'
        setTimeout(() => el.remove(), 200)
    }

    const timer = setTimeout(remove, Math.max(600, duration))
    el.addEventListener('click', () => {
        clearTimeout(timer)
        remove()
    })

    return el
}

export const toast = {
    info: (msg, d) => showToast(msg, { type: 'info', duration: d }),
    success: (msg, d) => showToast(msg, { type: 'success', duration: d }),
    error: (msg, d) => showToast(msg, { type: 'danger', duration: d || 3600 })
}
