# 数据 Schema 与语法数据编写规范

本文档合并原有的「数据 Schema」与「语法数据编写规范」两份文档，覆盖：

- IndexedDB 存储结构
- 用户导出 / 导入 JSON 结构
- 语言元数据
- Word 模型与多源合并策略
- 语法速查 JSON 编写规范
- 检索规范
- 版本迁移

---

## 第一部分 · 数据 Schema

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
    "languageOrder": ["la", "grc", "sa", "mnc", "ja-cls", "zh-cls", "he", "ja", "en", "fr", "de"],
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

定义在 `assets/js/data/languages.js`，不可由用户修改。

```js
{
  code: 'la',        // 语言 code，与 /data/grammar/{code}.json 对应
  name: '拉丁语',     // 中文名
  native: 'Latina',  // 本语言书写形式
  classical: true,   // 是否古典语言（决定语言选择页的分组）
  vertical: false,   // 是否纵向书写（满语 true）
  rtl: false         // 是否从右到左（希伯来 true）
}
```

完整列表：

| code     | name         | classical | vertical | rtl |
| -------- | ------------ | --------- | -------- | --- |
| `la`     | 拉丁语       | ✅         | ❌        | ❌   |
| `grc`    | 古希腊语     | ✅         | ❌        | ❌   |
| `he`     | 圣经希伯来语 | ❌         | ❌        | ✅   |
| `sa`     | 梵语         | ✅         | ❌        | ❌   |
| `mnc`    | 满语         | ✅         | ✅        | ❌   |
| `ja`     | 现代日语     | ❌         | ❌        | ❌   |
| `ja-cls` | 古典日语     | ✅         | ❌        | ❌   |
| `zh-cls` | 古汉语       | ✅         | ❌        | ❌   |
| `en`     | 现代英语     | ❌         | ❌        | ❌   |
| `fr`     | 法语         | ❌         | ❌        | ❌   |
| `de`     | 德语         | ❌         | ❌        | ❌   |

- **`classical`**：不可由用户修改。语言选择页按此字段分为「古典语言」「现代语言」两组。分组本身不可跨组拖动，组内语言顺序可由用户拖动调整，保存到 `settings.languageOrder`。组间顺序保存到 `settings.groupOrder`。
- **`vertical`**：为 `true` 时，语言内容元素触发竖排 popover。
- **`rtl`**：为 `true` 时，行内文字方向为 RTL。

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

#### 字段说明

| 字段                        | 说明                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `language`                  | 语言 code，见 `assets/js/data/languages.js`                                                       |
| `lemma`                     | 基本形态，原样保存，不做归一化                                                                    |
| `pos`                       | 词性，约定见下                                                                                    |
| `inflectionType.label`      | 变格/变位类型显示名，词卡徽章                                                                     |
| `inflectionType.grammarRef` | 指向语法 JSON 的锚点 id；无对应语法时为 `null`（此时视为「特殊变格 / 变位」，用户自行填写 label） |
| `paradigm`                  | 表格化的变位/变格数据，稀疏存储，键为 `{tableKey: {rowKey: {colKey: value}}}`                     |
| `inflections[].group`       | 可选，用于分组显示（如「不定式」「命令式」）                                                      |
| `meanings[].lang`           | `zh` / `en`                                                                                       |
| `derivatives`               | 派生词 lemma 列表；仅当目标词已存在时渲染为可点击链接                                             |
| `encounterCount`            | 每次添加时若命中唯一键则 +1                                                                       |
| `mastery`                   | 0–5，复习对 +1、错 −1，clamp 到区间                                                               |
| `nextReviewAt`              | 按 mastery 从间隔表 `[0,1,3,7,14,30]` 天取值                                                      |
| `source` 取值               | `manual` \| `wiktionary` \| `url:<host>` \| 其它自定义字符串                                      |

#### pos 约定

`noun` `verb` `adj` `adv` `pron` `prep` `conj` `particle` `participle` `num` `interj` `other`。

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
- 找不到模板的语言（如 `en` / `zh-cls` / `ja` / `ja-cls`）不使用此字段，相关变位/活用全部走 `inflections`。

---

### 5. 多源合并策略

同一条词（`userId + language + lemma + pos` 相同）：

- `meanings` / `inflections` / `collocations` / `examples` 均为**数组**，新来源的内容**追加**，不覆盖。
- `paradigm` 做**格子级合并**：同格子已有值不被覆盖，新格子填入。
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

导入时逐级升级到 `CURRENT_VERSION`。当前为 `version: 1`。

---

## 第二部分 · 语法数据编写规范

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

  "sections": [
    {
      "id": "la-noun",
      "title": "名词变格",
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

---

### 2. paradigms 字段

用于生词表单与词卡中的结构化变位/变格表格。按词性分表。

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

#### 字段说明

| 字段                 | 说明                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `<pos>`              | 词性 key，取值与 Word 的 `pos` 字段一致（`noun` / `verb` / `adj` …） |
| `tables[].key`       | 表 id，同一 pos 下唯一；Word.paradigm 顶层键即为此 key               |
| `tables[].title`     | 表标题，显示在表格上方                                               |
| `tables[].columns[]` | 列定义，`key` 是数据存储用的键，`label` 是显示名                     |
| `tables[].rows[]`    | 行定义，`key` 是数据存储用的键，`label` 是显示名                     |
| `rows[].grammarRef`  | 可选，指向同文件 `sections` 里的锚点 id，用于「语法」跳转按钮        |
| `rows[].principal`   | 可选，为 `true` 时该行在派生 principal parts 时被提取                |

#### 覆盖范围

- `la` / `grc` / `he` / `sa` / `mnc` / `fr` / `de`：定义了 `verb` 和/或 `noun` 的 paradigm 模板。
- `ja` / `ja-cls`：**不使用 paradigm**，所有活用信息走 `inflections`（有 `group` 字段用于分组）。
- `en` / `zh-cls`：不使用 paradigm。

---

### 3. 锚点 id 命名

格式：`{lang}-{category}-{item}`

#### 示例

| 语言   | 锚点                     | 含义             |
| ------ | ------------------------ | ---------------- |
| la     | `la-noun-1st-decl`       | 第一变格法       |
| la     | `la-verb-1st-conj`       | 第一变位法       |
| la     | `la-pron-personal`       | 人称代词         |
| grc    | `grc-noun-1st-decl`      | 第一变格         |
| grc    | `grc-verb-pres-act-ind`  | 现在时主动陈述式 |
| he     | `he-noun-segolate`       | 元音变化名词     |
| he     | `he-verb-qal-perfect`    | Qal 完成式       |
| sa     | `sa-noun-a-stem-m`       | a 词干阳性       |
| sa     | `sa-verb-pres-act`       | 现在时主动       |
| mnc    | `mnc-letter-a-initial`   | 字母 a 词首形    |
| mnc    | `mnc-noun-genitive`      | 名词属格         |
| ja     | `ja-verb-godan`          | 五段动词活用     |
| ja     | `ja-adj-i`               | イ形容词活用     |
| ja-cls | `ja-cls-verb-yodan`      | 四段活用         |
| ja-cls | `ja-cls-kana-historical` | 历史假名遣       |
| zh-cls | `zh-cls-parts-of-speech` | 词类             |
| zh-cls | `zh-cls-function-words`  | 虚词             |
| fr     | `fr-verb-1st-group`      | 第一组动词       |
| de     | `de-noun-decl-strong`    | 强变化名词       |

生词表中 `inflectionType.grammarRef` 即写入上述 id。

### 关联

- Word 中 `inflectionType.grammarRef` 引用 `sections[].items[].id`。
- paradigm 中 `rows[].grammarRef` 引用同文件的 `sections[].items[].id`。
- 引用不存在的 id 时，UI 显示为普通文本。

---

### 4. 各语言语法覆盖范围

#### la 拉丁语

- 名词：五个变格法全表
- 形容词：第一二变格、第三变格
- 代词：人称、指示、关系、疑问
- 动词：四种变位法；现在/未完成/将来/完成/过去完成/将来完成；主动/被动；陈述/虚拟/命令；不定式、分词、动名词、动形词

#### grc 古希腊语

- 名词：三变格
- 冠词、形容词
- 代词：人称、指示、关系、疑问、不定
- 动词：现在/未来/未完成/不定过去/完成/过去完成；陈述/虚拟/祈愿/命令；主动/中动/被动；不定式、分词

#### he 圣经希伯来语

- 名词：性、数、附属形、代词后缀
- 形容词
- 代词：独立、后缀
- 动词：Qal / Nif'al / Pi'el / Pu'al / Hif'il / Hof'al / Hitpa'el；完成/未完成/命令/不定式/分词
- 弱根动词分类

#### sa 梵语

- 名词：a / ā / i / ī / u / ū / ṛ 词干，性数格
- 代词：人称、指示、关系、疑问
- 动词：现在系统（现在、未完成、命令、祈愿）、完成、不定过去、将来；主动/中动；不定式、分词、绝对分词

#### mnc 满语

- 字母：元音、辅音的词首/词中/词尾/独立四形
- 名词：格（主、属、与、宾、位、从、工具、协同等）
- 代词：人称、指示、疑问
- 动词：时、体、态、式

#### ja 现代日语

- 词类
- 动词：五段、一段、不规则；辞书形、ます形、て形、た形、ない形、可能、被动、使役、命令、意志、条件
- 形容词：イ、ナ
- 助词
- 敬语

#### ja-cls 古典日语

- 词类
- 动词：四段、上一段、下一段、上二段、下二段、カ变、サ变、ナ变、ラ变
- 活用形：未然、連用、終止、連体、已然、命令
- 形容词、形容动词
- 助动词
- 历史假名遣

#### zh-cls 古汉语

- 词类
- 常见虚词（之、其、而、以、于、为、者、也、所 等）
- 常见句式（判断句、被动句、倒装、省略）
- 词类活用（名词作动词、使动、意动）

#### en 现代英语

- 名词复数规则
- 代词
- 动词：时态、语态、语气；不规则动词表
- 形容词比较级

#### fr 法语

- 名词性与数
- 冠词
- 代词
- 动词：三组动词、常用时态、分词

#### de 德语

- 名词性数格
- 冠词、形容词变格
- 代词
- 动词：弱、强、混合变化；时态；分词

---

## 第三部分 · 检索规范

### 1. 检索范围

- **当前语言内**，不做跨语言检索。
- 命中字段：`lemma`、`meanings[].text`、`examples[].text`、`examples[].translation`、`collocations[].text`、`collocations[].gloss`。

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

## 第四部分 · 数据源

### 1. 手动编写

- 通过「添加生词」表单输入
- 支持导入/导出完整用户 JSON
- 支持批量导入生词 JSON（单对象 / 数组 / `{ words: [...] }`）
- 支持 AI 提示词下载，驱动模型按当前语言的 paradigm 模板生成结构化 JSON

### 2. Wiktionary 在线查询

实现位置：`assets/js/services/wiktionary-service.js`

- MediaWiki Action API（`action=query`）拉取 wikitext
- `action=parse` 拉取渲染后 HTML
- 解析内容：语言节、词性小节、释义、例句、例句译文与出处、变格/变位表
- 表单集成：添加生词页「从 Wiktionary 查询」按钮

**已知限制**

- 表格行列映射只覆盖常见情况，未命中的行走 `inflections`
- 古典日语与近现代日语共用 `Japanese` 节，暂未区分
- 无缓存
- 未处理速率限制

### 3. 外部数据源（待实现）

入口形式：**按钮**，不是输入框。每个按钮对应一个内置数据源，URL 由开发者在对应的 `services/*.js` 中写死并维护。

详见 `docs/TODO-IMPORT.md`。
