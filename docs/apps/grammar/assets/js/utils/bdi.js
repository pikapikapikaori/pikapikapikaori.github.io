
import { h, frag, htmlFragment } from './dom.js'
import { getLanguage } from '../data/languages.js'

const SCRIPTS = [
    ['mnc', /[\u1800-\u18AF\u{11660}-\u{1167F}]/u],
    ['he', /[\u0590-\u05FF\uFB1D-\uFB4F]/u],
    ['sa-siddham', /[\u{11580}-\u{115FF}]/u],
    ['sa', /[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]/u],
    ['grc', /[\u0370-\u03FF\u1F00-\u1FFF]/u]
]

const LATIN = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/u
const CJK = /[\u3200-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF]/u

const EXTEND = /[\u0300-\u036F\u200C-\u200D]/u

const LATIN_LANGS = new Set(['la', 'fr', 'de', 'en'])

const KANA = /[\u3040-\u30FF\u31F0-\u31FF]/u

const INLINE_MARKUP = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i

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

export function scriptLangOf(text) {
    for (const ch of String(text ?? '')) {
        const lang = scriptOfChar(ch)
        if (lang) return lang
    }
    return null
}

function matchesLang(text, lang) {
    if (!lang) return false
    if (LATIN_LANGS.has(lang)) return LATIN.test(text)
    if (lang === 'ja') return KANA.test(text)
    if (lang === 'zh-cls') return CJK.test(text)
    const re = SCRIPTS.find(([code]) => code === lang)?.[1]
    if (re) return re.test(text)
    return false
}

export function splitRuns(text, ctxLang = null) {
    const chars = [...String(text ?? '')]
    const ext = chars.map((ch) => EXTEND.test(ch))
    const langs = chars.map((ch, i) => {
        if (ext[i]) return undefined
        const script = scriptOfChar(ch)
        if (script) return script
        return LATIN_LANGS.has(ctxLang) && LATIN.test(ch) ? ctxLang : null
    })

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

    for (let i = 1; i < runs.length - 1; i += 1) {
        const prev = runs[i - 1].lang
        if (runs[i].lang !== null || !prev || prev !== runs[i + 1].lang) continue
        runs[i - 1].text += runs[i].text + runs[i + 1].text
        runs.splice(i, 2)
        i -= 1
    }
    return runs
}

export function bdiNode(text, lang = null, props = null) {
    return h('bdi', { ...props, lang: lang || undefined, dir: bdiDir(lang) }, String(text ?? ''))
}

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
    const single = new Set(runs.map((run) => run.lang).filter(Boolean))
    if (single.size === 1 && runs.every((run) => run.lang || !CJK.test(run.text))) {
        return bdiNode(source, [...single][0])
    }
    return frag(...runs.map((run) => (run.lang ? bdiNode(run.text, run.lang) : run.text)))
}

export function stripBdi(text) {
    return String(text ?? '').replace(/<bdi[^>]*>/gi, '').replace(/<\/bdi>/gi, '')
}

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

export function annotateBdi(root, ctxLang = null) {
    if (!root || !root.querySelectorAll) return root
    const targets = []
    if (root.nodeType === 1 && root.tagName === 'BDI') targets.push(root)
    for (const el of root.querySelectorAll('bdi')) targets.push(el)

    for (const el of targets) {
        if (!el.parentNode) continue
        annotateOne(el, ctxLang)
    }
    return root
}

export function hasScript(text, lang = null) {
    const source = String(text ?? '')
    if (!source) return false
    if (!lang) return !!scriptLangOf(source)
    const re = SCRIPTS.find(([code]) => code === lang)?.[1]
    return re ? re.test(source) : matchesLang(source, lang)
}

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
