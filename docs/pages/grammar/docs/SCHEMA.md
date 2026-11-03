# 数据 Schema 与语法数据规范

本文档按你要做的事选读：

| 你要做什么 | 看哪里 |
| --- | --- |
| 存储结构、导入 / 导出 JSON 格式、Word 字段、某个语言的语法数据写法 | 应用内「数据格式」页（`#/schema`；数据在 `data/schema/*.json`） |
| 改版本迁移、检索与唯一键规则、HTTP 层 | [一、数据契约](#一数据契约) |
| 加一个新语言、一个新外部源、一个新分析源 | [三、新增流程](#三新增流程) |
| 看某个语言 / 某个源目前是怎么实现的、有哪些坑 | [四、现有实现](#四现有实现) |

---

## 一、数据契约

存储结构（IndexedDB 三个 store）、用户导出 / 导入 JSON 与 Word 字段已迁到应用内「数据格式」页
（`#/schema`，数据在 `data/schema/*.json`）。这一章只剩下面几节。

---

### 5. 版本迁移

`assets/js/services/import-export-service.js` 中维护 `MIGRATIONS`：

```js
const MIGRATIONS = {
  1: (payload) => { /* v1 → v2 */ return payload },
  // 2: (payload) => { /* v2 → v3 */ return payload },
}
```

导入时逐级升级到 `CURRENT_VERSION`。当前为 `version: 2`：

- **v1 → v2**：`words[].stem`（单一词干）→ `words[].stems: { base }`；导入 v1 文件时自动升级。

---

### 6. 检索规则

#### 6.1 检索范围

- **当前语言内**，不做跨语言检索。
- 列表页「检索范围」三档：

| 值 | 名称 | 命中字段 |
| --- | --- | --- |
| `all` | 全部 | 词形（下列全部）+ `meanings[].text`、`examples[].text`、`examples[].translation`、`collocations[].text`、`collocations[].gloss` |
| `forms` | 词形 | `lemma`、`stems` 全部值、`paradigm` 全部格子、`inflections[].form` |
| `head` | 原形 | 只有 `lemma` + `stems` 全部值 |

- 默认 `all`。`head` 同时用于派生词选择器的搜索。
- **数词的多种形式属于派生词**，不作为同一词条的变格形式参与检索。

#### 6.2 匹配方式

**大小写、变音符号、长短音、气符不敏感**。

规范化流程（`utils/text-normalize.js` 的 `normalizeSearch`）：

1. `String.prototype.normalize('NFD')` —— 分解预组合字符
2. 去除所有 Unicode 组合标记（`\p{M}`）
3. `toLowerCase()`
4. 词尾 sigma `ς` 归并为 `σ`（古希腊语）

例：

- 检索 `amo` 命中 `amō` / `AMŌ` / `ămō`
- 检索 `λυω` 命中 `λύω`
- 检索 `λογος` 命中 `λόγος`
- 检索 `kama` 命中 `kāma`
- 检索 `ete` 命中 `été`

**高亮与片段**保留原始文本，索引映射通过 `normalizeSearchWithMap` 计算。

#### 6.3 唯一键

**不受检索规范化影响**。`addOrMerge` / `findByKey` / 导入合并时仍按原始字符串严格比较。

---

### 7. 共用 HTTP 层

各源不直接调 `fetch`，统一用 `requestJSON` / `requestText`，参数写在源文件顶部的 `HTTP` 常量里
（`timeout` / `retries` / `minInterval` / `concurrency` / `cacheTtl`，含义见 http.js 顶部注释）。

- 节流按 `origin` 全局生效：不同源请求同一站点也会排队；同一站点被多个源请求时取各自声明的较大值。
  参数没有默认值，由各源自己声明（写在源文件顶部的 `HTTP` 常量里）。
- 429 / 503 优先按 `Retry-After`（秒数或 HTTP-date）等待，其余按 `400ms·2^n` + 抖动退避；
  其他 4xx 不重试，抛 `HTTP <status>`；超时抛「请求超时」。
- `cacheTtl > 0` 时，成功响应写进 IndexedDB 的 `httpCache`（库 `langnotebook` v2，键是排序后的 URL），
  过期条目按需清理；语言列表页点「清空数据」时会连它一起清掉（`store/http-cache.js` 的 `clearHttpCache()`）。

---

## 三、新增流程

这块只讲「加什么、放哪里」，具体实现与坑见 **四、现有实现** 的对应小节。

### 1. 新增一个语言

以新增语言 code `xx` 为例，按以下顺序改动：

| 步骤 | 文件 | 改动内容 |
| ---- | ---- | -------- |
| 1 | `assets/js/config/config.js` | 在 `GRAMMAR_FILES` 末尾追加语言 code `'xx'`。元信息全部写在 `data/language/xx/meta.json`（见手册 §1），`code` 必须唯一。 |
| 2 | `data/language/xx/` | 新建语言目录，目录名必须与 `code` 一致：`meta.json`（`version`（整数）、`language`（同 `code`）、`name`、`files`、`grammarFiles` 必填）、`grammar/paradigms.json`、`grammar/{章}.json`（一章一个文件，文件名 = 章节 id）。锚点按 `xx-{category}-{item}` 命名且全局唯一，并登记到 `grammarFiles.chapters[].anchors`。 |
| 3 | `assets/css/base.css` | 在语言字体区块加 `[lang="xx"] { font-family: var(--ff-xx); --ff-display: var(--ff-xx); }`。**方向不写在这里**：RTL / 竖排由 `config.js` 的 `BDI_LANGS` / `SCRIPT_POPUP_LANGS` 决定，原文会自动包进 `<bdi dir>`。 |
| 4 | `assets/css/variables.css` + `fonts.css` | `variables.css` 加 `--ff-xx: "LN XX", var(--ff-ui);`（缺字时回退到界面字体）。`fonts.css` 加 `@font-face`，**只声明该文字的 `unicode-range`**，这样同一段里的说明性中英文会落到界面字体；只声明实际拥有的字重，缺的粗体由浏览器合成。没有专用字体可跳过这一步。 |
| 5 | `external/js/wiktionary.js` | 需要 Wiktionary 在线查询时，在 `LANG_TO_WIKTIONARY` 增加 `'xx': '<英文 Wiktionary 的二级标题名>'`；该语言在 Wiktionary 没有词条时不要加，否则查询永远返回空。 |
| 6 | `data/language/xx/paradigm.js` | 可选。该语言的 derive 后期处理（重音 / 连声 / 词尾变音），在 `meta.files.paradigm` 里登记，见「数据格式 · 语言数据手册」的「语言档案」一节。不需要就跳过，引擎会自动略过这两步。 |
| 7 | `docs/SCHEMA.md` | 更新「锚点 id 命名」的示例表（见「数据格式 · 语言数据手册」）。（语言元数据表与四·1 都以数据文件为准，不用回来改） |

补充说明：

- **分组**：`classical` 决定语言进入「古典语言」还是「现代语言」组，分组本身不可由用户跨组拖动。
- **竖排 / RTL**：`vertical: true` 只让浮层用竖排样式；`rtl: true` 决定 `<bdi>` 与浮层的 `dir`。
  能否弹浮层看 `SCRIPT_POPUP_LANGS`，`<bdi>` 的包裹范围看 `BDI_LANGS`（都按字符范围判定）。
- **词性**：`pos` 取值来自 `assets/js/config/config.js` 的全局 `POS_LIST`，不是按语言定义。新语言的 `paradigms` 只能使用这些 key；确有新词性需求时需同时改 `POS_LIST` 和四·1。
- **语法文件加载**：`assets/js/services/grammar-service.js` 先取 `./data/language/{code}/meta.json`，再按当前章节取 `grammar/{章}.json`（词表单 / 词列表会组合全部章节），404 时该语言的「语法」页显示为空提示。`data/language/` 在 `sw.js` 中走 stale-while-revalidate，新增语言文件不需要改动 `sw.js`。
- **既有用户数据**：老用户的 `settings.languageOrder` 里没有新 code 时，语言选择页会按 `LANGUAGES` 原始顺序把它追加到所在组末尾，不需要数据迁移。

### 2. 新增外部数据源

新增一个源就是两步：写一个 `external/js/<source>.js`（导出 `lookupWordForForm`），
在 `EXTERNAL_SOURCES` 里加一条记录（源一律动态 import，不静态引用）。接入前先确认可行性 —— **CORS、限流、覆盖哪些语言**：
CORS 是硬门槛（无 `Access-Control-Allow-Origin` 的站点前端直连不了，只能换接口或不做），
限流则写在源文件顶部的 `HTTP` 常量里（见一·7）。

**注册方式**（`assets/js/config/config.js`）：

```js
export const EXTERNAL_SOURCES = [
    { id: 'wiktionary', label: 'Wiktionary', file: 'wiktionary' },
]
```

- `id` 同时写进词条的 `source` 字段（`meanings` / `examples` / `inflections`），
  也会出现在表单「来源」下拉里（`WORD_SOURCE_OPTIONS` = 手动 + 各外部源）。
- `file` 对应 `external/js/{file}.js`。
- 生词表单在 `mount()` 时按清单 `Promise.all` 动态 import；某个文件缺失或断网时该源不显示，
  表单其余部分照常。新增一个源 = 加一条 `EXTERNAL_SOURCES` 记录 + 一个导出 `lookupWordForForm` 的文件，
  不改视图代码。
- **界面**：
  - 「词性」下拉右边是**唯一一个**「从来源查询」按钮，按一次并发查全部外部源；
  - 查回来的内容按来源落到各自的 `source` 上：
    语法性等 `attributes`、变格 / 变位类型、语法锚点、词干取自选中的那个词条；
    含义则每个来源各写一份；
  - 候选多于一个（同一页多个词性，或多个源都有结果）时弹窗列出「来源 · 词性 · 词源小节」，
    用户选定后按它回填；`preferredPos`（表单当前词性）优先作为默认选项；
  - 「含义」块内部有来源标签页（`手动` + 各外部源 + 数据里出现过的其它来源），
    **切换 tab 只影响含义**；每条含义不再带「来源」下拉，归属由 tab 决定。
- **词性**：查询到的词条自己带 `pos`，选中后表单词性跟着变；属性字段按新词性重新渲染。
  本次没有可靠锚点的词条会清掉上次自动填的「变格 / 变位类型」文案。

**模块契约**：

```js
// external/js/<source>.js
export async function lookupWordForForm({ lemma, langCode, preferredPos, grammarDoc })
// → { pos, meanings, stems?, inflectionType?, attributes?, summary, choices? } | null
```

返回的是**回填用的补丁**：`pos` 会切词性，`meanings` 写进该来源的含义页，
`stems` 写进「词干」，`attributes`（如 `{ gender: "f" }`）填词性声明的属性字段，
`inflectionType`（`{ grammarRef, label }`）选中「语法锚点」——
`grammarRef` 必须是该词性下确实存在的锚点 id，对不上的会被视图忽略。
来源标记由模块自己盖（`source: '<id>'`）。

变格 / 变位表由 `derive` 引擎按词干生成，**不要求外部源提供表格**；
视图另外还认 `examples`（覆盖例句）、`paradigm`（合并进 `data.paradigm.main`）、
`inflections`（追加到「补充形式」），哪个源能拿到再给，拿不到就不返回。

同一页有多个可用词条时（多词性，或同一词性分属多个词源小节），
除了按 `preferredPos` 挑一条当主结果，还要给出 `choices: [{ label, patch }]`，
`patch` 与本对象同构。视图在查询按钮旁多一个下拉，切换即用该 `patch` 重新回填；
`label` 要带上语言与词性（Wiktionary 源还会带词源小节名），以便区分。

### 3. 新增形态分析源

形态分析（「这个屈折形式是什么」）是**独立于生词表单**的功能，不注册进 `EXTERNAL_SOURCES`：
入口在生词列表页标题栏的「分析」按钮，打开 `components/analyze-modal.js` 浮层。
和外部数据源一样，一个 API 一个文件、动态 import、共用 HTTP 层。

**注册方式**（`assets/js/config/config.js`）：

```js
export const ANALYZE_SOURCES = [
    { id: 'perseus', label: 'Perseus', file: 'perseus', langs: ['grc', 'la'] },
]
```

- `file` 对应 `external/js/{file}.js`；`langs` 决定哪些语言的生词列表页出现「分析」入口
  （一个源都没有时整颗按钮不渲染，与 `grammar: false` 时隐藏「语法」是同一种写法）。
- 配置只有数据；筛源 / 加载 / 并发查询在 `assets/js/services/analyze-service.js`：
  `hasAnalyzer(lang)`（列表页判断入口）、`loadAnalyzers(lang)`（动态 import + 校验导出，缺文件跳过）、
  `analyze({ word, langCode, sources })`（并发查全部源，返回 `{ entries, errors }`）。
  浮层与列表页都只调这三个函数，不直接碰清单或 `external/js/`。
- **新增一个分析源 = 两步**：写 `external/js/<source>.js` 导出 `analyzeWord({ word, langCode })`
  + 在 `ANALYZE_SOURCES` 加一条（带 `langs`）。`analyze-service.js` 与视图代码都不用改。

**模块契约**：

```js
// external/js/<source>.js
export async function analyzeWord({ word, langCode })
// → { entries: [{ lemma, pos, posLabel, analysis, classLabel, stem, patch, rawPos? }] } | null
```

- 一个词形可能有多个候选：按「原形 + 词性」归并，一组一张卡片，`analysis` 是该组各种形态
  （「主格 · 单数 · 阴性；呼格 · 单数 · 阴性」）。
- `patch` 与 `lookupWordForForm()` 的返回值**同构**（`pos` / `meanings` / `stems` /
  `inflectionType` / `attributes` / `summary`），「存为生词」时交给
  `store/pending-lookup.js` 一次性交给新建生词表单，表单用**同一套回填逻辑**（`applyEntry`）
  套上去 —— 所以新增一个分析源不需要碰表单代码。
- 分析源通常不产出释义（`meanings: []`），浮层文案里已写明「只做词形分析，不提供释义」。
- 判不出来的词干 / 语法锚点一律留空：错填会静默生成一张错的变格表，比不填更贵。

---

## 四、现有实现

各语言（`data/language/*/`）与各外部源（`external/js/*.js`）
都是按第一、二块的契约接入的插件：满足约定即可自由接入，本块记录各自现在怎么实现。

### 1. 各语言的写法要点

覆盖范围以数据文件为准，本文档不再逐语言罗列 —— 改数据时不需要回来同步这里。
想知道某语言讲了哪些语法，看对应 JSON 的 `sections[].title` / `items[].title`；
想知道某个词性会生成哪些表，看 `paradigms.<pos>.tables[].key`（模板字段见「数据格式 · 语言数据手册」§3）。

#### 基本形态约定

| 语言 | 名词 | 形容词 | 动词 |
| --- | --- | --- | --- |
| `la` / `grc` | 单数主格 | 阳性单数主格 | 第一人称单数现在时（`amō` / `λύω`） |
| `fr` | 单数（带冠词与否不限） | 阳性单数 | **不定式**（`parler`） |
| `de` | 单数主格 | 无词尾词干（词典形式） | **不定式**（`sprechen`） |
| `he` | 单数绝对形 | 阳性单数绝对形 | 3ms Qal 完成式 |
| `sa` | 单数主格 | 阳性单数主格 | 第三人称单数现在时 |

#### 已知坑

- **拉丁语第三变位法**：完成时词干（regō → rēxī）和各类分词词干是词汇性的，规则推不出来；
  换词后要手工核对，`parts[].required` 里不要假装能推。
- **希伯来语四辅音形容词**：不能用 `variants` 自动判型 —— אַדִּיר 与 צַדִּיק 的
  `toSkeleton(基本形态, 词根)` 完全相同，差别只在阴性单数。必须拆成独立锚点，由用户按词选择。
- **满文位置形**：同一码位的字形由字体按上下文决定，表格里用 ZWJ / ZWNJ 强制显示
  独立 / 词首 / 词中 / 词尾四种位置形；复制单元格会带上这些不可见字符。

写数据时更通用的清单（词干取法、`expect`、`skipTables`、锚点等）见「数据格式 · 语言数据手册」§5。

### 2. 外部数据源：Wiktionary

- 一次 `action=parse`（`prop=sections|wikitext`）拿全 wikitext 与标题层级；走共用 HTTP 层，缓存 7 天
- 按 `sections` 的标题层级 + `byteoffset` 切 wikitext：语言节是二级标题，
  词性小节按标题名认（`===Noun===` 与 `Etymology 1` 下的 `====Verb====` 都要认），
  四级以下只作词性小节的子节
- 只解析三样：`#` 开头的释义行、词头模板里报的词干、以及模板里的语法性（`g=f` 等）
- 词头模板（`{{la-verb}}` / `{{la-noun}}`）里的词干会回填 `stems`，
  变位 / 变格号能可靠对应到锚点时一并给出 `inflectionType`（好让 `derive` 直接出表）
- 该文件内部的 `LANG_TO_WIKTIONARY` / `POS_MAP` / `HEADWORD_TEMPLATES` 是
  这个源专属的解析表，不放进 `config.js`
- `QUERY_FORM` 是这个源专属的「检索形」转换表：部分语言的词条建在不带附加符号的写法上，
  查之前先转换一次（结果里的 `lemma` 仍是用户输入的原文）。
  目前只有希伯来语 —— 去掉 U+0591–U+05C7（元音点 niqqud、重音号 te'amim 与 maqaf / paseq / sof pasuq），
  即「基本形态填带元音点的词形，检索用纯辅音字母」。新增语言若也有这种落差，在 `QUERY_FORM` 里加一条。

**已知限制**

- 词头模板只处理拉丁语；词干靠规则剪（现在时词干、名词词干），
  第二变格法会按模板里的 `g=` 选阳性 / 阴性锚点；第三变格法等分不出小类时不猜锚点
- 只认 `#` 顶层的释义行；纯模板释义（如 `{{medieval spelling of|...}}`）清洗后为空会被跳过
- 只解析 wikitext 文本，模板渲染后的内容（模板生成的表格、释义块）拿不到

### 3. 形态分析源：Perseus

- 数据源 `morph.perseids.org`（Perseids 的 Morpheus）：**只给形态、没有释义**；
  入口是生词列表页标题栏的「分析」，结果可一键「存为生词」。只支持古希腊语 / 拉丁语。
- Perseus 官方的 Word Study Tool 页面**没有 CORS 头**，新站 Scaife 有反爬验证，前端都直连不了；
  可直连的只有 Perseids 的 Morpheus 服务（与 Hopper 背后同一套引擎）：
  `GET https://morph.perseids.org/analysis/word?lang=grc|lat&engine=morpheusgrc|morpheuslat&word=…`
  —— `Access-Control-Allow-Origin: *`，返回 JSON-LD，缓存 30 天。
- 返回的 `Body` / `infl` 都可能是对象或数组，先归一化再按 `dict.hdwd`（去掉 `manus1` 这种词书序号）
  + `dict.pofs` 归组。
- 换算：`pofs` → 本站词性；`gend` → `attributes.gender`；`decl` / `stemtype` → 语法锚点
  （拉丁语 1–5 变格、`conj1`–`conj4`；希腊语只给 1 / 2 变格，第三变格法的主格判不出小类，留空）。
- 词干只回填能确认的：拉丁语动词（现在时词干）与 1 / 2 / 4 变格名词。
  Morpheus 用 `_` 标长音（`re_` → `rē`），转写后仍有 `_` 就不认；
  拉丁语第三变格法只有主格时词干不可靠（rēx 的真实词干是 rēg），不填；
  希腊语词干不带重音（λογ vs 语法表的 λόγ），留给表单按基本形态推导。

**已知限制**

- 只有 `grc` / `la` 有源；Morpheus 偶尔超时（`dies` 这类词要算很久），失败时浮层显示「查询失败：…」
- **希腊语第三变格法与动词不回填语法锚点**：第三变格法的小类（-σ / 流音 / -ι …）在主格上判不出来；
  希腊语动词的锚点是「类 × 时态」，没有一个类就是一个锚点的对应关系。
  卡片上仍显示变格法 / stemtype 换出来的类名（如「第三变格法」「-ω 动词」），交用户自己选锚点
