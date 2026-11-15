export const tags = {
    div: 'div',
    span: 'span',
    input: 'input',
    button: 'button',
    img: 'img',
    template: 'template',
    canvas: 'canvas',
    footer: 'footer',
    li: 'li',
    a: 'a'
}

export const eventNames = {
    click: 'click',
    keydown: 'keydown',
    keyup: 'keyup',
    pointerdown: 'pointerdown',
    pointerup: 'pointerup',
    pointercancel: 'pointercancel',
    touchstart: 'touchstart',
    touchend: 'touchend',
    scroll: 'scroll',
    resize: 'resize',
    change: 'change',
    input: 'input',
    focusout: 'focusout',
    blur: 'blur',
    load: 'load',
    error: 'error',
    mouseover: 'mouseover',
    animationend: 'animationend'
}

function splitNames(value) {
    return String(value ?? '').split(/\s+/).filter(Boolean)
}

export function on(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== 'function') return () => {}

    target.addEventListener(type, handler, options)

    return () => off(target, type, handler, options)
}

export function off(target, type, handler, options) {
    if (!target || typeof target.removeEventListener !== 'function') return

    target.removeEventListener(type, handler, options)
}

export function addClass(el, value) {
    if (!el || !el.classList) return

    const names = splitNames(value)
    if (!names.length) return

    el.classList.add(...names)
}

export function removeClass(el, value) {
    if (!el || !el.classList) return

    const names = splitNames(value)
    if (!names.length) return

    el.classList.remove(...names)
}

export function toggleClass(el, value, force) {
    if (!el || !el.classList) return

    const names = splitNames(value)
    if (!names.length) return

    if (force === undefined) {
        names.forEach(name => el.classList.toggle(name))
        return
    }

    names.forEach(name => el.classList.toggle(name, Boolean(force)))
}

export function hasClass(el, value) {
    if (!el || !el.classList) return false

    const names = splitNames(value)
    if (!names.length) return false

    return names.every(name => el.classList.contains(name))
}

export function createElement(tag, options = {}) {
    const el = document.createElement(tag)

    if (options.className) addClass(el, options.className)
    if (options.text !== undefined) el.textContent = options.text
    if (options.html !== undefined) el.innerHTML = options.html
    if (options.attrs) setAttrs(el, options.attrs)
    if (options.data) setData(el, options.data)

    return el
}

export function query(selector, root = document) {
    if (!selector || !root || typeof root.querySelector !== 'function') return null

    try {
        return root.querySelector(selector)
    }
    catch {
        return null
    }
}

export function queryAll(selector, root = document) {
    if (!selector || !root || typeof root.querySelectorAll !== 'function') return []

    try {
        return Array.from(root.querySelectorAll(selector))
    }
    catch {
        return []
    }
}

export function byId(id, root = document) {
    if (!id || !root || typeof root.getElementById !== 'function') return null

    return root.getElementById(id) || null
}

export function byClass(className, root = document) {
    const name = String(className ?? '').trim()
    if (!name) return null

    return query(`.${name}`, root)
}

export function setCssVar(name, value, root = document.documentElement) {
    if (!name || !root || !root.style) return

    root.style.setProperty(name, value)
}

export function removeCssVar(name, root = document.documentElement) {
    if (!name || !root || !root.style) return

    root.style.removeProperty(name)
}

export function setStyleProperty(element, name, value, priority) {
    if (!element || !element.style || !name) return

    element.style.setProperty(name, value, priority)
}

export function removeStyleProperty(element, name) {
    if (!element || !element.style || !name) return

    element.style.removeProperty(name)
}

export function setAttrs(el, attrs) {
    if (!el || typeof el.setAttribute !== 'function' || !attrs) return

    Object.entries(attrs).forEach(([name, value]) => {
        if (value === null || value === undefined) {
            el.removeAttribute(name)
            return
        }

        el.setAttribute(name, String(value))
    })
}

export function getData(el, key, fallback = null) {
    const value = el?.dataset?.[key]

    return value === undefined ? fallback : value
}

export function setData(el, key, value) {
    if (!el || !el.dataset) return

    if (key && typeof key === 'object') {
        Object.entries(key).forEach(([name, item]) => writeData(el, name, item))
        return
    }

    writeData(el, key, value)
}

function writeData(el, key, value) {
    if (!key) return

    if (value === null || value === undefined) {
        delete el.dataset[key]
        return
    }

    el.dataset[key] = String(value)
}
