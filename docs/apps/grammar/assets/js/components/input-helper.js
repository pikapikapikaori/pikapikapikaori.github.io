/** 输入助手：修饰符 / 键盘面板，以及全局的空格转写。 */

import { h } from '../utils/dom.js'
import { adaptField } from '../adapters/text-field.js'
import {
    applyMark, insertAt, deleteBefore, isMark, previewChar, splitTail, sanitizeOriginal, WORD_TAIL
} from '../utils/ime-compose.js'
import { loadIme } from '../services/ime-service.js'
import { bdiNode } from '../utils/bdi.js'

const LS_ENABLED = 'ln.ime.enabled'
const LS_FOLLOW = 'ln.ime.follow'
const LS_MODE = (code) => `ln.ime.mode.${code}`

/**
 * 键盘几何：真实键盘比例，四行都是 15 个单位。
 * 网格按 1/4 单位切 60 列，span 用「四分之一单位」计（1u = 4）。
 *
 * row1  ` 1 2 3 4 5 6 7 8 9 0         -    =     ⌫(2u)       = 1+10+1+1+2 = 15
 * row2  Tab(1.5u) q…p  [ ]  \(1.5u)                        = 1.5+10+1+1+1.5 = 15
 * row3  Caps(2u) a…l  ; '  aux1 aux2                      = 2+9+1+1+1+1 = 15
 * row4  Shift(2.25u) z…m  , . /  ⇧(2.75u)                 = 2.25+7+1+1+1+2.75 = 15
 */
const KEY_ROWS = [
    [
        { k: '`' },
        { k: '1' }, { k: '2' }, { k: '3' }, { k: '4' }, { k: '5' },
        { k: '6' }, { k: '7' }, { k: '8' }, { k: '9' }, { k: '0' },
        { k: '-' }, { k: '=' },
        { action: 'back', span: 8, label: '⌫' }
    ],
    [
        { action: 'tab', span: 6, label: 'Tab' },
        { k: 'q' }, { k: 'w' }, { k: 'e' }, { k: 'r' }, { k: 't' },
        { k: 'y' }, { k: 'u' }, { k: 'i' }, { k: 'o' }, { k: 'p' },
        { k: '[' }, { k: ']' },
        { k: '\\', span: 6 }
    ],
    [
        { action: 'caps', span: 8, label: 'Caps' },
        { k: 'a' }, { k: 's' }, { k: 'd' }, { k: 'f' }, { k: 'g' },
        { k: 'h' }, { k: 'j' }, { k: 'k' }, { k: 'l' },
        { k: ';' }, { k: '\'' },
        { k: 'aux1' }, { k: 'aux2' }
    ],
    [
        { action: 'shift', span: 9, label: 'Shift' },
        { k: 'z' }, { k: 'x' }, { k: 'c' }, { k: 'v' }, { k: 'b' }, { k: 'n' }, { k: 'm' },
        { k: ',' }, { k: '.' }, { k: '/' },
        { action: 'follow', span: 11 }
    ]
]

/**
 * 物理键 → 键盘槽位。e.key 随键盘布局与 Shift 变化（Shift+5 是 %），
 * 用 e.code 才能稳定对上 KEY_ROWS 的槽位名。
 */
const CODE_SLOT = {
    Backquote: '`',
    Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
    Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
    Minus: '-', Equal: '=',
    KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r', KeyT: 't', KeyY: 'y', KeyU: 'u',
    KeyI: 'i', KeyO: 'o', KeyP: 'p', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyF: 'f',
    KeyG: 'g', KeyH: 'h', KeyJ: 'j', KeyK: 'k', KeyL: 'l', KeyZ: 'z', KeyX: 'x',
    KeyC: 'c', KeyV: 'v', KeyB: 'b', KeyN: 'n', KeyM: 'm',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/',
}

const state = {
    enabled: readEnabled(),
    code: null,
    config: null,
    target: null,
    mode: null,
    shift: false,
    caps: false,
    follow: readFollow()
}

let els = null
let mounted = false
/** 屏幕上的 Shift 是「一次性」：插入下一个字符后回落 */
let oneShotShift = false
/** 系统 CapsLock 的最近已知状态（null = 还没从任何事件里读到过） */
let osCapsLock = null

/** 任何带修饰键状态的输入事件都顺手记一下 CapsLock，面板打开时用它对齐 */
function noteModifiers(e) {
    if (typeof e.getModifierState !== 'function') return
    osCapsLock = e.getModifierState('CapsLock')
    // 只有真的按了 CapsLock 才改面板的 Caps（点屏幕上的 Caps 不该被别的事件覆盖）。
    // macOS 上「开」发 keydown、「关」只发 keyup，所以两个方向都要在这里处理。
    if (e.key !== 'CapsLock') return
    if (!mounted || !els || els.panel.hidden) return
    if (state.caps === osCapsLock) return
    state.caps = osCapsLock
    render()
}

function stored(key, fallback) {
    try {
        const value = localStorage.getItem(key)
        return value === null ? fallback : value
    } catch { return fallback }
}

function store(key, value) {
    try { localStorage.setItem(key, value) } catch { /* 无痕模式下写不进去，忽略 */ }
}

function readEnabled() {
    return stored(LS_ENABLED, '1') !== '0'
}

function readFollow() {
    return stored(LS_FOLLOW, '1') !== '0'
}

/* ---------------- 生命周期 ---------------- */

export async function mountInputHelper({ lang } = {}) {
    mounted = true
    if (!lang) return unmountInputHelper()
    if (state.code === lang && els) {
        refreshFab()
        return
    }
    state.code = lang
    state.config = await loadIme(lang)
    if (!mounted || state.code !== lang) return
    if (!state.config) return unmountInputHelper()
    ensureDom()
    // tab 按语言各记各的：换语言时不能沿用上一个语言选的 tab（满语只有键盘）
    state.mode = stored(LS_MODE(lang), null)
    state.shift = false
    state.caps = false
    oneShotShift = false
    bindOnce()
    refreshFab()
    if (state.enabled) openForFocused()
    else closePanel()
}

export function unmountInputHelper() {
    mounted = false
    state.code = null
    state.config = null
    state.target = null
    state.mode = null
    state.shift = false
    state.caps = false
    oneShotShift = false
    if (els) {
        els.fab.remove()
        els.panel.remove()
        els = null
    }
    document.documentElement.classList.remove('has-ime-fab')
}

let bound = false
function bindOnce() {
    if (bound) return
    bound = true

    document.addEventListener('focusin', (e) => {
        if (!mounted || !state.enabled || !state.config) return
        const field = adaptField(e.target)
        if (!field) {
            // 焦点落到非输入框（按钮、下拉、空白）上就收起面板
            if (!isInsidePanel(e.target)) closePanel()
            return
        }
        state.target = field
        openPanel()
    })

    document.addEventListener('focusout', (e) => {
        if (!mounted) return
        const field = adaptField(e.target)
        if (field) trimField(field)
        // 焦点留在页面外 / 落到非输入框：收起面板（点面板按钮时焦点没动，不会触发）
        setTimeout(() => {
            if (!els || els.panel.hidden) return
            const active = document.activeElement
            if (els.panel.contains(active)) return
            if (adaptField(active)) return
            closePanel()
        }, 0)
    })

    // 先记修饰键状态，再处理按键
    window.addEventListener('pointerdown', noteModifiers, true)
    window.addEventListener('keydown', noteModifiers, true)
    window.addEventListener('keyup', noteModifiers, true)
    window.addEventListener('keydown', onPhysicalKey, true)
    window.addEventListener('keyup', onPhysicalKeyUp, true)

    document.addEventListener('input', (e) => {
        if (!mounted || !state.target || e.target !== state.target.el) return
        sanitizeTarget()
        if (els && !els.panel.hidden) render()
    })

    let caretTimer = 0
    document.addEventListener('selectionchange', () => {
        if (!state.target || !els || els.panel.hidden) return
        if (document.activeElement !== state.target.el) return
        clearTimeout(caretTimer)
        caretTimer = setTimeout(() => {
            if (state.mode === 'marks') render()
        }, 80)
    })

    window.addEventListener('resize', syncLift)

    const vv = window.visualViewport
    if (vv) {
        const sync = () => {
            const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
            document.documentElement.style.setProperty('--ime-kb', `${Math.round(gap)}px`)
        }
        vv.addEventListener('resize', sync)
        vv.addEventListener('scroll', sync)
        sync()
    }
}

function isInsidePanel(el) {
    return !!(els && els.panel.contains(el))
}

/** 失焦去首尾空白 */
function trimField(field) {
    const value = field.getValue()
    const trimmed = value.trim()
    if (value === trimmed) return
    const caret = field.getCaret()
    const head = value.length - value.replace(/^\s+/, '').length
    field.setValue(trimmed)
    field.setCaret(Math.max(0, Math.min(trimmed.length, caret - head)))
}

/** 原文类输入框吞掉数字与中文标点（含中日韩文字的框不动） */
function sanitizeTarget() {
    if (!state.target) return
    const value = state.target.getValue()
    const clean = sanitizeOriginal(value)
    if (clean === value) return
    const caret = state.target.getCaret()
    state.target.setValue(clean)
    state.target.setCaret(Math.max(0, Math.min(clean.length, caret)))
}

/* ---------------- DOM ---------------- */

function ensureDom() {
    if (els) return els

    const fab = h('button', {
        class: 'ime-fab',
        type: 'button',
        'aria-label': '输入助手',
        onclick: () => {
            state.enabled = !state.enabled
            store(LS_ENABLED, state.enabled ? '1' : '0')
            refreshFab()
            if (state.enabled) openForFocused()
            else closePanel()
        }
    }, keyboardIcon())

    const panel = h('div', { class: 'ime', role: 'dialog', 'aria-label': '输入助手', hidden: true })
    const head = h('div', { class: 'ime__head' })
    const body = h('div', { class: 'ime__body' })
    panel.append(head, body)

    // 面板里的按钮不抢焦点，否则点一下输入框就丢了光标
    panel.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) e.preventDefault()
    })

    document.body.append(fab, panel)
    els = { fab, panel, head, body }
    return els
}

/** 键盘小图标（内联 SVG，避免平台字形差异） */
function keyboardIcon() {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 20 14')
    svg.setAttribute('width', '18')
    svg.setAttribute('height', '13')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '1.4')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = '<rect x="1" y="1" width="18" height="12" rx="2"/><path d="M3.5 4.5h1M6.5 4.5h1M9.5 4.5h1M12.5 4.5h1M15.5 4.5h1M3.5 9.5h13"/>'
    return svg
}

/** 生词表单底部有吸底的提交条，按钮和面板要让开它 */
function syncLift() {
    const bar = document.querySelector('.word-form__actions')
    const lift = bar ? Math.round(bar.getBoundingClientRect().height) + 8 : 0
    document.documentElement.style.setProperty('--ime-lift', `${lift}px`)
}

function refreshFab() {
    if (!els) return
    syncLift()
    els.fab.hidden = !state.config
    // 浮动工具列（回到顶部 / 显示转写）要和助手按钮错开
    document.documentElement.classList.toggle('has-ime-fab', !els.fab.hidden)
    els.fab.classList.toggle('ime-fab--on', state.enabled)
    els.fab.title = state.enabled ? '输入助手：开（点击关闭）' : '输入助手：关（点击开启）'
}

function openForFocused() {
    const field = adaptField(document.activeElement)
    if (field && field.el.closest('#view')) {
        state.target = field
        openPanel()
    }
}

function openPanel() {
    if (!state.config || !els) return
    // 面板是照物理键盘做的：打开时先跟系统的 CapsLock 对齐，
    // 否则键面显示和「跟随物理键盘」打出来的字会相反
    if (osCapsLock !== null) state.caps = osCapsLock
    els.panel.hidden = false
    render()
    keepTargetVisible()
}

function closePanel() {
    if (els) els.panel.hidden = true
    // 面板收起时一次性 Shift 不该留着
    state.shift = false
    oneShotShift = false
}

/** 面板会盖住下半屏：把当前输入框滚到面板上方 */
function keepTargetVisible() {
    if (!els || !state.target) return
    const panelRect = els.panel.getBoundingClientRect()
    const fieldRect = state.target.el.getBoundingClientRect()
    const narrow = window.matchMedia('(max-width: 720px)').matches
    const visibleBottom = narrow ? panelRect.top - 12 : Math.min(panelRect.top - 12, window.innerHeight - 12)
    const overlap = fieldRect.bottom - visibleBottom
    if (overlap > 0) window.scrollBy({ top: overlap + 12, behavior: 'smooth' })
}

/* ---------------- 渲染 ---------------- */

const MODE_LABEL = { marks: '修饰符', keyboard: '键盘' }

function availableModes() {
    const c = state.config
    if (!c) return []
    const modes = []
    if (c.marks.some((g) => (g.items || []).length)) modes.push('marks')
    if (c.keyboard) modes.push('keyboard')
    return modes
}

function currentMode() {
    const modes = availableModes()
    if (!modes.length) return ''
    return modes.includes(state.mode) ? state.mode : modes[0]
}

/** 当前是不是 Shift 层：Caps 与 Shift 互斥叠加（Caps + Shift = 小写层，与真实键盘一致） */
function layerUpper() {
    return state.caps !== state.shift
}

/** 语言片段：带 lang 包进 bdi，字体与方向由 lang.css 决定；纯 ASCII（数字、标点）原样输出 */
function scriptText(text) {
    const str = String(text ?? '')
    if (!state.code || !str || /^[\x20-\x7E]+$/.test(str)) return str
    return bdiNode(str, state.code)
}

/** 组合符托的样字：单独放会因字体不同显示成空框 */
function sampleLetter() {
    const base = state.config?.placeholderBase
    if (!base) return '\u25CC'
    return layerUpper() && state.config?.cased === true ? base.toUpperCase() : base
}

/** 某个符号的样字：语言可以用 `samples` 单独指定（如希伯来语的中点用 ב、ש 加点的用 ש） */
function sampleForChar(ch) {
    const overrides = state.config?.samples
    const hit = ch && overrides ? overrides[ch] : null
    return hit || sampleLetter()
}

function render() {
    const c = state.config
    const modes = availableModes()
    const mode = currentMode()
    state.mode = mode

    els.head.replaceChildren(
        h('div', { class: 'ime__tabs', role: 'group', 'aria-label': '输入方式' },
            ...modes.map((m) => h('button', {
                type: 'button',
                class: 'ime__tab',
                'aria-pressed': String(m === mode),
                onclick: () => {
                    state.mode = m
                    state.shift = false
                    oneShotShift = false
                    store(LS_MODE(c.code), m)
                    render()
                }
            }, MODE_LABEL[m]))
        ),
        h('button', {
            type: 'button',
            class: 'ime__close',
            title: '关闭输入助手',
            'aria-label': '关闭输入助手',
            onclick: () => {
                state.enabled = false
                store(LS_ENABLED, '0')
                refreshFab()
                closePanel()
            }
        }, '✕')
    )

    els.body.replaceChildren()
    if (mode === 'marks') els.body.append(renderMarks())
    else if (mode === 'keyboard') els.body.append(renderKeyboard())
}

function currentBase() {
    if (!state.target) return ''
    return splitTail(state.target.getValue().slice(0, state.target.getCaret())).base
}

function groupChars(group) {
    return (group.items || []).map((it) => it.c).filter(Boolean).join('')
}

/** 组按 row 分行：同 row 的并排，没配 row 的各占一行 */
function markRows(groups) {
    const keyed = new Map()
    const loose = []
    for (const group of groups) {
        if (Number.isInteger(group.row)) {
            if (!keyed.has(group.row)) keyed.set(group.row, [])
            keyed.get(group.row).push(group)
        } else {
            loose.push([group])
        }
    }
    // 行的先后按 row 的值排，不是按组在配置里的先后
    const rows = [...keyed.keys()].sort((a, b) => a - b).map((key) => keyed.get(key))
    return rows.concat(loose)
}

/** 基字上的全部组合符号（insert 组是整字，不参与） */
function allMarkChars(groups) {
    return groups.filter((g) => !g.insert).map(groupChars).join('')
}

/** 「还原」：独立一组、永远排在最前，一次去掉基字上的所有附加符号 */
function renderRestore(before, groups) {
    const chars = allMarkChars(groups)
    const { base: bare, marks } = splitTail(before)
    const hasMark = !!bare && [...marks].some((m) => chars.includes(m))
    return h('button', {
        type: 'button',
        class: 'ime__chip ime__chip--restore',
        title: '还原：去掉所有附加符号',
        disabled: !hasMark,
        onclick: () => {
            if (!state.target) return
            const next = applyMark(state.target.getValue(), state.target.getCaret(), chars, '', chars)
            if (next) applyResult(next)
        }
    }, scriptText(bare || sampleLetter()))
}

function renderMarks() {
    const c = state.config
    const before = state.target
        ? state.target.getValue().slice(0, state.target.getCaret())
        : ''
    const base = splitTail(before).base
    const wrap = h('div', { class: 'ime__marks' })

    if (!base) wrap.append(h('div', { class: 'ime__hint' }, '把光标放到一个字母后面，按钮会显示合并后的字形。'))

    // 「还原」独占一个组，但要能并进语言指定的那一行（restoreRow，默认第一行）
    const rows = markRows(c.marks).map((groups) => groups.map((group) => markGroupEl(group, base)))
    const restore = h('div', { class: 'ime__group' },
        h('div', { class: 'ime__label' }, '还原'),
        h('div', { class: 'ime__items' }, renderRestore(before, c.marks))
    )
    const restoreRow = Number.isInteger(c.restoreRow) ? c.restoreRow : 0
    const targetRow = rows[restoreRow] || rows[0]
    if (targetRow) targetRow.unshift(restore)
    else rows.push([restore])

    for (const row of rows) wrap.append(h('div', { class: 'ime__row' }, ...row))
    return wrap
}

function markGroupEl(group, base) {
    return h('div', { class: 'ime__group' },
        h('div', { class: 'ime__label' }, group.label),
        renderMarkItems(group, base)
    )
}

function renderMarkItems(group, base) {
    const c = state.config
    const items = h('div', { class: 'ime__items' })

    for (const item of group.items) {
        // insert 组（如希腊语的古字母）：点一下直接插入字符，不与前一个字合并
        if (group.insert) {
            items.append(h('button', {
                type: 'button',
                class: 'ime__chip',
                title: item.label || '',
                onclick: () => {
                    if (!state.target) return
                    applyResult(insertAt(state.target.getValue(), state.target.getCaret(), item.c))
                }
            }, scriptText(item.c)))
            continue
        }

        // 组合符托在样字上（有基字就用基字）；独立字符（ß、连字）就显示字符本身
        const label = isMark(item.c) ? previewChar(base || sampleForChar(item.c), item.c) : item.c
        // 没有基字就不判适用性：预览是 ◌ 托底，点了也不会产生字形
        const allowed = !base || (item.applies ? item.applies(base) : c.applies(base, group.key))
        const disabled = !!item.c && !!base && !allowed
        items.append(h('button', {
            type: 'button',
            class: 'ime__chip',
            title: item.label || '',
            disabled,
            onclick: () => {
                if (!state.target) return
                const next = applyMark(
                    state.target.getValue(), state.target.getCaret(),
                    groupChars(group), item.c || '', allMarkChars(c.marks)
                )
                if (next) applyResult(next)
            }
        }, scriptText(label)))
    }
    return items
}

function renderKeyboard() {
    const c = state.config
    const wrap = h('div', { class: 'ime__kb' })

    for (const row of KEY_ROWS) {
        const rowEl = h('div', { class: 'ime__kb-row' })
        for (const slot of row) {
            if (!slot.action) {
                rowEl.append(keyButton(slot))
                continue
            }
            if (slot.action === 'shift') {
                rowEl.append(actionButton(slot, state.shift, () => {
                    state.shift = !state.shift
                    oneShotShift = state.shift
                    render()
                }))
            } else if (slot.action === 'caps') {
                rowEl.append(actionButton(slot, state.caps, () => {
                    state.caps = !state.caps
                    render()
                }))
            } else if (slot.action === 'follow') {
                rowEl.append(followButton(slot))
            } else if (slot.action === 'back') {
                rowEl.append(actionButton(slot, false, () => {
                    if (state.target) applyResult(deleteBefore(state.target.getValue(), state.target.getCaret()))
                }))
            } else if (slot.action === 'tab') {
                rowEl.append(placeholderButton(slot))
            }
        }
        wrap.append(rowEl)
    }

    return wrap
}

/** Tab 只是照真实键盘占位：切焦点的活交给物理键盘 */
function placeholderButton(slot) {
    const btn = h('button', {
        type: 'button',
        class: 'ime__key ime__key--action ime__key--empty',
        title: 'Tab（用物理键盘切换焦点）',
        disabled: true
    }, slot.label)
    btn.style.gridColumn = `span ${slot.span || 4}`
    return btn
}

function actionButton(slot, pressed, onclick) {
    const btn = h('button', {
        type: 'button',
        class: 'ime__key ime__key--action' + (pressed ? ' is-on' : ''),
        'aria-pressed': String(pressed),
        onclick
    }, slot.label)
    btn.style.gridColumn = `span ${slot.span || 4}`
    return btn
}

function followButton(slot) {
    const btn = h('button', {
        type: 'button',
        class: 'ime__key ime__key--follow' + (state.follow ? ' is-on' : ''),
        'aria-pressed': String(state.follow),
        title: state.follow ? '跟随物理键盘：开（点一下只响应屏幕点击）' : '跟随物理键盘：关（点一下恢复）',
        onclick: () => {
            state.follow = !state.follow
            store(LS_FOLLOW, state.follow ? '1' : '0')
            render()
        }
    }, keyboardIcon(), h('span', { class: 'ime__key__text' }, '跟随'))
    btn.style.gridColumn = `span ${slot.span || 4}`
    return btn
}

function keyButton(slot) {
    const latin = slot.k
    const char = keyChar(latin)
    const btn = h('button', {
        type: 'button',
        class: 'ime__key' + (char ? '' : ' ime__key--empty'),
        'data-key': latin,
        // 没有字符的键也要能点：它唯一的作用就是让一次性 Shift 熄灭
        'aria-disabled': String(!char),
        tabindex: char ? null : '-1',
        onclick: () => {
            const cleared = clearOneShotShift()
            if (!state.target || !char) {
                if (cleared) render()
                return
            }
            applyResult(insertAt(state.target.getValue(), state.target.getCaret(), char))
        }
    }, scriptText(char || ''))
    btn.style.gridColumn = `span ${slot.span || 4}`
    if (char && isMark(char)) {
        btn.replaceChildren(scriptText((sampleForChar(char) + char).normalize('NFC')))
    }
    // 数字这类「键面就是键名」的键不用再标一遍小字；aux1 / aux2 是附加键，不露内部名
    const hint = latin.startsWith('aux') ? '' : latin
    if (char && hint && hint !== char) btn.append(h('small', {}, hint))
    return btn
}

function keyChar(latin) {
    const kb = state.config.keyboard
    if (!kb) return ''
    const map = kb.map || {}
    const shift = kb.shift || {}
    if (layerUpper()) return shift[latin] || map[latin] || ''
    return map[latin] || shift[latin] || ''
}

/* ---------------- 写入与键盘 ---------------- */

/** 屏幕上的 Shift 是一次性的：按下哪一个键就熄灭，哪怕那个键不产生字符 */
function clearOneShotShift() {
    if (!oneShotShift) return false
    oneShotShift = false
    state.shift = false
    return true
}

function applyResult(next) {
    if (!state.target) return
    const field = state.target
    field.setValue(next.value)
    field.setCaret(next.caret)
    field.el.dispatchEvent(new Event('input', { bubbles: true }))
    // 一次性 Shift：插完一个字符就回落
    clearOneShotShift()
    if (els && !els.panel.hidden) render()
}

/** 空格转写：按空格把光标前的拉丁词换成原文，与助手开关、面板状态无关 */
function convertOnSpace(field, e) {
    const convert = state.config?.translit?.convert
    if (typeof convert !== 'function') return false
    const caret = field.getCaret()
    const value = field.getValue()
    const m = value.slice(0, caret).match(WORD_TAIL)
    const word = m ? m[0] : ''
    if (!word) return false
    e.preventDefault()
    const start = caret - word.length
    const converted = convert(word) || word
    field.setValue(value.slice(0, start) + converted + ' ' + value.slice(caret))
    field.setCaret(start + converted.length + 1)
    field.el.dispatchEvent(new Event('input', { bubbles: true }))
    if (state.target === field && els && !els.panel.hidden) render()
    return true
}

/** 物理按键：Shift / CapsLock 改层，键盘模式按映射替换（跟随开关关掉时不拦） */
function onPhysicalKey(e) {
    if (!mounted || !state.config) return
    // 输入法组字期间的按键（空格上屏候选词）一律放行
    if (e.isComposing || e.keyCode === 229) return

    // 空格转写：全局，和助手开关 / 面板是否打开无关
    if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const field = adaptField(e.target)
        if (field && convertOnSpace(field, e)) return
    }

    if (!state.enabled || !els || els.panel.hidden) return
    if (!state.target || e.target !== state.target.el) return

    if (state.mode === 'keyboard') {
        if (e.key === 'Shift') {
            // 只有左 Shift 是 Shift 层；右 Shift 是「跟随物理键盘」的开关
            if (e.code === 'ShiftRight') {
                state.follow = !state.follow
                store(LS_FOLLOW, state.follow ? '1' : '0')
                render()
                return
            }
            state.shift = true
            oneShotShift = false
            render()
            return
        }
        if (e.key === 'CapsLock') {
            // 正常情况由 noteModifiers 按系统状态同步；拿不到系统状态时才退回「翻转一次」
            if (osCapsLock === null) {
                state.caps = !state.caps
                render()
            }
            return
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return

        // 一次性 Shift：按下任意字符键就熄灭，哪怕这个键没有映射、不产生字符
        const cleared = clearOneShotShift()
        const repaint = () => {
            if (cleared && els && !els.panel.hidden) render()
        }
        if ([...e.key].length !== 1) return repaint()
        if (!state.follow) return repaint()
        const latin = CODE_SLOT[e.code] || e.key.toLowerCase()
        const map = state.config.keyboard?.map || {}
        const shiftMap = state.config.keyboard?.shift || {}
        if (!map[latin] && !shiftMap[latin]) return repaint()
        e.preventDefault()
        const capsLock = e.getModifierState ? e.getModifierState('CapsLock') : false
        const upper = capsLock !== e.shiftKey
        const char = upper ? (shiftMap[latin] || map[latin]) : (map[latin] || shiftMap[latin])
        applyResult(insertAt(state.target.getValue(), state.target.getCaret(), char))
        flashKey(latin)
    }
}

function onPhysicalKeyUp(e) {
    if (!mounted || e.key !== 'Shift') return
    if (e.code === 'ShiftRight') return
    if (!state.shift) return
    state.shift = false
    if (els && !els.panel.hidden && state.mode === 'keyboard') render()
}

function flashKey(latin) {
    if (!els) return
    const btn = els.body.querySelector(`[data-key="${latin}"]`)
    if (!btn) return
    btn.classList.add('is-pressed')
    setTimeout(() => btn.classList.remove('is-pressed'), 120)
}
