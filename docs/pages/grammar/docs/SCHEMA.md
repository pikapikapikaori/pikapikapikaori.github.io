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

#### 字段说明

| 字段                        | 说明                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `language`                  | 语言 code，见 `assets/js/data/languages.js`                                                       |
| `lemma`                     | 基本形态，原样保存，不做归一化                                                                    |
| `pos`                       | 词性，约定见下                                                                                    |
| `inflectionType.label`      | 变格/变位类型显示名，词卡徽章                                                                     |
| `inflectionType.grammarRef` | 指向语法 JSON 的锚点 id；无对应语法时为 `null`（此时视为「特殊变格 / 变位」，用户自行填写 label） |
| `paradigm`                  | 表格化的变位/变格数据，稀疏存储，键为 `{tableKey: {rowKey: {colKey: value}}}`                     |
| `stems`                     | 主要部分 `{ 名称: 词干 }`；`base` 必填，其余（`perf` / `ppp` …）可缺省，缺省时按变位类型的规则从 `base` 推导 |
| `gender`                    | 语法性，**仅 `pos=noun` 有意义**；字符串数组，取值 `m` / `f` / `n`，可多选（common gender）        |
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
- **列 key 统一为 `{数}_{性}`**（`sg_m` / `pl_f` / `du_n`…）表示性数格；无性别维度时用 `{数}`（`sg` / `pl`）；
  动词用人称，**统一按「数优先」排列**：先单数、再双数（有的话）、后复数，组内按 1/2/3 人称：
  - 无双数：`1sg 2sg 3sg 1pl 2pl 3pl`
  - 有双数：`1sg 2sg 3sg 1du 2du 3du 1pl 2pl 3pl`

  非定式用单列 `form`。
- 找不到模板的语言（如 `en` / `zh-cls` / `ja` / `ja-cls`）不使用此字段，相关变位/活用全部走 `inflections`。

#### 主要部分（stems）

```json
"stems": { "base": "am", "perf": "amāv", "ppp": "amāt" }
```

- **词干**：一个词所有词形共有的不变部分，词尾一律追加在其后。
  - 拉丁语：`base: am` → `amō` / `amās` / `amāre`，`perf: amāv` → `amāvī`，`ppp: amāt` → `amātum`
  - 古希腊语：`base: λόγ` → `λόγος` / `λόγου` / `λόγῳ`
- `base` 是**必填**的基准词干（表单里的「主要部分」）；其余部分由变位 / 变格类型声明，
  在表单里按 `derive.parts` 渲染成额外的输入框，**可以留空**。
- **留空时按类型的规则从 `base` 推导**（如拉丁语第一变位法 `am → amāv / amāt`）；
  规则推不出来或该词不规则时，填上实际词干即可覆盖生成结果。
- 取词干顺序：**用户填的 `stems[名称]` → `derive.stems[名称]` → `derive.stemForms[名称]`（作用于 base）→ base**。
- **不写末尾的连字符**：数据里是 `am`、`λόγ`，只在界面显示时补成 `am-`、`λόγ-`。
- 与 `lemma`（基本形态）不同：`lemma` 是词典形式，词干是去掉词尾后的部分。
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
| `rows[].principal`   | 可选，为 `true` 时标记该行为该变位类型的代表性行（词典列出的主要形式）；与 Word 的 `stem` 不是同一概念 |

#### 覆盖范围

- `la` / `grc` / `he` / `sa` / `mnc` / `fr` / `de`：定义了 `verb` 和/或 `noun` 的 paradigm 模板。
- `la` 的 `noun` / `adj` 与 `grc` 一样按类型拆条目，并给出 `derive`（`la` 19 条、`grc` 22 条，均带 `expect` 自检）。
- `grc` 另有 `pron`（有性 / 无性两张表）、`adj`（变格 + 比较等级）、`participle`（`extends: "adj"`）、`adv`（比较等级）；
  `verb` 按 `{pres, impf, fut, aor, perf, plup, inf, ptcp}` 分表，列为 `1sg 2sg 3sg 1du 2du 3du 1pl 2pl 3pl`。
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

- 代词：人称、反身、物主、指示、关系、疑问、不定（章节顺序与 grc 一致）
- 名词：第一变格（-a，含阳性）、第二变格（-us / -er 掉 e / -er 保留 e / -um）、
  第三变格（辅音词干、i 词干、辅音词干中性、i 词干中性）、第四变格（-us / -ū）、
  第五变格（rēs 型 / diēs 型）
- 形容词：第一二变格、第三变格（二尾）
- 副词、比较等级：见形容词章
- 动词：四种变位法；现在/未完成/将来/完成/过去完成/将来完成；主动/被动；陈述/虚拟/命令；不定式、分词、动名词、动形词。
  1 / 2 / 4 变位法的完成时与目的分词词干由规则推出（`-āv-` / `-u-` / `-īv-`）；
  第三变位法的完成时词干是词汇性的（regō → rēxī），`stems` 只给示例值，换词需手工填

#### grc 古希腊语

章节顺序：代词 → 名词 → 形容词 → 副词 → 动词 → 数词 → 冠词 → 元音缩合规则 → 重音规则 → 方言。

- 代词：人称（含双数）、反身（只有斜格）、物主、指示、关系、疑问、不定
- 名词：第一变格（-ᾱ / -η 的词干重音与词尾重音型、阳性 -ης）、第二变格（-ος 两种重音、-ον 中性）、
  第三变格（塞音 / 齿音、流音 / 鼻音、-ος 中性、i 词干、-υς、-εύς）；表列按 `{数}_{性}` 九个列，含双数
- 形容词：第一二变格、第三变格（-εσ- 词干）、比较级与最高级、形容词构成副词
- 副词：比较等级、方位副词（位置 / 趋向 / 来源三式）、常见副词分类
- 动词：总论（时态与语态体系、六个主要部分、增音与重复、语气用法、异态动词）；
  变位类型四类——元音词干（-ω）、缩合（-έω / -άω / -όω）、辅音词干、-μι；
  时态 `{现在, 未完成, 将来, 不定过去, 完成, 过去完成}`，语气 `{陈述, 虚拟, 祈愿, 命令}`，
  语态 `{主动, 中动, 被动}`，另有不定式与分词（主格单数三性）
- 数词：基数词、数词变格（1–4）、序数词与数词副词
- 冠词：定冠词 ὁ, ἡ, τό（单 / 双 / 复）
- 元音缩合规则：α / ε / ο 与后续元音的缩合表 + 动词与名词举例
- 重音规则：三种记号与限制法、动词退重音与名词持续重音
- 方言与诗歌形式：方言概览、史诗（荷马）形式、伊奥尼亚与通用希腊语差异；
  **方言词按独立词条收录**，用派生词链接标准阿提卡形式

`derive` 覆盖：名词 14 个类型、形容词 2 个类型、元音词干变位（8 张时态表），全部带 `expect` 自检。

#### he 圣经希伯来语

- 章节顺序：代词 → 名词：元音模式 → 名词：形态类别 → 形容词 → 副词 → 动词总论 →
  九个词根类型（完整词根 / 喉音根 / I-א / I-י / I-נ / III-ה / III-א / 中空 / 叠音）→
  数词 → 马索拉符号 → 转写对照（共 18 节）
- **每个条目都是「元音（辅音）表 + 示例表」两张同构的表**，没有词尾表：
  格内写含词缀的完整骨架，`_` = 一个词根辅音（可带 dagesh 等附加点）；
  `data/paradigm/he.js` 的 `applySkeleton(root, 骨架)` 把骨架还原成词形，两张表逐格可互推
- 名词元音模式 18 项（קֵטֶל / קֹטֶל / קְטָל / קַטָּל / מִקְטָל / קִטּוּל / קָטוֹל / קְטָלָה /
  קַטְלָה / קִטְלָה / קַטֶּלֶת / קְטִילָה / הַקְטָלָה / הִתְקַטְּלוּת / קַטְלוּת / קְטֻלָּה /
  מִקְטָלָה / מַקְטֵל），开头一张判定总表；**不进语法锚点**（模式由基本形态的骨架判定）
- 名词语法锚点 11 项（通用 + 10 个词根 / 形态类别）；双数类 / 唯复数 / 不规则 / 阴阳同形
  保留为参考条目，词条请选「特殊变格」
- 形容词 8 项，全部可锚定；比较级 / 最高级只在正文说明（希伯来语无形态比较级）
- 动词：binyan 在「时态」层级 —— `paradigms.verb` = 7 个常用 binyan 表 + 不定式 + 分词（9 张），
  每张表行 = 完成式 / 连续完成式 / 未完成式 / 连续未完成式 / 祈愿式 / 劝勉式 / 命令式，
  列 = `1cs 2fs 2ms 3fs 3ms 1cp 2fp 2mp 3fp 3mp`（先单数后复数，同数内先阴后阳）
- 罕见 binyan 8 个（Poel / Poal / Hitpoel / Pilpel / Palpel / Hitpalpel / Nitpael / Štaphel）只写在
  `he-verb-strong` 正文，不进 paradigm 模板
- 「主要部分」= 三辅音词根（`כ-ת-ב`），由 grammar 文档的 `stems` 字段给出标签与占位提示；
  基本形态 = 名词单数绝对形 / 形容词 ms 绝对形 / 动词 3ms Qal 完成式
- 重音：`data/paradigm/he.js` 的 `accent()` 用 מֶתֶג（U+05BD）标重读音节，
  模式 `he-milra`（末音节）/ `he-milel`（倒数第二）

`derive` 覆盖：**骨架型 derive**（`mode: "skeleton"`）10 条 ——

| 规格 | 覆盖 | 自检 |
| --- | --- | --- |
| `he-verb-strong`（section 级） | 7 个 binyan × 7 式 × 10 身位 + 不定式 + 分词 = **428 格**，`post.accent: he-milra` | 428/428 |
| 八个弱根类型（各 1 条） | Qal 的完成式 / 未完成式 3ms、命令式 2ms、分词单数、不定式附属形 = 5 格 | 40/40 |
| `he-noun`（section 级，**按基本形态选变体**） | 19 个元音模式变体（18 个 מִשְׁקָל + 通用 קָטָל）× 绝对形 / 附属形 × 单 / 复 = 61 格 | 61/61 |

骨架↔示例的逐格一致性另外由 `spell(root, 骨架)` 校验。

未覆盖：弱根的其余 binyan 与弱根 Qal 的完整网格（见 `docs/TODO.md`：词尾形、槽位下标、
词中 dagesh lene 三个坑需要逐类核对）。

#### sa 梵语

- 章节顺序：**代词 → 名词 → 形容词 → 副词 → 动词 → 数词 → 连声 → 元音交替 → 天城文与转写**
- 格序：梵语传统 **体（主）→ 业（宾）→ 具（工具）→ 为（与）→ 从（离）→ 属 → 依（位）→ 呼**，
  标签写作「主格（体）」等，与传统名同字者（属格、呼格）不重复标
- 名词 15 类：a-m / a-n / ā-f / ī-f / ū-f / i-m / i-n / u-m / u-n / ṛ / -ant / -in / -as / -vas / 塞音词干
- 形容词 6 项：a-ā、i-u、ṛ、-ant、代词性形容词、比较级与最高级；**与名词分开写**（与古希腊语一致）
- 代词 7 项，末项为「代词变格总表」（tad- / yad- / kad- 三形并列）
- 动词：总论 1 节 + **现在系统按十类各一节**（每节 5 项：现在时 / 未完成 / 命令 / 祈愿 / 现在分词）
  + 将来·条件·祝愿 / 不定过去（7 类）/ 完成（含吠陀无重复型）/ 非定式 / 派生动词
- 梵语**没有独立的过去完成时**，`liṭ` 兼表完成与久远过去
- 语法表文字：3 列表用「天城文 (IAST)」，9 列表只用天城文；悉昙文见 `sa-script`
- 尚未实现：`derive`（含梵语连声与吠陀三重重音规则）

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

### 5. 新增一个语言的流程

以新增语言 code `xx` 为例，按以下顺序改动：

| 步骤 | 文件 | 改动内容 |
| ---- | ---- | -------- |
| 1 | `assets/js/data/languages.js` | 在 `LANGUAGES` 数组末尾追加一条元数据：`{ code: 'xx', name: '中文名', native: '本语言书写形式', classical, vertical, rtl }`。`code` 必须唯一。 |
| 2 | `data/grammar/xx.json` | 新建语法文件，文件名必须与 `code` 一致。`version`（整数）、`language`（同 `code`）、`name` 必填，`sections` 必填（可为空数组，但建议至少给出一个条目），`paradigms` 可选。锚点按 `xx-{category}-{item}` 命名且全局唯一。 |
| 3 | `assets/css/base.css` | 在语言字体区块加 `[lang="xx"] { font-family: "LN XX", var(--ff-content); }`；RTL 语言再补 `direction: rtl; unicode-bidi: isolate;`。 |
| 4 | `assets/css/fonts.css` | 若准备专用字体：把 `xx.woff2` 放到 `assets/resources/fonts/`，并新增/取消对应 `@font-face`（`font-family: "LN XX"`）。没有专用字体可跳过，自动回退到 `--ff-content`。 |
| 5 | `assets/js/services/wiktionary-service.js` | 需要 Wiktionary 在线查询时，在 `LANG_TO_WIKTIONARY` 增加 `'xx': '<英文 Wiktionary 的二级标题名>'`；该语言在 Wiktionary 没有词条时不要加，否则查询永远返回空。 |
| 6 | `data/paradigm/xx.js` | 可选。该语言的 derive 后期处理（重音 / 连声 / 词尾变音），见 §7.1。不需要就跳过，引擎会自动略过这两步。 |
| 7 | `docs/SCHEMA.md` | 更新第一部分第 3 节的语言元数据表格、第二部分第 4 小节「各语言语法覆盖范围」，以及第 3 小节（锚点 id 命名）的示例表。 |

补充说明：

- **分组**：`classical` 决定语言进入「古典语言」还是「现代语言」组，分组本身不可由用户跨组拖动。
- **竖排 / RTL**：`vertical: true` 会为带 `lang` 属性的内容启用竖排 popover；`rtl: true` 会为词条文本启用 RTL 方向，均无需额外代码。
- **词性**：`pos` 取值来自 `assets/js/models/word.js` 的全局 `POS_LIST`，不是按语言定义。新语言的 `paradigms` 只能使用这些 key；确有新词性需求时需同时改 `POS_LIST` 和本文档第 4 节。
- **语法文件加载**：`assets/js/services/grammar-service.js` 运行时按 `./data/grammar/{code}.json` 拉取，404 时该语言的「语法」页显示为空提示。`data/grammar/` 在 `sw.js` 中走 stale-while-revalidate，新增语言文件不需要改动 `sw.js`。
- **既有用户数据**：老用户的 `settings.languageOrder` 里没有新 code 时，语言选择页会按 `LANGUAGES` 原始顺序把它追加到所在组末尾，不需要数据迁移。

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
- 因此「时态构成」「分词与不定式」这类通用条目**不要**标 `inflect`，否则会混进下拉。
- 代词 / 数词没有具体变格类型，所以下拉里只有 特殊 + 不变。
- 词性徽章（词卡正面）点击跳转到 `${lang}-${pos}` 对应的语法 section，与 `inflect` 无关。

---

### 7. derive 字段（按主要部分生成变格 / 变位表）

挂在 `sections[].items[]` 上，描述「给定词干 → 生成该类型的表格」的规则。

- 生成逻辑：`assets/js/models/paradigm-generate.js`（通用引擎，不 import 任何模块）
- 语言专属后期处理：`data/paradigm/<lang>.js`（见 §7.1）
- 自检入口：语言选择页的「校验语法数据（dev）」按钮
- 入口：生词表单「主要部分」右侧的「生成表格」按钮；没有 `derive` 的类型按钮为禁用状态

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
| `mode`                          | 可选。`"skeleton"` = **骨架型**：格子写的是「元音（辅音）骨架」而不是词尾，由 `profile.realize(stem, 骨架)` 把主要部分代入；缺省是词尾拼接型 |
| `stemExample`                   | 自检用基准词干（即 `stems.base` 的例词），配 `expect` 使用                    |
| `parts`                         | 主要部分声明 `[{ key, label?, example?, hint?, required? }]`，第一项固定为 `base` |
| `expectParts`                   | 可选。主要部分全填时的期望值，缺省时用 `expect`                              |
| `endings[tableKey][rowKey][colKey]` | 词尾。字符串 = 只加词尾（可写成 `-a`）；对象 = `{ suffix, prefix, stemForm }` |
| `rowDefaults[tableKey][rowKey]` | 该行的 `prefix` / `suffix` / `stemForm` 默认值，被格级声明覆盖               |
| `stems[名称]`                   | 直接给出词干变体（无法用规则表达时用，如 la `reg → rēx`）                    |
| `stemForms[名称]`               | 词干变体规则：`[{ pattern, replace, flags? }]`（作用于 `base`），或 `{ from, rules }`（先取另一个变体的词干，再套规则，可链式，见下） |
| `formRules`                     | 拼接后作用于整词的规则 `[{ pattern, replace, flags? }]`，按顺序执行           |
| `stemOnly`                      | 格级布尔值。整格就是词干本身（如呼格单数与主格同形），不拼接任何词尾        |
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

#### 骨架型 derive（`mode: "skeleton"`）

适用于**词根 + 元音骨架**型语言（目前是圣经希伯来语）：词干不是「加词尾的基础形」，
而是三辅音词根，每个格子给出的是完整骨架，`_` 表示一个词根辅音（占位后可带 dagesh 等附加点）。

```jsonc
{
  "mode": "skeleton",
  "stemExample": "קטל",                     // 词根，不是词干
  "parts": [{ "key": "base", "label": "词根（辅音）", "example": "קטל", "required": true }],
  "post": { "accent": "he-milra" },
  "endings": { "qal": { "perf": { "3ms": "_ָ_ַ_", "3fs": "_ָ_ְ_ָה" } } },
  "expect":  { "qal": { "perf": { "3ms": "קָטַל", "3fs": "קָטְלָה" } } }
}
```

- 代入由语言档案完成：`profile.realize(词根, 骨架)`（`he.js` 会先补词首的 dagesh lene，再按需落重音）。
- `endings` / `expect` 的结构、`disabled` 跳过、`existing` 不覆盖等行为与词尾拼接型完全一致。
- 校验器会拒绝除 `"skeleton"` 以外的 `mode` 值。

**骨架的写法**（`data/paradigm/he.js` 的 `applySkeleton` / `toSkeleton`）：

| 记号 | 含义 |
| --- | --- |
| `_` | 依次取下一个词根辅音 |
| `_1` `_2` `_3` | 显式取第 n 个词根辅音 —— 词根辅音脱落时用（I-נ 同化、中空词根丢中辅音、III-ה 丢词尾 ה） |
| 其他字符 | 原样保留（词缀、元音点、dagesh 等） |

例：`_ָ_ַ_` + 词根 קטל → קָטַל；`יִ_2ֹּ_` + 词根 נפל → יִפֹּל（第 1 个辅音 נ 被同化，所以第 2 个用 `_2`）。

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
- 锚点本身没有 `derive` 时，表单会退回该词性的总规则（`${lang}-${pos}` 这一节），
  所以希伯来语名词的这条规格挂在 `he-noun` 上就够，不必在 11 个形态类别里重复。

约束：

- 规则的 `pattern` **必须锚定**（以 `^` 开头或以 `$` 结尾），否则一次替换就能写坏整张表；校验器会直接报错。
- `endings` / `rowDefaults` / `expect` 里的 key 必须能在 `paradigms[pos]` 中找到，列 key 也要对得上。
- 生成的格**只填空格**，词条里已有内容（含用户手改）永不覆盖。
- 没有 `derive` 的类型不参与生成，仍可手工填表。
- `derive` **可以挂在 section 上**：一个变位法的规则天然覆盖它全部时态表，
  于是 `endings` 按 `{pres, impf, fut, perf, plup, futp, inf, ptcp, gerund, supine}` 分块，
  用 `rowDefaults` 声明各行默认使用哪个词干变体（完成系统各表用 `perf`，分词 / 目的动名词用 `ppp`）。
- **分词表按词尾类型拆表**：多词尾（三尾 / 二尾）的分词用 `m` / `f` / `n` 三列，
  单词尾（一尾，如拉丁语 `amāns`）的分词用单列 `form`。拉丁语因此有 `ptcp`（三尾/二尾）
  与 `ptcp1`（一尾）两张表，语法条目对应给 4 张表（两张词尾 + 两张示例）。
- 语法里每个变格 / 变位条目都要给**两张表**：
  1. `caption: "屈折词尾"` —— 只列词尾（`-ō` / `-ās`…）
  2. `caption: "示例：amō, amāre, amāvī, amātum"` —— 完整词形

  两张表行列一一对应，`derive.endings` 应与第一张表一致。

### 7.1 语言档案（`data/paradigm/<lang>.js`）

通用引擎只负责「词干 + 词尾 → 拼起来 → 套正则」这套机械流程。
凡是需要语言学知识的后期处理（音节、重音、连声），一律放到该语言自己的档案文件里，
由引擎在生成每一格时调用；没有档案文件的语言（如拉丁语）自动跳过这两步。

档案是一个普通 ES 模块，可导出：

| 导出            | 类型                        | 作用                                             |
| --------------- | --------------------------- | ------------------------------------------------ |
| `accentModes`   | `string[]`                  | 该语言允许的 `post.accent` 取值；校验器据此报错   |
| `accent(text, mode, options)` | `function`     | 拼好之后按模式指派重音；`options.endingAccented` 表示该格词尾自带重音 |
| `sandhi`        | `{ join, wordFinal }`       | `join(左段, 右段)` 做接合处连声；`wordFinal(整词)` 做词尾停顿式 |

- 加载：`services/grammar-service.js` 的 `loadParadigmProfile(lang)`（动态 `import()`，结果缓存，缺失时返回 `null`）。
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

## 第三部分 · 检索规范

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

## 第四部分 · 数据源

### 1. 手动编写

- 通过「添加生词」表单输入
- 支持导入/导出完整用户 JSON
- 支持批量导入生词 JSON（单对象 / 数组 / `{ words: [...] }`）
- 支持 AI 提示词下载，驱动模型按当前语言的 paradigm 模板生成结构化 JSON
- **派生词只能从词库中选择**（外键语义）：用 `head` 范围搜索当前语言的词条，
  选不中的词会提示「未找到，请先添加该词」，不提供自由文本输入

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

详见 `docs/TODO.md`。

---

### 4. 开发专用目录（`assets/dev/`）

**整个 `assets/dev/` 都不提交、也不随站点发布**：

- `.gitignore` → `docs/pages/grammar/assets/dev/`
- `.github/workflows/cloudflare-r2.yml` → rclone `--exclude "pages/grammar/assets/dev/**"`

因此**它里面不能放应用运行时必须存在的文件**：app 代码里禁止静态 import，只能用
`isDevHost()` 判断后 `import()` 动态加载，这样生产环境根本不会发请求，干净 clone 也不会报错。

| 文件                          | 用途                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `data/{lang}.json`            | 开发测试词，`{ "words": [...] }`，每个语言一个名词 + 一个动词，字段完整 |
| `js/fixtures.js`              | 导入生词模态框里的「载入测试词（dev）」按钮                            |
| `js/verify-ui.js`             | 语言选择页的「校验语法数据（dev）」按钮 + 结果对话框                    |

- 界面上的两个 dev 按钮只在 localhost 出现，且各自通过动态 import 挂载。
- 「校验语法数据」跑的是 `assets/js/models/paradigm-generate.js` 里的 `verifyGrammarDocs`，
  与命令行版共用同一套引擎。
- 语法 / 元数据每改一次，应同步更新对应语言的测试词。
- **配套的 SW 环境切换代码不在这里**：`assets/js/main.js` 的 `setupServiceWorker()` +
  `assets/js/utils/env.js` 的 `isDevHost()`。它必须被生产环境加载，不能依赖 dev 目录。
