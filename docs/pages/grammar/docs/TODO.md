# 待办事项

---

## 1. 外部数据源导入

（注册方式与模块契约见 [SCHEMA 第四部分 §2](./SCHEMA.md#2-外部数据源在线查询)）

- [ ] 新增更多源：每个源一个文件（如 `external/js/dictionaryapi.js`）+ 一条注册记录

### 可用的外部数据源

**词典类**

| 数据源 | 语言支持 | 密钥 | CORS | 备注 |
|---|---|---|---|---|
| [dictionaryapi.dev](https://dictionaryapi.dev) | 多语言（英语为主，部分其他语言） | 无 | 不支持 | 纯前端直接请求会被 CORS 拦截，需要代理；英语覆盖最全 |
| [freedictionaryapi](https://github.com/ngocsangyem/freedictionaryapi) | 基于 Wiktionary 开源 | 无 | 未知 | 70 万+ 词条，需自查 CORS 支持 |
| [Glosbe API](https://glosbe.com/a-api) | 几乎所有活语言 | 无 | 支持 JSONP | 免费但有限流，返回 JSON/JSONP/XML |

**古籍 / 专业文献类**

| 数据源 | 语言支持 | 密钥 | CORS | 备注 |
|---|---|---|---|---|
| [Perseus Digital Library](https://www.perseus.tufts.edu) | 古希腊语、拉丁语 | 无 | 未知 | 提供词形分析（Perseus Hopper），非 JSON API |

**整合建议**

- 古籍词形分析：Perseus Hopper（需调研接口格式）
- 不可用的数据源（CORS 不支持）需要一个本地 CORS 代理或直接放弃

## 2. 人工确认各语言的语法和词卡组织布局

- [x] 拉丁语
- [x] 古希腊语
- [ ] 梵语
- [x] 圣经希伯来语
- [ ] 法语
- [ ] 德语
- [ ] 日语
- [x] 满语
