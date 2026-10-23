# 数据 Schema 与语法数据编写规范

本文档合并原有的「数据 Schema」与「语法数据编写规范」两份文档，覆盖：

- IndexedDB 存储结构
- 用户导出 / 导入 JSON 结构
- 语言元数据
- Word 模型与多源合并策略
- 语法速查 JSON 编写规范
- 新增语言的接入流程
- 检索规范
- 版本迁移

---

## 第一部分 数据 Schema

所有持久数据存放在浏览器 **IndexedDB**（库名 `langnotebook`），运行时通过 `assets/js/store/*` 访问；导出/导入使用下文的用户 JSON。

---

### 1. IndexedDB 对象存储

| Store      | 主键     | 索引                                                                       |
| ---------- | -------- | -------------------------------------------------------------------------- |
| `users`    | `id`     | `name`                                                                     |
| `words`    | `id`     | `userId`、`[userId, language]`、`[userId, language, lemma, pos]`（unique） |
| `settings` | `userId` | —                                                                          |

`words` 的唯一索引强制约束：**同一用户、同一语言下，`lemma + pos` 完全一致即视为同一个词**。比较时严格区分大小写、变音符号、长短音，不做任何归一化。

> 注意：**检索**采用规范化比较（见第 7 节），但**唯一键查重**始终严格敏感。`amō` 与 `amo` 是两个词条。

---

### 2. 用户导出 JSON（也是导入格式）

```json
{
  "version": 1,
  "kind": "langnotebook-user",
  "user": {
    "id": "u_xxxxxxxx",
    "name": "默认用户",
    "createdAt": "2026-10-15T10:00:00.000Z",
    "updatedAt": "2026-10-15T10:00:00.000Z"
  },
  "settings": {
    "theme": "auto",
    "fontMode": "default",
    "fontFamily": null,
    "fontUrl": null,
    "pageSize": 30,
    "reviewOrder": "mastery-asc",
    "defaultSource": "manual",
    "sortField": "addedAt",
    "sortOrder": "desc",
    "languageOrder": ["la", "grc", "sa", "mnc", "zh-cls", "he", "ja", "en", "fr", "de"],
    "groupOrder": ["classical", "modern"]
  },
  "words": [ /* Word[] */ ]
}
```

**约定**

- `version` 为整数，schema 变更时 +1，导入时做迁移。
- `kind` 固定为 `langnotebook-user`，导入时校验。
- 时间一律为 ISO 8601 字符串，UTC。
- `userId` 在导入时若与本地已有用户冲突，重新生成 id。

#### settings 字段说明

| 字段            | 类型           | 默认                     | 说明                                           |
| --------------- | -------------- | ------------------------ | ---------------------------------------------- |
| `theme`         | string         | `auto`                   | `auto` / `light` / `dark`                      |
| `fontMode`      | string         | `default`                | `default` / `system` / `local`                 |
| `fontFamily`    | string \| null | `null`                   | 本地字体名（`local` 模式）                     |
| `fontUrl`       | string \| null | `null`                   | 本地字体的 objectURL（仅会话内有效，不跨会话） |
| `pageSize`      | number         | `30`                     | 生词列表每页卡片数，20–50                      |
| `reviewOrder`   | string         | `mastery-asc`            | `mastery-asc` / `added-desc` / `random`        |
| `defaultSource` | string         | `manual`                 | 多源展示时的默认来源                           |
| `sortField`     | string         | `addedAt`                | 列表默认排序字段                               |
| `sortOrder`     | string         | `desc`                   | `asc` / `desc`                                 |
| `languageOrder` | string[]       | `[]`                     | 语言在分组内的自定义顺序（组内相对位置）       |
| `groupOrder`    | string[]       | `["classical","modern"]` | 语言分组的先后顺序                             |

---

### 3. 语言元数据

**真源在每个语言自己的 `data/grammar/{code}.json` 顶层**，`assets/js/data/languages.js` 只列出
**要加载哪些文件**（`GRAMMAR_FILES`），启动时把这份清单里的 JSON 全拉一遍、取出元信息。
语言选择页需要所有语言的元信息，所以这一层是启动时的固定开销（当前合计约 5 MB）。

```jsonc
// data/grammar/ja.json 顶层
{
  "version": 1,
  "language": "ja",              // = code，文件名也是它
  "name": "现代日语",             // 中文名
  "native": "日本語",             // 本语言书写形式
  "classical": false,            // 是否古典语言（兼容字段，等价于 group.id === 'classical'）
  "group": { "id": "modern", "title": "现代语言", "order": 2 },  // 选择页分组
  "order": 1,                    // 组内顺序
  "vertical": false,             // 纵向书写
  "rtl": false,                  // 从右到左
  "grammar": true,               // 是否有语法页（false：列表页不显示「语法」，词性徽章不可点）
  "paradigm": true,              // 是否有变格 / 变位表（false：表单只留基本形态、词性、含义、
                                 //   补充形式、固定搭配、例句、派生词、标签备注）
  "profile": false,              // 是否有专属语言档案 data/paradigm/{lang}.js；
                                 //   false 时表单不会去 import 它（避免 404）
  "terms": { … },                // 界面用词，见下
  "paradigms": { … },            // paradigm: false 的语言不写这个字段
  "sections": [ … ]              // grammar: false 的语言写空数组 []
}
```

| code | name | group | grammar | paradigm | profile |
| --- | --- | --- | --- | --- | --- |
| `la` | 拉丁语 | 古典语言 | ✅ | ✅ | ❌ |
| `grc` | 古希腊语 | 古典语言 | ✅ | ✅ | ✅ |
| `he` | 圣经希伯来语 | 古典语言 | ✅ | ✅ | ✅ |
| `sa` | 梵语 | 古典语言 | ✅ | ✅ | ✅ |
| `mnc` | 满语 | 古典语言 | ✅ | ✅ | ✅ |
| `zh-cls` | 古汉语 | 古典语言 | ❌ | ❌ | ❌ |
| `ja` | 现代日语 | 现代语言 | ✅ | ✅ | ❌ |
| `en` | 现代英语 | 现代语言 | ❌ | ❌ | ❌ |
| `fr` | 法语 | 现代语言 | ✅ | ✅ | ❌ |
| `de` | 德语 | 现代语言 | ✅ | ✅ | ❌ |

- **`group` / `order`**：语言选择页按 `group.order` → `order` 排序；组标题只写在各自 JSON 里，不在代码中硬编码。分组本身不可跨组拖动，组内顺序存 `settings.languageOrder`，组间顺序存 `settings.groupOrder`。
- **`vertical` / `rtl`**：只影响**呈现样式** —— `vertical: true` 的 popover 用竖排样式，
  `rtl: true` 决定 `<bdi>` 与浮层的 `dir`。它们**不**决定能否弹浮层、也不决定检索行为。
- 与文字相关的三份配置都在 `assets/js/config/config.js`，彼此独立、按语言 code 登记：
  | 配置 | 作用 |
  | --- | --- |
  | `SCRIPT_POPUP_LANGS` | 允许弹「原文预览浮层」的语言；值是该文字的 Unicode 范围（用来判断元素里是否真有该文字）。浮层只显示 `<bdi>` 里的原文，输入框取 `value` |
  | `TRANSLIT_SEARCH_LANGS` | 检索时同时匹配原文与 `paradigmRoman`（转写）的语言；不在列表里的只搜原文 |
  | `BDI_LANGS` | 渲染时把**命中的字符**包进 `<bdi>` 的语言（满文、希伯来文…）；同一段文本里的中文 / 拉丁不包 |
  渲染原文一律走 `assets/js/utils/bdi.js`：组件渲染完后调用 `applyBdi(root, lang)` 即可（按 `[lang]` 与字符范围包 `<bdi>`，重复调用安全）。
  夹在两个原文之间的分隔符（词根 `ק-ט-ל`、gershayim `ע"ו`）会并进同一个 `<bdi>`，否则每个字母各自成 bdi，
  RTL 字母会被按 LTR 顺序排开、词根看起来是反的。
  原生 `placeholder` 带不了标记 —— 含原文的 placeholder 会由 `ghost-input` 组件或 `applyBdiPlaceholders()` 叠一层自绘提示；
  主要部分输入框的「推导提示」也用同一套幽灵文字（前缀匹配，输入不符即消失）。
  原生 `<input>` / `<select>` 只放纯文本、收起态的文字也由浏览器直接画，同样包不了 `<bdi>`，所以生词表单里的文本输入框与下拉框都是自绘控件：
  `components/editable-input.js`（contenteditable，值仍是纯文本，`el.value` 照旧）、`components/ghost-input.js`（在其上叠 placeholder / 推导提示）、
  `components/select-field.js`（按钮 + 自绘列表，收起态用 `bdiText` 渲染当前项）。展开的列表统一由 `components/select-menu.js` 画，
  原生 `<select>` 与自绘下拉共用同一套，键盘与 `role="listbox" / combobox` 语义一致。
- **`grammar: false`**：生词列表不显示「语法」按钮；直接访问 `#/grammar/{code}` 会跳回词列表；词卡的词性徽章不可点。
- **`paradigm: false`**：表单与词卡都不出现变格 / 变位相关的字段与表格。
- **`profile`**：有 `data/paradigm/{lang}.js` 才写 `true`；表单据此决定要不要 import 语言档案，
  写 `false` 的语言不会发那个请求。新增 / 删除档案时同步改这个字段。

#### terms：界面用词

**每个语言必须自己写一套**，代码里不留默认文案。语言级的值可以按词性用 `byPos` 覆盖
（满语名词锚点是「复数类型」、动词是「活用类型」，就靠这个区分）。

| key | 用途 |
| --- | --- |
| `inflectionType` | 「变格 / 变位类型」这一栏的标签 |
| `inflectionTypePlaceholder` | 该输入框的 placeholder |
| `inflectionTypeHint` | 该栏的说明文字 |
| `special` | 锚点下拉里的「特殊…（自行填写）」 |
| `indeclinable` | 锚点下拉里的「不变格 / 不变形 / 无活用」 |
| `paradigmTitle` | 变化表块标题，`{pos}` 会替换成词性名（如 `{pos}词形表`；希伯来语直接用「变化表」） |
| `anchorHint` | 语法锚点下拉的说明 |
| `extraForms` | 「补充形式」块标题 |
| `extraPartsHint` | 额外主要部分那一栏的说明 |
| `stems` | `{ label, placeholder, hint }`：主要部分那一栏的三处文案 |
| `byPos` | `{ [pos]: { 上面任意键 } }`，按词性覆盖 |

---
### 4. Word

```json
{
  "id": "w_xxxxxxxx",
  "userId": "u_xxxxxxxx",
  "language": "la",
  "lemma": "amō",
  "pos": "verb",

  "inflectionType": {
    "label": "第一变位法",
    "grammarRef": "la-verb-1st-conj"
  },

  "paradigm": {
    "main": {
      "pres-act-ind": { "1sg": "amō", "2sg": "amās", "3sg": "amat" }
    }
  },

  "stems": { "base": "am", "perf": "amāv", "ppp": "amāt" },

  "inflections": [
    { "group": "不定式", "label": "现在时", "form": "amāre", "source": "manual" },
    { "group": "命令式", "label": "单数",   "form": "amā",   "source": "wiktionary" }
  ],

  "meanings": [
    { "text": "爱，热爱", "lang": "zh", "source": "manual" },
    { "text": "to love",  "lang": "en", "source": "wiktionary" }
  ],

  "collocations": [
    { "text": "amō aliquem", "gloss": "爱某人", "source": "manual" }
  ],

  "examples": [
    {
      "text": "Amō tē.",
      "translation": "我爱你。",
      "citation": "Verg. Ecl. 1.1",
      "source": "manual"
    }
  ],

  "derivatives": ["amor", "amīcitia"],

  "encounterCount": 3,
  "mastery": 2,
  "correctCount": 5,
  "wrongCount": 1,
  "lastReviewedAt": "2026-10-15T10:00:00.000Z",
  "nextReviewAt":   "2026-10-17T10:00:00.000Z",

  "tags": ["高频"],
  "notes": "",
  "addedAt":   "2026-10-01T00:00:00.000Z",
  "updatedAt": "2026-10-15T10:00:00.000Z"
}
```

#### 字段说明（Word）

| 字段                        | 说明                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `language`                  | 语言 code，见 `assets/js/data/languages.js`                                                       |
| `lemma`                     | 基本形态，原样保存，不做归一化                                                                    |
| `pos`                       | 词性，约定见下                                                                                    |
| `inflectionType.label`      | 变格/变位类型显示名，词卡徽章                                                                     |
| `inflectionType.grammarRef` | 指向语法 JSON 的锚点 id；无对应语法时为 `null`（此时视为「特殊变格 / 变位」，用户自行填写 label） |
| `paradigm`                  | 表格化的变位/变格数据，稀疏存储，键为 `{tableKey: {rowKey: {colKey: value}}}`                     |
| `paradigmRoman`             | 书写体系与界面不同的文字（目前只有满文）的**转写副本**，结构与 `paradigm` 相同；`paradigm` 存原文、这里存转写，供检索用，界面不显示 |
| `stems`                     | 主要部分 `{ 名称: 词干 }`；`base` 必填，其余（`perf` / `ppp` …）可缺省，缺省时按变位类型的规则从 `base` 推导 |
| `gender`                    | 语法性，**仅 `pos=noun` 有意义**；字符串数组，取值 `m` / `f` / `n`，可多选（common gender）        |
| `inflections[].group`       | 可选，用于分组显示（如「不定式」「命令式」）                                                      |
| `meanings[].lang`           | `zh` / `en`                                                                                       |
| `derivatives`               | 派生词 lemma 列表；仅当目标词已存在时渲染为可点击链接。点击后清空搜索 / 筛选，跳到目标词所在页并高亮它的卡片 |
| `encounterCount`            | 每次添加时若命中唯一键则 +1                                                                       |
| `mastery`                   | 0–5，复习对 +1、错 −1，clamp 到区间                                                               |
| `nextReviewAt`              | 按 mastery 从间隔表 `[0,1,3,7,14,30]` 天取值                                                      |
| `source` 取值               | `manual` \| `wiktionary` \| `url:<host>` \| 其它自定义字符串                                      |

#### pos 约定

`noun` `verb` `adj` `adv` `pron` `prep`（前置介词） `postp`（后置介词） `midp`（中置介词） `conj` `particle`（助词） `participle` `num` `interj` `other`。

#### paradigm 结构

```json
"paradigm": {
  "<tableKey>": {
    "<rowKey>": { "<colKey>": "词形", "<colKey>": "词形" }
  }
}
```

- `<tableKey>` / `<rowKey>` / `<colKey>` 由对应语言的语法 JSON 中 `paradigms` 字段定义。
- 只保存有值的格子，空字符串、`null`、`undefined` 一律剔除。
- **列 key 统一为 `{数}_{性}`**（`sg_m` / `pl_f` / `du_n`…）表示性数格；无性别维度时用 `{数}`（`sg` / `pl`）；
  动词用人称，**统一按「数优先」排列**：先单数、再双数（有的话）、后复数，组内按 1/2/3 人称：
  - 无双数：`1sg 2sg 3sg 1pl 2pl 3pl`
  - 有双数：`1sg 2sg 3sg 1du 2du 3du 1pl 2pl 3pl`

  非定式用单列 `form`。
- **性也可以放在行上**：列用 `sg` / `pl`，行 key 直接写 `m` / `f` / `n`（法语名词、形容词采用
  「数在列、性在行」的排法，与语法页的「单数 / 复数」表头一致）。
- 找不到模板的语言（如 `en` / `zh-cls`）不使用此字段，相关变化全部走 `inflections`。

#### 主要部分（stems）

```json
"stems": { "base": "am", "perf": "amāv", "ppp": "amāt" }
```

- **词干**：一个词所有词形共有的不变部分，词尾一律追加在其后。
  - 拉丁语：`base: am` → `amō` / `amās` / `amāre`，`perf: amāv` → `amāvī`，`ppp: amāt` → `amātum`
  - 古希腊语：`base: λόγ` → `λόγος` / `λόγου` / `λόγῳ`
- `base` 是**必填**的基准词干（表单里的「词干 / 主要部分」，没填就不能点「生成表格」）；
  其余部分由变位 / 变格类型声明，在表单里按 `derive.parts` 渲染成额外的输入框，**可以留空**。
- **留空时按类型的规则从 `base` 推导**（如拉丁语第一变位法 `am → amāv / amāt`）；
  规则推不出来或该词不规则时，必须填上实际词干。
- 输入框的 placeholder 是**动态推导预览**（满语 `arambi` → `ara`），但预览不会参与生成：
  只有实际填写的值 + `derive` 规则才作数。
- 取词干顺序：**用户填的 `stems[名称]` → `derive.stems[名称]` → `derive.stemForms[名称]`（作用于 base）→ base**。
- **不写末尾的连字符**：数据里是 `am`、`λόγ`，只在界面显示时补成 `am-`、`λόγ-`。
- 与 `lemma`（基本形态）不同：`lemma` 是词典形式，词干是去掉词尾后的部分。
- **各语言的「基本形态」约定**：

| 语言 | 名词 | 形容词 | 动词 |
| --- | --- | --- | --- |
| `la` / `grc` | 单数主格 | 阳性单数主格 | 第一人称单数现在时（`amō` / `λύω`） |
| `fr` | 单数（带冠词与否不限） | 阳性单数 | **不定式**（`parler`） |
| `de` | 单数主格 | 无词尾词干（词典形式） | **不定式**（`sprechen`） |
| `he` | 单数绝对形 | 阳性单数绝对形 | 3ms Qal 完成式 |
| `sa` | 单数主格 | 阳性单数主格 | 第三人称单数现在时 |

  法语 / 德语的动词 `derive` 用 `stemForms.base = { from: 'headword', rules }` 从不定式推出词干，
  因此**主要部分不必重复填写**（见第二部分 [§7](#7-derive-字段用主要部分生成变格变位表)）。
- **尽量取一个能让词尾直接拼接的词干**（第一变位法用 `am` 而不是 `amā`），可省掉大量音变规则。
- 词卡正面显示 `base`，其余已填的部分在下面另起一行小字列出。
- 与「变格 / 变位类型」配合用于**自动生成变格 / 变位表**，见第 7 节。
- `base` 为空时词卡背面不显示该区块，生成的按钮也为禁用状态。

#### 语法性（gender）

```json
"gender": ["m", "f"]
```

- **只有名词有语法性**，其它词性一律存空数组。
- 取值来自 `paradigms.noun` 的表列 key（`{数}_{性}` 中的性），所以 `fr` / `he` 自动只有 `m` / `f`。
- 生词表单在 `pos=noun` 时显示多选 chip；**视图与编辑都隐藏未选中性别的列**
  （如 `aqua`（f）只显示 `sg_f` / `pl_f`）。

---

### 5. 多源合并策略

同一条词（`userId + language + lemma + pos` 相同）：

- `meanings` / `inflections` / `collocations` / `examples` 均为**数组**，新来源的内容**追加**，不覆盖。
- `paradigm` 做**格子级合并**：同格子已有值不被覆盖，新格子填入。
- `stems`：按名称逐个合并，已有的值不被覆盖，只在缺失时填充。
- `inflectionType`：已有 label / grammarRef 时不覆盖；为空时填充。
- 界面按 `source` 分标签显示，默认优先 `manual`。
- `encounterCount` +1。
- `updatedAt` 更新。

复习相关字段（`mastery` / `correctCount` / `wrongCount` / `lastReviewedAt` / `nextReviewAt`）在导入合并时**保留已有值**，不被导入数据覆盖。

---

### 6. 版本迁移

`assets/js/services/import-export-service.js` 中维护 `MIGRATIONS`：

```js
const MIGRATIONS = {
  1: (payload) => { /* v1 → v2 */ return payload },
  // 2: (payload) => { /* v2 → v3 */ return payload },
}
```

导入时逐级升级到 `CURRENT_VERSION`。当前为 `version: 2`：

- **v1 → v2**：`words[].stem`（单一主要部分）→ `words[].stems: { base }`；导入 v1 文件时自动升级。

---

## 第二部分 语法数据编写规范

语法数据为**只读**，由静态 JSON 提供，前端不提供任何修改入口。
路径：`/data/grammar/{lang}.json`。

---

### 1. 文件结构

```json
{
  "version": 1,
  "language": "la",
  "name": "拉丁语",

  "paradigms": {
    "verb": {
      "tables": [
        {
          "key": "main",
          "title": "变位",
          "columns": [
            { "key": "1sg", "label": "单1" },
            { "key": "2sg", "label": "单2" }
          ],
          "rows": [
            {
              "key": "pres-act-ind",
              "label": "现在时 主动 陈述式",
              "grammarRef": "la-verb-1st-conj",
              "principal": true
            }
          ]
        }
      ]
    }
  },

  "groups": [
    { "id": "pron", "title": "代词" },
    { "id": "noun", "title": "名词" }
  ],

  "sections": [
    {
      "id": "la-noun",
      "title": "名词变格",
      "group": "noun",
      "items": [
        {
          "id": "la-noun-1st-decl",
          "title": "第一变格法",
          "tables": [
            {
              "caption": "aqua, -ae (f.)",
              "headers": ["格", "单数", "复数"],
              "rows": [
                ["主格", "aqua", "aquae"],
                ["属格", "aquae", "aquārum"]
              ]
            }
          ],
          "notes": "多用于阴性名词。"
        }
      ]
    }
  ]
}
```

#### 约束

- 顶层 `version` 为整数。
- `language` 必须与 `assets/js/data/languages.js` 中的 code 一致。
- 每个 `section` / `item` 都必须有全局唯一的 `id`，用作锚点。
- `item.tables` 可为空数组；`item.notes` 可选。
- 表格单元格为字符串，可含 HTML 实体但不解析 HTML 标签。
- 表格行中若标注语言，可加 `"lang": "la"` 到对应 table 对象，用于选中专用字体。
- 每张表要标 `"role"`：`"pattern"`（变化表 / 词尾 / 骨架）或 `"example"`（示例表）。
- 语法页的 tab 规则：
  - 同一组里**有示例表**时，一张表一个 tab（不再按「变化表 / 示例表」两类分桶）：
    变化表的 tab 名是「变化表」，示例表的 tab 名是 `示例表：<例词>`（取该表的 `exampleWord`），
    表自己写了 `roleLabel` 时用 `roleLabel`（如希伯来语代词后缀表叫「后缀表」）。
  - 同一组里只有一堆同类表（如德语一张条目下的几张变格表，没有示例表）时不出 tab，按数组顺序叠放。
- 一个条目有多对表时，给同属一对的两张表标相同的 `"group"`（如 `"g1"`）与 `"groupLabel"`
  （组 tab 的显示名，如 `Qal · 不定式`、`一尾`、`强变化`）。没有 `group` 的表按同一组处理。
- 每张示例表**都要标 `"exampleWord"`**（这张表的例词，如 `דָּבָר`、`קָטַל`），tab 名和 caption 都用它。
- **只按单词分 tab、不按语式分 tab** 的写法（法语 / 德语的「特殊变位」）：所有表都标 `role: "pattern"`，
  同一单词的表给相同的 `group` / `groupLabel`，各表 `caption` 写语式名。组里没有 `role: "example"` 的表时
  不再按表分 tab，选中单词后所有语式表**上下排列**。

---

### 2. paradigms 字段

用于生词表单与词卡中的结构化变位/变格表格。按词性分表。

- 一个词性有多张表时（如拉丁语动词的 13 张），表单和词卡都用 `tables[].title` 做成 tab 切换，
  同一时间只显示一张；只有一张表时不显示 tab 条。
- 单表时表单用卡片标题（`terms.paradigmTitle`）、词卡用表自己的 `title`，表内不再重复。

```json
"paradigms": {
  "<pos>": {
    "tables": [
      {
        "key": "main",
        "title": "变位",
        "columns": [{ "key": "1sg", "label": "单1" }],
        "rows": [
          {
            "key": "pres-act-ind",
            "label": "现在时 主动 陈述式",
            "grammarRef": "la-verb-1st-conj",
            "principal": true
          }
        ]
      }
    ]
  }
}
```

#### 字段说明（paradigm 模板）

| 字段                 | 说明                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `<pos>`              | 词性 key，取值与 Word 的 `pos` 字段一致（`noun` / `verb` / `adj` …） |
| `tables[].key`       | 表 id，同一 pos 下唯一；Word.paradigm 顶层键即为此 key               |
| `tables[].title`     | 表标题，显示在表格上方                                               |
| `tables[].columns[]` | 列定义，`key` 是数据存储用的键，`label` 是显示名                     |
| `tables[].rows[]`    | 行定义，`key` 是数据存储用的键，`label` 是显示名                     |
| `rows[].grammarRef`  | 可选，指向同文件 `sections` 里的锚点 id，用于「语法」跳转按钮        |
| `rows[].principal`   | 可选，为 `true` 时标记该行为该变位类型的代表性行（词典列出的主要形式）；与 Word 的 `stem` 不是同一概念 |
| `tables[].anchors`   | 可选，锚点 id 数组：只有「语法锚点」选中的是其中之一时才显示这张表（拉丁语代词按锚点切换有性 / 无性表） |
| `tables[].default`   | 可选，为 `true` 时作为没选锚点（特殊 / 不变）时的默认表。同一词性里声明了 `anchors` 的表互斥，未声明 `anchors` 的表始终显示 |

#### 覆盖范围

- `la` / `grc` / `he` / `sa` / `mnc` / `fr` / `de`：定义了 `verb` 和/或 `noun` 的 paradigm 模板。
- `la` 的 `noun` / `adj` 与 `grc` 一样按类型拆条目，并给出 `derive`（`la` 19 条、`grc` 22 条，均带 `expect` 自检）。
- `grc` 另有 `pron`（有性 / 无性两张表，按锚点互斥显示）、`adj`（变格 + 比较等级）、`participle`（`extends: "adj"`）、`adv`（比较等级）；
  `verb` 按 `{pres, impf, fut, aor, perf, plup, futp, inf}` 分表，分词再按种类拆成
  `ptcp-pres-act` … `ptcp-futp-midpass` 共 11 张完整变格表（行 = 主 / 属 / 与 / 宾，列 = 单数阳性 … 复数中性 9 列），
  时态表列为 `1sg 2sg 3sg 1du 2du 3du 1pl 2pl 3pl`（1du 没有形式的行用 `disabled`）。
- `ja`：使用 paradigm，活用由 `fields` / `endings` 驱动（见 [§4「ja 现代日语」](#ja-现代日语)）。
- `en` / `zh-cls`：不使用 paradigm。

---

### 3. 锚点 id 命名

格式：`{lang}-{category}-{item}`

#### 示例

| 语言   | 锚点                     | 含义             |
| ------ | ------------------------ | ---------------- |
| la     | `la-noun-1st-decl`       | 第一变格法       |
| la     | `la-verb-1st-conj`       | 第一变位法       |
| la     | `la-pron-3rd`            | 三人称代词       |
| grc    | `grc-noun-1st-decl-e`    | 第一变格：-η（νίκη 型） |
| grc    | `grc-noun-3rd-decl-i`    | 第三变格：i 词干 |
| grc    | `grc-adj-1st-2nd`        | 第一二变格形容词 |
| grc    | `grc-verb-vowel-conj`    | 第一变位法（元音词干） |
| grc    | `grc-verb-vowel-pres`    | 现在时（第一变位法） |
| he     | `he-noun-segolate`       | 元音变化名词     |
| he     | `he-verb-qal-perfect`    | Qal 完成式       |
| sa     | `sa-noun-a-stem-m`       | a 词干阳性       |
| sa     | `sa-verb-pres-act`       | 现在时主动       |
| mnc    | `mnc-letter-a-initial`   | 字母 a 词首形    |
| mnc    | `mnc-noun-genitive`      | 名词属格         |
| ja     | `ja-verb-godan`          | 五段动词活用     |
| ja     | `ja-adj-i`               | イ形容词活用     |
| fr     | `fr-verb-1st-group`      | 第一组动词       |
| de     | `de-noun-decl-strong`    | 强变化名词       |

生词表中 `inflectionType.grammarRef` 即写入上述 id。

锚点下拉里的显示名：`section` 级锚点用章节标题；`item` 级锚点**只用条目标题**（不再带
「名词变格 · 」这类章节前缀），只有同一词性里出现重名条目时才退回「章节 · 条目」。

换锚点时会**重写**「变形类型」输入框（`terms.inflectionType`）：真实锚点填锚点短名、
「不变形」填 `terms.indeclinable`、「特殊变形」清空待填 —— 之前只在为空时才填，换锚点后旧内容会残留。

选「不变格 / 不变形 / 不变位」时，整块变化表（主要部分、标题、表格、句尾提示、以及块内的分隔线）都不渲染。
模板里声明了 `anchors` 的表按锚点互斥显示，没选锚点（特殊 / 不变）时只显示 `default: true` 的那张。

### 关联

### 1.1 章节分组（groups 与 section.group）

语法页按**一级章节分页**：一条 `groups` 声明章节顺序与名称，每个 section 用 `group` 声明归属。

| 字段 | 说明 |
| --- | --- |
| `groups[]` | `{ id, title }`。顺序即章节顺序。**缺省或只有一章时不分页**（整篇在一页里显示，适用于节数很少的语言） |
| `sections[].group` | 该 section 归属的 `groups[].id`。缺省时算第一章 |

- 路由：`#/grammar/{lang}/{group}`（如 `#/grammar/he/verb`）；`#/grammar/{lang}` 落到第一章。
- 章节页里，**section 标题是页面的一级标题（h1）**，item 标题是二级标题（h2）。
- 旧锚点（`#/grammar/he#he-verb-iii-he`）仍然有效：视图会按 anchor 反查它所在的章节并渲染那一页。
- 左栏分两段：上面是章节切换，下面是本页的 section / item 目录。
- 页面很长时 item 的表格**懒渲染**（IntersectionObserver，rootMargin 900px），锚点所在 section 及其之前的内容始终立即渲染，保证滚动位置准确。
- **空内容不渲染**：语法表的行/列如果除首列外全是空或 `—`，整行/整列（含表头）都不渲染；
  一张表全空就不渲染。单格缺内容照常显示 `—`（表示「该形式不存在」，如 Piel 没有命令式）。
  词卡的 `paradigm` 表格同理：行全空的隐藏，`disabled` 的格子显示 `—` 并带 `title="该形式不存在"`。

- Word 中 `inflectionType.grammarRef` 引用 `sections[].items[].id`。
- paradigm 中 `rows[].grammarRef` 引用同文件的 `sections[].items[].id`。
- 引用不存在的 id 时，UI 显示为普通文本。

---

### 4. 各语言语法覆盖范围

#### la 拉丁语

- 代词：一二人称、三人称、反身、物主、指示、关系、疑问、不定。八个条目都标 `inflect`，可直接当语法锚点；
  词卡按锚点只显示对应的那张表（`paradigms.pron.tables[].anchors`）：一二人称与反身是无性表 `common`，
  其余是有性表 `main`；没选锚点时只显示 `main`（`default: true`）
- 名词：第一变格（-a，含阳性）、第二变格（-us 阳性 / -us 阴性 / -er 掉 e / -er 保留 e / -um）、
  第三变格（辅音词干、i 词干、辅音词干中性、i 词干中性）、第四变格（-us / -ū）、
  第五变格（rēs 型 / diēs 型）
- 形容词：第一二变格、第三变格（三尾 → 二尾 → 一尾）
- 副词、比较等级：见形容词章
- 动词：四种变位法；现在/未完成/将来/完成/过去完成/将来完成；主动/被动；陈述/虚拟/命令。
  完成系统的被动不在变位表里，而是在完成时 / 过去完成时 / 将来完成时表下用 `notes` 的 `<ul><li>` 说明
  「完成时被动分词 + sum」的迂说式（将来完成时没有虚拟式）。
  另有古体的 `sigmatic` 条目（sigmatic 将来直陈主动、sigmatic 不定过去虚拟主动，只在语法页展示，不进词卡）。
- 不定式：表内只列现在时主动 / 被动、完成时主动；迂说式的不定式（完成时被动 `amātum esse`、
  将来时主动 `amātūrum esse`、将来时被动 `amātum īrī`、将来完成时被动 `amātum fore`、
  完成时潜能式 perfect potential `amātūrum fuisse`）写在 `notes` 里。
- 分词：四个条目共用一个 item，按分词种类分 tab（现在时主动 / 完成时被动 / 将来时主动 / 将来时被动），每张表都是完整变格；
  词卡的 `ptcp-pres` / `ptcp-perf` / `ptcp-fut` / `ptcp-futpass` 四张表与之对应。
  1 / 2 / 4 变位法的完成时、现在时主动分词、将来时主动分词、将来时被动分词词干由规则推出；
  第三变位法的完成时词干（regō → rēxī）与各类分词词干是词汇性的，换词需手工核对

#### grc 古希腊语

章节顺序：代词 → 名词 → 形容词 → 副词 → 动词 → 数词 → 冠词 → 元音缩合规则 → 重音规则 → 方言。

- 代词：一二人称、三人称、反身（只有斜格）、物主、指示、关系、疑问、不定，八类都标 `inflect` 当语法锚点。
  人称代词第三人称把重读形式 `αὐτός` 与附着形式（`οὗ / οἷ / ἕ`）合成一张表，斜杠后为附着形式；
  所有代词都列**双数**（双数的属格与与格同形）。词卡按锚点只显示一张表：
  一二人称 → 无性表 `common`，其余（含反身）→ 有性表 `main`，没选锚点时显示 `main`（`default: true`）
- 名词：第一变格（-ᾱ / -η 的词干重音与词尾重音型、阳性 -ης）、第二变格（-ος 两种重音、-ον 中性）、
  第三变格（塞音 / 齿音、流音 / 鼻音、-ος 中性、i 词干、-υς、-εύς）；表列按 `{数}_{性}` 九个列，含双数
- 形容词：第一二变格、第三变格（-εσ- 词干）、比较级与最高级、形容词构成副词
- 副词：比较等级、方位副词（位置 / 趋向 / 来源三式）、常见副词分类
- 动词：总论（时态与语态体系、六个主要部分、增音与重复、语气用法、异态动词）；
  变位类型四类——元音词干（-ω）、缩合（-έω / -άω / -όω）、辅音词干、-μι。
  语气用「**直陈式**」（不用「陈述式」），时态名叫「**不定过去时**」。
  时态 `{现在, 未完成, 将来, 不定过去时, 完成, 过去完成, 将来完成}`，
  语态 `{主动, 中动, 被动}`，另有不定式与分词。
  **将来完成**只有中动/被动，是综合式（完成时中动词干 + -σ- + 中动词尾）：直陈、祈愿 + 不定式 / 分词，
  没有虚拟式与命令式
- 分词：11 个 tab —— 现在时主动 / 现在时中动·被动 / 将来时主动 / 将来时中动 / 将来时被动 /
  不定过去时主动 / 中动 / 被动 / 完成时主动 / 完成时中动·被动 / 将来完成时中动·被动，
  每个 tab 一张**完整变格表**，与形容词表同构：4 行（主 / 属 / 与 / 宾）× 9 列
  （单数阳性 … 复数中性，含双数；呼格与主格同形）。词卡侧对应 11 张表（`ptcp-pres-act` … `ptcp-futp-midpass`），
  布局相同（列 `sg_m … pl_n`，行 `nom` / `gen` / `dat` / `acc`）
- 数词：基数词、数词变格（1–4）、序数词与数词副词
- 冠词：定冠词 ὁ, ἡ, τό（单 / 双 / 复）
- 元音缩合规则：α / ε / ο 与后续元音的缩合表 + 动词与名词举例
- 重音规则：三种记号与限制法、动词退重音与名词持续重音
- 迂说形式（分词 + εἰμί）：只有完成时、过去完成时的**中动/被动虚拟式与祈愿式**才是迂说
  （`λελυμένος ὦ` / `λελυμένος εἴην`），直陈式第三人称复数也常作 `λελυμένοι εἰσί(ν)`；
  完成时中动/被动的**命令式不是迂说**，照常列在变位表里（`λέλυσο / λελύσθω …`），词卡的 `perf` 表也有这一行
  （辅音词干用 `perfmidsigma` / `perfmidth` 两个词干变体处理 `-ψο / -φθω` 之类的合流）。
  迂说内容不进 paradigm，写在对应时态条目 `notes` 的 `<ul><li>` 里
- 方言与诗歌形式：方言概览、史诗（荷马）形式、伊奥尼亚与通用希腊语差异；
  **方言词按独立词条收录**，用派生词链接标准阿提卡形式

`derive` 覆盖：名词 14 个类型、形容词 2 个类型、六个变位法的全部时态表 + 11 张分词表，带 `expect` 自检
（分词表格数多，用 `expectPartial` 只核对关键格）。

分词表的重音口径：现在时、将来时主动分词与 -μι 动词的分词用退重音，但中性单数主格 / 宾格用 `penult`
（`λῦον` / `φιλῆσαν`）；不定过去时被动、完成时主动、完成时中动·被动用持续重音（词尾自带重音）。
表上的 `group` / `groupLabel` 换成「每个分词一组」后，语法页多组只有一类表时也会显示组 tab
（`createGrammarTables` 的 `groups.length > 1` 分支）。

#### he 圣经希伯来语

- 章节顺序：代词 → **名词变形** → **名词附属形规律** → 形容词 → 副词 → 动词总论 →
  九个词根类型（**动词通用词根** / 喉音根 / I-א / I-י / I-נ / III-ה / III-א / 中空 / 叠音）→
  **罕见 binyan** → 数词 → 马索拉符号 → 转写对照（共 20 节）
- **每个条目都是「变化表 + 示例表」两张同构的表**，tab 名分别是「变化表」与 `示例表：<例词>`
  （例词写在表的 `exampleWord` 上；动词取 3ms 完成式，名词取单数绝对形）：
  格内写含词缀的完整骨架，`־`（מַקָּף）= 一个词根辅音（可带 dagesh 等附加点）；
  `data/paradigm/he.js` 的 `applySkeleton(root, 骨架)` 把骨架还原成词形，两张表逐格可互推。
  例外是词干 + 词尾型的 `he-adj-nisba`：第一张表列词尾（`־` 表示接在名词词干后）
- 代词 4 个条目：独立人称代词；名词、介词上的代词后缀（`后缀表` + `示例表：דָּבָר` +
  `示例表：לְ / בְּ / כְּ / מִן / עַל / עִם`，三个 tab）；动词上的宾语后缀
  （**两张表上下排列**：完成式 / 未完成式，列 = 人称 × 单数 / 复数）；指示 · 疑问 · 关系代词
  （指示代词按单阳 / 单阴 / 复数分列，疑问代词与关系代词不变形，写在 `notes` 的 `<ul><li>` 里）
- 界面用词走 `terms`：`变形类型` / `特殊变形（自行填写）` / `不变形` / `paradigmTitle: 变化表`
- 名词变格 15 个条目（锚点 11 项：通用 + 10 个词根 / 形态类别），小标题只写类别名
  （`III-ה 词根`、`末喉音词根`…，不再带 `名词：形态类别 · ` 前缀，也不带 `（ל"ה）` 这类括注）；
  双数类 / 唯复数 / 不规则 / 阴阳同形 保留为参考条目，词条请选「特殊变形」
- 名词附属形规律 18 项（קֵטֶל / קֹטֶל / קְטָל / קַטָּל / מִקְטָל / קִטּוּל / קָטוֹל / קְטָלָה /
  קַטְלָה / קִטְלָה / קַטֶּלֶת / קְטִילָה / הַקְטָלָה / הִתְקַטְּלוּת / קַטְלוּת / קְטֻלָּה /
  מִקְטָלָה / מַקְטֵל）；**不进语法锚点**（模式由基本形态的骨架判定）
- 形容词 12 项，全部可锚定，且都接了 derive；四辅音按阳性 / 阴性单数的差异与词干形态拆成
  「规则 / 弱化 / 四词根 / 喉音叠音（首辅音 שׁ）/ 喉音叠音（首辅音非 שׁ）」五个锚点（见下）。
  末尾另有 `比较等级` 条目（不进锚点）：希伯来语无形态比较级，比较用 מִן、最高级用定冠词或 מִכָּל，
  与副词的说法一致
- 动词：binyan 在「时态」层级 —— `paradigms.verb` = 7 个常用 binyan 表 + 不定式 + 分词（9 张），
  每张表行 = 完成式 / 连续完成式 / 未完成式 / 连续未完成式 / 祈愿式 / 劝勉式 / 命令式，
  列 = `1cs 2fs 2ms 3fs 3ms 1cp 2fp 2mp 3fp 3mp`（先单数后复数，同数内先阴后阳）。
  Pual / Hophal 也有命令式（Pual קֻטַּל / Hophal הָקְטַל 等），derive 的 `impv` 已补全并进 `expect`。
  语法页每个 binyan 条目只保留「变化表 / 示例表」两组，**不定式与分词各自独立成条目**
  （`he-verb-strong-inf` / `-ptcp`，与其它词根章节同构）；分词行 = Qal / Niphal / Piel / Pual / Hithpael /
  Hiphil / Hophal（每个 binyan 只有一种分词，语态写在 `notes` 里；Qal 被动分词记在罕见 binyan 的说明里）。
  所有动词变化表第一列叫「语式」
- 罕见 binyan 单独一节（`he-verb-rare`，不进锚点、不进 paradigm），分三层：
  1. 有完整例词表的 `Poel` / `Polel` / `Hithpolel`（每个条目两张表：`式` / `分词`，用 `roleLabel` 命名 tab）；
  2. 条目「其他 binyan」：只有 3ms 形式的一张表（列 = `名称` / `3ms 形式` / `说明`）：Poal / Polal / Polpal / Hithpalpel /
     Hothpaal / Hishtaphel / Palel / Nithpael；
  3. 条目「极少见 binyan」：只有说明的用 `<ul><li>` 罗列（`notes`）：Pilel / Pealal / Pulal / Qal 被动 / Tiphil。
  这些 binyan 的例词都是 4–5 辅音词根，**不套 `־` 骨架**，所以只给示例、不给变化表
- `paradigms.pron` 6 张表：`decl`（默认表，四列 ms / fs / mp / fp × 绝对形 / 附属形，供「特殊变形」自行填写）、
  独立人称代词（单 / 复数）、名词、介词上的代词后缀（单 / 复数）、动词宾语后缀完成式 / 未完成式
  （各 5 人称 × 单 / 复数）。前四张用 `anchors: ["he-pron-personal"]`，`dem` 用
  `anchors: ["he-pron-demonstrative"]` —— 代词的两个锚点是 `独立人称代词` 与 `指示 · 疑问 · 关系代词`
- 数词：`11–1000` 不另开条目，作为「基数词」的第二张表；序数词补全 1–10
- 马索拉符号：附标的「符号」列一律写成 `־` + 附标（`־ָ`、`־ּ`、`־֑`…），纯标点（`׃` / `|` / `־`）不加占位
- 「主要部分」= 三辅音词根（`כ-ת-ב`），由 grammar 文档的 `stems` 字段给出标签与占位提示；
  基本形态 = 名词单数绝对形 / 形容词 ms 绝对形 / 动词 3ms Qal 完成式
- 重音：`data/paradigm/he.js` 的 `accent()` 用 מֶתֶג（U+05BD）标重读音节，
  模式 `he-milra`（末音节）/ `he-milel`（倒数第二）

`derive` 覆盖：以**骨架型**（`mode: "skeleton"`）为主，另有一条词干 + 词尾型 ——

| 规格 | 覆盖 | 自检 |
| --- | --- | --- |
| `he-verb-strong`（section 级） | 7 个 binyan × 7 式 × 10 身位 + 不定式 + 分词 = **428 格**，`post.accent: he-milra` | 428/428 |
| 九个弱根类型（各 1 条） | 7 个 binyan 的骨架，缺的行由规则补齐（连续完成式 / 愿式 / 劝勉式 / 命令式） | 全覆盖 |
| `he-noun`（section 级，**按基本形态选变体**） | 19 个元音模式变体（18 个 מִשְׁקָל + 通用 קָטָל）× 绝对形 / 附属形 × 单 / 复 = 61 格 | 61/61 |
| `he-adj-strong` / `segolate` / `qadosh` / `iii-he` / `guttural` / `hollow`（6 条，骨架型） | 各 1 张表 × 绝对形 × 四个身位（ms / fs / mp / fp）= 每类 4 格 | 各 4/4 |
| `he-adj-quadriliteral-regular` / `-quadriliteral` / `-quadriliteral-4root`（3 条，骨架型） | 四辅音三类：规则（אַדִּיר）/ 弱化（צַדִּיק）/ 四词根（אַכְזָר），各 4 格 | 各 4/4 |
| `he-adj-quadriliteral-guttural` / `-guttural-plain`（2 条，骨架型） | 喉音 / 叠音型：首辅音 שׁ（שַׁאֲנָן）/ 首辅音非 שׁ（רַעֲנָן），各 4 格 | 各 4/4 |
| `he-adj-nisba`（1 条，**词干 + 词尾**） | 名词词干 + `־ִי` / `־ִית` / `־ִיִּים` / `־ִיּוֹת` | 4/4 |

- 11 个名词形态类别（`he-class-*`）与 6 个形容词骨架条目都不重复写规格，
  分别用 `deriveRef` 指向 `he-noun` 与自己的 `derive`。
- 四辅音形容词拆成三个锚点，**不能用 `variants` 自动判型**：אַדִּיר 与 צַדִּיק 的
  `toSkeleton(基本形态, 词根)` 完全相同（都是 `_ַ_ִּי_`），差别只在阴性单数
  （规则型保留 י：אַדִּירָה；弱化型丢 י 并给中根加 dagesh forte：צַדֶּקֶת）。
  因此按「规则 / 弱化 / 四词根 / 喉音叠音」分五个锚点，由用户按词选择：
  - `he-adj-quadriliteral-regular`：主要部分 = **三辅音词根**（אַדִּיר 型）
  - `he-adj-quadriliteral`：主要部分 = **三辅音词根**，阴性丢 י（צַדִּיק 型）
  - `he-adj-quadriliteral-4root`：主要部分 = **四辅音词干**（אַכְזָר 型），骨架按 `־` 依次代入
  - `he-adj-quadriliteral-guttural` / `-guttural-plain`：主要部分 = **四辅音词干**，第 2 个辅音
    是喉音、复数末辅音加 dagesh forte。按**首辅音是不是 שׁ** 分成两个锚点：
    שׁ 型骨架里写死 שׁ 点（`־ַׁ׳ֲ״ָ׀`），所以基本形态不用带点。
    这里刻意不用 `variants`：锚点本来就必须选，而变体只能靠基本形态的 שׁ 点区分——
    用户漏点时会静默落到「非 שׁ」变体、生成没有 שׁ 点的词形
- 名词模板声明了 `fields`：语法性（阳性 / 阴性，单选）。希伯来语名词的变格表只有
  `sg` / `du` / `pl` 三列、不按性别分列，所以这个字段只作记录，不参与列筛选。

骨架↔示例的逐格一致性另外由 `spell(root, 骨架)` 校验。

弱根九个类型**全部** 7 个 binyan × 7 式 × 10 身位 + 不定式 + 分词（每类 9 张表；加上强根共 2 457 格）：
III-ה / 叠音 / 喉音 III / 喉音 II / I-א / I-י / I-נ / III-א / 中空。

骨架写法补充：

- `־` / `׳` / `״` / `׀` —— 固定表示第 1 / 2 / 3 / 4 个词根辅音。弱根里某个辅音脱落时（I-נ 的未完成式、
  III-ה 接辅音词尾、中空词根），看骨架里剩下哪几个符号就知道缺的是哪一个，不需要数字下标。
- 词中的 dagesh lene 直接写在占位符后面（如 `־ַּ`），并在规格里用 `post.leneSlots` 声明哪几个槽位是
  **条件点**（如 `["1"]`）：代入的辅音若不属于 בגדכפת，这个点会自动去掉。同一个骨架因此既能服务
  בנה（R1 = ב，保留点）也能服务 עשה（R1 = ע，去点）。词首的 בגדכפת 仍由 `dageshLene()` 自动补点。
  用于词中的 dagesh lene（`יִכְתְּבוּ` 的 ת 有点、`יִשְׁמְעוּ` 的 מ 没有、`כְּתֹב` 的 ת 也没有）。
  词首的 בגדכפת 仍由 `applySkeleton()` 自动补点。
- 词尾形自动归一：代入后按位置把 ן ם ף ך ץ 换成词中形（`קום` + `־ָ״ְתִּי` → `קַמְתִּי`），
  词末则换成词尾形。

#### sa 梵语

- 章节顺序：**代词 → 名词 → 形容词 → 副词 → 动词 → 数词 → 连声 → 元音交替 → 天城文与转写**
- 格序：梵语传统 **体（主）→ 业（宾）→ 具（工具）→ 为（与）→ 从（离）→ 属 → 依（位）→ 呼**，
  标签写作「主格（体）」等，与传统名同字者（属格、呼格）不重复标
- 名词 15 类：a-m / a-n / ā-f / ī-f / ū-f / i-m / i-n / u-m / u-n / ṛ / -ant / -in / -as / -vas / 塞音词干
- 形容词 6 项：a-ā、i-u、ṛ、-ant、代词性形容词、比较级与最高级；**与名词分开写**（与古希腊语一致）
- 代词 7 项，末项为「代词变格总表」（tad- / yad- / kad- 三形并列）
- 动词：总论 1 节 + **现在系统按十类各一节**（每节 5 项：现在时 / 未完成 / 命令 / 祈愿 / 现在分词）
  + 将来·条件·祝愿 / 不定过去（7 类）/ 完成（含吠陀无重复型）/ 非定式 / 派生动词
- 派生动词（使役 ṇic / 意欲 san / 强力 yaṅ / 名源）**变位法都同第一类动词**（bhvādi），
  区别只在词干后缀（`-áya-` / `-sa-`·`-iṣa-` / `-ya-` / `-aya-`·`-ya-`·`-kāmya-`）；
  第十类本身就是 vṛddhi + `-áya-` + 第一类词尾，所以使役与第十类同形。
- 梵语**没有独立的过去完成时**，`liṭ` 兼表完成与久远过去
- 语法表文字：3 列表用「天城文 (IAST)」，9 列表只用天城文；悉昙文见 `sa-script`
- `derive` 覆盖：29 条（15 个名词类型 + 4 个形容词 + 10 个动词类），连声与吠陀重音由 `data/paradigm/sa.js` 的 `sandhi` / `accent` 处理

#### mnc 满语

- 章节顺序：**代词 → 名词 → 形容词 → 动词 → 数词 → 副词 → 后置词 → 语音与元音和谐 → 文字 → 句法**（10 章，分页显示）
- 黏着语，没有屈折：名词不变格（格关系靠**格助词**）、形容词不变形、动词只接后缀且不随人称变化
- **没有语法性**，名词也没有「主要部分」（单数形式就是词干）——
  `paradigms.noun.stems: false`，表单里语法性与主要部分都不显示
- 名词锚点 = **复数类型**（5 类）：无标记（多数）/ `-sa` / `-ta` / `-si` / `-ri`，再加内置的「特殊变格」「不变格」；
  五类**都有** `derive` 与 `expect`（`-ri` 的例词：mafa → mafari）。原先的 `-l` / `-t` 两类经核对并不存在，已删除
- 动词锚点 = **元音和谐三类**：后元音 `a / ū`、前元音 `e / u`、圆唇 `o`；`i` 中性，向前找非 i 元音
- 代词**没有锚点**（也没有 paradigm）：格融合形式（`bi → mini / minde / mimbe / minci`）只写在语法页
- 动词 `paradigms.verb`：4 张单列表 —— 时制与体（10 行）/ 式与否定（6 行）/ 副动（5 行）/ 形动与名词化（5 行）
- `derive` 覆盖：动词 1 条（`stemForms.base` 由基本形态去 `-mbi`）+ 名词复数 7 条；
  后缀里的元音写成占位符 `V`，由 `data/paradigm/mnc.js` 的 `harmonize()` 按词干末元音替换。
  三个元音和谐锚点（`mnc-verb-harmony-back/front/round`）用 `deriveRef: "mnc-verb"` 复用同一份规格
- 派生动词单独一节（`mnc-verb-secondary`）：使役/被动 `-bu`、相互 `-nu`·`-ndu`、协同 `-ca`·`-ce`。
  派生出来的是**新词**（词干改变），不标 `inflect`、不接 `derive`；派生词仍按普通动词接全部后缀，
  **元音和谐按派生后的词干算**（`arambu-` → `arambuha`）。在生词本里另立词条，用「派生词」链接回原词
- 文字章：**34 个字母** —— 基本 25（6 元音 + 19 辅音）+ 带点 3（`k'` `g'` `h'`）+ 汉语借词 9
  （`ts` `ts'` `dz` `dz'` `ž` `j'` `c'` `s'` `f'`），每个字母列出**独立 / 词首 / 词中 / 词尾**四种位置形，
  附转写与用法说明（k·g·h 共用基形、d 加点于 t、b 与 p 是两个字母、ng 不作词首…）+ 书写与连接规则。
  满文同一码位的字形由字体按上下文决定，表格里用零宽连接符（ZWJ / ZWNJ）强制显示各位置形，复制单元格会带上这些不可见字符
- **转写 ↔ 满文**：`data/paradigm/mnc.js` 导出 `toScript()` / `toRoman()`（字母表与文字章一致，双字母与带撇号字母优先匹配）。
  生成表格时词干输入满文或转写都可以（含 U+1800–18AF 判为满文），内部统一转成转写做元音和谐，
  输出时 `paradigm` 存满文、`paradigmRoman` 存转写；列表检索两条都命中；其它语言不需要转写检索（数据本身就是自己的文字）

#### ja 现代日语

- 章节顺序：**名词 → 形容词 → 动词 → 助词 → 敬语 → 数词 → 句法**（7 章，分页显示）
- 黏着语，没有语法性、没有复数形态；词形变化只发生在**动词 / 形容词**上，格关系由**助词**表示
- 名词、助词、数词等**无锚点**，`paradigms` 里也没有模板 → 表单自动隐藏「类型 + 锚点」「主要部分」
- **动词锚点 = 四类活用**：五段 / 一段 / サ変（する）/ カ変（来る）；`paradigms.verb.stems: false`（基本形态 = 辞书形）
- **形容词锚点 = 两类**：形容詞（イ・高い型）/ 形容動詞（ナ・静か型）
- 活用形按**学校文法**列：未然・連用1・連用2（音便）・終止（＝辞書形）・連体・已然（仮定）・命令；
  合成形式另列一张表（ます / ない / た / て / 意志 / 可能 / 受身 / 使役 / 使役受身 / 已然＋ば），
  每行标注**基于哪个活用形**
- `derive` 覆盖：动词 4 条 + 形容词 2 条，全部以辞书形为唯一输入。
  五段用 `stemForms` 的 9 条正则做五段化与音便（`く→か/き/い/け/こ`、`つ/る/う→っ`…），
  一段去 `る`，する用 `stems` 字面量（し / さ / すれ / できる），カ変按汉字写法去 `る`（命令形 `-い`）
- **自他**：`paradigms.verb.fields` 声明「他动词 / 自动词 / 自他两用」，词条存 `word.attributes.transitivity`，
  表单在「语法性」的位置显示 chips（日语没有语法性，所以这一栏就是自他）
- 派生动词（`ja-verb-secondary`）：自他动词对应（-aru/-eru、-ru/-su、-ku/-keru、同形）+ 自谦语 + 尊他语，不接 `derive`
- 敬语章讲三分体系（尊敬 / 谦让 / 叮宁）+ 句式（お〜になる / お〜する / ご〜する），具体动词见派生动词章

#### zh-cls 古汉语与 en 现代英语

两者都关闭 `grammar` 与 `paradigm`，`sections` 为空数组、不写 `paradigms`、没有 `derive`。
表单只保留基本形态、词性、含义、补充形式、固定搭配、例句、派生词、标签备注；
词卡没有词性与语法锚点徽章，也没有语法页入口。

#### fr 法语

章节顺序：代词 → 名词 → 形容词 → 副词 → 动词总论 → 变位类型 → 特殊变位 → 数词 → 冠词 → 正字法 → 联诵。

法语名词、形容词没有格，界面文案统一用「变形」；只有动词用「变位」（`terms.byPos.verb`）。

- 代词（8 条）：第一二人称 / 第三人称 / 物主 / 指示 / 副代词 en·y / 关系 / 疑问 / 不定。
  前三条带 `inflect: decl`，是人称代词下拉里的锚点；**每条把同一类代词的全部功能列在一张表里**
  （主语 / 直接宾语 / 间接宾语 / 自反 / 重读）。第一二人称分成「第一人称」「第二人称」两张表上下排列，
  第三人称与指示代词按「单数阳性 / 单数阴性 / 复数阳性 / 复数阴性」分列。
- 名词：性与数、**去掉了「复数：」前缀的 4 个复数锚点**（一般 / -al→-aux / -eau→-x / 不变）+ 不规则复数
- 形容词：性数规则 + 6 个锚点（规则 / -e 同形 / -f→-ve / -eux→-euse / -er→-ère / 双写）、
  位置、比较级、**形容词构造副词（-ment）**、不规则形容词
- 副词：分类、比较等级、否定结构
- 动词总论：**时态与语式体系**（直陈式 / 虚拟式 / 条件式 / 命令式 / 不定式 / 分词六张表，
  「构成」一列只区分「变位」与「复合」）、**复合时态**（助动词选择 + 过去分词配合规则 + 副动词说明，
  纯文字、不进 paradigm）、代词式动词、词干拼写变化
- 变位类型（`inflect: conj`）：-er、-ir（-iss-），以及第三组 10 个模式
  （-re / -oir / -ir 不规则 / venir / prendre / mettre / -aître / -uire / -eindre / -vrir）；
  副动词不单列，说明写在「复合时态」里
- 特殊变位（不设锚点）：18 个常用不规则动词（être / avoir / aller / faire / pouvoir / vouloir / savoir /
  voir / dire / lire / écrire / boire / croire / mourir / vivre / courir / s'asseoir / naître）的完整简单时态。
  一个条目装全部动词表，**只有一层 tab（选动词，`group` / `groupLabel`）**，
  选中某个词后各语式（直陈式 / 虚拟式 / 条件式 / 命令式 / 不定式 / 分词）的表上下排列
  （做法见第二部分 §1「只按单词分 tab」）
- 数词、冠词（定冠词 / 不定冠词与部分冠词 / **缩合冠词**）、**正字法**（音符与特殊字符 / 省音 / 连字符 / 大写 / 标点与空格 5 条）、
  **联诵与连音**（三类联诵 + 联音变化 + 常见必须联诵例表）

`paradigms`：
- `noun`：列 `sg` / `pl`，行 `m` / `f`（性在行上），`fields` 显式声明语法性并开启 `declensionCells`
  —— 选了某个性就隐藏另一性的整行
- `adj`：同样是「列 单数 / 复数、行 阳性 / 阴性」，不含比较等级表（法语形容词比较等级没有形态变化）
- `pron`（`stems: false`）：`p12`（第一二人称）/ `p3`（第三人称）/ `poss` 与 `poss_free`（物主限定词 / 独立使用），
  用 `tables[].anchors` 绑定到三个代词锚点；词卡里只填该词自己的格子，空的整行在只读模式下自动隐藏
- `participle: extends adj`
- `verb`：按语式分表（`ind` / `subj` / `cond` / `impr` / `inf` / `ptcp`），命令式行用
  `disabled: ["1sg","3sg","3pl"]`（全行都禁用的列整列不渲染）；**复合时态一律不设行，也没有副动词表**

`derive` 覆盖（22 条，全部带 `expect` 自检）：
- 动词 12 组：`base` + `stemForms` 规则表达多词干（如 recevoir 的 `reçoi-` / `recev-` / `reçu-`）；
  分词「屈折词尾」表按「主要部分 + 词尾」写（-er：`-ant` / `-é -ée -és -ées`；-ir：`-issant` / `-i -ie -is -ies`），
  词干会变的类型在括号里注明（如 `-is（prend- → pris-）`）
- 每个动词类型都用 `parts[].kind: "select"` 声明**复合时态助动词**（`avoir` / `être` / `两可`），值存进 `words[].stems.aux`；
  根节点 `fr-verb` 用 `{ "partsOnly": true, "parts": [...] }` 再声明一份，「特殊变位」也能选助动词
  （`partsOnly` 的 derive 只提供主要部分，没有 `endings`，所以「生成表格」保持禁用）
- 名词 4 个复数类型、形容词 6 个性数类型（行 m / f、列 sg / pl）
- 复合时态不进 `endings`；`post.accent` 不需要

#### de 德语

章节顺序：代词 → 名词 → 形容词 → 副词 → 动词总论 → 变位类型（8 组）→ 情态动词 → 特殊变位 → 数词 →
冠词 → 介词 → 语序 → 正字法。

德语有格，所以名词、形容词、冠词、代词都用「变格」；表格一律**行 = 主格 / 属格 / 与格 / 宾格，
列 = 单数阳性 / 单数阴性 / 单数中性 / 复数**（名词只留自己的性别列，其余列写「—」，渲染时整列隐藏）。
人称列写全（`第一人称单数`…），不用 `单1` / `1sg` 这类缩写。

- 代词（8 条）：**第一二人称**（第一人称、第二人称含敬称各一张表，敬称单独一列）、
  **第三人称**、**反身代词**（没有主格，行 = 与格 / 宾格，列 = 六个人称）、
  **物主代词**（tab：词干 / 词尾 / 示例 mein / 示例 euer）、指示、关系、疑问、不定
- 名词：性与数（含复数词尾一览）+ 9 个变格锚点 + 特殊复数与外来词
- 形容词：形容词通用变格（按限定词选类型）+ 弱变化 / 混合变化 / 强变化 + 比较等级
  （规则变化 / 词干变音与特殊词尾 / 不规则变化）+ 分词作形容词、形容词构副词
- 副词：分类、比较等级（规则表在前、不规则表在后）、代副词 da(r)- / wo(r)-
- 动词总论：**时态与语式体系**（直陈式 / 虚拟式 / 命令式 / 不定式 / 分词五张表，「构成」列只区分
  「变位」与「复合」；语式用法与虚拟式构成写在 notes 里）、**复合时态与被动语态（迂说法）**、
  可分动词、反身动词
- 变位类型（`inflect: conj`，8 组）：弱变化（machen）、弱变化 -e- 插入（arbeiten / atmen）、
  弱变化 -eln / -ern（sammeln / ändern）、`-ieren`（studieren）、不可分前缀（besuchen）、
  强变化（sprechen）、混合变化（bringen）、情态动词（können，没有命令式 → `skipTables: ['impr']`）
- 情态动词：用法（意义表 + 语序）+ 词尾/例词 + **六个情态动词的完整变位**
- 特殊变位：**助动词 sein / haben / werden** 与 **13 个常用特殊变位动词**，
  每个词都列出完整简单时态。tab 只切换单词，同一词下按语式竖排
- 数词（含时间与日期）、冠词与限定词、介词与格支配（含缩合）、语序（含 nicht 的位置）、
  正字法（ß/ss、名词大写、分写与合写、标点与引号）

`paradigms`：
- `noun`：列 `sg_m` / `sg_f` / `sg_n` / `pl`，行四格；语法性由列 key 推导
- `adj`：`weak` / `mixed` / `strong` × 四格 + `comparison`；`participle: extends adj`
- `pron`（`stems: false`）：`p12` / `p3` / `refl` / `poss`，用 `tables[].anchors` 绑定四个代词锚点；
  物主代词条目的 `anchorLabel` 是「其他代词（物主代词）」
- `verb`：`ind`（现在时 / 过去时）/ `konj`（虚拟式 I / II）/ `impr` / `inf` / `ptcp`；
  **复合时态、被动、würde-形式一律不设行**

`derive` 覆盖（17 条，全部带 `expect` 自检）：
- 动词 8 组：基本形态 = **不定式**，`stemForms.base` 用 `en$ → ''` 推出词干。主要部分全部保留输入框
  （即使能自动推出）：现在时 2/3 单数（强变化）、现在时单数（情态动词）、
  **过去时**、**过去分词**、**虚拟式 I**、**虚拟式 II**，外加「完成时助动词」select。
  过去时 / 虚拟式 I / 虚拟式 II / 过去分词分别以 `pret` / `k1` / `k2` / `pp` 作 `stemForm`；
  `k2` 默认由 `pret` 变音（`sprach → spräch`），弱变化则 `k2 = pret`
- 名词 9 个类型：**复数主要部分**（词干，如 Tisch → `Tisch`、Mann/Männer → `Männ`）+
  各类型的固定复数词尾（-e / -er / -en / 同形），`exampleStems.pl` 供自检
- 形容词 1 个类型：三套变格表共用同一批词尾；比较级 / 最高级各有一个主要部分
  （`cmp` / `sup`，`sup` 默认 = `cmp` + `st`），变音、`-esten`、丢 e 都由用户按需填
- 「完成时助动词」用 `parts[].kind: "select"`（`haben` / `sein` / `beide`），值存进 `words[].stems.aux`；
  `select` 类字段没有空选项，默认取第一项

### 5. 新增一个语言的流程

以新增语言 code `xx` 为例，按以下顺序改动：

| 步骤 | 文件 | 改动内容 |
| ---- | ---- | -------- |
| 1 | `assets/js/config/config.js` | 在 `GRAMMAR_FILES` 末尾追加语言 code `'xx'`。元信息全部写在 `data/grammar/xx.json` 顶层（见第 3 节），`code` 必须唯一。 |
| 2 | `data/grammar/xx.json` | 新建语法文件，文件名必须与 `code` 一致。`version`（整数）、`language`（同 `code`）、`name` 必填，`sections` 必填（可为空数组，但建议至少给出一个条目），`paradigms` 可选。锚点按 `xx-{category}-{item}` 命名且全局唯一。 |
| 3 | `assets/css/base.css` | 在语言字体区块加 `[lang="xx"] { font-family: "LN XX", var(--ff-content); }`；RTL 语言再补 `direction: rtl; unicode-bidi: isolate;`。 |
| 4 | `assets/css/fonts.css` | 若准备专用字体：把 `xx.woff2` 放到 `assets/resources/fonts/`，并新增/取消对应 `@font-face`（`font-family: "LN XX"`）。没有专用字体可跳过，自动回退到 `--ff-content`。 |
| 5 | `external/js/wiktionary.js` | 需要 Wiktionary 在线查询时，在 `LANG_TO_WIKTIONARY` 增加 `'xx': '<英文 Wiktionary 的二级标题名>'`；该语言在 Wiktionary 没有词条时不要加，否则查询永远返回空。 |
| 6 | `data/paradigm/xx.js` | 可选。该语言的 derive 后期处理（重音 / 连声 / 词尾变音），见 [§7.1](#71-语言档案dataparadigm-目录)。不需要就跳过，引擎会自动略过这两步。 |
| 7 | `docs/SCHEMA.md` | 更新[§3 语言元数据](#3-语言元数据)的表格、[第二部分 §4](#4-各语言语法覆盖范围)「各语言语法覆盖范围」，以及[§3 锚点 id 命名](#3-锚点-id-命名)的示例表。 |

补充说明：

- **分组**：`classical` 决定语言进入「古典语言」还是「现代语言」组，分组本身不可由用户跨组拖动。
- **竖排 / RTL**：`vertical: true` 只让浮层用竖排样式；`rtl: true` 决定 `<bdi>` 与浮层的 `dir`。
  能否弹浮层看 `SCRIPT_POPUP_LANGS`，`<bdi>` 的包裹范围看 `BDI_LANGS`（都按字符范围判定）。
- **词性**：`pos` 取值来自 `assets/js/config/config.js` 的全局 `POS_LIST`，不是按语言定义。新语言的 `paradigms` 只能使用这些 key；确有新词性需求时需同时改 `POS_LIST` 和本文档第 4 节。
- **语法文件加载**：`assets/js/services/grammar-service.js` 运行时按 `./data/grammar/{code}.json` 拉取，404 时该语言的「语法」页显示为空提示。`data/grammar/` 在 `sw.js` 中走 stale-while-revalidate，新增语言文件不需要改动 `sw.js`。
- **既有用户数据**：老用户的 `settings.languageOrder` 里没有新 code 时，语言选择页会按 `LANGUAGES` 原始顺序把它追加到所在组末尾，不需要数据迁移。

#### 5.1 写语法数据的清单与坑

**先定 `paradigms`，再写 `sections`** —— 模板决定生词表单与词卡能填什么，改起来最贵。

1. **词干要取成「词尾能直接拼上去」的形式**。拉丁语第一变位法用 `am` 而不是 `amā`，
   规则最省。德语 `-eln` / `-ern` 动词的不定式以 `-ln` / `-rn` 结尾，`en$ → ''` 匹配不到，
   必须写 `ln$ → l` / `rn$ → r`；`-eln` 还要给 1 单与命令式另备一个短词干（`el$ → l`）。
   接新语言时，先只填「基本形态」跑一遍，确认每个格子都对。
2. **`expect` 要同步写全**，它是自检唯一的对照物；只写一部分（`expectPartial: true`）等于
   放弃大部分格子的把关。凡是「主要部分推不出来」的格子（德语强变化的过去时 / 第二分词），
   要在 `exampleStems` 里给自检用的样例词干，否则必然报错。
3. **`parts[].required`**：标了 `required` 又没填，表单会禁用「生成表格」并在 tooltip 里列出缺项。
   能用 `stemForms` / `stems` 推出的**不要**标 required，否则用户会被多余地拦住。
   没标 required、又推不出来的部分，生成时对应的表会跳过并清空（提示里会说明）。
   `parts[].example` 只用于自检，界面不再拿它当 placeholder —— placeholder 显示的是**推导预览**。
4. **`parts[].kind: "select"`**：这类字段是元数据（德语完成时助动词 `haben` / `sein` / `beide`），
   **不要给 `example`**，否则自检的「主要部分全填」路径会把它当词干填进去。
5. **`skipTables`**：某个变位类型整张表都不存在时（情态动词没有命令式）用它，
   不要留一张全空表；语法章与生词表单都会跳过，已填数据保留不删。
6. **锚点**：要让某个 section / item 出现在「语法锚点」下拉里，就给它标
   `inflect: "decl"` 或 `"conj"`（见 [§6](#6-paradigms-的两个通用机制)）。`collectInflectAnchors` 会拿标题做词卡徽章的短名，
   **保留标题末尾括号里的例词**（`强变化动词（sprechen 型）`），短名撞车时回退完整标题；
   下拉里 item 级锚点只显示条目标题（不带章节前缀）。`section.id` 与 `item.id` 必须全局不重复。
7. **表格写法**：
   - 每个条目两张表（「变化表」/「屈折词尾」+「示例表」），**两表形状必须一致、逐格可互推**；
     骨架型语言靠 `profile.realize` 保证互推。两张表分别标 `role: "pattern"` / `role: "example"`，
     语法页会把它们做成「变化表 / 示例表：<例词>」两个 tab。
   - 规则型条目（复数后缀、比较级构成等）第一张表写**规则**（列头用 `情况 / 说明` 这类写法），
     不必与例词表逐格对应；只有变格 / 变位表才要求两表同构。
   - 多对表（如希伯来动词的 Qal / 不定式 / 分词、拉丁语分词的三尾二尾 / 一尾）用 `group` +
     `groupLabel` 配对，语法页显示两行 tab：第一行选组，第二行选变化 / 示例。
   - 行标签只用分析语言（中文）。不要把示例词尾塞进标签（`连续完成式 וְ` 这种在窄首列会换行错位）。
   - 单元格 `—` 表示「该形式不存在」。**全空的行/列会自动隐藏**（含表头），所以缺数据时可以先留空，
     不会出现一排破折号；词卡的 `disabled` 格同样显示 `—`。
8. **章节分组**：章节多于一个时，在文档顶部写 `groups`，每节用 `group` 归属（见 [§1.1](#11-章节分组groups-与-sectiongroup)）；
   只有一两节的语言不分页，什么都不用写。
9. **语言专属音系处理**：连声 / 重音 / 词根骨架代入这类需要音节或词根知识的逻辑，
   放到 `data/paradigm/<lang>.js`，通过 `profile` 注入（见 [§7.1](#71-语言档案dataparadigm-目录)）；通用引擎只保留机械流程。
10. **改完数据要 bump `sw.js` 的 `CACHE`**：`data/grammar/` 是 stale-while-revalidate，
    不 bump 时浏览器首次加载会读到旧文件。
11. **跑自检**：`verifyGrammarDoc(lang, doc, profile)`（命令行跑法见[第四部分 §4](#4-校验语法数据命令行)），
    错误必须为 0；新增语言时同时确认章节能渲染、锚点下拉能取到条目。
12. **说明文字用 HTML，不写 Markdown**：`notes` / `note` / 表格 caption 与单元格都按 HTML 片段渲染
    （`utils/dom.js` 的 `htmlFragment`），可用的标签只有
    `<strong>` `<b>` `<em>` `<i>` `<code>` `<br>` `<small>` `<sup>` `<sub>` `<span>`；
    `on*` 事件与 `javascript:` 链接会被丢弃，不认识的标签会拆掉但保留文字。
    所以写 `<strong>强调</strong>`、`<code>-mbi</code>`，**不要写 `**强调**` 或反引号**（旧数据里的 `**` 已批量转换）。
12. **不需要锚点的词性**：某词性没有任何 `inflect` 条目时，生词表单会**整行隐藏**「变格 / 变位类型 +
    语法锚点」，连「特殊变格」「不变格」两个内置项也不提供（永久不变格变位的词性谈不上这两项），
    保存时清空 `inflectionType`。感叹词、介词、连词、数词等通常就是这种情况，无需额外配置。
13. **不需要「主要部分」的词性**：`paradigms[pos].stems: false` 表示该词性的词干就等于基本形态
    （满语名词、代词等），表单会隐藏主要部分与额外部分输入框；没有 `paradigm` 模板的词性同样隐藏。
    生成按钮独立成一行，只要该词性有可锚定的类型就显示。
14. **字段顺序**：基本形态 + 词性 → 语法性（有则显示）→ 变格 / 变位类型 + 语法锚点 → 含义 →
    主要部分（+ 额外主要部分）→ 变格 / 变位表（→ 补充形式 / 搭配 / 例句 / 派生词 / 标签备注）。
15. **属性字段 `paradigms[pos].fields`**：词性自己的「要不要填、显示什么、有哪些选项」都由这里声明，
    表单按顺序渲染成 chips（位置在「语法性」当年所在的那一行）。
    ```jsonc
    "fields": [
      { "key": "gender", "label": "语法性", "multi": true, "declensionColumns": true,
        "hint": "可多选（如 common gender 同时为阳性与阴性）。只显示所选性别的变格列。",
        "options": [{ "value": "m", "label": "阳性" }, { "value": "f", "label": "阴性" }, { "value": "n", "label": "中性" }] },
      { "key": "transitivity", "label": "自他",
        "options": [{ "value": "trans", "label": "他动词" }, { "value": "intrans", "label": "自动词" }, { "value": "both", "label": "自他两用" }] }
    ]
    ```
    - `multi: true` 存数组（语法性），否则存字符串（自他）
    - `declensionCells: true`（旧写法 `declensionColumns: true` 仍兼容）表示这个字段用来筛变化表格子：
      性在列上（`sg_m`）就整列不渲染，性在行上（`m` / `f`）就整行不渲染
    - 取值统一存进 `word.attributes`（对象）。旧的 `word.gender` 只作为兼容镜像保留，
      读旧数据时自动迁移到 `attributes.gender`；导出时也一并写 `gender`
    - **不声明 `fields` 也不会坏**：只要**名词**的变格列名带 `_m` / `_f` / `_n` 后缀，
      或者行 key 就是 `m` / `f` / `n`，就自动推导出一个「语法性」字段
      （la / grc / sa / de 走列的回退路径；fr 显式声明了字段）。
      回退只对名词生效（与旧行为一致）；其它词性要显示字段必须显式声明 `fields`
    - 日语动词显式用 `fields` 声明「自他」。以后要加「及物性 / 有生性 / 体」之类，加一条就行

**接入 derive 的四步**（详见 [§7](#7-derive-字段用主要部分生成变格变位表)、[§8](#8-postaccent-字段按音节指派重音)，按顺序加，每步都能单独跑自检）：

| 步骤 | 手段 | 用于 |
| --- | --- | --- |
| 1 | `endings` 纯拼接 | 词干 + 词尾型语言的主流情况 |
| 2 | `stemForms`（含 `{ from, rules }` 链式、带环检测） | 多词干系统：复数变音、虚拟式 II 变音、只填一个主要部分派生其余 |
| 3 | `formRules` | 接合处的音变：作用于拼好的整词（拉丁语现在时主动分词 `-nt` + `-s` → `-ns`） |
| 4 | `post.accent` | 重音 / 声调（古希腊语、梵语、希伯来语已在用） |

骨架型语言（词根嵌进元音骨架，如圣经希伯来语）另见 [§「骨架型 derive」](#骨架型-derivemode-取-skeleton)。

---

### 6. paradigms 的两个通用机制

#### `extends`（模板继承）

```jsonc
"paradigms": {
  "participle": { "extends": "adj" },      // 分词按形容词变格，不重复数据
  "adj": { "tables": [ ... ] }
}
```

- 本层写了 `tables` 就用本层的，否则整体继承 `extends` 指向的词性的 `tables`（不做深合并）。
- 可链式（`a → b → c`）；出现环时忽略 `extends` 并 `console.warn`。
- 生成器、校验器、界面全部走同一个 `getParadigmTemplate`，行为一致。

#### `disabled`（该形式不存在）

```jsonc
{ "key": "pres-act-impr", "label": "命令式 主动", "disabled": ["1sg", "1pl", "3sg", "3pl"] }
```

命令式只有第二人称，其余格不存在。三种模式统一处理：

| 场景 | 行为 |
| --- | --- |
| 视图（词卡 / 放大） | 渲染灰底空单元格，`title="该形式不存在"` |
| 编辑 / 新建 | 输入框 `disabled`，同款灰底 |
| `derive` 生成 | 跳过该格 |
| 校验 | `endings` / `expect` 若命中该格 → 报错 |

通用函数：`paradigm-generate.js` 的 `isCellDisabled(row, colKey)`。

#### `inflect`（语法锚点下拉的取数依据）

```jsonc
{ "id": "la-noun-1st-decl", "inflect": "decl" }     // item
{ "id": "la-verb-1st-conj", "inflect": "conj" }     // section
```

- 生词表单的「语法锚点」下拉 **只列带 `inflect` 的 section / item**，再加内置的「特殊」与「不变格 / 不变位」。
- 下拉与徽章里的名字默认取 `title`；需要和语法页标题不同时（如德语物主代词在生词表单里叫「其他代词」）
  写 `anchorLabel`，它只改下拉与徽章名，不影响语法速查的条目标题。
- 因此「时态构成」「分词与不定式」这类通用条目**不要**标 `inflect`，否则会混进下拉。
- 数词没有具体变格类型，所以下拉里只有 特殊 + 不变。拉丁语与古希腊语的代词按类别标 `inflect`（一二人称 / 三人称 / 反身 / 物主 / 指示 / 关系 / 疑问 / 不定），章节本身不标，避免下拉里多出一个笼统的「代词」项。
- 词性徽章（词卡正面）点击跳转到 `${lang}-${pos}` 对应的语法 section，与 `inflect` 无关。

---

### 7. derive 字段（用主要部分生成变格、变位表）

挂在 `sections[].items[]` 上，描述「给定词干 → 生成该类型的表格」的规则。

- 生成逻辑：`assets/js/models/paradigm-generate.js`（通用引擎，不 import 任何模块）
- 语言专属后期处理：`data/paradigm/<lang>.js`（见 [§7.1](#71-语言档案dataparadigm-目录)）
- 自检入口：命令行（见[第四部分 §4](#4-校验语法数据命令行)），页面上没有开发专用按钮
- 入口：生词表单「词干 / 主要部分」右侧的「生成表格」按钮。按钮的启用条件是
  **填了词干** + **`required` 的主要部分都填了** + 该类型有 `derive`；基本形态能推出词干也只作为
  placeholder 预览，不再单独构成启用条件。
- **每次点击都是全量覆盖**：本次生成的结果即新的表格数据，已有内容会被覆盖；
  某个词干没有来源（没填、也没有规则可推）时，**依赖它的整张表跳过并被清空**，
  生成后用提示列出「哪些表因缺哪个主要部分未生成」。

```json
{
  "id": "la-noun-1st-decl",
  "title": "第一变格法",
  "derive": {
    "pos": "noun",
    "stemExample": "aqu",
    "endings": {
      "main": {
        "nom": { "sg": "-a", "pl": "-ae" }
      }
    },
    "expect": {
      "main": { "nom": { "sg": "aqua", "pl": "aquae" } }
    }
  }
}
```

| 字段                            | 说明                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| `pos`                           | 可选。对应的 `paradigms` 词性 key；缺省时按 section id / 表 key 推断         |
| `mode`                          | 可选。`"skeleton"` = **骨架型**：格子写的是「辅音 + 元音骨架」而不是词尾，由 `profile.realize(stem, 骨架)` 把主要部分代入；缺省是词尾拼接型 |
| `stemExample`                   | 自检用基准词干（即 `stems.base` 的例词），配 `expect` 使用                    |
| `parts`                         | 主要部分声明 `[{ key, label?, example?, hint?, required?, kind?, options? }]`，第一项固定为 `base`（除非用 `stemForms.base` / `stems.base` 声明了 base 的来源） |
| `partsOnly`                     | 可选。`true` = 这份 derive 只声明主要部分（如法语动词根节点的「复合时态助动词」），不生成表格：校验时不要求 `endings` / `stemExample` / `expect`，「生成表格」保持禁用 |
| `parts[].kind`                  | 可选。`"select"` = 这一栏不是词干，而是从 `options` 里选的元数据（德语动词的完成时助动词 `haben` / `sein` / `beide`），值同样存进 `words[].stems[名称]` |
| `exampleStems`                  | 可选。自检用的主要部分示例 `{ 名称: 词形 }`。主要部分无法由基本形态推出时（德语强变化的过去时 / 第二分词）必须给，否则那些格子必然对不上 |
| `skipTables`                    | 可选。该类型没有的表格 `["impr"]`：语法速查的章节条目与生词表单的变位表格都会跳过（德语情态动词没有命令式）；表单里已填过的数据不会被删除，只是不显示 |
| `expectParts`                   | 可选。主要部分全填时的期望值，缺省时用 `expect`                              |
| `endings[tableKey][rowKey][colKey]` | 词尾。字符串 = 只加词尾（可写成 `-a`）；对象 = `{ suffix, prefix, stemForm }` |
| `rowDefaults[tableKey][rowKey]` | 该行的 `prefix` / `suffix` / `stemForm` 默认值，被格级声明覆盖               |
| `stems[名称]`                   | 直接给出词干变体（无法用规则表达时用，如 la `reg → rēx`）                    |
| `stemForms[名称]`               | 词干变体规则：`[{ pattern, replace, flags? }]`（作用于 `base`），或 `{ from, rules }`（先取另一个变体的词干，再套规则，可链式，见下） |
| `formRules`                     | 拼接后作用于整词的规则 `[{ pattern, replace, flags? }]`，按顺序执行。接合处音变（如拉丁语现在时主动分词 `amant-s → amāns`、希腊语连声）用它表达 |
| `stemOnly`                      | 格级布尔值。整格就是词干本身（如呼格单数与主格同形），不拼接任何词尾        |
| `unlessEndsWith`                | 格级条件词尾：`prefix + 词干` 已以数组里任一字符串结尾时**不加** suffix。用于「第三格复数加 -n，但已以 -n / -s 结尾则不加」（德语 Tischen / Kindern / Frauen / Autos） |
| `post.sandhi`                   | 可选。交给语言档案的连声处理：`"sa"` = 词干与词尾接合处连声；`"sa-word"` 或 `{ scope: "word" }` 额外做词尾停顿式 |
| `post.accent`                   | 可选。按音节重新指派重音，见下                                              |
| `expect`                        | 自检期望值，结构同 `paradigm`                                                |

生成过程（每个格子）：

```
1. stemForm = 格级 ?? 行级 ?? 'base'
2. stem     = 用户填的 stems[stemForm] ?? derive.stems[stemForm] ?? 对 base 套用 stemForms[stemForm]
3. naive    = prefix + stem + suffix            （骨架型：profile.realize(stem, 骨架)）
4. naive    = 有 post.sandhi 时交给 profile.sandhi 处理（骨架型跳过）
5. form     = 对 naive 套用 formRules
6. form     = 有 post.accent 时交给 profile.accent 处理
7. 该格已有值 → 跳过，不覆盖
```

`formRules` 与 `stemForms` 的区别：`stemForms` 改的是**词干本身**（多词干系统，一次算好、所有格共用）；
`formRules` 改的是**拼好的整词**（只在接合处发生的音变），因此它在 `prefix + stem + suffix`
之后、`post.accent` 之前执行，作用范围是整份规格（不区分格）。目标语言的重音本身就依赖连声结果时，
仍应优先用 `post.sandhi`（语言档案），`formRules` 用来处理档案里没有的零散音变。
自检会校验规则必须锚定（`^` 或 `$`）。目前拉丁语用它处理现在时主动分词的 `-nt` + `-s` → `-ns`（并补偿延长：`ants → āns`、`ents → ēns`）。

#### 骨架型 derive（mode 取 skeleton）

适用于**词根 + 元音骨架**型语言（目前是圣经希伯来语）：词干不是「加词尾的基础形」，
而是三辅音词根，每个格子给出的是完整骨架，`־`（מַקָּף）表示一个词根辅音（占位后可带 dagesh 等附加点）。

```jsonc
{
  "mode": "skeleton",
  "stemExample": "קטל",                     // 词根，不是词干
  "parts": [{ "key": "base", "label": "词根（辅音）", "example": "קטל", "required": true }],
  "post": { "accent": "he-milra" },
  "endings": { "qal": { "perf": { "3ms": "־ָ־ַ־", "3fs": "־ָ־ְ־ָה" } } },
  "expect":  { "qal": { "perf": { "3ms": "קָטַל", "3fs": "קָטְלָה" } } }
}
```

- 代入由语言档案完成：`profile.realize(词根, 骨架)`（`he.js` 会先补词首的 dagesh lene，再按需落重音）。
- `endings` / `expect` 的结构、`disabled` 跳过、`existing` 不覆盖等行为与词尾拼接型完全一致。
- 校验器会拒绝除 `"skeleton"` 以外的 `mode` 值。

**骨架的写法**（`data/paradigm/he.js` 的 `applySkeleton` / `toSkeleton`）：

| 记号 | 含义 |
| --- | --- |
| `־` | 第 1 个词根辅音 |
| `׳` | 第 2 个词根辅音 |
| `״` | 第 3 个词根辅音 |
| `׀` | 第 4 个词根辅音（四辅音词根） |
| 其他字符 | 原样保留（词缀、元音点、dagesh 等） |

例：`־ָ׳ַ״` + 词根 קטל → קָטַל；`יִ׳ֹּ״` + 词根 נפל → יִפֹּל（第 1 个辅音 נ 被同化，所以骨架里只有 `׳` 和 `״`）。

> 为什么不用「按顺序编号 + 下标数字」：数字夹在占位符和它的元音附标之间时，附标会挂到数字上，
> 在 RTL 里叠成一团（实测过）。换成四个固定符号后，附标始终挂在占位符上，且缺哪个辅音一目了然。

**按基本形态选变体**（`variants`）：同一个 derive 规格可以声明多个模式变体，
引擎用 `profile.toSkeleton(基本形态, 词根)` 求出基本形态的骨架，与该变体的 `match` 比对后选用：

```jsonc
{
  "mode": "skeleton",
  "headword": "基本形态",           // 由表单传入 generateParadigm({ headword })
  "variants": [
    { "id": "he-noun-qatal", "match": "_ָּ_ָ_", "root": "דבר", "headword": "דָּבָר",
      "endings": { "main": { "abs": { "sg": "_ָּ_ָ_" }, "cst": { "sg": "_ְּ_ַ_" } } },
      "expect":  { "main": { "abs": { "sg": "דָּבָר" }, "cst": { "sg": "דְּבַר" } } } }
  ]
}
```

- 比对时忽略 dagesh（`profile.skeletonKey`），用户少写一个点也能匹配上。
- 一个变体都匹配不上时 `generateParadigm` 返回 `noVariant`，表单提示「按基本形态判不出元音模式」。
- `variants` 里每个变体自带 `root` / `headword` / `expect`，自检逐个变体跑。
- 锚点本身没有 `derive` 时用 `deriveRef` 指向提供规格的锚点 id 复用（见下）。

约束：

- 规则的 `pattern` **必须锚定**（以 `^` 开头或以 `$` 结尾），否则一次替换就能写坏整张表；校验器会直接报错。
- `endings` / `rowDefaults` / `expect` 里的 key 必须能在 `paradigms[pos]` 中找到，列 key 也要对得上。
- 生成的格**只填空格**，词条里已有内容（含用户手改）永不覆盖。
- 没有 `derive` 的类型不参与生成，仍可手工填表。

**`deriveRef`：复用别处的规格。** 锚点自己不想重复写 `derive` 时，写
`"deriveRef": "he-noun"` 即可复用那个锚点的 `derive`（也支持指向 section id）。
典型场景是「一份规则 + 多个可选锚点」：

- 满语 `mnc-verb-harmony-back/front/round` 三个章节共用 `mnc-verb` 的规格，
  元音和谐由 `profile.harmonize()` 按词干处理，规则本身只有一份。
- 希伯来语 `he-class-*` 11 个形态类别共用 `he-noun` 的骨架型规格，
  具体走哪个变体由基本形态的骨架决定。

约束：`derive` 与 `deriveRef` 只能二选一；`deriveRef` 必须指向存在的锚点且不能成环，
校验器会报错。
- `derive` **可以挂在 section 上**：一个变位法的规则天然覆盖它全部时态表，
  于是 `endings` 按 `{pres, impf, fut, perf, plup, futp, inf, ptcp-pres, ptcp-perf, ptcp-fut, ptcp-futpass, gerund, supine}`
  分块，用 `rowDefaults` 声明各行默认使用哪个词干变体（完成系统各表用 `perf`，
  分词按种类分别用 `presptcp` / `ppp` / `futact` / `futpass`，目的动名词用 `ppp`）。
- **分词一章按分词种类拆表**：拉丁语的分词表都是完整变格（`sg_m sg_f sg_n pl_m pl_f pl_n` × 六个格），
  按现在时主动 / 完成时被动 / 将来时主动 / 将来时被动分成四张表
  （`ptcp-pres` / `ptcp-perf` / `ptcp-fut` / `ptcp-futpass`），与语法条目的四个 tab 一一对应。
  只列主格、用 `m` / `f` / `n` 三列的紧凑写法（旧版 `ptcp` / `ptcp1`）已废弃。
- 语法里每个变格 / 变位条目都要给**两张表**：
  1. `caption: "屈折词尾"` —— 只列词尾（`-ō` / `-ās`…）
  2. `caption: "示例：amō, amāre, amāvī, amātum"` —— 完整词形

  两张表行列一一对应，`derive.endings` 应与第一张表一致。

### 7.1 语言档案（data/paradigm 目录）

通用引擎只负责「词干 + 词尾 → 拼起来 → 套正则」这套机械流程。
凡是需要语言学知识的后期处理（音节、重音、连声），一律放到该语言自己的档案文件里，
由引擎在生成每一格时调用；没有档案文件的语言（如拉丁语）自动跳过这两步。

档案是一个普通 ES 模块，可导出：

| 导出            | 类型                        | 作用                                             |
| --------------- | --------------------------- | ------------------------------------------------ |
| `accentModes`   | `string[]`                  | 该语言允许的 `post.accent` 取值；校验器据此报错   |
| `accent(text, mode, options)` | `function`     | 拼好之后按模式指派重音；`options.endingAccented` 表示该格词尾自带重音 |
| `sandhi`        | `{ join, wordFinal }`       | `join(左段, 右段)` 做接合处连声；`wordFinal(整词)` 做词尾停顿式 |
| `toScript(text)` | `function`                 | 「转写 → 文字」转换（满文）：生成时把每一格的转写换成文字存进 `paradigm`，转写另存 `paradigmRoman` |
| `toRoman(text)`  | `function`                 | 「文字 → 转写」转换：把用户填成文字的词干先转回转写，再做规则、和谐与重音 |

- 加载：`services/grammar-service.js` 的 `loadParadigmProfile(lang, doc)`（动态 `import()`，结果缓存，
  只有 JSON 里 `profile: true` 时才加载，其余直接返回 `null`）。
- 传播：`generateParadigm({ …, profile })`、`checkDeriveExample(spec, tpl, { profile })`、
  `verifyGrammarDoc(lang, doc, profile)` / `verifyGrammarDocs([{ lang, doc, profile }])`。
- 共用工具在引擎里导出：`toUnits` / `fromUnits`（拆成「字母 + 组合记号」）与 `ACUTE` / `CIRCUMFLEX` /
  `ACCENT_MARKS` / `LENGTH_MARKS` / `hasAccentMark`。
- 现有档案：[`grc.js`](../data/paradigm/grc.js)（希腊语重音）、[`sa.js`](../data/paradigm/sa.js)（梵语连声 + 吠陀重音）。

---

### 8. post.accent 字段（按音节指派重音）

「单一词干 + 词尾拼接」拿不到重音位置，而希腊语的重音位置由**音节数与音节量**决定。
`derive.post.accent` 让引擎在拼好之后按音节重新放置重音：

```jsonc
"post": {
  "accent": {
    "*": "recessive",                       // 默认模式
    "inf": { "aor-pass": "penult" },        // 按表覆盖
    "aor": { "aor-pass-opt": { "3pl": "acute", "*": "persistent" } }   // 按行 / 按格覆盖
  }
}
```

| 模式 | 行为 |
| --- | --- |
| `recessive` | 退重音（动词）：在限制法允许的范围内尽量往词首推 |
| `penult` | 固定在倒数第二音节（不定式 `-ναι`、`-σθαι`、`-μενος` 分词等） |
| `persistent` | 持续重音（名词 / 形容词）：保持原音节，只受限制法约束 |
| `acute` | 同 `persistent` 的位置，但一律用锐重音（个别形式，如 `λυθείεν`） |
| `none` | 不处理 |

覆盖写法与 `endings` 同构：`{ '*': 默认, 表: 模式 | { 行: 模式 | { 列: 模式 } } }`，
每层都可以用 `'*'` 给出该层的默认值。

规则细节：

- **约定**：词干按它在基本形态里的样子写（重音照写）；重音落在词尾的类型由词尾自带重音
  （如 `τιμ` + `-ή`、`χώρ` + `-ῶν`）。词尾自带重音时优先采用词尾那一侧。
- **长音符**（`ᾱ` `ῑ` `ῡ`，分解后是组合长音符 `U+0304`）只是元音长短的标注：引擎用它判断音节量，
  生成结果里会去掉。未标长音的 `α ι υ` 一律按短音处理。
- 限制法：末音节为短时重音才可落在倒数第三；末音节的 `-αι` / `-οι` 与 `-εως` / `-εων` 按短音算，
  但**祈愿式**的词尾 `-οι` / `-αι` 按长音算（`λύοι` 是锐重音，不定式 `λῦσαι` 才是弯曲重音）。
- 倒数第二音节为长音（长元音 / 双元音）且末音节短时转弯曲重音；仅「位置长」（后接两个辅音）不转
  （`λυθέντος`、`ὄρνις` 保持锐重音）。
- 括号、斜杠等标记不参与音节量计算，所以 `ἔλυσε(ν)`、`τίς / τί` 这类写法可以正常处理。
- 分音符（`ϊ` / `ϋ`）表示不合为双元音（`ἰχθύϊ`）。

#### 梵语：连声与吠陀重音

```jsonc
"post": { "sandhi": "sa", "accent": "sa-vedic" }
```

**`sandhi`**（`data/paradigm/sa.js` 的 `join` / `wordFinal`）：

| 类别 | 规则 |
| --- | --- |
| 元音连声 | `a/ā + a/ā → ā`；`+ i/ī → e`；`+ u/ū → o`；`+ ṛ → ar`；`+ ai / au → ai / au` |
| 半元音化 | `i/ī + 元音 → y`、`u/ū → v`、`ṛ → r`（同元音则并为长音 ī / ū） |
| 词尾停顿式 | 浊 / 送气 → 同部位清不送气（`g/gh → k`、`d/dh → t`、`b/bh → p`…）；`ś ṣ s r → ḥ`；`m → ṃ` |

注意：梵语变格数据建议把 `stems.base` 取成**不含主题元音**的形式（`kām` 而不是 `kāma`），
这样词尾本身就是 `-aḥ / -ena / -asya` 等教科书形式，连声只在元音结尾的词干上才真正触发。

**`accent`**：

| 模式 | 行为 |
| --- | --- |
| `sa` | 保持词干里原有的锐重音（udātta），不做希腊语的三音节限制法 |
| `sa-vedic` | 在 `sa` 基础上，把 udātta 之后的那个音节标为 swarita（`◌̂`，U+0302） |

#### stemForms 的链式写法

同一个词干的派生形式可以写成「先取另一个变体，再做一次音变」，不必从 `base` 重新推一遍：

```jsonc
"stemForms": {
  "perf": [ /* base → 完成时词干：重复 + 缩短 + κ */ ],
  "perfmid": { "from": "perf", "rules": [{ "pattern": "κ$", "replace": "" }] },   // 完成时中动词干
  "perfmidmu": { "from": "perfmid", "rules": [ /* 与 -μαι 同化 */ ] }
}
```

- 取词干顺序对每一层都成立：用户填的 `stems[名称]` → `stems[名称]` 字面量 → 该层的规则 → `base`。
  所以**只要用户填了 `perf`，`perfmid` 就会跟着变**（用户单独填 `perfmid` 时优先用用户的）。
- `from` 可以指向 `base` 或任何已声明的变体名；出现环时该层退回 `base`（校验器会报错）。
- 规则同样要求 `pattern` 锚定。

---

## 第三部分 检索规范

### 1. 检索范围

- **当前语言内**，不做跨语言检索。
- 列表页「检索范围」三档：

| 值 | 名称 | 命中字段 |
| --- | --- | --- |
| `all` | 全部 | 词形（下列全部）+ `meanings[].text`、`examples[].text`、`examples[].translation`、`collocations[].text`、`collocations[].gloss` |
| `forms` | 词形 | `lemma`、`stems` 全部值、`paradigm` 全部格子、`inflections[].form` |
| `head` | 原形 | 只有 `lemma` + `stems` 全部值 |

- 默认 `all`。`head` 同时用于派生词选择器的搜索。
- **数词的多种形式属于派生词**，不作为同一词条的变格形式参与检索。

### 2. 匹配方式

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

### 3. 唯一键

**不受检索规范化影响**。`addOrMerge` / `findByKey` / 导入合并时仍按原始字符串严格比较。

---

## 第四部分 数据源

### 1. 手动编写

- 通过「添加生词」表单输入
- 支持导入/导出完整用户 JSON
- 支持批量导入生词 JSON（单对象 / 数组 / `{ words: [...] }`）
- 支持导入前预览：按唯一键（`userId + language + lemma + pos`）模拟统计「新增 / 合并 / 跳过」，不写入数据；
  同一批次内的重复条目按合并计入，与实际导入结果一致
- 支持 AI 提示词下载，驱动模型按当前语言的 paradigm 模板生成结构化 JSON
- **派生词只能从词库中选择**（外键语义）：用 `head` 范围搜索当前语言的词条，
  选不中的词会提示「未找到，请先添加该词」，不提供自由文本输入

### 2. 外部数据源（在线查询）

外部依赖统一放在 `docs/pages/grammar/external/js/`，一个源一个文件，**不静态 import**。

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
    语法性等 `attributes`、变格 / 变位类型、语法锚点、主要部分取自选中的那个词条；
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
`stems` 写进「主要部分」，`attributes`（如 `{ gender: "f" }`）填词性声明的属性字段，
`inflectionType`（`{ grammarRef, label }`）选中「语法锚点」——
`grammarRef` 必须是该词性下确实存在的锚点 id，对不上的会被视图忽略。
来源标记由模块自己盖（`source: '<id>'`）。

变格 / 变位表由 `derive` 引擎按主要部分生成，**不要求外部源提供表格**；
视图另外还认 `examples`（覆盖例句）、`paradigm`（合并进 `data.paradigm.main`）、
`inflections`（追加到「补充形式」），哪个源能拿到再给，拿不到就不返回。

同一页有多个可用词条时（多词性，或同一词性分属多个词源小节），
除了按 `preferredPos` 挑一条当主结果，还要给出 `choices: [{ label, patch }]`，
`patch` 与本对象同构。视图在查询按钮旁多一个下拉，切换即用该 `patch` 重新回填；
`label` 要带上语言与词性（Wiktionary 源还会带词源小节名），以便区分。

**共用 HTTP 层**（`assets/js/services/http.js`）：各源不直接调 `fetch`，统一走这一层。

```js
import { requestJSON, requestText } from '../../assets/js/services/http.js'

requestJSON(url, {
    query: { action: 'parse', page: lemma, origin: '*' },
    timeout: 15000,      // 单次超时（ms）
    retries: 2,          // 网络错误 / 超时 / 5xx / 429 才重试
    minInterval: 250,    // 同站点相邻请求的最小间隔（ms）
    concurrency: 1,      // 同站点并发数
    cacheTtl: 7 * 24 * 60 * 60 * 1000   // >0 时缓存到 IndexedDB
})
```

- 节流按 `origin` 全局生效：不同源请求同一站点也会排队；同一站点被多个源请求时取各自声明的较大值。
  参数没有默认值，由各源自己声明（写在源文件顶部的 `HTTP` 常量里）。
- 429 / 503 优先按 `Retry-After`（秒数或 HTTP-date）等待，其余按 `400ms·2^n` + 抖动退避；
  其他 4xx 不重试，抛 `HTTP <status>`；超时抛「请求超时」。
- `cacheTtl > 0` 时，成功响应写进 IndexedDB 的 `httpCache`（库 `langnotebook` v2，键是排序后的 URL），
  过期条目按需清理；`store/http-cache.js` 里也导出 `clearHttpCache()` 供以后做「清理缓存」入口。

**Wiktionary 实现**（`external/js/wiktionary.js`）：

- 一次 `action=parse`（`prop=sections|wikitext`）拿全 wikitext 与标题层级；走共用 HTTP 层，缓存 7 天
- 按 `sections` 的标题层级 + `byteoffset` 切 wikitext：语言节是二级标题，
  词性小节按标题名认（`===Noun===` 与 `Etymology 1` 下的 `====Verb====` 都要认），
  四级以下只作词性小节的子节
- 只解析三样：`#` 开头的释义行、词头模板里报的主要部分、以及模板里的语法性（`g=f` 等）
- 词头模板（`{{la-verb}}` / `{{la-noun}}`）里的主要部分会回填 `stems`，
  变位 / 变格号能可靠对应到锚点时一并给出 `inflectionType`（好让 `derive` 直接出表）
- 该文件内部的 `LANG_TO_WIKTIONARY` / `POS_MAP` / `HEADWORD_TEMPLATES` 是
  这个源专属的解析表，不放进 `config.js`

**已知限制**

- 词头模板只处理拉丁语；词干靠规则剪（现在时词干、名词词干），
  第二变格法会按模板里的 `g=` 选阳性 / 阴性锚点；第三变格法等分不出小类时不猜锚点
- 只认 `#` 顶层的释义行；纯模板释义（如 `{{medieval spelling of|...}}`）清洗后为空会被跳过
- 无缓存
- 未处理速率限制

### 3. 计划接入的外部数据源

具体候选与可行性（CORS / 限流 / 覆盖语言）见 `docs/TODO.md` 第一部分。
接入方式就是 [§2](#2-外部数据源在线查询) 的两步：写一个 `external/js/<source>.js`，在 `EXTERNAL_SOURCES` 里加一条记录。

---

### 4. 校验语法数据（命令行）

页面上没有开发专用按钮，`assets/dev/` 目录已移除。改完 `data/grammar/*.json` 后直接用
`paradigm-generate.js` 的自检函数跑一遍（该模块自包含，可直接在 node 里 import）：

```bash
cd docs/pages/grammar
node --input-type=module -e "
import fs from 'node:fs'
import { verifyGrammarDoc } from './assets/js/models/paradigm-generate.js'
for (const f of fs.readdirSync('data/grammar')) {
  const lang = f.replace('.json', '')
  const doc = JSON.parse(fs.readFileSync('data/grammar/' + f, 'utf8'))
  const profile = await import('./data/paradigm/' + lang + '.js').catch(() => null)
  const r = verifyGrammarDoc(lang, doc, profile)
  console.log(lang, 'errors', r.errors.length, 'warnings', r.warnings.length)
  for (const e of r.errors.concat(r.warnings)) console.log('   ', e)
}
"
```

- 期望结果：每个语言 **errors 0 / warnings 0**。
- 需要真实表格做样本时，用 `generateParadigm()` 按 `spec` + `template` 生成再核对，
  方式与 `sample-words.json`（项目根目录的导入样例）一致。
- 语法 / 元数据每改一次，应同步更新 `sample-words.json` 里对应语言的样例词。

改完界面枚举（词性、语法性、主题、页码、外部源）后记得对一下 `assets/js/config/config.js`：
站点级常量都收在这个文件里，各模块不再各自写一份。
