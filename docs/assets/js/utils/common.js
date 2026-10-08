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
 * @example
 *   import { protectCodeBlocks } from '../common/protectCodeBlocks.js'
 *
 *   content = protectCodeBlocks(content, 'htmlReplace', 'protect')
 *   // ... 在 content 上做各种替换 ...
 *   content = protectCodeBlocks(content, 'htmlReplace', 'restore')
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
