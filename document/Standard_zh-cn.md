# pikapikapi-blog

[English](./Standard.md) | 简体中文

> 本文档中的「支持性说明」「项目结构」与「PWA 缓存与存储命名」对根项目及所有子项目同样适用。

## 支持性

- 支持 **Chrome** 与 **Safari**。
- 不支持「减少动效」（`prefers-reduced-motion`）相关设置。

## 项目结构

```text
<项目>/
├── index.html              主页面留在项目根
├── sw.js
├── data/
└── assets/
    ├── css/
    │   ├── nonstandard/    存放非标准属性 css 文件（webkit 相关 css 代码）；内部文件结构与 css/ 下目录结构一致，对应同名文件头 @import 本目录内的文件
    │   └── ...
    ├── js/
    │   └── ...
    ├── html/               子页面
    ├── sources/            第三方库
    ├── external/           针对外部库/资源的代码
    │   ├── css/
    │   │   └── nonstandard/
    │   └── js/
    ├── layout/             不同布局模版
    │   └── <布局名称>/      布局文件夹
    │       ├── css/
    │       │   └── nonstandard/
    │       ├── js/
    │       └── html/
    └── resources/          资源文件，共享
        ├── fonts/
        ├── img/
        ├── live2d/
        ├── icon/
        ├── meta/           feed、sitemap、manifest.json 与 file-cache.json
        └── logo/
```

## PWA 缓存与存储命名

- 每个项目一个缓存前缀，`manifest.json` 的 `id` 与前缀一致且保持稳定。自有 `localStorage`、`sessionStorage` 键与 IndexedDB 库名带同一项目前缀。
- Service Worker 缓存名为 `<前缀>:static:<版本>:<hash>`。`hash` ：把排序后的 `路径:文件哈希` 首尾相接，再取 SHA-256 的前 16 位十六进制，文件哈希取该文件 SHA-256 的前 16 位十六进制。

## 代码规范

- 命名风格：优先使用首字母小写的驼峰式命名，也允许全大写加下划线的命名风格。
- 注释风格：优先使用英语注释，也允许中文；优先使用 `/** */` 的多行注释，也允许使用 `/* */` 与 `//`。
- `js` 代码风格：不允许使用任何 `var` 来声明。

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
    }
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
