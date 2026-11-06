/** 按字符范围把原文包进 <bdi>。 */

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

/** 文档正文里能靠字符范围认出来的文字：命中的片段用各自的字体显示 */
const SCRIPT_TEXT_RANGES = [
    ['mnc', /[\u1800-\u18AF]/],
    ['he', /[\u0590-\u05FF\uFB1D-\uFB4F]/],
    ['sa', /[\u0900-\u097F]/],
    ['grc', /[\u0370-\u03FF\u1F00-\u1FFF]/]
]

function scriptOf(text) {
    for (const [lang, re] of SCRIPT_TEXT_RANGES) {
        if (re.test(text)) return lang
    }
    return null
}

/** 把一段文字切成「该文字 / 其它」两种片段 */
function splitByRange(text, re) {
    const runs = []
    let buf = ''
    let current = null
    for (const ch of text) {
        const hit = re.test(ch)
        if (current === null || hit === current) {
            buf += ch
            current = hit
        } else {
            runs.push({ text: buf, script: current })
            buf = ch
            current = hit
        }
    }
    if (buf) runs.push({ text: buf, script: !!current })
    return runs
}

/**
 * 文档正文用：把能认出来的原文包成 <bdi lang dir>。
 * 拉丁字母、汉字、假名认不出来（会和正文混在一起），那些由文档自己写 <bdi>。
 * 跳过已有 bdi 与代码块 —— 代码块要按原样显示。
 */
export function wrapScriptText(root) {
    if (!root || !root.querySelectorAll) return root
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
            const parent = node.parentNode
            if (parent && parent.closest && parent.closest('bdi, pre, code, kbd')) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        }
    })
    const targets = []
    while (walker.nextNode()) targets.push(walker.currentNode)

    for (const node of targets) {
        const text = node.nodeValue
        const lang = scriptOf(text)
        if (!lang) continue
        const re = SCRIPT_TEXT_RANGES.find(([code]) => code === lang)[1]
        const runs = splitByRange(text, re)
        if (!runs.some((run) => run.script)) continue
        const frag = document.createDocumentFragment()
        for (const run of runs) {
            frag.appendChild(run.script
                ? h('bdi', { lang, dir: needsBdi(lang) ? bdiDir(lang) : undefined }, run.text)
                : document.createTextNode(run.text))
        }
        node.parentNode.replaceChild(frag, node)
    }
    return root
}

/**
 * 整段都是该语言的文字：一律带 lang（字体由 lang.css 决定，界面字体设置不影响它）。
 * dir 只给需要隔离方向的语言。
 */
export function bdiNode(text, lang) {
    return h('bdi', { lang: lang || undefined, dir: needsBdi(lang) ? bdiDir(lang) : undefined },
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
