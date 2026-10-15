# 数据源导入 · 待办

当前版本（v1）**不实现**自动导入器，仅在界面和数据模型上预留扩展位。
数据源标记统一使用 `source` 字段：
`manual` | `wiktionary` | `url:<host>` | 其它自定义字符串。

---

## 1. Wiktionary 英文版 archive 导入（TODO）

- [ ] 确认 download 格式（JSONL dump / Kafka stream / 其它）
- [ ] 确认字段结构，样例条目归档到 `docs/samples/`
- [ ] 实现 `services/import-export-service.js` 中的 `importWiktionary(records)`
- [ ] 按 `[userId, language, lemma, pos]` 查重：
  - 命中 → 把来源内容**追加**到 `meanings` / `inflections` / `examples`
  - 未命中 → 新建词条，`source: "wiktionary"`
- [ ] 语言 code 映射表（Wiktionary 用名 → 本项目 code）
- [ ] 分词 / 变格表解析规则（尤其 la / grc / sa / he）
- [ ] 大批量导入的分片与进度提示
- [ ] 失败条目的错误日志与重试

## 2. URL 导入（TODO）

- [ ] 界面输入框：接收一个返回本 schema `kind: "langnotebook-user"` 或词条数组的 URL
- [ ] 同源 / CORS 处理说明
- [ ] 冲突策略同 Wiktionary
- [ ] 失败重试与超时

## 3. 通用

- [ ] 导入前预览：新增 / 合并 / 跳过 三类计数
- [ ] 冲突策略可选择（追加 / 覆盖 / 跳过），默认追加
- [ ] 导入日志导出（JSON）

---

## 4. 手动编写（v1 已实现）

- 通过「添加生词」表单输入
- 支持导入/导出完整用户 JSON（见 `DATA-SCHEMA.md`）
