/**
 * 运行环境判断
 */

const DEV_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]']

/** 本地开发环境（`npm start` 起的 hostthis dev server） */
export function isDevHost() {
    return DEV_HOSTS.includes(location.hostname)
}
