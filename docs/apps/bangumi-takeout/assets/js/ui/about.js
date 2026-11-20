import {
    IMPORT_TIMEOUT_MS, MAX_FILE_SIZE, REQUEST_TIMEOUT_MS, ZIP_MAX_OUTPUT_BYTES,
} from '../config.js'

// Limits are read from config so a later change to 1 GiB and 1.5 GiB updates
// this copy without a second edit.
function formatBytes(bytes) {
    const gib = bytes / 1024 / 1024 / 1024
    if (gib >= 1) return `${Number(gib.toFixed(1))} GiB`
    return `${Math.round(bytes / 1024 / 1024)} MB`
}

export function renderAbout() {
    const main = document.getElementById('main')
    const fileLimit = formatBytes(MAX_FILE_SIZE)
    const zipLimit = formatBytes(ZIP_MAX_OUTPUT_BYTES)
    const importSeconds = Math.round(IMPORT_TIMEOUT_MS / 1000)
    const requestSeconds = Math.round(REQUEST_TIMEOUT_MS / 1000)
    main.innerHTML = `
        <div class="about">
            <h1>关于本站</h1>
            <p>本站是一个纯静态的收藏浏览器，用来查看从 Bangumi 导出的个人收藏数据。数据完全保存在浏览器本地，不会上传到任何服务器。</p>

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
            <p>搜索范围为条目的原名、中文名和简介，不搜索标签与评论。</p>

            <h2>问题反馈</h2>
            <p>如遇到问题或有建议，请到 GitHub 的<a href="https://github.com/pikapikapikaori/pikapikapikaori.github.io/issues/445" target="_blank" rel="noopener">issues/445</a>提交。</p>
        </div>
    `
}
