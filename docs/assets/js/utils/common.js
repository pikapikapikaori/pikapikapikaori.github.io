/**
 * @description
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
