/**
 * 原文的 <bdi> 包裹：
 * - 数据（语法 JSON / 数据格式文档）里的 `<bdi>` 是真相，渲染期只补 `lang` / `dir`；
 * - 值字段（词形、词干、单元格…）整段一个 `<bdi>`；
 * - 标题 / 说明有可能一格多语，按码位切段，中文与转写保持纯文本。
 */

import { h, frag, htmlFragment } from './dom.js'
import { getLanguage } from '../data/languages.js'

/** 每种文字自己的码位区间，与 fonts.css 的 unicode-range 对齐。
 * 注意 5 位码位必须写 `\u{11660}`：`\u11660` 只会吃掉 4 位，剩下一个「0」字面量。 */
const SCRIPTS = [
    ['mnc', /[\u1800-\u18AF\u{11660}-\u{1167F}]/u],
    ['he', /[\u0590-\u05FF\uFB1D-\uFB4F]/u],
    ['sa-siddham', /[\u{11580}-\u{115FF}]/u],
    ['sa', /[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]/u],
    ['grc', /[\u0370-\u03FF\u1F00-\u1FFF]/u]
]

const LATIN = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/u
const CJK = /[\u3200-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF]/u

/** 组合符号与零宽连接符：跟随相邻文字，不单独成段 */
const EXTEND = /[\u0300-\u036F\u200C-\u200D]/u

/** 拉丁字母语言（拉丁语系 + 英语）：这些语言的页面里，拉丁 run 就是原文 */
const LATIN_LANGS = new Set(['la', 'fr', 'de', 'en'])

/** 假名：只出现在日语里，中文说明不会用，用来把「日语词」和「中文标签」分开 */
const KANA = /[\u3040-\u30FF\u31F0-\u31FF]/u

/** 受控数据里的行内标记（<bdi>、<strong> 等）：有标记就先解析成 DOM，再补 lang/dir */
const INLINE_MARKUP = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i

/** 方向只对 RTL 语言有意义，其余交给 `auto`（输入框里纯转写时才不会被按 RTL 排） */
export function bdiDir(lang) {
    const meta = getLanguage(lang)
    return meta && meta.rtl ? 'rtl' : 'auto'
}

function scriptOfChar(ch) {
    for (const [lang, re] of SCRIPTS) {
        if (re.test(ch)) return lang
    }
    return null
}

/** 一段文字里出现的第一种「自有文字」，用来给没有 lang 的 bdi 定语言 */
export function scriptLangOf(text) {
    for (const ch of String(text ?? '')) {
        const lang = scriptOfChar(ch)
        if (lang) return lang
    }
    return null
}

/**
 * 该文字是否算「这个语言的内容」。
 * 拉丁语言只认拉丁；日语只认含假名的块（纯汉字多半是中文标签）；
 * 古汉语整段都是汉字，直接认。
 */
function matchesLang(text, lang) {
    if (!lang) return false
    if (LATIN_LANGS.has(lang)) return LATIN.test(text)
    if (lang === 'ja') return KANA.test(text)
    if (lang === 'zh-cls') return CJK.test(text)
    const re = SCRIPTS.find(([code]) => code === lang)?.[1]
    if (re) return re.test(text)
    return false
}

/**
 * 逐字符判定用什么语言；两种「不认」的情况保持 null（中文、转写、标点）。
 * 夹在两段同类文字之间的分隔符（`ק-ט-ל`、`-nt-`）并入该段，
 * 否则每个字母各自成一个 bdi，RTL 词根会看起来是反的。
 */
export function splitRuns(text, ctxLang = null) {
    const chars = [...String(text ?? '')]
    const ext = chars.map((ch) => EXTEND.test(ch))
    const langs = chars.map((ch, i) => {
        if (ext[i]) return undefined
        const script = scriptOfChar(ch)
        if (script) return script
        return LATIN_LANGS.has(ctxLang) && LATIN.test(ch) ? ctxLang : null
    })

    // 组合符号跟上一个字符；开头没有上一段时跟下一个
    for (let i = 0; i < chars.length; i += 1) {
        if (!ext[i]) continue
        let prev = i - 1
        while (prev >= 0 && ext[prev]) prev -= 1
        langs[i] = prev >= 0 ? langs[prev] : undefined
    }
    for (let i = chars.length - 1; i >= 0; i -= 1) {
        if (!ext[i] || langs[i] !== undefined) continue
        let next = i + 1
        while (next < chars.length && ext[next]) next += 1
        langs[i] = next < chars.length ? langs[next] : null
    }

    // 汉字块整体判定：块里出现假名才算日语，否则是中文标签，保持纯文本
    if (ctxLang === 'ja' || ctxLang === 'zh-cls') {
        let i = 0
        while (i < chars.length) {
            if (!CJK.test(chars[i])) { i += 1; continue }
            let j = i
            let kana = false
            while (j < chars.length && CJK.test(chars[j])) {
                if (KANA.test(chars[j])) kana = true
                j += 1
            }
            const hit = ctxLang === 'ja' ? kana : true
            if (hit) for (let k = i; k < j; k += 1) langs[k] = ctxLang
            i = j
        }
    }


    const runs = []
    for (let i = 0; i < chars.length; i += 1) {
        const last = runs[runs.length - 1]
        if (last && last.lang === langs[i]) last.text += chars[i]
        else runs.push({ text: chars[i], lang: langs[i] })
    }

    // 多字符分隔符（`, `、` / `）夹在同一语言两段之间时并进去
    for (let i = 1; i < runs.length - 1; i += 1) {
        const prev = runs[i - 1].lang
        if (runs[i].lang !== null || !prev || prev !== runs[i + 1].lang) continue
        runs[i - 1].text += runs[i].text + runs[i + 1].text
        runs.splice(i, 2)
        i -= 1
    }
    return runs
}

/** 整段一个 <bdi>：值字段（词形、词干、变位形式…）用它；`props` 只放 class 之类的标记 */
export function bdiNode(text, lang = null, props = null) {
    return h('bdi', { ...props, lang: lang || undefined, dir: bdiDir(lang) }, String(text ?? ''))
}

export const bdiText = bdiFragment

/**
 * 可能含 `<bdi>` 标记的显示文本：有标记就解析并补 lang/dir，没有就按码位切段。
 * 标题、说明、表格单元格这类「一格可能多语」的地方用它。
 */
export function bdiFragment(text, ctxLang = null) {
    const source = String(text ?? '')
    if (!source) return document.createTextNode('')
    if (INLINE_MARKUP.test(source)) {
        const out = htmlFragment(source)
        annotateBdi(out, ctxLang)
        return out
    }
    const runs = splitRuns(source, ctxLang)
    if (!runs.some((run) => run.lang)) return document.createTextNode(source)
    // 整段只有一种语言（没有中文说明夹在里面）时整段一个 bdi，标点也一起进去
    const single = new Set(runs.map((run) => run.lang).filter(Boolean))
    if (single.size === 1 && runs.every((run) => run.lang || !CJK.test(run.text))) {
        return bdiNode(source, [...single][0])
    }
    return frag(...runs.map((run) => (run.lang ? bdiNode(run.text, run.lang) : run.text)))
}

/** 纯文本字段（输入框、title、原生 option）用的去标签 */
export function stripBdi(text) {
    return String(text ?? '').replace(/<bdi[^>]*>/gi, '').replace(/<\/bdi>/gi, '')
}

/** 没有 lang 时按码位猜；猜不到就用上下文语言（只在该语言确实匹配这段文字时） */
function resolveLang(text, ctxLang) {
    const script = scriptLangOf(text)
    if (script) return script
    if (LATIN_LANGS.has(ctxLang) && LATIN.test(text)) return ctxLang
    if (ctxLang === 'ja' && KANA.test(text)) return ctxLang
    if (ctxLang === 'zh-cls' && CJK.test(text)) return ctxLang
    return null
}

function dirOf(bdi, lang) {
    const preset = bdi.getAttribute('dir')
    if (preset && preset !== 'auto') return preset
    return bdiDir(lang)
}

/** 一个 bdi 里混了两种以上文字就原地拆开；单一语言只补属性 */
function annotateOne(bdi, ctxLang) {
    const text = bdi.textContent || ''
    if (!text) return
    const runs = splitRuns(text, ctxLang).filter((run) => run.text)
    const langs = new Set(runs.map((run) => run.lang).filter(Boolean))
    const preset = bdi.getAttribute('lang')

    if (langs.size > 1 && !preset) {
        const parent = bdi.parentNode
        if (!parent) return
        const keep = {}
        for (const attr of ['class', 'title']) {
            if (bdi.hasAttribute(attr)) keep[attr] = bdi.getAttribute(attr)
        }
        const out = frag(...runs.map((run) => (run.lang
            ? h('bdi', { ...keep, lang: run.lang, dir: bdiDir(run.lang) }, run.text)
            : run.text)))
        parent.replaceChild(out, bdi)
        return
    }

    const lang = preset || [...langs][0] || resolveLang(text, ctxLang)
    if (lang && !preset) bdi.setAttribute('lang', lang)
    bdi.setAttribute('dir', dirOf(bdi, lang))
}

/**
 * 给子树里所有 `<bdi>` 补齐 `lang` / `dir`；重复调用安全。
 * `ctxLang` 是上下文语言（页面语言、表格的 lang）——只用来兜底，不会覆盖已有 lang。
 */
export function annotateBdi(root, ctxLang = null) {
    if (!root || !root.querySelectorAll) return root
    const targets = []
    if (root.nodeType === 1 && root.tagName === 'BDI') targets.push(root)
    for (const el of root.querySelectorAll('bdi')) targets.push(el)

    // 只给「已经写好的 bdi」补属性，代码块里的也不跳过（作者明确包了就是要那门语言的字体）
    for (const el of targets) {
        if (!el.parentNode) continue
        annotateOne(el, ctxLang)
    }
    return root
}

/** 兼容旧调用点：原先只处理带 lang 的容器，现在只做「补属性」 */
export const applyBdi = annotateBdi

/** 该文本里有没有这门语言的文字（输入框提示、分析浮层用） */
export function hasScript(text, lang = null) {
    const source = String(text ?? '')
    if (!source) return false
    if (!lang) return !!scriptLangOf(source)
    const re = SCRIPTS.find(([code]) => code === lang)?.[1]
    return re ? re.test(source) : matchesLang(source, lang)
}

/**
 * 数据格式文档正文的兜底：把能靠码位认出来的原文包成 <bdi lang dir>。
 * 拉丁字母与汉字认不出来（会和正文混在一起），那些由文档自己写 <bdi>。
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
        if (!scriptLangOf(text)) continue
        const runs = splitRuns(text, null)
        if (!runs.some((run) => run.lang)) continue
        node.parentNode.replaceChild(
            frag(...runs.map((run) => (run.lang ? bdiNode(run.text, run.lang) : run.text))),
            node
        )
    }
    return root
}

/**
 * 原生 placeholder 不能带标记，所以含原文的 placeholder 用叠一层自己画的提示；
 * 输入框有内容时自动隐藏，已经包在 .ghost-input 里的（那些自己处理）跳过。
 */
export function applyBdiPlaceholders(root, lang = null) {
    if (!root || !root.querySelectorAll) return root
    for (const input of root.querySelectorAll('input[placeholder], textarea[placeholder]')) {
        const code = input.getAttribute('lang') || lang
        const text = input.getAttribute('placeholder') || ''
        if (!hasScript(text, code)) continue
        if (input.closest('.ghost-input')) continue

        const hint = h('span', {
            class: 'ghost-input__hint ghost-input__hint--placeholder',
            'aria-hidden': 'true'
        }, bdiFragment(text, code))
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
