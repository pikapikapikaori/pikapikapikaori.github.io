# 待办事项

数据源标记统一使用 `source` 字段：
`manual` | `wiktionary` | `url:<host>` | 其它自定义字符串。

---

## 1. 外部数据源导入

入口形式：**按钮**，每个按钮对应一个内置数据源，
URL 由开发者在对应的 `services/*.js` 中写死并维护。用户点击即触发查询，
无需也无法自行填写地址。

- [ ] 每个数据源实现为一个独立的 service 模块（如 `dictionaryapi-service.js`）
- [ ] 每个 service 暴露统一接口：`lookup(lemma, langCode) → Word[] | null`
- [ ] 按钮集中管理：新增数据源时只需注册一个 `{ id, label, service }`
- [ ] 冲突策略同 Wiktionary（按唯一键合并、追加来源内容）
- [ ] 失败重试与超时
- [ ] 限流 / 429 退避

### 可用的外部数据源

**词典类**

| 数据源 | 语言支持 | 密钥 | CORS | 备注 |
|---|---|---|---|---|
| [dictionaryapi.dev](https://dictionaryapi.dev) | 多语言（英语为主，部分其他语言） | 无 | 不支持 | 纯前端直接请求会被 CORS 拦截，需要代理；英语覆盖最全 |
| [freedictionaryapi](https://github.com/ngocsangyem/freedictionaryapi) | 基于 Wiktionary 开源 | 无 | 未知 | 70 万+ 词条，需自查 CORS 支持 |
| [Glosbe API](https://glosbe.com/a-api) | 几乎所有活语言 | 无 | 支持 JSONP | 免费但有限流，返回 JSON/JSONP/XML |

**翻译类**（可用于补充中文释义）

| 数据源 | 语言支持 | 密钥 | CORS | 备注 |
|---|---|---|---|---|
| [MyMemory](https://mymemory.translated.net) | 多语言 | 无 | 支持 | 匿名每天 5,000 字符，浏览器可直接调用 |
| [Lingva Translate](https://lingva.ml) | 100+ 语言 | 无 | 支持 | Google Translate 的开源前端，可自部署 |
| [LibreTranslate](https://libretranslate.com) | 多语言 | 可选 | 支持 | 可自部署，社区实例免费 |

**古籍 / 专业文献类**

| 数据源 | 语言支持 | 密钥 | CORS | 备注 |
|---|---|---|---|---|
| [Perseus Digital Library](https://www.perseus.tufts.edu) | 古希腊语、拉丁语 | 无 | 未知 | 提供词形分析（Perseus Hopper），非 JSON API |
| [CLTK](https://cltk.org) | 拉丁语、古希腊语、梵语等 | 无 | N/A | Python 库，需本地运行，非 HTTP API |

**整合建议**

- 中文释义补充：MyMemory 或 Lingva
- 古籍词形分析：Perseus Hopper（需调研接口格式）
- 不可用的数据源（CORS 不支持）需要一个本地 CORS 代理或直接放弃

## 2. Wiktionary 在线查询的后续扩展

当前实现位于 `assets/js/services/wiktionary-service.js`。

- [ ] 表格行列映射扩展（尤其 la / grc / sa / he 的长尾标签）
- [ ] 查询结果缓存（IndexedDB，按 `[lang, lemma]` 存储 wikitext / HTML）
- [ ] 请求节流 / 429 退避重试
- [ ] 多语言词条同页时提供选择 UI（当前自动取首个匹配词性）
- [ ] 处理 `{{la-noun}}` / `{{la-verb}}` 等模板参数，提取主要部分
- [ ] 从 `action=parse` 的 heading 层级切分，取代当前 wikitext 正则的粗糙节切
- [ ] 古典日语与近现代日语区分（当前共用 `Japanese` 节）
- [ ] 接入 Wiktionary REST API（`/api/rest_v1/page/definition/{term}`），替代当前的 wikitext 解析

## 3. 语法数据（`data/grammar/`）

针对 `data/grammar/*.json` 的静态语法数据，与导入功能无关，但同属数据待办。
编写规范见 `docs/SCHEMA.md` 第二部分。

- [ ] **核对各语言语法点**：逐语言把 `sections` / `items` 与实际语法体系、以及
  `SCHEMA.md` 第二部分第 4 节的覆盖清单对照一遍，补齐缺失语法点，修正错误分类、
  错漏的表格行与说明。目前 `en` / `zh-cls` 等仍有 `notes: "待补充"` 与空 `tables`。
  同时检查 `section.id` / `item.id` 全局唯一、命名符合 `{lang}-{category}-{item}`，
  并确认 Word 的 `inflectionType.grammarRef` 与 paradigm 的 `rows[].grammarRef`
  都能命中真实存在的锚点。
- [ ] **优化各语言 paradigms 字段**：统一同一 `pos` 下 `tables[].key` /
  `columns[].key` / `rows[].key` 的命名风格，补齐 `title` 与 `grammarRef`；
  评估 `en` / `zh-cls` / `ja` / `ja-cls` 这些当前不使用 paradigm 的语言是否需要新增模板，
  并核对 `rows[].principal` 标记与生词表单的 principal parts 提取逻辑一致。
- [x] **按主要部分自动生成变格 / 变位表**：引擎完成
  （`assets/js/models/paradigm-generate.js`，自检入口是语言选择页的
  「校验语法数据（dev）」按钮，表单入口在「主要部分」右侧）。
  la 已按四种变位法写了 section 级 `derive`（自检 4/4 通过），其余语言按下述四步补：
  1. [ ] `endings` 纯拼接。**优先把词干取成能让词尾直接拼接的形式**（拉丁语第一变位法用
     `am` 而不是 `amā`），这样最省规则；`expect` 必须同步写，否则自检形同虚设。
  2. [ ] `stemForms` 处理多词干系统：拉丁语完成时 / 目的分词词干、希腊语将来时 /
     不定过去 / 完成时词干、德语复数 Umlaut。
  3. [ ] `formRules` 处理接合处音变：希腊语缩合动词（`τιμάω → τιμῶ`）、梵语连声、
     拉丁语长元音缩短。
  4. [ ] **重音与声调**。当前策略是「重音先写进不变的那一侧」：名词写进词干
     （`λόγ` + `-ος`）或词尾（`τιμ` + `-ή`），动词靠退重音天然落在词干上
     （`λύ` + `-ω`），增音把重音写在前缀（`ἔ` + `λυ`）。
     只有在同一位置反复漂移、怎么写都要堆 `stemForms` 时，才实现 `derive.post`
     做单词级后处理（需要音节切分 + 位置规则，成本明显更高，放到最后）。
     涉及希腊语（动词退重音 / 名词持续重音）与梵语。

## 4. 通用

- [ ] 导入前预览：新增 / 合并 / 跳过 三类计数
