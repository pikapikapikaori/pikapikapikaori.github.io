/**
 * 「原文 + 转写」双行显示
 *
 * 表格里存的是原文（满文 / 天城文），转写由语言档案 `data/script/<lang>.js` 的
 * `toRoman` 现场算出来。这里只做 DOM 层的事：
 *
 *   - `annotateDualText()` 在每个**原文片段**后面插一个转写 span（中文等其它字符原样保留），
 *     不整格复制文本，所以「ᠠᵃ 写 / 将写」这种混排只给满文部分加注；
 *   - `setDualTextVisible()` 只切根节点上的 class，CSS 决定显示与隐藏。
 *
 * 这个模块不含任何具体语言的知识：脚本范围与转换函数都由调用方传入。
 */

/**
 * @param {HTMLElement} root   要处理的容器（处理其中的 td / th / dd / li）
 * @param {object} options
 *   range    RegExp  原文的字符范围（如 /[\u1800-\u18AF]/）
 *   toRoman  (text) => string  原文 → 转写
 */
export function annotateDualText(root, { range, toRoman } = {}) {
    if (!root || !(range instanceof RegExp) || typeof toRoman !== 'function') return
    const cells = root.querySelectorAll('td, th, dd, li')
    for (const cell of cells) {
        if (cell.dataset.dualText === '1') continue
        // 带输入框的格子（变格表 / 词卡）不处理；纯文本、<bdi>、<code> 都可以
        if (cell.querySelector('input, textarea, [contenteditable]')) continue
        if (cell.querySelector('.dual-text__roman')) continue

        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
        const nodes = []
        while (walker.nextNode()) nodes.push(walker.currentNode)

        let changed = false
        for (const node of nodes) {
            const pieces = splitByScript(node.nodeValue, range)
            if (!pieces.some((piece) => piece.script)) continue

            // 原文已经被 applyBdi 包进 <bdi lang="mnc" dir="auto">：转写必须放在 bdi 外面，
            // 否则会继承原文的字体（[lang="mnc"] 选满文字体）与书写方向。
            const bdi = node.parentElement?.closest?.('bdi')
            if (bdi && bdi.parentNode && bdi.textContent === node.nodeValue
                && pieces.length === 1 && pieces[0].script) {
                bdi.parentNode.insertBefore(createRomanSpan(toRoman(node.nodeValue)), bdi.nextSibling)
                changed = true
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

/** 切换显示：只改根节点 class，不重排 DOM */
export function setDualTextVisible(on) {
    document.documentElement.classList.toggle('show-dual-text', !!on)
}

/** 把一段文字按「原文 / 非原文」切成若干段 */
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
