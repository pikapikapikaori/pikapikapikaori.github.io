const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");
const stylistic = require("@stylistic/eslint-plugin");

/* ==============================
 * 唯一可配置区 
 ============================== */
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

const commonRules = {
    "no-empty": ["warn", { allowEmptyCatch: true }],
    "no-cond-assign": ["warn", "always"],
    "no-undef": "error",

    "@stylistic/indent": ["warn", 4],
    "@stylistic/linebreak-style": ["warn", "unix"],
    "@stylistic/quotes": ["warn", "single"],
    "@stylistic/semi": ["warn", "never"],
    "@stylistic/spaced-comment": ["warn", "always"],
    "@stylistic/arrow-spacing": ["warn", { before: true, after: true }],
    "@stylistic/comma-spacing": ["warn", { before: false, after: true }],
    "@stylistic/key-spacing": ["warn", { beforeColon: false, afterColon: true }],
    "@stylistic/keyword-spacing": ["warn", { before: true, after: true }],
};

const baseGlobals = {
    ...globals.node,
    ...globals.browser,
    ...globals.es2021,
};

// docs/utils/** 里额外认识的
const utilsGlobals = {
    Docsify: "readonly",
    Gitalk: "readonly",
    PIXI: "readonly",
    Sakura: "readonly",
};

// docs/pages/** 里额外认识的
const pagesGlobals = {
    animepage: {
        breakpoints: "readonly",
        browser: "readonly",
        $: "readonly",
        jQuery: "readonly",
    },
    homepage: {
        $: "readonly",
        jQuery: "readonly",
        cw: "readonly",
        ch: "readonly",
        requestAnimFrame: "readonly",
    },
    indexpage: {
        Handlebars: "readonly",
        date: "readonly",
        greet: "readonly",
    },
};

/* ============================== */

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
            globals: baseGlobals,
            ecmaVersion: "latest",
            sourceType: "module",
        },
        rules: commonRules,
    },
    {
        files: [
            "docs/utils/**/*.js"
        ],
        languageOptions: {
            globals: utilsGlobals,
        },
    },
    {
        files: [
            "docs/pages/animepage/**/*.js"
        ],
        languageOptions: {
            globals: pagesGlobals.animepage,
        },
        rules: {
            "no-cond-assign": ["warn", "except-parens"],
        },
    },
    {
        files: [
            "docs/pages/homepage/**/*.js"
        ],
        languageOptions: {
            globals: pagesGlobals.homepage,
        },
    },
    {
        files: [
            "docs/pages/indexpage/**/*.js"
        ],
        languageOptions: {
            globals: pagesGlobals.indexpage,
        },
    },
]);
