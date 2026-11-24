# 部署说明

[English](./Deploy.md) | 简体中文

## 中间件职责

- 目录路径：以 `/` 结尾的路径返回 `index.html`。
- 独立部署：域名根路径重写为子项目目录。
- 缓存：静态文件使用较长缓存时间，`sw.js` 与缓存清单不进缓存。
- 内容替换：跨项目地址在下发前替换为主站地址。
- 清单身份：按请求来源把 `manifest.json` 的 `id` 替换为对应的部署地址。
- 社交预览：把根 `index.html` 中的 `og:url` 与 `og:image` 相对地址展开为绝对地址。
- 保留地址：提供[开发规范](./Standard_zh-cn.md)中所述的代理、授权与回调服务。
- 静态跨域：补齐跨域响应头，并处理预检请求。
- OAuth 登记：每个服务只登记一个回调地址，即部署域名的 `baseUrl` 加上[开发规范](./Standard_zh-cn.md)中的[保留地址](./Standard_zh-cn.md#保留地址)一节中所述的路径后，再加上回调用的查询字符串。例：`https://pikapikapi.com/_cross_origin?oauth=callback`。

## Cloudflare

- 使用 R2 存储以支持大文件，中间件使用 Cloudflare Worker。
- 中间件把存储桶绑定为 `R2_BUCKET`。

## GitHub Pages

- 没有中间件，保留地址不可用，无文件响应头缓存设置，跨域失败。
- 目录地址由 Pages 自动补 `index.html`，不需要额外规则。
