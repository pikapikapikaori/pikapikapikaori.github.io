/**
 *   快捷键注册表。
 *
 *   所有快捷键都必须先按住前缀键 `LEADER` 再按另一个键才生效；前缀键单独按下不拦截
 *   任何事件。同一个按键从“最后注册”的一组开始匹配，晚注册的作用域可以覆盖先注册的。
 *   匹配依据是 KeyboardEvent.code，不受输入法全角标点与键盘布局影响。
 *
 * @param {Object} bindings
 *   键为 KeyboardEvent.code（ArrowLeft、KeyM、Digit1、Comma、Escape 等）；
 *   值为处理函数，或一个配置对象：
 *   {
 *     handler,                       // 触发时执行
 *     repeat,                        // 长按是否重复触发，默认 false
 *     when,                          // 单条快捷键的额外条件
 *     allowInInput,                  // 焦点在输入框里时是否仍触发，默认 false
 *     preventDefault,                // 默认 true
 *     stopPropagation,               // 默认 false
 *     ctrl, meta, alt, shift         // 需要按下的修饰键，默认全部为 false
 *   }
 * @param {Object} [options]
 * @param {Function} [options.when] 整组快捷键的启用条件，省略表示一直启用
 *
 * @returns {Function} 取消注册
 */
export function bindShortcuts(bindings, options) {
    const group = {
        when: (options && options.when) || null,
        bindings: {}
    }

    Object.keys(bindings).forEach(key => {
        const value = bindings[key]
        const binding = typeof value === 'function' ? { handler: value } : Object.assign({}, value)

        binding.repeat = Boolean(binding.repeat)
        binding.allowInInput = Boolean(binding.allowInInput)
        binding.preventDefault = binding.preventDefault !== false
        binding.stopPropagation = Boolean(binding.stopPropagation)
        binding.ctrl = Boolean(binding.ctrl)
        binding.meta = Boolean(binding.meta)
        binding.alt = Boolean(binding.alt)
        binding.shift = Boolean(binding.shift)

        group.bindings[key] = binding
    })

    registry.push(group)
    listen()

    return function unbind() {
        const index = registry.indexOf(group)
        if (index > -1) registry.splice(index, 1)
    }
}

const LEADER = 'KeyB'

const registry = []

let listening = false
let leaderDown = false

function listen() {
    if (listening) return
    listening = true

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', resetLeader)
}

function resetLeader() {
    leaderDown = false
}

function isEditable(target) {
    if (!target || target.nodeType !== 1) return false

    const tagName = target.tagName

    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
}

function hasModifier(event) {
    return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
}

function onKeyDown(event) {
    if (event.isComposing || event.keyCode === 229) return

    if (event.code === LEADER) {
        if (!event.repeat && !hasModifier(event)) leaderDown = true
        return
    }

    if (!leaderDown) return

    const binding = find(event)
    if (!binding) return

    if (binding.preventDefault) event.preventDefault()
    if (binding.stopPropagation) event.stopPropagation()

    binding.handler(event)
}

function onKeyUp(event) {
    if (event.code === LEADER) resetLeader()
}

function find(event) {
    for (let i = registry.length - 1; i >= 0; i--) {
        const group = registry[i]

        if (group.when && !group.when()) continue

        const binding = group.bindings[event.code]
        if (!binding) continue
        if (event.repeat && !binding.repeat) continue
        if (!binding.allowInInput && isEditable(event.target)) continue
        if (binding.ctrl !== event.ctrlKey) continue
        if (binding.meta !== event.metaKey) continue
        if (binding.alt !== event.altKey) continue
        if (binding.shift !== event.shiftKey) continue
        if (binding.when && !binding.when()) continue

        return binding
    }

    return null
}
