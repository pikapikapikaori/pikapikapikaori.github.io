/**
 *   代码块保护工具（通用）。
 *   通过第三个参数 mode 区分“保护”和“还原”两个动作。
 *
 *   保护：把 ```...``` 代码块整体替换成 HTML 注释标记，
 *         按 prefix 暂存原始代码块，返回处理后的内容。
 *   还原：根据 prefix 取出暂存的代码块，把标记还原回原始内容。
 *
 *   标记格式：<!-- ${prefix}-${index} -->
 *
 *   只处理 ``` 包裹的代码块，不处理 ~~~ 和行内代码。
 *   同一 prefix 的 protect 与 restore 必须成对调用。
 *
 * @param {string} content - 待处理内容
 * @param {string} prefix  - 标记前缀，用于区分不同调用方
 * @param {'protect'|'restore'} mode - 操作模式
 *
 * @returns {string}
 *   - mode='protect'：代码块已被替换成标记后的内容
 *   - mode='restore'：标记已被还原成原始代码块后的内容
 *
 */
const codeBlockStore = new Map()

const CODE_MARKUP = /(```[\s\S]*?```)/gm

export function protectCodeBlocks(content, prefix = 'codeblock', mode = 'protect') {
    if (mode === 'protect') {
        const blocks = []

        const protectedContent = content.replace(CODE_MARKUP, block => {
            const marker = `<!-- ${prefix}-${blocks.length} -->`
            blocks.push(block)
            return marker
        })

        codeBlockStore.set(prefix, blocks)
        return protectedContent
    }

    if (mode === 'restore') {
        const blocks = codeBlockStore.get(prefix) || []

        const restoredContent = blocks.reduce((acc, block, i) => {
            const marker = `<!-- ${prefix}-${i} -->`
            return acc.replace(marker, () => block)
        }, content)

        codeBlockStore.delete(prefix)
        return restoredContent
    }

    console.warn(`[protectCodeBlocks] Unknown mode: ${mode}`)
    return content
}

/**
 * 统计各脚本词/字数，并估算阅读时间（分钟）。不修改 content。
 *
 * @param {string} content 只读原文
 * @param {{ speeds?: Record<string, number> }} [options] 可覆盖默认速度（单位/分钟）
 * @returns {{
 *   total: { count: number, time: number },  // 总和
 *   word:  { count: number, time: number },  // 词部分小计
 *   char:  { count: number, time: number },  // 字/假名部分小计
 *   detail: Record<string, { count: number, time: number, speed: number, type: 'word' | 'char' }>
 * }}
 */
const COUNT_RULES = [
    // —— 按“词”统计 ——
    { name: 'latin',      type: 'word', pattern: String.raw`\p{Script_Extensions=Latin}+`,      speed: 250 },
    { name: 'greek',      type: 'word', pattern: String.raw`\p{Script_Extensions=Greek}+`,      speed: 150 },
    { name: 'cyrillic',   type: 'word', pattern: String.raw`\p{Script_Extensions=Cyrillic}+`,   speed: 200 },
    { name: 'hebrew',     type: 'word', pattern: String.raw`\p{Script_Extensions=Hebrew}+`,     speed: 200 },
    { name: 'mongolian',  type: 'word', pattern: String.raw`\p{Script_Extensions=Mongolian}+`,  speed: 100 },
    { name: 'devanagari', type: 'word', pattern: String.raw`\p{Script_Extensions=Devanagari}+`, speed: 200 },
    { name: 'siddham',    type: 'word', pattern: String.raw`\p{Script_Extensions=Siddham}+`,    speed: 100 },

    // —— 按“字/假名”统计 ——
    { name: 'cjk', type: 'char',
        pattern: String.raw`[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30FC]`,
        speed: 400 }
]

export function countText(content, options = {}) {
    const src = (typeof content === 'string' ? content : String(content ?? ''))
        .normalize('NFC')

    const detail = {}
    const word  = { count: 0, time: 0 }
    const char  = { count: 0, time: 0 }

    for (const rule of COUNT_RULES) {
        const re = new RegExp(rule.pattern, 'gu')
        const matches = src.match(re)
        const count = matches ? matches.length : 0

        const speed = options.speeds?.[rule.name] ?? rule.speed
        const time  = speed > 0 ? count / speed : 0

        detail[rule.name] = { count, time, speed, type: rule.type }

        const bucket = rule.type === 'word' ? word : char
        bucket.count += count
        bucket.time  += time
    }

    return {
        total: { count: word.count + char.count, time: word.time + char.time },
        word,
        char,
        detail
    }
}

/**
 * 临时禁用页面过渡（引用计数，可嵌套）。
 *
 * 与 `body.no-transition` 样式配合：需要瞬时生效的样式修改前后成对调用，
 * 保证这次修改不触发 transition。最后一个 unlock 会强制一次 reflow 再摘类。
 */
let noTransitionDepth = 0

export function lockNoTransition() {
    noTransitionDepth++
    document.body.classList.add('no-transition')
}

export function unlockNoTransition() {
    if (noTransitionDepth === 0) return

    noTransitionDepth--

    if (noTransitionDepth > 0) return

    void document.body.offsetHeight
    document.body.classList.remove('no-transition')
}

/**
 * 判断当前设备是否属于移动端。
 *
 * 命中时会给 <html> 补上 android / iphone / winphone 类名。
 *
 * @returns {boolean} 是否移动端
 */
export function isMobile() {
    let WIN = window
    let NA = WIN.navigator
    let UA = NA.userAgent.toLowerCase()

    function test(needle) {
        return needle.test(UA)
    }

    let IsAndroid = test(/android|htc/) || /linux/i.test(NA.platform + '')
    let IsIPhone = !IsAndroid && test(/ipod|iphone/)
    let IsWinPhone = test(/windows phone/)

    let device = {
        IsAndroid: IsAndroid,
        IsIPhone: IsIPhone,
        IsWinPhone: IsWinPhone,
    }

    let documentElement = WIN.document.documentElement
    for (var i in device) {
        if (device[i]) {
            documentElement.className += ' ' + i.replace('Is', '').toLowerCase()
        }
    }

    return device.IsAndroid || device.IsIPhone || device.IsWinPhone
}

/**
 * #rgb / #rrggbb / #rrggbbaa → [h, s, l]。
 *
 * @param {string} hex 十六进制颜色
 * @returns {number[]} [h(0-360), s(0-100), l(0-100)]，均为整数
 */
export function hexToHsl(hex) {
    hex = hex.replace('#', '')

    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('')
    }

    if (hex.length === 8) {
        hex = hex.substring(0, 6)
    }

    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    let h = 0
    if (delta !== 0) {
        if (max === r) {
            h = 60 * (((g - b) / delta) % 6)
        } else if (max === g) {
            h = 60 * ((b - r) / delta + 2)
        } else {
            h = 60 * ((r - g) / delta + 4)
        }
    }
    if (h < 0) h += 360

    let s = 0
    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * (max + min) / 2 - 1))
    }

    const l = (max + min) / 2

    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

/**
 * [h, s, l] → #rrggbb。
 *
 * @param {number} h 色相 0-360
 * @param {number} s 饱和度 0-100
 * @param {number} l 亮度 0-100
 * @returns {string} 十六进制颜色
 */
export function hslToHex(h, s, l) {
    l /= 100

    const a = s * Math.min(l, 1 - l) / 100
    const f = n => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
    }

    return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * 让原本只能点击的元素可键盘操作。
 *
 * 加上 role="button" 与 tabindex="0"，并把 Enter / Space 转成一次 click。
 *
 * @param {HTMLElement} el 目标元素
 */
const buttonLikeElements = new WeakSet()

export function makeButtonLike(el) {
    if (buttonLikeElements.has(el)) return
    buttonLikeElements.add(el)

    el.setAttribute('role', 'button')
    el.tabIndex = 0
    el.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.key === ' ') event.preventDefault()
        if (event.repeat) return
        el.click()
    })
}
