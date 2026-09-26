# pikapikapi-blog

English | [简体中文](./Standard_zh-cn.md)

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

## Article-Related

### Writing a New Article

1. Add a link in `_sidebar.md` in the same directory. The path is based on the path of `index.html` (`docs`).
2. Add the following content in `config/tocdata.json.js`:

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

    Among these, `editedTime`, `href`, and `baseUrl` are required fields. The paths of the latter two are based on the path of `index.html` (`docs`). These fields are used for the article list display on the cover page:
    1. The `time` field is used for sorting (reverse chronological order).
    2. The `href` field is used for the a element to access the article.
    3. The `baseUrl` field is used to match the collection to which the article belongs.
3. [Optional] In the `_media/` folder in the same directory, create a corresponding folder to store resource files. The path used to reference the file is a relative path (`_media/path/to/directory/path/to/file`).
4. [Optional] After deployment, visit the corresponding interface to create a comment section.

### Editing an Article

Modify the corresponding `editedTime` field in `config/tocdata.json.js`.

### Archiving an Article / Modifying an Article Path / Renaming an Article

1. Move the corresponding `.md` file and the folder storing resource files in `_media`.
2. Modify the corresponding `cover`, `href`, and `baseUrl` fields in `config/tocdata.json.js`.
3. Modify the link in the corresponding `_sidebar.md`.
4. Modify the corresponding links in all other articles that reference this article.
5. Modify the link of the corresponding Gitalk Issue Tag.

**Note**: Modifying the reference links to resource files within the article (`_media/path/to/directory/path/to/file`) is not necessary, as they are relative paths.
