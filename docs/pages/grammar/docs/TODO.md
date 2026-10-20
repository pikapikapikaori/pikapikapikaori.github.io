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
  三尾形容词（ācer）、一尾形容词（fēlīx），并修正 mare 型 notes。
- [x] **la 的代词补全**：加反身代词、物主代词、不定代词，章节顺序与 grc 对齐。
- [x] **la.json 修掉重复表**：7 个条目的「屈折词尾」表原先各重复 3 份，已各删掉 2 份。
- [x] **梵语（sa）语法数据**：paradigms + 24 个 section / 122 条目（非动词 + 动词十类 + 其余系统）
- [x] **梵语引擎连声/重音**：`post.sandhi`（`sa` / `sa-word`）与 `post.accent`（`sa` / `sa-vedic`）
- [x] **梵语 derive 铺开**：15 类名词 + 4 类形容词 + **10 类动词全部**（第二、七类用多词干 `stems` + 格级 `stemForm` 表达连声/强弱的变体）
- [x] **悉昙文对照**：辅音（独立 / 合写上 / 合写下）、**特殊合写（连字）15 条**（क्ष / ज्ञ / त्र / श्र 等）、
  元音（独立 / 附标 / **备注**，标注 ḷ / ḹ 吠陀专用）、符号（含 ॐ）；
  注：Unicode 的悉昙区块无独立上标/下标与连字码位，一律靠 virama 拼接，当前字体不做叠合
- [x] **Service Worker 缓存版本**：语法数据改动后需 bump `sw.js` 的 `CACHE` 名（现为 v7），否则读到旧数据
- [x] **derive 按语言拆文件**：语言专属后期处理从 `models/paradigm-generate.js` 拆到 `data/paradigm/<lang>.js`
  （现为 `grc.js` 重音、`sa.js` 连声 + 吠陀重音），通用引擎只保留机械流程，通过 `profile` 参数注入；
  加载入口 `grammar-service.loadParadigmProfile(lang)`，文档见 SCHEMA §7.1。
  拆分后自检结果与拆分前一致：la 23/27、grc 22/28、sa 29/39，错误 0
- [x] **希伯来语（he）重写**：18 节 / 85 条目 / 178 张表
  - 章节：代词 → 名词：元音模式（判定总表 + 18 项）→ 名词：形态类别（锚定 11 + 参考 4）→
    形容词（8）→ 副词 → 动词总论 → 九个词根类型 → 数词 → 马索拉符号（4 张表）→ 转写对照
  - 表结构：**全部「元音（辅音）表 + 示例表」同构**，无词尾表；骨架 `_` = 词根辅音，
    `applySkeleton()` 逐格可还原（467 + 91 格全部校验通过）
  - `paradigms`：noun 1 张、adj 1 张、verb 9 张（7 binyan + 不定式 + 分词）、pron 5 张
  - `data/paradigm/he.js`：`applySkeleton` / `countSlots` / `accent`（מֶתֶג）/ `stripAccent` / `realize`
  - 主词条字段：主要部分 = 三辅音词根（grammar 文档 `stems` 提供标签与提示），
    基本形态 = 名词单数绝对形 / 形容词 ms 绝对形 / 动词 3ms Qal 完成式
- [x] **骨架型 derive**（`mode: "skeleton"`）：引擎支持「词根 + 元音骨架」代入，
  由语言档案的 `profile.realize(词根, 骨架)` 完成；`endings` / `expect` / `disabled` /
  `existing` 的行为与词尾拼接型一致。见 SCHEMA 第二部分 §7
  - `he-verb-strong`：一条 section 级 derive 覆盖 7 binyan + 不定式 + 分词 **428 格**
    （自检 428/428，含 מֶתֶג 重音）
  - 八个弱根类型各一条：自动生成 Qal 的 5 个基本形式
  - `he.js` 新增 `dageshLene`（词首 בגדכפת 补 דָּגֵשׁ קַל）与 `spell()`（只出词形不标重音）
- [x] **名词 derive（按基本形态判定元音模式）**：`he-noun` 一条 section 级规格 + 19 个变体
  （18 个 מִשְׁקָל + 通用 קָטָל），引擎用 `toSkeleton(基本形态, 词根)` 求骨架后与 `variants[].match` 比对；
  比对忽略 dagesh。实测 `דָּבָר` → `דְּבָרִים / דְּבַר / דִּבְרֵי`，换成 `סֵפֶר` 自动切到 segolate 变体。
- [x] **骨架下标占位**：`_1` / `_2` / `_3` 显式指定第几个词根辅音，供词根辅音脱落的形式使用；
  `toSkeleton()` 在跳过辅音时自动改用下标。
- [ ] **希伯来语 derive 剩余部分**（弱根的其余 binyan + 弱根 Qal 完整网格）。
  试跑生成器时校出四类系统性错误，**没有入库**，按下面的顺序逐项解决后再铺数据。
  建议**按词根类型逐个做、每次人工核对后再提交**，不要一次性生成。

  #### E1. 词尾形归一（先做，纯位置规则、无反例）
  词根的 ן ם ף ך ץ 只用于词尾；出现在**词中**要换成 נ מ פ כ צ。
  - 例：词根 קום + Qal 完成式 1cs → `קַמְתִּי`，现在是 `קַםְתִּי`
  - 做法：`data/paradigm/he.js` 的 `applySkeleton()` 代入后按位置归一
    （不是词末字符的 ן ם ף ך ץ → נ מ פ כ צ），再交给 `dageshLene()`
  - 库：`ך→כ ם→מ ן→נ ף→פ ץ→צ`；只处理词根代入出来的字符即可，骨架里的字面字符照抄

  #### E2. 槽位数 / 下标占位（已具备工具，数据待写）
  词根辅音脱落的形式只能用 `_1` / `_2` / `_3` 写，顺序 `_` 会错位：
  - III-ה：完成式 2ms/2fs/2mp/2fp/1cs/1cp、未完成式、命令式都丢词尾 ה（剩 2 个槽）
  - I-נ：未完成式 / 命令式 / 连续未完成式丢词首 נ（同化进第 2 个辅音的 dagesh）
  - 中空：丢掉中辅音，第 3 个辅音用 `_3`；mater 用字面 ו（ע"י 类如 שׂים 要手改）
  - 叠音：第 2、3 辅音同形，通常只写一个 + dagesh

  #### E3. 词中 dagesh lene（语言学问题，需逐类处理）
  `שְׁוָא נָח` 之后的 בגדכפת 是否带 דָּגֵשׁ קַל 不是纯位置规则：
  | 词形 | 该字母 | 有点吗 |
  | --- | --- | --- |
  | יִכְתְּבוּ | ת | 有 |
  | כִּתְבוּ | ב | 没有 |
  | כָּתְבָה | ב | 没有 |
  | שָׁפְטָה | פ | 没有 |
  → 需要按「词根类型 + binyan + 式」单独决定；必要时在骨架里直接写死 `_` + דָּגֶשׁ (U+05BC)。
  目前 `dageshLene()` 只处理**词首**（已覆盖词缀 `תִּ` `כְּ` `בְּ` 与词首词根辅音，如 כָּתַב）。

  #### E4. 喉音根要分亚类
  「喉音根」不是均质类：II-ח / II-ע / II-ר / III-ח / III-ע 的补偿元音不同
  （如 Piel 的不定式、Hitpael 的附属形），一类一表可能需要拆成 2–3 个锚点。

  #### E5. 数据铺开顺序
  1. `he-verb-iii-he`（最系统、课本最常用）→ 7 binyan × 7 式 × 10 身位
  2. `he-verb-i-nun`
  3. `he-verb-hollow`
  4. `he-verb-geminate`
  5. 喉音根（先拆亚类再写）
  6. `he-verb-i-alef` / `he-verb-i-yod` / `he-verb-iii-alef`
  每完成一类：补 `endings` + `expect`，跑 `verifyGrammarDoc` 自检，人工核对 3ms/3fs/3mp/2ms/1cs 五格。

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
