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
- [x] **grc：时态表拆分 / 双数 / 语法锚点**：`verb` 拆成 `{pres, impf, fut, aor, perf,
  plup, inf, ptcp}` 八张表（列为 `1sg…3pl`，保留双数；命令式行用 `disabled` 标出不存在的人称；
  六个主要部分标 `principal`）；`noun` / `adj` 改成九个 `{数}_{性}` 列（含双数）；
  新增 `pron`（有性 / 无性两张表）、`adj`（含比较等级）、`participle`（`extends: adj`）、
  `adv`；语法锚点补全 `inflect`；章节顺序按「代词 → 名词 → 形容词 → 副词 → 动词 →
  数词 → 冠词 → 元音缩合规则 → 重音规则 → 方言」重排。
- [x] **la / grc 的名词与形容词接 `derive`**：la 15 个变格类型（第一至第五变格、-er 两型、
  第三变格四种词干、第四变格中性、第五变格两型、第一二变格与第三变格形容词）、
  grc 16 个类型；`屈折词尾` / `示例` 两张表都由 `derive.endings` 生成，保证与生成结果一致。
- [x] **la 的动词 derive 补齐**：1 / 2 / 4 变位法改用 `stemForms` 推出完成时与目的分词词干
  （原先 `stems` 是 amō 的字面量，对别的动词会算错）；第三变位法因完成时词干是词汇性的，
  保留示例值并在 notes 说明。
- [x] **grc 的动词 derive 补齐**：缩合（-έω / -άω / -όω）、辅音词干、-μι 三类都补齐
  （共 6 个变位类型 × 8 张时态表，含 `expect` 自检）。
- [x] **多主要部分（stems）**：语法 JSON 的 `derive.parts` 声明各主要部分，Word 只存
  `stems: { base, perf, ppp, ... }`（导出 v1 → v2 自动迁移）；表单按 `parts` 渲染额外输入框，
  留空按规则从 `base` 推导、填了就覆盖；自检跑两遍（只填 base / 主要部分全填）。
- [x] **la 第三变格补洞**：animal / calcar 型中性、turris 型（宾格 -im、夺格 -ī）、
  三终止形容词（ācer）、一终止形容词（fēlīx），并修正 mare 型 notes。
- [x] **la 的代词补全**：加反身代词、物主代词、不定代词，章节顺序与 grc 对齐。
- [x] **la.json 修掉重复表**：7 个条目的「屈折词尾」表原先各重复 3 份，已各删掉 2 份。
- [ ] **优化各语言 paradigms 字段**：统一同一 `pos` 下 `tables[].key` /
  `columns[].key` / `rows[].key` 的命名风格，补齐 `title` 与 `grammarRef`；
  评估 `en` / `zh-cls` / `ja` / `ja-cls` 这些当前不使用 paradigm 的语言是否需要新增模板，
  并核对 `rows[].principal` 标记与生词表单的 principal parts 提取逻辑一致。
- [x] **按主要部分自动生成变格 / 变位表**：引擎完成
  （`assets/js/models/paradigm-generate.js`，自检入口是语言选择页的
  「校验语法数据（dev）」按钮，表单入口在「主要部分」右侧）。
  - [x] la：四种变位法写了 section 级 `derive`（自检 4/4 通过）。
  - [x] grc：名词 15 个变格类型 + 形容词 4 个类型 + **6 个变位类型**（元音词干、缩合 -έω/-άω/-όω、
    辅音词干、-μι），共 22 条 `derive`，每个变位类型 8 张时态表，全部带 `expect` 自检。
  - [ ] 其余语言按下述四步补：
  1. [ ] `endings` 纯拼接。**优先把词干取成能让词尾直接拼接的形式**（拉丁语第一变位法用
     `am` 而不是 `amā`），这样最省规则；`expect` 必须同步写，否则自检形同虚设。
  2. [ ] `stemForms` 处理多词干系统：拉丁语完成时 / 目的分词词干、德语复数 Umlaut。
  3. [ ] `formRules` 处理接合处音变：梵语连声、拉丁语长元音缩短。
  4. [x] **重音与声调**。`derive.post.accent` 已实现（音节切分 + 古希腊语退重音 /
     持续重音 + `penult` / `acute` 模式，见 SCHEMA 第二部分第 8 节），la / grc 已启用；
     梵语声调与拉丁语重音位置可复用同一层，尚未接入。
  5. [x] **音变规则串起主词干变体**：`stemForms` 支持 `{ from: 'perf', rules: [...] }`，
     先取另一个变体的词干再做一次音变（可链式、带环检测）。grc 用它把完成时中动/被动的词干
     挂到「完成时词干」上（`perfmid` = `perf` 去 κ 并缩短元音；辅音词干再按词干末辅音同化出
     μ / σ / τ / θ 四种形式），因此**只填主要部分 perf，完成时中动/被动那一列会跟着对**。
     la 不再有字面量 `stems`：1 / 2 / 4 变位法的完成时与目的分词词干由 `stemForms` 规则推出，
     3 变位法按「元音延长 + 塞音融合」给出规则型推导，不规则词用 `parts`（`perf` / `ppp`）覆盖。

## 4. 通用

- [ ] 导入前预览：新增 / 合并 / 跳过 三类计数
