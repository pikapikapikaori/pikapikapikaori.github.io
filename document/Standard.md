# Develop Standard

English | [简体中文](./Standard_zh-cn.md)

> The "Support", "Project Structure" and "PWA Settings" sections in this document apply equally to the root project and all sub-projects.

## Support

- Supports **Chrome** and **Safari**.
- Does not support the "reduce motion" (`prefers-reduced-motion`) setting.

## Project Structure

```text
<project>/
├── index.html              Main page stays at the project root
├── sw.js
├── data/
└── assets/
    ├── css/
    │   ├── nonstandard/    Non-standard property CSS files (webkit-related CSS code); internal file structure matches that under css/, and the corresponding same-named file @imports the files in this directory at its head
    │   └── ...
    ├── js/
    │   └── ...
    ├── html/               Sub-pages
    ├── sources/            Third-party libraries
    ├── external/           Code for external libraries/resources
    │   ├── css/
    │   │   └── nonstandard/
    │   └── js/
    ├── layout/             Different layout templates
    │   └── <layout name>/      Layout folder
    │       ├── css/
    │       │   └── nonstandard/
    │       ├── js/
    │       └── html/
    └── resources/          Resource files, shared
        ├── fonts/
        ├── img/
        ├── live2d/
        ├── icon/
        ├── meta/           Feed, sitemap, manifest.json and file-cache.json
        └── logo/
```

## PWA Settings

- Each project owns one cache prefix, and the `id` in `manifest.json` equals that prefix. Own `localStorage` / `sessionStorage` keys and IndexedDB database names carry the same project prefix.
- A service worker cache name is `<prefix>:static:<version>:<hash>`. `hash`: join the sorted entries as `path:file hash` with no separator, then take the first 16 hex characters of the SHA-256, each file hash is the first 16 hex characters of the SHA-256 of that file.

## Reserved Path

Every project uses the path `/_cross_origin` as its reserved path. It is relative to `base_url`, so the full path is `<domain-base-url>/_cross_origin`.

### Cross-Origin Requests

Cross-origin access goes through this address and is handled by the [deployment middleware](./Deploy.md#middleware-duties).

### Authorization

- The page provides only the challenge and `state`; the middleware builds the authorize address and the client parameters.
- Only one callback address is registered, and `state` carries the return page.
- The token exchange also goes through the middleware.
- Page navigations to this address are always rejected.

## Coding Standards

- Naming style: Prefer lower camel case (lowerCamelCase); all-uppercase with underscores is also allowed.
- Comment style: Prefer English comments; Chinese is also allowed. Prefer `/** */` multi-line comments; `/* */` and `//` are also allowed.
- `js` code style: Do not use `var` for any declaration.

## Branch Naming & Commit Message

- **New article:** article/[title]-[yy|yymm|yymmdd] | atic:
- **Edit articles & web pages:** edit/[title]-[yymmdd] | edit:
- **Brief comments:** briefnotes/[yymmdd] | bric:
- **Backup:** backup/[yymmdd] | bakp:
- **New feature:** feature/[description] | feat:
- **Bug fixing:** fix/[description] | fix:
- **Refactor & Annotations:** refactor/[description] | refc:
- **Performance:** performance/[description] | perf:
- **Config & Scripts:** config/[description] | conf:
- **Document:** document/[description] | docs:

## Common Commands

Via the unified entry point:

```shell
npm run blog -- <command> [args...]

# Or
bash script/blog.sh <command> [args...]
```

The `help` command is provided to view all commands:

```shell
npm run blog -- help

# Or
bash script/blog.sh help
```

## Dates

Dates in project data files are stored as UTC+8.

## Article-Related

### Writing a New Article

1. Add a link in `_sidebar.md` in the same directory. The path is based on the path of `index.html` (`docs`).
2. Add the following content in `config/tocdata.json.js`:

    ```javascript
    {
        "title": "",
        "createdTime": "",
        "type": "",
        "editedTime": "",
        "cover": "",
        "href": "",
        "baseUrl": ""
    }
    ```

    `cover` is optional. `href` links to the article and `baseUrl` identifies its parent directory; both paths are relative to `index.html`. Set `type` to `content` for an article or `intro` for an introduction page.
3. [Optional] In the `_media/` folder in the same directory, create a corresponding folder to store resource files. The path used to reference the file is a relative path (`_media/path/to/directory/path/to/file`).
4. [Optional] Create a comment section.

### Editing an Article

1. Modify the corresponding `editedTime` field in `config/tocdata.json.js`.

### Archiving an Article / Modifying an Article Path / Renaming an Article

1. Move the corresponding `.md` file and the folder storing resource files in `_media`.
2. Modify the corresponding `cover`, `href`, and `baseUrl` fields in `config/tocdata.json.js`.
3. Modify the link in the corresponding `_sidebar.md`.
4. Modify the corresponding links in all other articles that reference this article.
5. Move the corresponding comment JSON to the new article path. If Gitalk is selected instead, update its Issue Tag link.

**Note**: Modifying the reference links to resource files within the article (`_media/path/to/directory/path/to/file`) is not necessary, as they are relative paths.

## Cross-Project References

| Project | File | Content | Count |
| --- | --- | --- | --- |
| homepage | `assets/js/config.js` | Feed, photographs, article covers, blog root link | 34 |
| homepage | `assets/js/i18n.js` | Feed link, blog root link for each language | 4 |
| indexpage | `data/apps.json` | Blog root link, homepage address | 1 |
| light | `index.html` | Styles, scripts, and feed from the root project | 10 |
| light | `assets/js/config/config.js` | `basePath` and `fixUrl.prefix` | 2 |
| bangumi-takeout | `assets/resources/meta/default-source.json` | Default archive in the root project | 1 |

These addresses are stored as page-relative paths. An independent deployment replaces them with main site addresses in the middleware.
