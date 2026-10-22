/**
 * 自定义下拉菜单
 *
 * 原生 <select> 的弹出层是浏览器画的，和站点主题对不上，位置也不受控。
 * 这里在文档级别接管所有 <select>：点开时在控件正下方画一个同风格的列表，
 * 选中后照常写回 select.value 并派发 change，其它代码完全不用改。
 */

import { h } from '../utils/dom.js'
import { bdiText } from '../utils/bdi.js'

let menuEl = null
let currentSelect = null
let activeIndex = 0

function closeMenu() {
    menuEl?.remove()
    menuEl = null
    currentSelect?.setAttribute('aria-expanded', 'false')
    currentSelect = null
}

function optionsOf(select) {
    return Array.from(select.options).filter((o) => !o.disabled)
}

function placeMenu(select) {
    if (!menuEl) return
    const rect = select.getBoundingClientRect()
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

function highlight(index) {
    if (!menuEl) return
    const items = Array.from(menuEl.querySelectorAll('.select-menu__item'))
    if (!items.length) return
    activeIndex = (index + items.length) % items.length
    items.forEach((el, i) => el.classList.toggle('select-menu__item--active', i === activeIndex))
    items[activeIndex].scrollIntoView({ block: 'nearest' })
}

function choose(select, option) {
    if (!option) return
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    closeMenu()
}

function openMenu(select) {
    if (currentSelect === select) {
        closeMenu()
        return
    }
    closeMenu()

    const options = optionsOf(select)
    if (!options.length) return

    currentSelect = select
    menuEl = h('div', { class: 'select-menu', role: 'listbox' })

    let lastGroup = null
    for (const option of options) {
        const group = option.parentElement instanceof HTMLOptGroupElement
            ? option.parentElement.label
            : null
        if (group && group !== lastGroup) {
            menuEl.appendChild(h('div', { class: 'select-menu__group' }, group))
            lastGroup = group
        }

        menuEl.appendChild(h('div', {
            class: 'select-menu__item' + (option.selected ? ' select-menu__item--selected' : ''),
            role: 'option',
            'aria-selected': String(option.selected),
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => choose(select, option)
        },
        h('span', { class: 'select-menu__label' },
            bdiText(option.textContent, select.getAttribute('lang'))),
        option.selected ? h('span', { class: 'select-menu__check' }, '✓') : null
        ))
    }

    document.body.appendChild(menuEl)
    select.setAttribute('aria-expanded', 'true')

    // 打开时让当前项高亮
    const selectedIdx = options.findIndex((o) => o.selected)
    placeMenu(select)
    highlight(selectedIdx < 0 ? 0 : selectedIdx)
}

function onPointerDown(e) {
    const select = e.target instanceof Element ? e.target.closest('select') : null
    if (select) {
        if (select.disabled || select.multiple) return
        e.preventDefault()
        select.focus({ preventScroll: true })
        openMenu(select)
        return
    }
    if (menuEl && !e.target.closest('.select-menu')) closeMenu()
}

function onKeyDown(e) {
    const select = e.target instanceof Element ? e.target.closest('select') : null

    if (currentSelect && (e.key === 'Escape' || e.key === 'Tab')) {
        closeMenu()
        return
    }

    if (currentSelect) {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            highlight(activeIndex + 1)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            highlight(activeIndex - 1)
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            choose(currentSelect, optionsOf(currentSelect)[activeIndex])
        } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault()
            highlight(e.key === 'Home' ? 0 : -1)
        }
        return
    }

    if (!select || select.disabled || select.multiple) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu(select)
    }
}

export function enhanceSelects() {
    if (document.body.dataset.selectMenu === 'on') return
    document.body.dataset.selectMenu = 'on'

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', closeMenu)
    // 页面滚动时收起菜单，但菜单自己的滚动（选项列表）不能算
    window.addEventListener('scroll', (e) => {
        if (!menuEl) return
        if (e.target instanceof Node && menuEl.contains(e.target)) return
        closeMenu()
    }, true)
}
