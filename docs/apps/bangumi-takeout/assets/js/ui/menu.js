import { escapeHtml } from '../dom.js'

let activeMenu = null

export function closeMenu() {
    if (activeMenu) activeMenu.close()
}

// The popup is appended to body and positioned with fixed coordinates, so a
// scrolling page or the footer cannot clip it.
export function openMenu({ anchor, items, current, onPick, emptyText = '暂无可选项' }) {
    // Clicking the same trigger again closes its menu instead of rebuilding it.
    if (activeMenu?.anchor === anchor) {
        activeMenu.close()
        return { close: () => {} }
    }
    if (activeMenu) activeMenu.close()

    const pop = document.createElement('div')
    pop.className = 'menu-pop'
    pop.setAttribute('role', 'listbox')
    pop.innerHTML = items.length
        ? items.map(item => {
            const selected = String(item.value) === String(current)
            return `
                <button type="button" class="menu-option ${selected ? 'is-cur' : ''}" role="option"
                    data-value="${escapeHtml(item.value)}" aria-selected="${selected}">
                    <span class="menu-label">
                        <span>${escapeHtml(item.label)}</span>
                        ${item.sub ? `<span class="menu-sub">${escapeHtml(item.sub)}</span>` : ''}
                    </span>
                    ${item.tag ? `<span class="cred-tag">${escapeHtml(item.tag)}</span>` : ''}
                    ${selected ? '<span class="menu-check" aria-hidden="true">✓</span>' : ''}
                </button>
            `
        }).join('')
        : `<div class="menu-empty">${escapeHtml(emptyText)}</div>`
    document.body.appendChild(pop)

    const rect = anchor.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16)
    pop.style.width = width + 'px'
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    let top = rect.bottom + 6
    const height = pop.getBoundingClientRect().height
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6)
    pop.style.left = left + 'px'
    pop.style.top = top + 'px'
    anchor.setAttribute('aria-expanded', 'true')

    let closed = false
    const close = () => {
        if (closed) return
        closed = true
        if (pop.isConnected) pop.remove()
        anchor.setAttribute('aria-expanded', 'false')
        document.removeEventListener('click', outside, true)
        document.removeEventListener('keydown', keyclose, true)
        if (activeMenu && activeMenu.pop === pop) activeMenu = null
    }
    const restoreFocus = () => {
        const target = anchor.isConnected
            ? anchor
            : (anchor.id ? document.getElementById(anchor.id) : null)
        if (target) target.focus({ preventScroll: true })
    }
    const outside = event => {
        if (!pop.contains(event.target) && !anchor.contains(event.target)) close()
    }
    const options = () => Array.from(pop.querySelectorAll('.menu-option'))
    const focusOption = index => {
        const list = options()
        if (!list.length) return
        const next = (index + list.length) % list.length
        list[next].focus()
    }
    const keyclose = event => {
        if (event.key === 'Escape') {
            event.stopPropagation()
            close()
            anchor.focus()
            return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const list = options()
        if (!list.length) return
        const currentIndex = list.indexOf(document.activeElement)
        if (event.key === 'Home') focusOption(0)
        else if (event.key === 'End') focusOption(list.length - 1)
        else if (event.key === 'ArrowDown') focusOption(currentIndex + 1)
        else focusOption(currentIndex - 1)
    }

    setTimeout(() => {
        if (closed) return
        document.addEventListener('click', outside, true)
        document.addEventListener('keydown', keyclose, true)
    }, 0)

    options().forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value
            close()
            const result = onPick?.(value)
            // A pick may re-render the page and replace the trigger; wait for
            // that render before returning focus to the (new) trigger.
            if (result && typeof result.then === 'function') {
                result.then(restoreFocus, restoreFocus)
            } else {
                restoreFocus()
            }
        })
    })

    const first = pop.querySelector('.menu-option')
    if (first) first.focus()

    activeMenu = { anchor, pop, close }
    return { close }
}
