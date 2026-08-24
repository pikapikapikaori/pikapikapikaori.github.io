const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");
const stylistic = require("@stylistic/eslint-plugin");

module.exports = defineConfig([
    globalIgnores(["**/*.*", "!docs/utils/**/*.js"]),
    {
        // Only lint js files in docsify utils
        files: ["docs/utils/**/*.js"],
        plugins: {
            "@stylistic": stylistic,
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                ...globals.es2021,

                Gitalk: "readonly",
                PIXI: "readonly",
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },
        rules: {
            "no-empty": "warn",
            "no-cond-assign": ["warn", "always"],
            "no-undef": "error",
            // "comma-dangle": ["error", "always"],

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
