import {
    importTimeoutMs, maxFileSize, zipMaxOutputBytes,
} from '../config.js'
import { getExternal } from '../external.js'

function formatBytes(bytes) {
    const gib = bytes / 1024 / 1024 / 1024
    if (gib >= 1) return `${Number(gib.toFixed(1))} GiB`
    return `${Math.round(bytes / 1024 / 1024)} MB`
}

export function renderAbout() {
    const main = document.getElementById('main')
    const fileLimit = formatBytes(maxFileSize)
    const zipLimit = formatBytes(zipMaxOutputBytes)
    const importSeconds = Math.round(importTimeoutMs / 1000)
    const requestSeconds = Math.round(getExternal().requestTimeoutMs / 1000)
    main.innerHTML = `
        <div class="about">
            <h1>关于本站</h1>
            <p>纯静态页面，用来查看 Bangumi 收藏。数据只保存在浏览器本地，不上传服务器。</p>

            <h2>备份耗时</h2>
            <p>按约 1500 条收藏、请求间隔 700ms、每条平均 9 次 API 调用估算，未命中本地缓存时：</p>
            <ul>
                <li><strong>首次备份</strong>：约 2–3 小时；命中大部分 BGM 数据后可缩短到十几分钟。</li>
                <li><strong>再次备份</strong>：通常几秒到几分钟。</li>
                <li>期间可随时停止并从断点继续。</li>
            </ul>

            <h2>限制</h2>
            <p>接口有速率限制，默认请求间隔 700ms，失败会按设置重试；单次请求 ${requestSeconds} 秒超时。导入单个文件上限 ${fileLimit}，ZIP 仅解压 JSON 且解压输出上限 ${zipLimit}；链接下载 ${importSeconds} 秒超时，可在导入页取消。超过限制会直接报错，达到上限即停止读取或解压。</p>

            <h2>搜索</h2>
            <p>搜索条目原名、中文名与简介，不搜索标签与评论。</p>

            <h2>问题反馈</h2>
            <p>如遇到问题或有建议，请到 GitHub 的<a href="https://github.com/pikapikapikaori/pikapikapikaori.github.io/issues/445" target="_blank" rel="noopener">issues/445</a>提交。</p>
        </div>
    `
}
