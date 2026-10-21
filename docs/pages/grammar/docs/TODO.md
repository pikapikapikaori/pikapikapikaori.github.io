# 待办事项

---

## 1. 外部数据源导入

（注册方式与模块契约见 [SCHEMA 第四部分 §2](./SCHEMA.md#2-外部数据源在线查询)）

- [ ] 新增更多源：每个源一个文件（如 `external/js/dictionaryapi.js`）+ 一条注册记录
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

- [ ] 表格行列映射扩展（尤其 la / grc / sa / he 的长尾标签）
- [ ] 查询结果缓存（IndexedDB，按 `[lang, lemma]` 存储 wikitext / HTML）
- [ ] 请求节流 / 429 退避重试
- [ ] 多语言词条同页时提供选择 UI（当前自动取首个匹配词性）
- [ ] 处理 `{{la-noun}}` / `{{la-verb}}` 等模板参数，提取主要部分
- [ ] 从 `action=parse` 的 heading 层级切分，取代当前 wikitext 正则的粗糙节切
- [ ] 接入 Wiktionary REST API（`/api/rest_v1/page/definition/{term}`），替代当前的 wikitext 解析

## 3. 语法数据（`data/grammar/`）

（编写规范见 [SCHEMA 第二部分 §1–§8](./SCHEMA.md#第二部分-语法数据编写规范)，校验方式见 [第四部分 §4](./SCHEMA.md#4-校验语法数据命令行)）

### 已知数据缺口

- [ ] **`he-adj-quadriliteral`（四辅音形容词）不接 derive**：这类词干常含弱根
  （如 צַדִּיק 的 י 在阴性单数 צַדֶּקֶת 里脱落），一张骨架套不住全部词干，目前手填。
  真要接的话，得按「三辅音 + 弱根」拆成两个锚点。
- [ ] 从 Wiktionary 导入时提取主要部分后，回填 `stems` 并复用 `derive` 自动出表。

## 4. 通用

- [ ] 导入前预览：新增 / 合并 / 跳过 三类计数
