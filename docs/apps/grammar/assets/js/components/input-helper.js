
import { h } from '../utils/dom.js'
import { adaptField } from '../adapters/text-field.js'
import {
    applyMark, insertAt, deleteBefore, isMark, previewChar, splitTail, sanitizeOriginal, WORD_TAIL
} from '../utils/ime-compose.js'
import { loadIme } from '../services/ime-service.js'
import { getLanguage } from '../data/languages.js'
import { bdiNode } from '../utils/bdi.js'
import {
    getBool, setBool, getString, setString, imeModeKey, imeEnabledKey, imeFollowKey
} from '../store/local-storage.js'

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
let oneShotShift = false
let osCapsLock = null

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

function readEnabled() {
    return getBool(imeEnabledKey, true)
}

function readFollow() {
    return getBool(imeFollowKey, true)
}


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
    state.mode = getString(imeModeKey(lang), null)
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
        setTimeout(() => {
            if (!els || els.panel.hidden) return
            const active = document.activeElement
            if (els.panel.contains(active)) return
            if (adaptField(active)) return
            closePanel()
        }, 0)
    })

    window.addEventListener('pointerdown', noteModifiers, true)
    window.addEventListener('keydown', noteModifiers, true)
    window.addEventListener('keyup', noteModifiers, true)
    window.addEventListener('keydown', onShortcutKey, true)
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

function trimField(field) {
    if (field.el.dataset && field.el.dataset.imeRaw === 'true') return
    const value = field.getValue()
    const trimmed = value.trim()
    if (value === trimmed) return
    const caret = field.getCaret()
    const head = value.length - value.replace(/^\s+/, '').length
    field.setValue(trimmed)
    field.setCaret(Math.max(0, Math.min(trimmed.length, caret - head)))
}

function sanitizeTarget() {
    if (!state.target) return
    if (state.target.el.dataset && state.target.el.dataset.imeRaw === 'true') return
    const value = state.target.getValue()
    const clean = sanitizeOriginal(value)
    if (clean === value) return
    const caret = state.target.getCaret()
    state.target.setValue(clean)
    state.target.setCaret(Math.max(0, Math.min(clean.length, caret)))
}


function ensureDom() {
    if (els) return els

    const fab = h('button', {
        class: 'ime-fab',
        type: 'button',
        'aria-label': '输入助手',
        onclick: () => {
            state.enabled = !state.enabled
            setBool(imeEnabledKey, state.enabled)
            refreshFab()
            if (state.enabled) openForFocused()
            else closePanel()
        }
    }, keyboardIcon())

    const panel = h('div', { class: 'ime', role: 'dialog', 'aria-label': '输入助手', hidden: true })
    const head = h('div', { class: 'ime__head' })
    const body = h('div', { class: 'ime__body' })
    const foot = h('div', { class: 'ime__foot' })
    panel.append(head, body, foot)

    panel.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) e.preventDefault()
    })

    document.body.append(fab, panel)
    els = { fab, panel, head, body, foot }
    return els
}

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

function refreshFab() {
    if (!els) return
    els.fab.hidden = !state.config
    document.documentElement.classList.toggle('has-ime-fab', !els.fab.hidden)
    els.fab.classList.toggle('ime-fab--on', state.enabled)
    els.fab.title = state.enabled
        ? '输入助手：开（点击或 Ctrl+Shift+` 关闭）'
        : '输入助手：关（点击或 Ctrl+Shift+` 开启）'
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
    if (osCapsLock !== null) state.caps = osCapsLock
    els.panel.hidden = false
    render()
    keepTargetVisible()
}

function closePanel() {
    if (els) els.panel.hidden = true
    state.shift = false
    oneShotShift = false
}

function keepTargetVisible() {
    if (!els || !state.target) return
    const panelRect = els.panel.getBoundingClientRect()
    const fieldRect = state.target.el.getBoundingClientRect()
    const narrow = window.matchMedia('screen and (max-width: 768px)').matches
    const visibleBottom = narrow ? panelRect.top - 12 : Math.min(panelRect.top - 12, window.innerHeight - 12)
    const overlap = fieldRect.bottom - visibleBottom
    if (overlap > 0) window.scrollBy({ top: overlap + 12, behavior: 'smooth' })
}


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

function layerUpper() {
    return state.caps !== state.shift
}

function scriptText(text) {
    const str = String(text ?? '')
    if (!state.code || !str || /^[\x20-\x7E]+$/.test(str)) return str
    return bdiNode(str, state.code)
}

function upperSample(sample) {
    if (!sample) return '\u25CC'
    return state.config?.cased === true && layerUpper() ? sample.toUpperCase() : sample
}

function sampleLetter() {
    return upperSample(state.config?.placeholderBase)
}

function sampleForChar(ch) {
    const overrides = state.config?.samples
    const hit = ch && overrides ? overrides[ch] : null
    return upperSample(hit || state.config?.placeholderBase)
}

function setMode(mode) {
    if (!mode || mode === currentMode()) return
    if (!availableModes().includes(mode)) return
    state.mode = mode
    state.shift = false
    oneShotShift = false
    if (state.config) setString(imeModeKey(state.config.code), mode)
    render()
}

function render() {
    const c = state.config
    const modes = availableModes()
    const mode = currentMode()
    state.mode = mode
    els.panel.classList.toggle('ime--vertical', getLanguage(state.code)?.vertical === true)

    els.base = h('span', { class: 'ime__base' })
    els.head.replaceChildren(
        h('div', { class: 'ime__tabs', role: 'group', 'aria-label': '输入方式' },
            ...modes.map((m, i) => h('button', {
                type: 'button',
                class: 'ime__tab',
                'aria-pressed': String(m === mode),
                'aria-keyshortcuts': `Control+Shift+${i + 1}`,
                title: `${MODE_LABEL[m]}（Ctrl+Shift+${i + 1}）`,
                onclick: () => setMode(m)
            }, MODE_LABEL[m]))
        ),
        els.base
    )

    els.body.replaceChildren()
    if (mode === 'marks') {
        els.body.append(renderMarks())
    } else {
        if (els.base) els.base.replaceChildren()
        if (mode === 'keyboard') els.body.append(renderKeyboard())
    }
    els.foot.textContent = modes.length > 1
        ? 'Ctrl+Shift+` / Esc 关闭 · Ctrl+Shift+1 / 2 切换'
        : 'Ctrl+Shift+` / Esc 关闭'
}

function groupChars(group) {
    return (group.items || []).map((it) => it.c).filter(Boolean).join('')
}

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
    const rows = [...keyed.keys()].sort((a, b) => a - b).map((key) => keyed.get(key))
    return rows.concat(loose)
}

function allMarkChars(groups) {
    return groups.filter((g) => !g.insert).map(groupChars).join('')
}

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

    if (els && els.base) {
        els.base.replaceChildren(...(base
            ? ['基字 ', bdiNode(base, state.code)]
            : ['基字 ', bdiNode(sampleLetter(), state.code), '（样字）']))
    }

    const rows = markRows(c.marks).map((groups) => groups.map((group) => markGroupEl(group, base)))
    const restore = h('div', { class: 'ime__group' },
        h('div', { class: 'ime__group-title' }, '还原'),
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
        h('div', { class: 'ime__group-title' }, group.label),
        renderMarkItems(group, base)
    )
}

function renderMarkItems(group, base) {
    const c = state.config
    const items = h('div', { class: 'ime__items' })

    for (const item of group.items) {
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

        const label = isMark(item.c) ? previewChar(base || sampleForChar(item.c), item.c) : item.c
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
            setBool(imeFollowKey, state.follow)
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
    clearOneShotShift()
    if (els && !els.panel.hidden) render()
}

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

function onShortcutKey(e) {
    if (!mounted || !els || !state.config) return
    if (e.isComposing || e.keyCode === 229) return

    if (e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey && e.code === 'Backquote') {
        e.preventDefault()
        e.stopPropagation()
        if (!els.panel.hidden) {
            closePanel()
            return
        }
        const field = adaptField(document.activeElement)
        if (!field || !field.el.closest('#view')) return
        if (!state.enabled) {
            state.enabled = true
            setBool(imeEnabledKey, true)
            refreshFab()
        }
        state.target = field
        openPanel()
        return
    }

    if (els.panel.hidden) return

    if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closePanel()
        return
    }

    if (!e.ctrlKey || !e.shiftKey || e.metaKey || e.altKey) return
    const index = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : -1
    if (index < 0) return
    const modes = availableModes()
    if (!modes[index]) return
    e.preventDefault()
    setMode(modes[index])
}

function onPhysicalKey(e) {
    if (!mounted || !state.config) return
    if (e.isComposing || e.keyCode === 229) return

    if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const field = adaptField(e.target)
        if (field && convertOnSpace(field, e)) return
    }

    if (!state.enabled || !els || els.panel.hidden) return
    if (!state.target || e.target !== state.target.el) return

    if (state.mode === 'keyboard') {
        if (e.key === 'Shift') {
            if (e.code === 'ShiftRight') {
                state.follow = !state.follow
                setBool(imeFollowKey, state.follow)
                render()
                return
            }
            state.shift = true
            oneShotShift = false
            render()
            return
        }
        if (e.key === 'CapsLock') {
            if (osCapsLock === null) {
                state.caps = !state.caps
                render()
            }
            return
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return

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
