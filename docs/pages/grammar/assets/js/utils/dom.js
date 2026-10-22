/**
 * DOM 构造与操作
 * 统一用 h() 构造元素，避免 innerHTML 拼接。
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

export function h(tag, props = null, ...children) {
    const el = document.createElement(tag)
    if (props) applyProps(el, props)
    append(el, children)
    return el
}

export function svg(tag, props = null, ...children) {
    const el = document.createElementNS(SVG_NS, tag)
    if (props) {
        for (const [k, v] of Object.entries(props)) {
            if (v == null || v === false) continue
            el.setAttribute(k, v === true ? '' : String(v))
        }
    }
    append(el, children)
    return el
}

export function frag(...children) {
    const f = document.createDocumentFragment()
    append(f, children)
    return f
}

function applyProps(el, props) {
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue

        if (k === 'class' || k === 'className') {
            el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v)
        } else if (k === 'style') {
            if (typeof v === 'string') el.setAttribute('style', v)
            else Object.assign(el.style, v)
        } else if (k === 'dataset') {
            for (const [dk, dv] of Object.entries(v)) {
                if (dv != null) el.dataset[dk] = String(dv)
            }
        } else if (k === 'text') {
            el.textContent = String(v)
        } else if (k === 'html') {
            // 仅在受控数据上使用；调用方需自行确保安全
            el.innerHTML = String(v)
        } else if (k === 'ref' && typeof v === 'function') {
            v(el)
        } else if (k.startsWith('on') && typeof v === 'function') {
            const ev = k.slice(2).toLowerCase()
            el.addEventListener(ev, v)
        } else if (k === 'value' && (el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
            el.value = v
        } else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') {
            el[k] = !!v
        } else {
            el.setAttribute(k, v === true ? '' : String(v))
        }
    }
}

function append(el, children) {
    for (const c of children) {
        if (c == null || c === false) continue
        if (Array.isArray(c)) { append(el, c); continue }
        if (c instanceof Node) { el.appendChild(c); continue }
        el.appendChild(document.createTextNode(String(c)))
    }
}

/**
 * 把语法数据里的说明文字解析成 DOM 片段。
 *
 * 数据是静态的语法 JSON，说明里允许少量 HTML（`<strong>` / `<code>` / `<em>` 等）。
 * 只保留白名单标签与普通属性，`on*` 事件与 `javascript:` 链接一律丢弃，
 * 不认识的标签会被拆掉但保留里面的文字 —— 这样即使数据里混进脚本也执行不了。
 */
const HTML_TAGS = new Set([
    'STRONG', 'B', 'EM', 'I', 'CODE', 'BR', 'SMALL', 'SUP', 'SUB', 'SPAN',
    'UL', 'OL', 'LI', 'P'
])

export function htmlFragment(text) {
    const out = document.createDocumentFragment()
    const source = String(text ?? '')
    if (!source) return out
    if (!/[<&]/.test(source)) {
        out.appendChild(document.createTextNode(source))
        return out
    }
    const tpl = document.createElement('template')
    tpl.innerHTML = source
    copyFlow(tpl.content, out)
    return out
}

function copyFlow(from, to) {
    for (const child of Array.from(from.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            to.appendChild(document.createTextNode(child.nodeValue))
            continue
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue
        if (!HTML_TAGS.has(child.tagName)) {
            copyFlow(child, to)
            continue
        }
        const el = document.createElement(child.tagName.toLowerCase())
        for (const attr of Array.from(child.attributes)) {
            const name = attr.name.toLowerCase()
            if (name.startsWith('on')) continue
            if (name === 'href' && /^\s*javascript:/i.test(attr.value)) continue
            el.setAttribute(attr.name, attr.value)
        }
        copyFlow(child, el)
        to.appendChild(el)
    }
}

export function qs(sel, root = document) { return root.querySelector(sel) }
export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)) }

export function on(el, type, handler, opts) {
    el.addEventListener(type, handler, opts)
    return () => el.removeEventListener(type, handler, opts)
}

export function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild)
}

export function replace(container, ...children) {
    clear(container)
    append(container, children)
    return container
}

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function delegate(root, selector, type, handler) {
    const listener = (e) => {
        const target = e.target.closest(selector)
        if (target && root.contains(target)) handler.call(target, e, target)
    }
    root.addEventListener(type, listener)
    return () => root.removeEventListener(type, listener)
}

export function focusFirst(container) {
    const el = container.querySelector(
        'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (el) el.focus()
}
