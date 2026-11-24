import { h } from '../utils/dom.js'
import { bdiFragment } from '../utils/bdi.js'
import { createEditableInput } from './editable-input.js'

export function createGhostInput({
    value = '',
    lang = null,
    bdiLang = null,
    dir = null,
    className = 'input',
    placeholder = '',
    dataset = null,
    disabled = false,
    getGhost = null,
    spaceKey = false,
    onInput = null
} = {}) {
    const scriptLang = bdiLang || lang
    const hint = h('span', { class: 'ghost-input__hint', 'aria-hidden': 'true' })

    const input = createEditableInput({
        value,
        lang,
        bdiLang,
        dir,
        className,
        placeholder,
        dataset,
        disabled,
        onPlaceholderChange: () => refresh(),
        onValueChange: () => refresh(),
        onInput: (e) => {
            refresh()
            if (typeof onInput === 'function') onInput(e)
        }
    })

    const showSpaceKey = spaceKey && !disabled
    const el = h('span', { class: showSpaceKey ? 'ghost-input ghost-input--space' : 'ghost-input' }, hint, input,
        showSpaceKey ? h('span', { class: 'ghost-input__key', 'aria-hidden': 'true' }, 'Space') : null)

    function ghostTarget() {
        return typeof getGhost === 'function' ? String(getGhost() || '') : ''
    }

    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return
        const target = ghostTarget()
        const current = input.value
        if (!target || target === current || !target.startsWith(current)) return
        e.preventDefault()
        input.value = target
        input.dispatchEvent(new Event('input'))
        const range = document.createRange()
        range.selectNodeContents(input)
        range.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(range)
        }
        refresh()
    })

    function refresh() {
        const target = ghostTarget()
        const current = input.value
        const showGhost = !!target && target !== current && target.startsWith(current)

        if (showGhost) {
            hint.hidden = false
            hint.replaceChildren(
                h('span', { class: 'ghost-input__typed' }, bdiFragment(current, scriptLang)),
                h('span', { class: 'ghost-input__rest' }, bdiFragment(target.slice(current.length), scriptLang)),
                h('span', { class: 'ghost-input__key ghost-input__key--tab', 'aria-hidden': 'true' }, 'Tab')
            )
            return
        }

        const tip = input.placeholder
        if (!current && tip) {
            hint.hidden = false
            hint.replaceChildren(h('span', { class: 'ghost-input__rest' }, bdiFragment(tip, scriptLang)))
            return
        }

        hint.hidden = true
        hint.replaceChildren()
    }

    refresh()
    return { el, input, refresh }
}
