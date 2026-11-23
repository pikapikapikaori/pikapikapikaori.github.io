const EVENT = 'ln:toggles'

export function notifyToggles() {
    document.dispatchEvent(new CustomEvent(EVENT, {
        detail: {
            roman: document.documentElement.classList.contains('show-dual-text'),
            breve: document.documentElement.classList.contains('show-breve')
        }
    }))
}

export function onToggles(handler) {
    const listener = (e) => handler(e.detail)
    document.addEventListener(EVENT, listener)
    return () => document.removeEventListener(EVENT, listener)
}

export function isRomanOn() {
    return document.documentElement.classList.contains('show-dual-text')
}

export function isBreveOn() {
    return document.documentElement.classList.contains('show-breve')
}
