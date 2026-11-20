// One mask serves every slow action. The page stays in the document and keeps
// its state, but `inert` takes it out of clicks, focus and the tab order.
// Overlapping calls share the same mask; the last one to close removes it.
let mask = null
let labelEl = null
let cancelEl = null
let entries = []
let inertRecords = []
let inertObserver = null
let focusRecord = null

function build() {
    mask = document.createElement('div')
    mask.className = 'loading-mask'
    mask.id = 'loading-mask'
    mask.hidden = true
    mask.tabIndex = -1
    mask.setAttribute('role', 'dialog')
    mask.setAttribute('aria-modal', 'true')
    mask.setAttribute('aria-labelledby', 'loading-text')
    mask.innerHTML = `
        <div class="loading-card">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span class="loading-text" id="loading-text" role="status" aria-live="polite"></span>
            <button type="button" class="btn loading-cancel" id="loading-cancel" hidden>取消</button>
        </div>
    `
    labelEl = mask.querySelector('.loading-text')
    cancelEl = mask.querySelector('.loading-cancel')
    cancelEl.addEventListener('click', () => {
        top()?.onCancel?.()
    })
    // The page keeps document-level handlers; a press on the mask must not
    // reach them.
    ;['click', 'mousedown', 'keydown'].forEach(type => {
        mask.addEventListener(type, event => event.stopPropagation())
    })
    // A modal dialog keeps the tab order inside itself. Without this the key
    // leaves the mask for the browser chrome, where the cancel button cannot
    // be reached.
    mask.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return
        event.preventDefault()
        focusInner()
    })
    document.body.appendChild(mask)
}

function focusInner() {
    if (cancelEl.hidden) mask.focus({ preventScroll: true })
    else cancelEl.focus({ preventScroll: true })
}

function top() {
    return entries[entries.length - 1] || null
}

function paint() {
    const entry = top()
    if (!entry) return
    labelEl.textContent = entry.label
    if (entry.cancelLabel) cancelEl.textContent = entry.cancelLabel
    const cancelFocused = document.activeElement === cancelEl
    cancelEl.hidden = !entry.onCancel
    // Hiding the focused button hands focus to the page behind the mask.
    if (cancelFocused && cancelEl.hidden) mask.focus({ preventScroll: true })
}

function lockBody() {
    inertRecords = []
    for (const child of Array.from(document.body.children)) {
        if (child === mask) continue
        inertRecords.push([child, child.hasAttribute('inert')])
        child.setAttribute('inert', '')
    }
    // Menus and panels append themselves to `body` after the mask opens; the
    // observer keeps them inside the same lock.
    inertObserver = new MutationObserver(records => {
        records.forEach(record => {
            record.addedNodes.forEach(node => {
                if (!(node instanceof HTMLElement) || node === mask) return
                if (node.hasAttribute('inert')) return
                inertRecords.push([node, false])
                node.setAttribute('inert', '')
            })
        })
    })
    inertObserver.observe(document.body, { childList: true })
}

function unlockBody() {
    inertObserver?.disconnect()
    inertObserver = null
    for (const [child, already] of inertRecords) {
        if (!already) child.removeAttribute('inert')
    }
    inertRecords = []
}

function resolveFocus(target) {
    if (typeof target !== 'function') return target || null
    try {
        return target() || null
    } catch {
        return null
    }
}

function focusElement(target) {
    const el = resolveFocus(target)
    if (!el || !el.isConnected || el.disabled) return false
    // A status region is not focusable on its own; a `tabindex` lets it take
    // the focus without entering the tab order.
    if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: true })
    return document.activeElement === el
}

// A page rebuild or a disabled control may replace the element that opened the
// mask, so the caller can name a stable target.
function restoreFocus() {
    const record = focusRecord
    focusRecord = null
    if (!record) return
    const candidates = [
        record.returnFocus,
        record.fallbackFocus,
        () => document.getElementById('main'),
        () => document.querySelector('#main .form-status'),
    ]
    for (const candidate of candidates) {
        if (focusElement(candidate)) return
    }
}

function drop(entry) {
    const index = entries.indexOf(entry)
    if (index !== -1) entries.splice(index, 1)
    if (entries.length) {
        paint()
        return
    }
    mask.hidden = true
    unlockBody()
    restoreFocus()
}

// `returnFocus` names the control the action belongs to when the pressed
// element itself is replaced or hidden by the action. `fallbackFocus` names
// what takes over when that control is gone or disabled.
export function beginLoading(label, {
    onCancel = null, cancelLabel = null, returnFocus = null, fallbackFocus = null,
} = {}) {
    if (!mask) build()
    const opening = !entries.length
    const entry = {
        label: String(label ?? ''),
        onCancel,
        cancelLabel,
    }
    if (opening) {
        const active = document.activeElement
        focusRecord = {
            // A click in WebKit may leave the body focused; it is no place to
            // return to.
            returnFocus: returnFocus
                || (active instanceof HTMLElement && active !== document.body ? active : null),
            fallbackFocus,
        }
        lockBody()
        mask.hidden = false
    }
    entries.push(entry)
    paint()
    if (opening) focusInner()

    let closed = false
    return {
        close() {
            if (closed) return
            closed = true
            drop(entry)
        },
        setLabel(text) {
            entry.label = String(text ?? '')
            if (top() === entry) paint()
        },
        update({ label: nextLabel, onCancel: nextCancel = null, cancelLabel: nextCancelLabel = null } = {}) {
            entry.label = String(nextLabel ?? entry.label)
            entry.onCancel = nextCancel
            entry.cancelLabel = nextCancelLabel
            if (top() === entry) paint()
        },
    }
}
