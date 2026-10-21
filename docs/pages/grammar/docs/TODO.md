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
- [ ] 接入 Wiktionary REST API（`/api/rest_v1/page/definition/{term}`），替代当前的 wikitext 解析

## 3. 语法数据（`data/grammar/`）

针对 `data/grammar/*.json` 的静态语法数据，与导入功能无关，但同属数据待办。
编写规范、新增语言的流程与「每加一种语言都要过一遍的坑」见 `docs/SCHEMA.md` 第二部分
（§5 与 §5.1）；接入 derive 的四步见 §7、§8。

- [ ] **核对各语言语法点**：逐语言把 `sections` / `items` 与实际语法体系、以及
  SCHEMA 第 4 节的覆盖清单对照一遍，补齐缺失语法点，修正错误分类与错漏的表格行/说明。
  - 已完成：`la` / `grc` / `sa` / `he` / `fr` / `de` / `mnc` / `ja`
  - 待做：`en` / `zh-cls`（仍 `notes: "待补充"`、`tables` 为空）
- [ ] **优化各语言 paradigms 字段**：统一 `tables[].key` / `columns[].key` / `rows[].key`
  的命名风格，补齐 `title` 与 `grammarRef`，核对 `rows[].principal` 与表单的主要部分逻辑一致。
  - 已完成：`la` / `grc` / `sa` / `he` / `fr` / `de` / `mnc` / `ja`
  - 待做：`en` / `zh-cls` 评估是否需要新增模板
- [ ] **其余语言接 `derive`**：四种接入方式（`endings` / `stemForms` / `formRules` /
  `post.accent`）均已实现，接入步骤与注意事项见 SCHEMA §5.1、§7、§8。
  - 已完成：`la` / `grc` / `sa` / `he`（骨架型）/ `fr` / `de` / `mnc`（词尾占位 `V` + 元音和谐）/ `ja`（辞书形 + 音便正则）
  - 待做：`en` / `zh-cls`
  - [ ] `formRules`：处理器已实现，但还没有语言用到（接合处音变可用它）

## 4. 通用

- [ ] 导入前预览：新增 / 合并 / 跳过 三类计数
