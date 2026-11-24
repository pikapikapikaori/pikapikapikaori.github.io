# Deployment

English | [简体中文](./Deploy_zh-cn.md)

## Middleware Duties

- Directory paths: a path ending in `/` serves `index.html`.
- Independent deployment: the domain root path is rewritten to the sub-project directory.
- Caching: static files use long cache lifetimes, while `sw.js` and the cache manifests are never cached.
- Content replacement: cross-project addresses are rewritten to the main site address before delivery.
- Manifest identity: the `id` in `manifest.json` is replaced with the deployment address of the project, chosen by the request host.
- Social preview: the relative `og:url` and `og:image` in the root `index.html` are expanded to absolute addresses.
- Reserved path: provides the proxy, authorization and callback services described in the [develop standard](./Standard.md).
- Static cross-origin: adds the cross-origin response headers and answers preflight requests.
- OAuth registration: one callback address per service, made of the deployment domain's `baseUrl`, the path described in the [reserved path](./Standard.md#reserved-path) section of the develop standard, and the callback query string. Example: `https://pikapikapi.com/_cross_origin?oauth=callback`.

## Cloudflare

- Uses R2 storage for large files, and Cloudflare Worker as the middleware.
- The middleware binds the bucket as `R2_BUCKET`.

## GitHub Pages

- There is no middleware, so the reserved path is unavailable, response headers carry no cache settings, and cross-origin requests fail.
- Directory addresses resolve to `index.html` without extra rules.
