import { addClass, onListen, removeClass } from './dom.js'

export function isEnabled(value) {
    return Boolean(value)
}

export function isNil(value) {
    return value === null || value === undefined
}

const codeBlockStore = new Map()

const codeBlockMarkup = /(```[\s\S]*?```)/gm
const inlineCodeMarkup = /(`[^`\n]+`)/g

export const codeBlockModes = {
    protect: 'protect',
    restore: 'restore'
}

export function protectCodeBlocks(content, prefix = 'codeblock', mode = codeBlockModes.protect) {
    if (mode === codeBlockModes.protect) {
        const blocks = []

        let protectedContent = content.replace(codeBlockMarkup, block => {
            const marker = `<!-- ${prefix}-${blocks.length} -->`
            blocks.push(block)
            return marker
        })

        protectedContent = protectedContent.replace(inlineCodeMarkup, block => {
            const marker = `<!-- ${prefix}-${blocks.length} -->`
            blocks.push(block)
            return marker
        })

        codeBlockStore.set(prefix, blocks)
        return protectedContent
    }

    if (mode === codeBlockModes.restore) {
        const blocks = codeBlockStore.get(prefix) || []

        const restoredContent = blocks.reduce((acc, block, i) => {
            const marker = `<!-- ${prefix}-${i} -->`
            return acc.replace(marker, () => block)
        }, content)

        codeBlockStore.delete(prefix)
        return restoredContent
    }

    return content
}

const countRules = [
    { name: 'latin',      type: 'word', pattern: String.raw`\p{Script_Extensions=Latin}+`,      speed: 250 },
    { name: 'greek',      type: 'word', pattern: String.raw`\p{Script_Extensions=Greek}+`,      speed: 150 },
    { name: 'cyrillic',   type: 'word', pattern: String.raw`\p{Script_Extensions=Cyrillic}+`,   speed: 200 },
    { name: 'hebrew',     type: 'word', pattern: String.raw`\p{Script_Extensions=Hebrew}+`,     speed: 200 },
    { name: 'mongolian',  type: 'word', pattern: String.raw`\p{Script_Extensions=Mongolian}+`,  speed: 100 },
    { name: 'devanagari', type: 'word', pattern: String.raw`\p{Script_Extensions=Devanagari}+`, speed: 200 },
    { name: 'siddham',    type: 'word', pattern: String.raw`\p{Script_Extensions=Siddham}+`,    speed: 100 },

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

    for (const rule of countRules) {
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

export const noTransitionClass = 'no-transition'

let noTransitionDepth = 0

export function lockNoTransition() {
    noTransitionDepth++
    addClass(document.body, noTransitionClass)
}

export function unlockNoTransition() {
    if (noTransitionDepth === 0) return

    noTransitionDepth--

    if (noTransitionDepth > 0) return

    void document.body.offsetHeight
    removeClass(document.body, noTransitionClass)
}

// #rgb / #rrggbb / #rrggbbaa → [h, s, l]
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

// [h, s, l] → #rrggbb
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

const buttonLikeElements = new WeakSet()

export function makeButtonLike(el) {
    if (buttonLikeElements.has(el)) return
    buttonLikeElements.add(el)

    el.tabIndex = 0
    onListen(el, 'keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.key === ' ') event.preventDefault()
        if (event.repeat) return
        el.click()
    })
}

export function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || min, min), max)
}

export function toDate(value) {
    if (value instanceof Date) return value
    const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = ''] = value.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/)
    // Stored fields are UTC+8 wall time even when a zone suffix is present.
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 8, Number(minute), Number(second), Number(fraction.padEnd(3, '0').slice(0, 3))))
}

export function formatDate(value, format = 'YYYY.MM.DD') {
    if (!value) return ''
    const date = toDate(value)
    if (format === 'YYYY-MM-DD' || format === 'YYYY.MM.DD') {
        const separator = format[4]
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(separator)
    }

    return format(date.getMonth() + 1, date.getDate(), date.getFullYear())
}
