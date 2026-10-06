const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");
const stylistic = require("@stylistic/eslint-plugin");

// ── 唯一可配置区 ─────────────────────────────────
const lintConfig = {
    ext: [
        "js"
    ],
    excludes: [
        "docs/**/*.min.js",
        "docs/**/sources/**",
        "docs/**/npm/**",
        "docs/pages/**/hexo/**",
    ],
};

const extGlob = lintConfig.ext.length === 1
    ? `*.${lintConfig.ext[0]}`
    : `*.{${lintConfig.ext.join(",")}}`;

const lintIncludes = [`docs/**/${extGlob}`];

const lintExcludes = lintConfig.excludes;

module.exports = defineConfig([
    globalIgnores([
        "**/*.*",
        ...lintIncludes.map(g => `!${g}`),
        ...lintExcludes,
    ]),
    {
        files: lintIncludes,
        ignores: lintExcludes,
        plugins: {
            "@stylistic": stylistic,
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                ...globals.es2021,

                Docsify: "readonly",
                Gitalk: "readonly",
                PIXI: "readonly",
                Sakura: "readonly",
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },
        rules: {
            "no-empty": "warn",
            "no-cond-assign": ["warn", "always"],
            "no-undef": "error",

            "@stylistic/indent": ["warn", 4],
            "@stylistic/linebreak-style": ["warn", "unix"],
            "@stylistic/quotes": ["warn", "single"],
            "@stylistic/semi": ["warn", "never"],
            "@stylistic/spaced-comment": ["warn", "always"],
            "@stylistic/arrow-spacing": ["warn", { before: true, after: true }],
            // "@stylistic/comma-dangle": ["warn", "always"],
            "@stylistic/comma-spacing": ["warn", { before: false, after: true }],
            "@stylistic/key-spacing": ["warn", { beforeColon: false, afterColon: true }],
            "@stylistic/keyword-spacing": ["warn", { before: true, after: true }],
        },
    },
]);
