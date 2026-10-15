import { h, qs } from '../utils/dom.js'

let activeModal = null

/**
 * 打开模态框
 * @param {object} opts
 *   title           标题
 *   body            HTMLElement / string
 *   actions         [{ label, className?, onClick? }]
 *   closeOnBackdrop 默认 true
 *   onClose         关闭后回调
 * @returns {Function} close
 */
export function openModal({
    title = '',
    body = null,
    actions = [],
    closeOnBackdrop = true,
    onClose = null
} = {}) {
    const root = qs('#modal-root')
    if (!root) return () => {}

    // 关闭已有模态
    if (activeModal) activeModal.close()

    const backdrop = h('div', { class: 'modal-backdrop' })

    const modal = h('div', {
        class: 'modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title || '对话框'
    })

    const head = h('div', { class: 'modal__head' },
        h('div', { class: 'modal__title' }, title || ''),
        h('button', {
            class: 'btn btn--ghost btn--icon',
            type: 'button',
            'aria-label': '关闭',
            onclick: () => close()
        }, '✕')
    )
    modal.appendChild(head)

    const bodyEl = h('div', { class: 'modal__body' })
    if (body instanceof Node) bodyEl.appendChild(body)
    else if (body != null) bodyEl.appendChild(document.createTextNode(String(body)))
    modal.appendChild(bodyEl)

    if (actions.length) {
        const foot = h('div', { class: 'modal__foot' })
        for (const a of actions) {
            foot.appendChild(h('button', {
                class: 'btn ' + (a.className || ''),
                type: 'button',
                onclick: () => {
                    if (typeof a.onClick === 'function') {
                        try {
                            const r = a.onClick()
                            if (r === false) return // 阻止关闭
                        }
                        catch (err) { console.error(err); return }
                    }
                    close()
                }
            }, a.label))
        }
        modal.appendChild(foot)
    }

    root.appendChild(backdrop)
    root.appendChild(modal)
    root.setAttribute('aria-hidden', 'false')

    const onKey = (e) => {
        if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)

    if (closeOnBackdrop) backdrop.addEventListener('click', close)

    // 记录打开前的焦点
    const prevFocus = document.activeElement

    // 自动聚焦
    setTimeout(() => {
        const focusable = modal.querySelector(
            'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
        )
        if (focusable) focusable.focus()
    }, 0)

    function close() {
        if (!activeModal || activeModal.modal !== modal) return
        document.removeEventListener('keydown', onKey)
        root.replaceChildren()
        root.setAttribute('aria-hidden', 'true')
        activeModal = null
        if (prevFocus && typeof prevFocus.focus === 'function') {
            try { prevFocus.focus() } catch { /* ignore */ }
        }
        if (typeof onClose === 'function') onClose()
    }

    activeModal = { modal, close }
    return close
}

export function closeModal() {
    if (activeModal) activeModal.close()
}

export function isModalOpen() {
    return !!activeModal
}

/**
 * 确认对话框
 * @returns {Promise<boolean>}
 */
export function confirmModal({
    title = '确认',
    message = '',
    confirmLabel = '确定',
    cancelLabel = '取消',
    danger = false
} = {}) {
    return new Promise((resolve) => {
        let resolved = false
        const done = (v) => {
            if (resolved) return
            resolved = true
            resolve(v)
        }
        openModal({
            title,
            body: h('p', {}, message),
            actions: [
                { label: cancelLabel, onClick: () => done(false) },
                {
                    label: confirmLabel,
                    className: danger ? 'btn--danger' : 'btn--primary',
                    onClick: () => done(true)
                }
            ],
            onClose: () => done(false)
        })
    })
}
