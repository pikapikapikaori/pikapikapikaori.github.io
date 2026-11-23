import { notifyToggles } from './view-toggles.js'

export const BREVE = '\u0306'

const PRECOMPOSED = '\u0103\u0115\u011F\u012D\u014F\u016D\u0102\u0114\u011E\u012C\u014E\u016C'
const BREVE_CHAR = new RegExp(`[${PRECOMPOSED}${BREVE}]`)

export function foldBreve(text) {
    return String(text ?? '')
        .normalize('NFD')
        .split(BREVE).join('')
        .normalize('NFC')
}

export function annotateBreves(root, { selector = 'td, th' } = {}) {
    if (!root || !selector) return
    for (const cell of root.querySelectorAll(selector)) {
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
    span.setAttribute('aria-hidden', 'true')
    span.textContent = BREVE
    return span
}
