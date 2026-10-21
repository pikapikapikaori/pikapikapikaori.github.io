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

8 种语言的 `sections`、`paradigms`、`derive` 均已就位
（`la` / `grc` / `sa` / `he` / `fr` / `de` / `mnc` / `ja`）。
`en` / `zh-cls` 关闭了 `grammar` 与 `paradigm` 两个开关，`sections` 为空数组、没有 `paradigms`
与 derive，表单只留基本形态、词性、含义、补充形式、固定搭配、例句、派生词、标签备注。
编写规范见 `docs/SCHEMA.md`；校验方式见 SCHEMA §4（命令行）。

- [ ] `formRules`：处理器已实现，但还没有语言用到（接合处音变可用它）

### 已知数据缺口

- [ ] **`mnc` 动词锚点取不到 derive**：`derive` 挂在章节 `mnc-verb` 上，而可选锚点是
  `mnc-verb-harmony-back/front/round` 三个独立章节，`getDeriveSpec()` 因此返回 null，
  表单里点「生成」没有反应。修法二选一：把 `derive` 复制到三个和谐章节，或在
  `grammar.js` 里给锚点加显式 `deriveRef` 指向 `mnc-verb`。
- [ ] **`he` 名词锚点取不到 derive**：`derive`（骨架型 + variants）挂在章节 `he-noun` 上，
  锚点却在 `he-noun-class` 的 `he-class-*` 条目上，同样 `getDeriveSpec()` 返回 null。
  修法同上。
- [ ] **`he` 形容词没有 derive**：`he-adj-*` 锚点无 `derive`，形容词表只能手填。
- [ ] **`de` 名词没有语法性字段**：`de-noun*` 模板的列名是 `m_sg` / `f_sg` / `n_sg`（前缀式），
  而 `fieldDefsOfTemplate()` 的语法性回退只认 `_m` / `_f` / `_n` 后缀，且 `de.json` 没有
  显式 `fields`。补一个 `fields` 声明即可（`declensionColumns` + `columns` 前缀匹配）。
- [ ] **`he` 名词没有语法性字段**：列名是 `sg` / `du` / `pl`，同理需要显式 `fields`。
- [ ] 从 Wiktionary 导入时提取主要部分后，回填 `stems` 并复用 `derive` 自动出表。

## 4. 通用

- [ ] 导入前预览：新增 / 合并 / 跳过 三类计数
