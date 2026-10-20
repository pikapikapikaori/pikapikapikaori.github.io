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
  错漏的表格行与说明。同时检查 `section.id` / `item.id` 全局唯一、命名符合
  `{lang}-{category}-{item}`，并确认 Word 的 `inflectionType.grammarRef` 与 paradigm 的
  `rows[].grammarRef` 都能命中真实存在的锚点。
  - **已完成**：`la` / `grc` / `sa` / `he` / `fr`
  - 待做：`en` / `zh-cls` 仍有 `notes: "待补充"` 与空 `tables`；
    `ja` / `ja-cls` / `mnc` / `de` 待逐条核对
- [ ] **优化各语言 paradigms 字段**：统一同一 `pos` 下 `tables[].key` /
  `columns[].key` / `rows[].key` 的命名风格，补齐 `title` 与 `grammarRef`；
  核对 `rows[].principal` 标记与生词表单的 principal parts 提取逻辑一致。
  - **已完成**：`la` / `grc` / `sa` / `he` / `fr`
  - 待做：`en` / `zh-cls` / `ja` / `ja-cls` 评估是否需要新增模板；
    `mnc` / `de` 补齐 `title` / `grammarRef` / `principal`
- [ ] **其余语言接 `derive`**：引擎已完成（已接入的语言见上两条）；
  其余语言按下述四步补 `endings` + `expect`，每完成一类就跑一次自检。
  `fr` 已完成 22 条（12 个动词组 + 4 个名词复数 + 6 个形容词类型）。
  1. [ ] `endings` 纯拼接。**优先把词干取成能让词尾直接拼接的形式**（拉丁语第一变位法用
     `am` 而不是 `amā`），这样最省规则；`expect` 必须同步写，否则自检形同虚设。
  2. [ ] `stemForms` 处理多词干系统（德语复数 Umlaut 等）。已支持
     `{ from, rules }` 链式写法：先取另一个变体的词干，再做一次音变（可链式、带环检测），
     用于「只填一个主要部分，其余从它派生」。
  3. [ ] `formRules` 处理接合处音变。
  4. [x] **重音与声调**：`derive.post.accent` 已实现（音节切分 + 退重音 / 持续重音 /
     `penult` / `acute`，见 SCHEMA 第二部分第 8 节）；梵语声调与拉丁语重音位置可复用同一层。
- [x] **多主要部分（stems）**：语法 JSON 的 `derive.parts` 声明各主要部分，Word 只存
  `stems: { base, perf, ppp, ... }`（导出 v1 → v2 自动迁移）；表单按 `parts` 渲染额外输入框，
  留空按规则从 `base` 推导、填了就覆盖；自检跑两遍（只填 base / 主要部分全填）。
- [x] **骨架型 derive**（`mode: "skeleton"`）：适用于「词根 + 元音骨架」型语言。
  格子写骨架，`profile.realize(词根, 骨架)` 负责代入；`endings` / `expect` / `disabled` /
  `existing` 的行为与词尾拼接型一致。写法见 SCHEMA 第二部分 §7：
  - `_1` / `_2` / `_3` 显式指定第几个词根辅音（某辅音脱落时用，避免顺序错位）
  - `_~` 条件的 dagesh lene（该辅音属 בגדכפת 才补点）
  - 词尾形按位置自动归一（希伯来语 ן ם ף ך ץ ↔ נ מ פ כ צ 一类）
  - `he-noun` 另用 `variants` 按「基本形态的骨架」自动选元音模式
- [x] **derive 按语言拆文件**：语言专属后期处理放在 `data/paradigm/<lang>.js`
  （现有 `grc.js` 重音、`sa.js` 连声 + 吠陀重音、`he.js` 骨架 + מֶתֶג），
  通用引擎只保留机械流程，通过 `profile` 参数注入；
  加载入口 `grammar-service.loadParadigmProfile(lang)`，文档见 SCHEMA §7.1。
- [x] **Service Worker 缓存版本**：语法数据改动后要 bump `sw.js` 的 `CACHE` 名
  （现为 `v9`），否则浏览器会读到旧数据。

## 4. 通用

- [ ] 导入前预览：新增 / 合并 / 跳过 三类计数
