export function renderAbout() {
    const main = document.getElementById('main');
    main.innerHTML = `
    <div class="about">
      <h1>关于本站</h1>
      <p>本站是一个纯静态的收藏浏览器，用来查看从 Bangumi 导出的个人收藏数据。数据完全保存在浏览器本地，不会上传到任何服务器。</p>

      <h2>数据来源</h2>
      <p>网站按以下优先级获取数据：</p>
      <ol>
        <li>浏览器本地缓存（按用户隔离）</li>
        <li>你手动上传的 json / zip 文件</li>
        <li>你填写的 json / zip 地址（可选通过 CORS 代理）</li>
        <li>站点内置的默认地址</li>
      </ol>

      <h2>缓存与账号</h2>
      <p>数据读取成功后会写入 IndexedDB，并以导出文件里的 <code>meta.user.id</code> 作为隔离标识。</p>
      <ul>
        <li>右上角头像菜单可以<b>切换账号</b>（直接读取该用户在本地的缓存）。</li>
        <li><b>登出</b>只是回到引导界面，不会删除任何缓存；引导界面会列出已缓存的账号，点选即可继续。</li>
        <li><b>清除全部缓存</b>会清空所有用户在本地保存的数据，操作不可撤销。</li>
      </ul>

      <h2>搜索</h2>
      <p>全局搜索的范围为条目的原名、中文名和简介，不搜索标签与评论。</p>

      <h2>排序与筛选</h2>
      <p>默认按收藏更新时间倒序。另提供更新时间正序、评分正序 / 倒序、作品发布日期正序 / 倒序，以及按评分筛选。</p>

      <h2>问题反馈</h2>
      <p>如遇到问题或有建议，请到 <a href="https://github.com/pikapikapikaori/pikapikapikaori.github.io/issues/445" target="_blank" rel="noopener">项目仓库</a> 提交 issue。</p>
    </div>
  `;
}
