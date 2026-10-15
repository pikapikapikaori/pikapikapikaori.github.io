# 语法数据编写规范

语法数据为**只读**，由静态 JSON 提供，前端不提供任何修改入口。
路径：`/data/grammar/{lang}.json`。

---

## 1. 文件结构

```json
{
  "version": 1,
  "language": "la",
  "name": "拉丁语",
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
                ["属格", "aquae", "aquārum"],
                ["与格", "aquae", "aquīs"],
                ["宾格", "aquam", "aquās"],
                ["夺格", "aquā", "aquīs"],
                ["呼格", "aqua", "aquae"]
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

**约束**
- 顶层 `version` 为整数。
- `language` 必须与 `assets/js/data/languages.js` 中的 code 一致。
- 每个 `section` / `item` 都必须有全局唯一的 `id`，用作锚点。
- `item.tables` 可为空数组；`item.notes` 可选。
- 表格内单元格为字符串，可含 HTML 实体但不解析 HTML 标签。
- 表格行中若标注语言，可加 `"lang": "la"` 到对应 table 对象，用于选中专用字体。

---

## 2. 锚点 id 命名

格式：`{lang}-{category}-{item}`

**示例**

| 语言 | 锚点 | 含义 |
|---|---|---|
| la | `la-noun-1st-decl` | 第一变格法 |
| la | `la-verb-1st-conj` | 第一变位法 |
| la | `la-pron-personal` | 人称代词 |
| grc | `grc-noun-1st-decl` | 第一变格 |
| grc | `grc-verb-pres-act-ind` | 现在时主动陈述式 |
| he | `he-noun-segolate` | 元音变化名词 |
| he | `he-verb-qal-perfect` | Qal 完成式 |
| sa | `sa-noun-a-stem-m` | a 词干阳性 |
| sa | `sa-verb-pres-act` | 现在时主动 |
| mnc | `mnc-letter-a-initial` | 字母 a 词首形 |
| mnc | `mnc-noun-genitive` | 名词属格 |
| ja | `ja-verb-godan` | 五段动词活用 |
| ja | `ja-adj-i` | イ形容词活用 |
| ja-cls | `ja-cls-verb-yodan` | 四段活用 |
| ja-cls | `ja-cls-kana-historical` | 历史假名遣 |
| zh-cls | `zh-cls-parts-of-speech` | 词类 |
| zh-cls | `zh-cls-function-words` | 虚词 |
| en | `en-verb-irregular` | 不规则动词 |
| fr | `fr-verb-1st-group` | 第一组动词 |
| de | `de-noun-decl-strong` | 强变化名词 |

生词表中 `inflectionType.grammarRef` 即写入上述 id。

---

## 3. 各语言语法覆盖范围

### la 拉丁语
- 名词：五个变格法全表
- 形容词：第一二变格、第三变格
- 代词：人称、指示、关系、疑问
- 动词：四种变位法；现在/未完成/将来/完成/过去完成/将来完成；主动/被动；陈述/虚拟/命令；不定式、分词、动名词、动形词

### grc 古希腊语
- 名词：三变格
- 冠词、形容词
- 代词：人称、指示、关系、疑问、不定
- 动词：现在/未来/未完成/不定过去/完成/过去完成；陈述/虚拟/祈愿/命令；主动/中动/被动；不定式、分词

### he 圣经希伯来语
- 名词：性、数、附属形、代词后缀
- 形容词
- 代词：独立、后缀
- 动词：Qal / Nif'al / Pi'el / Pu'al / Hif'il / Hof'al / Hitpa'el；完成/未完成/命令/不定式/分词
- 弱根动词分类

### sa 梵语
- 名词：a / ā / i / ī / u / ū / ṛ 词干，性数格
- 代词：人称、指示、关系、疑问
- 动词：现在系统（现在、未完成、命令、祈愿）、完成、不定过去、将来；主动/中动；不定式、分词、绝对分词

### mnc 满语
- 字母：元音、辅音的词首/词中/词尾/独立四形
- 名词：格（主、属、与、宾、位、从、工具、协同等）
- 代词：人称、指示、疑问
- 动词：时、体、态、式

### ja 现代日语
- 词类
- 动词：五段、一段、不规则；辞书形、ます形、て形、た形、ない形、可能、被动、使役、命令、意志、条件
- 形容词：イ、ナ
- 助词
- 敬语

### ja-cls 古典日语
- 词类
- 动词：四段、上一段、下一段、上二段、下二段、カ变、サ变、ナ变、ラ变
- 活用形：未然、連用、終止、連体、已然、命令
- 形容词、形容动词
- 助动词
- 历史假名遣

### zh-cls 古汉语
- 词类
- 常见虚词（之、其、而、以、于、为、者、也、所 等）
- 常见句式（判断句、被动句、倒装、省略）
- 词类活用（名词作动词、使动、意动）

### en 现代英语
- 名词复数规则
- 代词
- 动词：时态、语态、语气；不规则动词表
- 形容词比较级

### fr 法语
- 名词性与数
- 冠词
- 代词
- 动词：三组动词、常用时态、分词

### de 德语
- 名词性数格
- 冠词、形容词变格
- 代词
- 动词：弱、强、混合变化；时态；分词

---

## 4. 生词引用约定

生词中的 `inflectionType.grammarRef` **必须**引用上表中存在的锚点 id；
若暂未编写对应语法，`grammarRef` 置 `null`，界面显示为普通文本。
