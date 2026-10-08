// TokenReplacer.js

/**
 * TokenReplacer
 * 模板替换工具：识别字符串里被 {} 包裹的内容，按 - 分隔后逐段替换。
 *
 * 字符规则：
 * - 唯一分隔符：-
 * - {} 内允许的字符：大小写字母、数字、_、-
 * - 注册的 token 名只允许：大小写字母、数字、_
 *
 * 替换规则：
 * - 内置日期 token：yyyy / mm / dd，永远可用，不允许被覆盖
 * - 一个实例最多注册一个前缀（静态字符串，只用于判断是否命中，不产生输出）
 * - 若 {} 内以「前缀-」开头：
 *     去掉前缀和它后面的 -，剩余部分里所有已注册 token 都替换
 * - 否则：
 *     只替换日期 token，其他原样保留
 * - 连续 -- 之间的空段忽略
 *
 * 用法示例：
 *   const replacer = new TokenReplacer({
 *     date: new Date('2000-11-11'),
 *     prefix: 'gitalk_footer',
 *     tokens: {
 *       aa: () => 'AA',
 *       bb: 'BB',
 *       cc: () => 'CC',
 *     },
 *   })
 */
class TokenReplacer {
    /**
     * @param {Object} [options]
     * @param {Date}   [options.date]   内置日期 token 使用的日期，默认 new Date()
     * @param {string} [options.prefix] 前缀名，只允许字母、数字、下划线，最多一个
     * @param {Object} [options.tokens] 自定义 token，{ name: value }
     *   value 可以是字符串，也可以是返回字符串的函数
     */
    constructor({ date, prefix, tokens } = {}) {
        this.date = date instanceof Date ? date : new Date()

        this.prefix = null
        if (prefix != null) {
            this.validateName(prefix, 'prefix')
            this.prefix = prefix
        }

        this.dateTokens = new Set(['yyyy', 'mm', 'dd'])

        this.tokens = new Map()

        this.registerBuiltinDateTokens()

        if (tokens) {
            Object.entries(tokens).forEach(([name, value]) => {
                this.registerToken(name, value)
            })
        }
    }

    /**
     * 注册内置日期 token：yyyy / mm / dd
     */
    registerBuiltinDateTokens() {
        const date = this.date
        const pad = n => String(n).padStart(2, '0')

        this.tokens.set('yyyy', () => String(date.getFullYear()))
        this.tokens.set('mm', () => pad(date.getMonth() + 1))
        this.tokens.set('dd', () => pad(date.getDate()))
    }

    /**
     * 注册一个自定义 token
     * @param {string} name 只允许字母、数字、下划线
     * @param {string|Function} value 替换值，函数会被调用并取其返回值
     * @returns {this}
     */
    registerToken(name, value) {
        this.validateName(name, 'token')

        if (this.dateTokens.has(name)) {
            throw new Error(
                `[TokenReplacer] Cannot override builtin date token: "${name}"`
            )
        }

        this.tokens.set(name, value)
        return this
    }

    /**
     * 移除一个自定义 token
     * @param {string} name
     * @returns {this}
     */
    unregisterToken(name) {
        if (this.dateTokens.has(name)) return this
        this.tokens.delete(name)
        return this
    }

    /**
     * 校验 token / prefix 名
     * @param {string} name
     * @param {string} type 'prefix' | 'token'
     */
    validateName(name, type) {
        if (typeof name !== 'string' || !/^[a-zA-Z0-9_]+$/.test(name)) {
            throw new Error(
                `[TokenReplacer] Invalid ${type} name: "${name}". ` +
                'Only letters, digits and underscore are allowed.'
            )
        }
    }

    /**
     * 解析一个 token 对应的替换值
     * @param {string} name
     * @returns {string}
     */
    resolve(name) {
        const value = this.tokens.get(name)
        return typeof value === 'function' ? String(value()) : String(value)
    }

    /**
     * 刷新日期 token 使用的日期
     * 会重新注册 yyyy / mm / dd，使它们指向新的日期
     * @param {Date} [date] 新的日期，默认 new Date()
     * @returns {this}
     */
    refreshDate(date = new Date()) {
        this.date = date instanceof Date ? date : new Date()
        this.registerBuiltinDateTokens()
        return this
    }

    /**
     * 替换入口
     * @param {string} input
     * @returns {string}
     */
    replace(input) {
        if (typeof input !== 'string') return input

        return input.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, expr) => {
            return this.processExpr(expr)
        })
    }

    /**
     * 处理 {} 里的表达式
     * @param {string} expr
     * @returns {string}
     */
    processExpr(expr) {
        let rest = expr
        let allowedTokens

        if (this.prefix && expr.startsWith(this.prefix + '-')) {
            rest = expr.slice(this.prefix.length + 1)
            allowedTokens = new Set(this.tokens.keys())
        } else {
            allowedTokens = this.dateTokens
        }

        const segments = rest.split('-').filter(segment => segment !== '')

        const processed = segments.map(segment =>
            this.replaceInSegment(segment, allowedTokens)
        )

        return processed.join('-')
    }

    /**
     * 在单个段里替换 token
     * 一次性匹配所有 token 并替换，避免替换结果被二次替换
     * @param {string} segment
     * @param {Set<string>} allowedTokens
     * @returns {string}
     */
    replaceInSegment(segment, allowedTokens) {
        const names = Array.from(allowedTokens).sort(
            (a, b) => b.length - a.length
        )

        if (names.length === 0) return segment

        const pattern = names
            .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|')

        const regex = new RegExp(
            `(?<![a-zA-Z0-9])(${pattern})(?![a-zA-Z0-9])`,
            'g'
        )

        return segment.replace(regex, (_, name) => this.resolve(name))
    }
}

export default TokenReplacer
export { TokenReplacer }
