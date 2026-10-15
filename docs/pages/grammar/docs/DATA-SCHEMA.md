# 数据 Schema

所有持久数据存放在浏览器 **IndexedDB**（库名 `langnotebook`），
运行时通过 `assets/js/store/*` 访问；导出/导入使用下文的用户 JSON。

---

## 1. IndexedDB 对象存储

| Store     | 主键       | 索引                                                        |
|-----------|------------|-------------------------------------------------------------|
| `users`   | `id`       | `name`                                                      |
| `words`   | `id`       | `userId`、`[userId, language]`、`[userId, language, lemma, pos]`（unique） |
| `settings`| `userId`   | —                                                           |

`words` 的唯一索引强制约束：**同一用户、同一语言下，`lemma + pos` 完全一致即视为同一个词**。
比较时严格区分大小写、变音符号、长短音，不做任何归一化。

---

## 2. 用户导出 JSON（也是导入格式）

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
    "pageSize": 30,
    "reviewOrder": "mastery-asc",
    "defaultSource": "manual"
  },
  "words": [ /* Word[] */ ]
}
```

**约定**
- `version` 为整数，schema 变更时 +1，导入时做迁移。
- `kind` 固定为 `langnotebook-user`，导入时校验。
- 时间一律为 ISO 8601 字符串，UTC。
- `userId` 在导入时若与本地已有用户冲突，重新生成 id。

---

## 3. Word

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

  "inflections": [
    { "label": "1sg pres act ind", "form": "amō",  "source": "manual" },
    { "label": "2sg pres act ind", "form": "amās", "source": "wiktionary" }
  ],

  "meanings": [
    { "text": "爱，热爱",   "lang": "zh", "source": "manual" },
    { "text": "to love",    "lang": "en", "source": "wiktionary" }
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

**字段说明**

| 字段 | 说明 |
|---|---|
| `language` | 语言 code，见 `assets/js/data/languages.js` |
| `lemma` | 基本形态，原样保存，不做归一化 |
| `pos` | 词性，约定见下方 pos 表 |
| `inflectionType.grammarRef` | 指向语法 JSON 中的锚点 id；无对应语法时为 `null` |
| `inflections[].source` | 数据来源标记，用于多源并列显示 |
| `meanings[].lang` | `zh` / `en` |
| `derivatives` | 派生词 lemma 列表；仅当目标词已存在时渲染为可点击链接 |
| `encounterCount` | 每次添加时若命中唯一键则 +1 |
| `mastery` | 0–5，复习对 +1、错 −1，clamp 到区间 |
| `nextReviewAt` | 按 mastery 从间隔表 `[0,1,3,7,14,30]` 天取值 |
| `source` 取值 | `manual` \| `wiktionary` \| `url:<host>` \| 其它自定义字符串 |

**pos 约定**（可扩展）：`noun` `verb` `adj` `adv` `pron` `prep` `conj` `particle` `participle` `num` `interj` `other`。

---

## 4. 多源合并策略

同一条词（`userId + language + lemma + pos` 相同）：

- `meanings` / `inflections` / `collocations` / `examples` 均为**数组**，新来源的内容**追加**，不覆盖。
- 界面按 `source` 分标签显示，默认优先 `manual`。
- `encounterCount` +1。
- `updatedAt` 更新。

---

## 5. 检索

- 范围：**当前语言内**，命中 `lemma`、`meanings[].text`、`examples[].text`、`collocations[].text`。
- 不做跨语言检索。
- 大小写与变音符号敏感（与唯一键一致）。

---

## 6. 版本迁移

`assets/js/services/import-export-service.js` 中维护 `MIGRATIONS`：
`{ 1: fn, 2: fn, ... }`，逐级升级到当前 `CURRENT_VERSION`。
