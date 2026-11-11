/**
 * 显示转写、短音符是两个全局开关（状态挂在 html 的 class 上）。
 * 右下角工具列、词卡、表单预览都要跟着刷新，所以切换后广播一次。
 */

const EVENT = 'ln:toggles'

export function notifyToggles() {
    document.dispatchEvent(new CustomEvent(EVENT, {
        detail: {
            roman: document.documentElement.classList.contains('show-dual-text'),
            breve: document.documentElement.classList.contains('show-breve')
        }
    }))
}

/** 订阅开关变化；返回退订函数 */
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
