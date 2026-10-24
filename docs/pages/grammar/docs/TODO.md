# 待办事项

---

## 1. 外部数据源导入

（注册方式与模块契约见 [SCHEMA 第四部分 §2](./SCHEMA.md#2-新增数据源流程)）

- [ ] 新增更多源：每个源一个文件（如 `external/js/dictionaryapi.js`）+ 一条注册记录

### 可用的外部数据源

**古籍 / 专业文献类**

| 数据源 | 语言支持 | 密钥 | CORS | 备注 |
|---|---|---|---|---|
| [Perseus Digital Library](https://www.perseus.tufts.edu) | 古希腊语、拉丁语 | 无 | 未知 | 提供词形分析（Perseus Hopper）（需调研接口格式），非 JSON API |
