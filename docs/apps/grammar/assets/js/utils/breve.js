/** 短音符的折叠（比较用）与注解（显示用）。 */

import { notifyToggles } from './view-toggles.js'

export const BREVE = '\u0306'

/** 预组合的带短音符字母（ă ĕ ğ ĭ ŏ ŭ 及其大写），兜住不是 NFD 形式的文本 */
const PRECOMPOSED = '\u0103\u0115\u011F\u012D\u014F\u016D\u0102\u0114\u011E\u012C\u014E\u016C'
const BREVE_CHAR = new RegExp(`[${PRECOMPOSED}${BREVE}]`)

/** 比较用：去掉短音符（长音符等其它符号保留） */
export function foldBreve(text) {
    return String(text ?? '')
        .normalize('NFD')
        .split(BREVE).join('')
        .normalize('NFC')
}

/**
 * 把短音符包进 span，便于用 CSS 隐藏、显示。可重复调用（每次先撤掉旧标记）。
 */
export function annotateBreves(root, { selector = 'td, th' } = {}) {
    if (!root || !selector) return
    for (const cell of root.querySelectorAll(selector)) {
        // 撤掉旧的包裹时要把短音符还回文本，否则重复调用会把符号吃掉
        for (const old of [...cell.querySelectorAll('.breve')]) old.replaceWith(old.textContent)
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
        const nodes = []
        while (walker.nextNode()) nodes.push(walker.currentNode)

        for (const node of nodes) {
            const text = node.nodeValue
            if (!text || !BREVE_CHAR.test(text)) continue
            const frag = document.createDocumentFragment()
            for (const ch of text) {
                if (ch === BREVE) {
                    frag.appendChild(breveSpan())
                    continue
                }
                // 预组合形式：拆成基底字母 + 短音符
                const nfd = ch.normalize('NFD')
                if (nfd.includes(BREVE)) {
                    frag.appendChild(document.createTextNode(nfd.split(BREVE).join('').normalize('NFC')))
                    frag.appendChild(breveSpan())
                    continue
                }
                frag.appendChild(document.createTextNode(ch))
            }
            node.parentNode.replaceChild(frag, node)
        }
    }
}

export function setBreveVisible(on) {
    document.documentElement.classList.toggle('show-breve', !!on)
    notifyToggles()
}

function breveSpan() {
    const span = document.createElement('span')
    span.className = 'breve'
    // 只是排版用的符号，读屏念出来反而干扰
    span.setAttribute('aria-hidden', 'true')
    span.textContent = BREVE
    return span
}
