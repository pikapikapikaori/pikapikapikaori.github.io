# pikapikapi-blog

[English](./Standard.md) | 简体中文

## 分支命名 & 提交信息

- **新文章：**article/[title]-[yy|yymm|yymmdd] | atic:
- **文章、页面内容修改：** edit/[title]-[yymmdd] | edit:
- **短评：** briefnotes/[yymmdd] | bric:
- **备份：** backup/[yymmdd] | bakp:
- **新特性、功能：** feature/[description] | feat:
- **修正缺陷：** fix/[description] | fix:
- **重构、注释：** refactor/[description] | refc:
- **性能优化：** performance/[description] | perf:
- **配置、脚本：** config/[description] | conf:
- **文档：** document/[description] | docs:

## 常用命令

通过统一入口：

```shell
npm run blog -- <command> [args...]

# 或
bash script/blog.sh <command> [args...]
```

可以使用 `help` 命令来查看全部命令：

```shell
npm run blog -- help

# 或
bash script/blog.sh help
```

## 文章相关

### 写新的文章

1. 同目录内 `_sidebar.md` 内添加链接，路径基于 `index.html` 的路径（`docs`）。
2. `config/tocdata.json.js` 内添加以下内容：

    ```javascript
    {
        "title": "",
        "time": "",
        "editedTime": "",
        "cover": "",
        "href": "",
        "baseUrl": ""
    },
    ```

    其中 `editedTime`、`href` 与 `baseUrl` 为必填字段，后两者的路径基于 `index.html` 的路径（`docs`）。这些字段用于封面页的文章列表展示：
    1. `time` 字段用于排序（时间倒序）。
    2. `href` 字段用于 `a` 元素访问该文章。
    3. `baseUrl` 字段用于匹配文章所属的选集。
3. 【可选】在同目录内的 `_media/` 文件夹内创建对应文件夹，存放资源文件。引用该文件的路径为相对路径（`_media/path/to/directory/path/to/file`）。
4. 【可选】部署后访问对应界面创建评论区。

### 编辑文章

1. 修改 `config/tocdata.json.js` 内对应的 `editedTime` 字段。

### 归档文章 / 修改文章路径 / 重命名文章

1. 移动对应的 `.md` 文件与 `_media` 内资源文件存放的文件夹。
2. 修改 `config/tocdata.json.js` 内对应的 `cover`、`href` 与 `baseUrl` 字段。
3. 修改对应 `_sidebar.md` 内的链接。
4. 修改其他引用该文章的全部文章中的对应链接。
5. 修改对应的 Gitalk Issue Tag 的链接。

**注意**：不用修改文章内对资源文件的引用链接（`_media/path/to/directory/path/to/file`），因其为相对路径。
