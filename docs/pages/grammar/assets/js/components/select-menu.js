/**
 * 自绘下拉菜单
 *
 * 原生 <select> 的弹出层是浏览器画的，和站点主题对不上，位置也不受控。
 * 这里统一画一套列表：
 *
 *   - 文档级接管 <select>：点开时在控件正下方画同风格的列表，选中后照常写回
 *     select.value 并派发 change，其它代码完全不用改；
 *   - 自绘下拉（components/select-field.js）直接调用 openSelectMenu() 复用同一套列表。
 *
 * 列表项的文字统一经 bdiText 处理，原文（希伯来文 / 满文）会包进 <bdi>。
 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'

let menuEl = null
let session = null
let menuSeq = 0

export function isSelectMenuOpenFor(owner) {
    return !!session && !!owner && session.owner === owner
}

export function closeSelectMenu() {
    if (!menuEl && !session) return
    if (menuEl) {
        menuEl.remove()
        menuEl = null
    }
    if (!session) return
    const { owner, onClose } = session
    session = null
    owner?.setAttribute('aria-expanded', 'false')
    owner?.removeAttribute('aria-activedescendant')
    if (typeof onClose === 'function') onClose()
}

function placeMenu(anchor) {
    if (!menuEl || !anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.max(rect.width, 160)
    const gap = 4
    const height = menuEl.offsetHeight

    let top = rect.bottom + gap
    if (top + height > window.innerHeight - 8) {
        const above = rect.top - gap - height
        top = above >= 8 ? above : Math.max(8, window.innerHeight - height - 8)
    }
    const left = Math.min(rect.left, window.innerWidth - width - 8)

    menuEl.style.top = `${top}px`
    menuEl.style.left = `${left}px`
    menuEl.style.width = `${width}px`
}

/** 高亮第 index 项（循环），并把 aria-activedescendant 同步给触发控件 */
function highlight(index, { scroll = true } = {}) {
    if (!menuEl || !session) return
    const items = Array.from(menuEl.querySelectorAll('.select-menu__item'))
    if (!items.length) return
    session.activeIndex = ((index % items.length) + items.length) % items.length
    items.forEach((el, i) => el.classList.toggle('select-menu__item--active', i === session.activeIndex))
    if (scroll) items[session.activeIndex].scrollIntoView({ block: 'nearest' })
    session.owner?.setAttribute('aria-activedescendant', items[session.activeIndex].id)
}

function choose(index) {
    if (!session) return
    const item = session.items[index]
    if (!item || item.disabled) return
    const { owner, onPick } = session
    closeSelectMenu()
    owner?.focus?.({ preventScroll: true })
    if (typeof onPick === 'function') onPick(item.value, item)
}

/**
 * 打开下拉列表
 *
 * @param {object} options
 *   anchor      列表挂靠的元素（定位用）
 *   items       [{ value, label, group?, disabled? }]
 *   value       当前值（用于高亮 / 打勾）
 *   lang        bdi 判定语言
 *   owner       aria-expanded / aria-activedescendant 的载体（默认 anchor）
 *   activeIndex 打开时的高亮项（缺省为当前值）
 *   onPick      (value, item) => void
 *   onClose     () => void
 */
export function openSelectMenu({
    anchor,
    items,
    value = '',
    lang = null,
    owner = null,
    activeIndex = null,
    onPick = null,
    onClose = null
}) {
    if (!anchor || !Array.isArray(items) || !items.length) return
    closeSelectMenu()

    session = {
        id: `select-menu-${++menuSeq}`,
        anchor,
        items,
        owner: owner || anchor,
        activeIndex: 0,
        onPick,
        onClose
    }

    menuEl = h('div', { class: 'select-menu', role: 'listbox', id: session.id })

    let lastGroup = null
    items.forEach((item, index) => {
        if (item.group && item.group !== lastGroup) {
            menuEl.appendChild(h('div', { class: 'select-menu__group' }, item.group))
            lastGroup = item.group
        }
        const selected = item.value === value
        menuEl.appendChild(h('div', {
            id: `${session.id}-opt-${index}`,
            class: 'select-menu__item'
                + (selected ? ' select-menu__item--selected' : '')
                + (item.disabled ? ' select-menu__item--disabled' : ''),
            role: 'option',
            'aria-selected': String(selected),
            'aria-disabled': item.disabled ? 'true' : null,
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => choose(index)
        },
        h('span', { class: 'select-menu__label' }, bdiText(item.label, lang)),
        selected ? h('span', { class: 'select-menu__check' }, '✓') : null
        ))
    })

    document.body.appendChild(menuEl)
    session.owner.setAttribute('aria-expanded', 'true')

    const selectedIndex = items.findIndex((item) => item.value === value)
    placeMenu(anchor)
    highlight(activeIndex == null ? (selectedIndex < 0 ? 0 : selectedIndex) : activeIndex, { scroll: false })
}

/* ---------------- 原生 <select> 的接管 ---------------- */

function itemsOf(select) {
    const out = []
    for (const option of select.options) {
        if (option.disabled) continue
        const group = option.parentElement instanceof HTMLOptGroupElement
            ? option.parentElement.label
            : null
        out.push({ value: option.value, label: option.textContent, group })
    }
    return out
}

function openNativeSelect(select) {
    if (isSelectMenuOpenFor(select)) {
        closeSelectMenu()
        return
    }
    const items = itemsOf(select)
    if (!items.length) return
    openSelectMenu({
        anchor: select,
        owner: select,
        items,
        value: select.value,
        lang: select.getAttribute('lang'),
        onPick: (value) => {
            select.value = value
            select.dispatchEvent(new Event('change', { bubbles: true }))
        }
    })
}

function onPointerDown(e) {
    const target = e.target instanceof Element ? e.target : null
    if (!target) return

    const select = target.closest('select')

    if (session) {
        // 点菜单内部：交给菜单项自己处理
        if (menuEl && menuEl.contains(target)) return
        // 点触发控件：交给控件自己开关
        const onOwner = session.owner === target || (session.owner?.contains?.(target) ?? false)
        const onAnchor = session.anchor === target || (session.anchor?.contains?.(target) ?? false)
        if (onOwner || onAnchor) {
            // 原生 <select> 再点一次要收起自绘列表，同时必须挡掉浏览器自己的弹层
            if (select) {
                e.preventDefault()
                closeSelectMenu()
            }
            return
        }
        closeSelectMenu()
    }

    if (!select || select.disabled || select.multiple) return
    e.preventDefault()
    select.focus({ preventScroll: true })
    openNativeSelect(select)
}

function onKeyDown(e) {
    if (session) {
        if (e.key === 'Escape' || e.key === 'Tab') {
            closeSelectMenu()
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopPropagation()
            highlight(session.activeIndex + 1)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            highlight(session.activeIndex - 1)
        } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault()
            e.stopPropagation()
            highlight(e.key === 'Home' ? 0 : session.items.length - 1)
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            choose(session.activeIndex)
        }
        return
    }

    const select = e.target instanceof Element ? e.target.closest('select') : null
    if (!select || select.disabled || select.multiple) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openNativeSelect(select)
    }
}

export function enhanceSelects() {
    if (document.body.dataset.selectMenu === 'on') return
    document.body.dataset.selectMenu = 'on'

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', closeSelectMenu)
    // 页面滚动时收起菜单，但菜单自己的滚动（选项列表）不能算
    window.addEventListener('scroll', (e) => {
        if (!menuEl) return
        if (e.target instanceof Node && menuEl.contains(e.target)) return
        closeSelectMenu()
    }, true)
}
