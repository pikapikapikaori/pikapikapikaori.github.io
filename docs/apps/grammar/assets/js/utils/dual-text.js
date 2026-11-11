/** 原文与转写的双行显示。 */

import { notifyToggles } from './view-toggles.js'

export function annotateDualText(root, { range, toRoman, selector = 'td, th' } = {}) {
    if (!root || !(range instanceof RegExp) || typeof toRoman !== 'function') return
    // 默认只处理表格单元格：正文（notes 里的 ul、li、code）不加转写，避免干扰阅读
    const cells = root.querySelectorAll(selector)
    for (const cell of cells) {
        // 带输入框的格子（变格表、词卡）不处理；纯文本、<bdi>、<code> 都可以
        if (cell.querySelector('input, textarea, [contenteditable]')) continue
        // 内容会变的节点（表单里的「推导提示」）每次都要重算：先撤掉旧转写再加，
        // 否则提示文字换了、旧转写还挂在那儿
        for (const old of cell.querySelectorAll('.dual-text__roman')) old.remove()

        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
        const nodes = []
        while (walker.nextNode()) nodes.push(walker.currentNode)

        let changed = false
        for (const node of nodes) {
            const pieces = splitByScript(node.nodeValue, range)
            if (!pieces.some((piece) => piece.script)) continue

            // 原文已被包进 <bdi lang="mnc" dir="auto">：转写必须放在 bdi 外面，
            // 否则会继承原文的字体（[lang="mnc"] 选满文字体）与书写方向。
            // 整个 bdi 就是这个文本节点时，直接整段转写、插在 bdi 后面
            // （零宽连接符之类不在 scriptRange 里的字符会被切成多段，不能因此退回 bdi 内部）。
            const bdi = node.parentElement?.closest?.('bdi')
            if (bdi && bdi.parentNode && bdi.textContent === node.nodeValue) {
                const roman = toRoman(node.nodeValue)
                if (roman) {
                    bdi.parentNode.insertBefore(createRomanSpan(roman), bdi.nextSibling)
                    changed = true
                }
                continue
            }

            const frag = document.createDocumentFragment()
            for (const piece of pieces) {
                frag.appendChild(document.createTextNode(piece.text))
                if (!piece.script) continue
                frag.appendChild(createRomanSpan(toRoman(piece.text)))
            }
            node.parentNode.replaceChild(frag, node)
            changed = true
        }
        if (changed) cell.dataset.dualText = '1'
    }
}

/** 只切根节点 class，不重排 DOM */
export function setDualTextVisible(on) {
    document.documentElement.classList.toggle('show-dual-text', !!on)
    notifyToggles()
}

function splitByScript(text, range) {
    const out = []
    let current = null
    for (const ch of String(text ?? '')) {
        const script = range.test(ch)
        if (!current || current.script !== script) {
            current = { script, text: '' }
            out.push(current)
        }
        current.text += ch
    }
    return out
}

function createRomanSpan(roman) {
    const span = document.createElement('span')
    span.className = 'dual-text__roman'
    // 转写是拉丁字母：显式 LTR，且不设 lang（避免命中原文的字体规则）
    span.setAttribute('dir', 'ltr')
    span.textContent = roman
    return span
}
