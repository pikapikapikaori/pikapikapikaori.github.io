/**
 * <bdi> 包裹：书写方向与界面不同的文字（满文竖写、希伯来文 RTL）按 Unicode 字符范围切成片段，
 * 只包命中范围的字符，同一段文本里的中文 / 拉丁转写保持原样。
 */

import { h, frag } from './dom.js'
import { getLanguage } from '../data/languages.js'
import { BDI_LANGS } from '../config/config.js'

const JOINERS = new Set(['\u200c', '\u200d'])

export function needsBdi(lang) {
    return !!lang && Object.prototype.hasOwnProperty.call(BDI_LANGS, lang)
}

export function bdiDir(lang) {
    const meta = getLanguage(lang)
    return meta && meta.rtl ? 'rtl' : 'auto'
}

function scriptRe(lang) {
    const re = BDI_LANGS[lang]
    return re instanceof RegExp ? re : null
}

function isScriptChar(ch, re) {
    return JOINERS.has(ch) || re.test(ch)
}

/**
 * 把文本切成「该文字 / 其他」的连续片段。
 * 夹在两段原文之间的分隔符（词根连字符 `ק-ט-ל`、gershayim `ע"ו`）并入同一片段，
 * 否则每个字母各自成一个 <bdi>，RTL 字母会按 LTR 顺序排开，词根看起来就是反的。
 */
export function splitScriptRuns(text, lang) {
    const re = scriptRe(lang)
    const source = String(text ?? '')
    if (!re || !source) return [{ text: source, script: false }]

    const chars = [...source]
    const script = chars.map((ch) => isScriptChar(ch, re))
    for (let i = 1; i < chars.length - 1; i += 1) {
        if (!script[i] && script[i - 1] && script[i + 1]) script[i] = true
    }

    const runs = []
    let buf = ''
    let current = null
    chars.forEach((ch, i) => {
        if (current === null || script[i] === current) {
            buf += ch
            current = script[i]
        } else {
            runs.push({ text: buf, script: current })
            buf = ch
            current = script[i]
        }
    })
    if (buf || current !== null) runs.push({ text: buf, script: !!current })
    return runs
}

export function bdiText(text, lang) {
    const runs = splitScriptRuns(text, lang)
    if (!needsBdi(lang) || !runs.some((run) => run.script)) return document.createTextNode(String(text ?? ''))
    const dir = bdiDir(lang)
    return frag(...runs.map((run) => (run.script
        ? h('bdi', { lang, dir }, run.text)
        : document.createTextNode(run.text))))
}

/** 不判定内容，整段直接包成一个 <bdi> */
export function bdiNode(text, lang) {
    return h('bdi', { lang: needsBdi(lang) ? lang : undefined, dir: needsBdi(lang) ? bdiDir(lang) : undefined },
        String(text ?? ''))
}

function textNodesOf(root) {
    const out = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
            const parent = node.parentNode
            if (parent && parent.closest && parent.closest('bdi')) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        }
    })
    while (walker.nextNode()) out.push(walker.currentNode)
    return out
}

export function hasScript(text, lang) {
    const re = scriptRe(lang)
    if (!re || !text) return false
    return [...String(text)].some((ch) => re.test(ch))
}

/**
 * 原生 placeholder 不能带标记，所以含原文的 placeholder 用叠一层自己画的提示；
 * 输入框有内容时自动隐藏，已经包在 .ghost-input 里的（那些自己处理）跳过。
 */
export function applyBdiPlaceholders(root, lang = null) {
    if (!root || !root.querySelectorAll) return root
    for (const input of root.querySelectorAll('input[placeholder], textarea[placeholder]')) {
        const code = input.getAttribute('lang') || lang
        if (!needsBdi(code)) continue
        const text = input.getAttribute('placeholder') || ''
        if (!hasScript(text, code)) continue
        if (input.closest('.ghost-input')) continue

        const hint = h('span', { class: 'ghost-input__hint ghost-input__hint--placeholder', 'aria-hidden': 'true' },
            bdiText(text, code))
        const wrap = h('span', { class: 'ghost-input' }, hint, input)
        input.setAttribute('placeholder', '')
        if (input.parentNode) input.parentNode.insertBefore(wrap, input)
        wrap.appendChild(input)

        const sync = () => { hint.hidden = !!input.value }
        input.addEventListener('input', sync)
        input.addEventListener('change', sync)
        sync()
    }
    return root
}

/** 处理一棵子树里所有带 `lang` 的元素；重复调用安全（已包过的跳过） */
export function applyBdi(root, defaultLang = null) {
    if (!root || !root.querySelectorAll) return root
    const targets = []
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute('lang')) targets.push(root)
    for (const el of root.querySelectorAll('[lang]')) targets.push(el)

    for (const el of targets) {
        const lang = el.getAttribute('lang')
        if (!needsBdi(lang)) continue
        for (const node of textNodesOf(el)) {
            const runs = splitScriptRuns(node.nodeValue, lang)
            if (!runs.some((run) => run.script)) continue
            node.parentNode.replaceChild(bdiText(node.nodeValue, lang), node)
        }
    }
    // 没标 lang 的元素（如目录项、标题）按传入的语言再扫一遍
    if (defaultLang && needsBdi(defaultLang)) {
        for (const node of textNodesOf(root)) {
            const owner = node.parentElement && node.parentElement.closest('[lang]')
            if (owner && owner.getAttribute('lang') !== defaultLang) continue
            if (owner) continue
            const runs = splitScriptRuns(node.nodeValue, defaultLang)
            if (!runs.some((run) => run.script)) continue
            node.parentNode.replaceChild(bdiText(node.nodeValue, defaultLang), node)
        }
    }
    applyBdiPlaceholders(root, defaultLang)
    return root
}
