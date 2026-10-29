# pikapikapi-blog

[English](./Design.md) | 简体中文

## 默认主题

除 `swiss` 之外的全部主题。所有颜色都由 `--theme-color` 派生，因此改主题色即改全部状态色。

### 交互标准

#### 四级阶梯

所有可交互元素都沿同一条四级阶梯上行。每一列都是从该列自身的静止状态起算的阶梯，元素只沿自己所在的那一列上行，且不跳级；**选中项被 hover 时停留在第 2 级**，不退回第 1 级。

| 级 | 语义 | 描边 / 条 | 表面（空心） | 表面（实心） | 文字 / 图标 | 缩放 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 静止：无色 | 无 / 中性 1px | 透明 | 主题色实色 | 空心 `-8`；实心反色墨 | 1 | 静止不显示任何强调 |
| 1 | hover：可以点 | 主题色 45% | 主题色 30% | 主题色 + 白 10%，2px 45% 墨环 | 空心 `-8`；实心反色墨 | 1.1 | 只表达“可以点”，文字不动 |
| 2 | 选中（`.active`）/ 聚焦（`:focus`） | 主题色实色 | 主题色 30%，描边 `-7` | 主题色 + 白 16%，2px 实色墨环 | 空心 `-8`；实心反色墨 | 1.2 | 比第 1 级深一级；选中项被 hover 时停在本级 |
| 3 | 按下（`:active`） | `-7` | 主题色 40%，描边 `-8` | 主题色 + 白 24%，3px 实色墨环 | 空心 `-8`；实心反色墨 | 1.3 | 按下即 `:active`，按住期间生效，松开回到 hover 或选中。导航链接、行内链接、色卡点击无效果，故不设按下态 |

三条推论，都不是额外规则：

- **表面（实心）的底色已经是最浅一档**。主题色本身就是最亮的颜色，继续加深只会把反色墨字压没（实测静止态已低至 4.88），所以它的阶梯改为**向白偏移**，并用墨色内环的浓度与粗细补足层级。
- **表面（空心）的文字恒定**。`-8` 是离纸最远的一档主题色，底只铺 30% / 40%，文字不随状态变化，因此任何状态下都不会掉对比度。
- **表面（空心）的描边**从第 1 级起步：静止 45%、hover 实色、选中 `-7`、按下 `-8`。这和“实心按钮的底色从第 2 级起步”是同一条规则——起点高就少走一步。

文字列：空心按钮恒为 `--global-theme-color-8`（彩色字），实心按钮恒为 `--global-solid-ink`（把主题色翻到明度另一端的反色墨）。两者靠色相区分——**空心是“无色底 + 彩字”，实心是“彩底 + 反色字”**。

#### 键盘焦点

`:focus-visible` 不属于阶梯，并且刻意与 hover 保持差别：

- `outline: 2px solid var(--global-theme-color-8)`，`outline-offset: var(--global-outline-offset)`（2px）
- 静止状态用 `outline: 2px solid transparent` 预留描边，聚焦时不产生位移
- 作用于 `a[href]`、`button`、`summary`、`select`、`[tabindex]` 以及各类 `input`

#### 过渡

已定义六档时长：

| 变量 | 值 |
| --- | --- |
| `--global-transition-duration-fast` | 250ms |
| `--global-transition-duration` | 500ms |
| `--global-transition-duration-slow` | 1s |
| `--global-transition-duration-very-slow` | 2s |
| `--global-transition-duration-super-slow` | 3s |
| `--global-transition-duration-most-slow` | 5s |

由其组合出：`--global-transition-color`（color、text-decoration-color、border-color、outline-color、box-shadow、background-color）、`--global-transition-transform`、`--global-transition-filter`、`--global-transition-font`（font-weight），以及 `-color-fast`、`-filter-fast`、`-transform-slow` 三个变体。

全部 hover 反馈使用 500ms 这一组；更短与更长的档位留给换主题、装饰动画等其它动效。

`font-weight` 以数值插值，但静态字体只携带少数几个字重，浏览器在插值过程中会就近取档，因此字重表现为“软化后的跳变”而不是连续变化。

#### 圆角

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--global-border-radius-big` | 0.625rem | 大面：卡片、浮窗、代码块 |
| `--global-border-radius` | 0.3125rem | 控件：按钮、输入框、色卡 |
| `--global-border-radius-small` | 0.125rem | 小件 |
| `--global-border-radius-none` | 0 | 直角 |
| `--global-border-radius-round` | 50% | 圆形（头像），属于形状而非档位 |

语义别名（不要直接写数值）：`--global-el-border-radius` = big、`--global-control-border-radius` = 默认档、`--global-avatar-border-radius` = round。

#### 尺寸变量

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--global-container-width` | 25rem | 文章内容器宽度 |
| `--global-container-height` | 18.75rem | 文章内容器高度 |

#### 交互变量

阶梯的颜色分两层：改主题色只改 `--theme-color`，改阶梯只改第一层，改某条通道的取色只改第二层。全部定义在 `base.css` 的「控件变量」一节。

**第一层：阶梯**

| 变量 | 值 | 含义 |
| --- | --- | --- |
| `--global-accent-level-1` | `var(--global-theme-color-blur-weak)`（主题色 45%） | 第 1 级：hover |
| `--global-accent-level-2` | `var(--theme-color)`（主题色实色） | 第 2 级：选中 / 聚焦 |
| `--global-accent-level-3` | `var(--global-theme-color-7)` | 第 3 级：选中后的描边、按下 |
| `--global-accent-level-4` | `var(--global-theme-color-8)` | 第 4 级：按下后的描边 |
| `--global-scale-hover` | `var(--global-transform-ratio-small)`（1.1） | 第 1 级缩放 |
| `--global-scale-active` | `var(--global-transform-ratio-normal)`（1.2） | 第 2 级缩放 |
| `--global-scale-press` | `var(--global-transform-ratio-big)`（1.3） | 第 3 级缩放 |

**第二层：通道**

| 变量 | 值 |
| --- | --- |
| `--global-nav-bar-rest` | `transparent` |
| `--global-nav-bar-hover` | `var(--global-accent-level-1)` |
| `--global-nav-bar-active` | `var(--global-accent-level-2)` |
| `--global-link-decoration-rest` | `var(--global-accent-level-2)` |
| `--global-link-decoration-hover` | `var(--global-accent-level-3)` |
| `--global-control-border-rest` | `var(--border-color)` |
| `--global-control-border-hover` | `var(--global-accent-level-1)` |
| `--global-control-border-active` | `var(--global-accent-level-2)` |
| `--global-control-border-press` | `var(--global-accent-level-3)` |
| `--global-surface-hollow-rest` | `transparent` |
| `--global-surface-hollow-hover` | `color-mix(in srgb, var(--theme-color) 30%, transparent)` |
| `--global-surface-hollow-active` | `color-mix(in srgb, var(--theme-color) 30%, transparent)` |
| `--global-surface-hollow-press` | `color-mix(in srgb, var(--theme-color) 40%, transparent)` |
| `--global-surface-hollow-border-rest` | `var(--global-accent-level-1)` |
| `--global-surface-hollow-border-hover` | `var(--global-accent-level-2)` |
| `--global-surface-hollow-border-active` | `var(--global-accent-level-3)` |
| `--global-surface-hollow-border-press` | `var(--global-accent-level-4)` |
| `--global-surface-hollow-text-rest` | `var(--global-theme-color-8)` |
| `--global-surface-hollow-text-hover` | `var(--global-theme-color-8)` |
| `--global-surface-hollow-text-active` | `var(--global-theme-color-8)` |
| `--global-surface-hollow-text-press` | `var(--global-theme-color-8)` |
| `--global-surface-solid-rest` | `var(--global-accent-level-2)` |
| `--global-surface-solid-hover` | `color-mix(in oklab, var(--theme-color) 90%, #fff)` |
| `--global-surface-solid-active` | `color-mix(in oklab, var(--theme-color) 84%, #fff)` |
| `--global-surface-solid-press` | `color-mix(in oklab, var(--theme-color) 76%, #fff)` |
| `--global-surface-solid-text` | `var(--global-solid-ink)` |
| `--global-surface-solid-ring-hover` | `color-mix(in srgb, var(--global-solid-ink) 45%, transparent)` |
| `--global-surface-solid-ring-active` | `var(--global-solid-ink)` |
| `--global-surface-solid-ring-press` | `var(--global-solid-ink)` |
| `--global-table-row-hover` | `color-mix(in srgb, var(--theme-color) 18%, transparent)` |

另有一个自动计算的令牌 `--global-solid-ink`，定义在 `base.css`，不依赖明暗方案、也不需要逐个主题配置：

```css
--global-solid-ink: color-mix(in srgb, var(--theme-color) 12%, #000);
--global-solid-ink: oklch(from var(--theme-color) clamp(0.08, calc(1 - l), 0.92) 0 h);
```

第二条是真正的取值：它把主题色的 OKLCH 明度翻到另一端（`1 - l`，再夹在 0.08–0.92 之间），于是浅主题色得到深灰、深主题色得到浅灰，色相无关。实测：薰衣草 `#c7a2ec` 算出 `#1c1c1c`（7.92:1），抹茶 `#c7eca2` 算出 `#030303`（15.62:1），雾蓝 `#a2d9ec` 算出 `#0a0a0a`（12.87:1）。第一条是给不支持相对颜色语法的浏览器兜底。实心按钮的文字与内环都用它。

### 组件类型

按交互机制归类。状态格里依次写**底 / 边 / 字**；表里出现的变量名对应「交互变量」一节。

| 类型 | 分组 | 覆盖元素 | 静止（0） | hover（1） | 选中（2） | 按下（3） | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **导航链接** | 链接 | 顶栏 navbar、侧栏、docsify tabs、TOC 切换器、面包屑 | 条 `--global-nav-bar-rest`（透明），字继承 | 条 `--global-nav-bar-hover`（45%），字不变 | 条 `--global-nav-bar-active`（实色），字主题色 + 加粗 | 无此态 | 点击只是重新进入当前页，没有额外反馈，所以不设按下态。面包屑的当前页不是链接，但语义上是选中态，取第 2 级 |
| **行内文字链接 1** | 链接 | 正文内联链接（`p` / `li` / `blockquote` / `table` 内的 `a`）、封面内的正文链接 | `--global-link-decoration-rest` 下划线，字继承 | `--global-link-decoration-hover` 下划线，字继承 | 无此态 | 无此态 | 点击即跳转，按下不额外反馈 |
| **行内文字链接 2** | 链接 | 站名、标题锚点、`summary`、分页标题、搜索结果、评论链接、gitalk 提示文字 | `transparent` 下划线，字继承 | `--global-link-decoration-hover` 下划线，字继承 | 无此态 | 无此态 | 点击即跳转，按下不额外反馈 |
| **正文图标链接** | 链接 | about-me 图标 | 图标 1 倍 | `--global-scale-hover` | 无此态 | `--global-scale-active` | 观感与幽灵图标完全相同，但语义是正文里的图标链接，所以单独成行，不参与按钮层级 |
| **幽灵图标** | 按钮 | widgets 九个图标、侧栏开关、回顶部、阅读进度环、评论 like/edit/reply、封面 chevron | 图标 1 倍 | `--global-scale-hover` | 无此态 | `--global-scale-active` | 只有缩放，没有底也没有描边 |
| **输入框** | 输入 | 搜索框、分页输入框、gitalk 文本框 | `--global-control-border-rest`，字继承 | `--global-control-border-hover`，字继承 | `--global-control-border-active`（`:focus`），字继承 | 无此态 | 聚焦与选中同值；按下无额外反馈 |
| **选择类色卡** | 按钮 | 主题预设、颜色预设、色轮 thumb | `--global-control-border-rest`，1 倍 | `--global-control-border-hover`，`--global-scale-hover` | `--global-control-border-active`，`--global-scale-active` | 未选中：取第 2 级的取值；已选中：`--global-control-border-press`，`--global-scale-press` | 按下即“预告选中”：未选中的色卡按下时呈现第 2 级，松开正好落入选中；已选中的色卡按下时再上一级。色轮 thumb 只换描边（`--border-color` → `--theme-color`），不加描边环、不缩放，且描边过渡只在 hover 时生效 |
| **表面（空心）按钮** | 按钮 | toc 分页箭头、看大图左右箭头、gitalk 预览、字号预设 | 透明底，描边 `--global-accent-level-1`，字 `-8` | 底 30%，描边 `--global-accent-level-2`，字 `-8` | 底 30%，描边 `--global-accent-level-3`，字 `-8` | 底 40%，描边 `--global-accent-level-4`，字 `-8` | 只有描边、没有实心底；选中态只用于字号预设 |
| **表面（实心）按钮** | 按钮 | gitalk 登录与发布、cover 主按钮、复制代码 | 底 `--global-surface-solid-rest`，字反色墨 | 底 +白 10%，2px 45% 墨环，字反色墨 | 底 +白 16%，2px 实色墨环，字反色墨 | 底 +白 24%，3px 实色墨环，字反色墨 | 静止即实心底。判定：有实心底为实心，只有描边为空心 |

### 引导线

导航链接的主题色条永远比所在容器的引导线宽 2px，因此有引导线的地方是 3px、没有的地方是 2px，视觉上“粗出的量”保持一致；hover 与选中同宽，只差颜色。

| 容器 | 引导线 | 位置 | 条宽 |
| --- | --- | --- | --- |
| 顶栏 navbar | 无 | 底边 | 2px |
| 侧栏 | 无 | 左边 | 2px |
| 侧栏（目录模式，`.sidebar:has(.toc-btn.active-btn) .sidebar-nav>ul>li>ul>li ul ul` 这一层） | 1px | 左边 | 3px |
| docsify tabs | 1px | 底边 | 3px |
| TOC 切换器 | 1px | 底边 | 3px |
| 面包屑 | 无 | 底边 | 2px |

三点补充：

- 同一组导航项之间不留间隙（TOC 切换器 `gap: 0`），条才能连续相接；间距由各项的内边距承担。
- 面包屑的当前页允许自然换行，折行时每一行各画一条——这是预期行为（inline 元素的边框就是这样工作的）。面包屑字号 `0.9rem`，比顶栏小一级。
- toc 分页按钮的外框是 28×28（1.75rem），内部图标是 100% 的 svg，靠父元素 `padding: var(--global-border-width)` 缩到 24px（28 − 1px 边框 ×2 − 1px 内边距 ×2）。swiss 的边框是 2px，因此它的 `padding` 为 0，图标同样是 24px。

### 表格

正文表格的单元格本身带 1px `--border-color-strong` 全边框（来自 base），行与行之间另有 1px `--border-color-mid` 上边线；**不画斑马纹，读数靠 hover**。

| 部位 | 静止 | hover |
| --- | --- | --- |
| 表头 `thead th` | 无底色，加粗，文字取 `--heading-color` | 无此态 |
| 行 `tbody tr` | 透明 | `--global-table-row-hover`（18% 主题色），过渡 500ms |

两点：

- hover 用的是行的背景，而不是单元格：`rowspan` 合并出来的单元格归属首行，行背景会铺满整条带状区域，因此它在被覆盖的第二行、第三行里也会一起染上；`colspan` 的行自然整行一起变。局限是指针停在跨行单元格内部时，命中的只能是它所属的那一行——CSS 无法感知 span 覆盖范围，这是预期行为。
- 表头不参与 hover；它的边界靠加粗与网格线表达，不用底色。

### 浮窗

三种浮窗共用大面圆角 `--global-el-border-radius`，差别只在描边用不用主题色、底色是斑马底还是主题色浅底：

| 种类 | 成员 | 描边 | 底色 | 其它 |
| --- | --- | --- | --- | --- |
| **组件浮窗** | widgets 的 popup（`.page-right-popups-div`） | 1px **主题色** | `--global-theme-color-blur`（10% 主题色） | `backdrop-filter: var(--global-backdrop-filter)` |
| **常规浮窗** | gitalk 评论卡 `.gt-comment-content`、`.gt-popup` 菜单、关于页右侧面板 `.main-page-right-panel-container` | 1px `--border-color-strong` | `--zebra-bg` | 无 |
| **突出浮窗** | 博主自己的评论（`.gt-comment.gt-comment-admin`） | 同常规浮窗 | `--global-theme-color-blur`（10% 主题色） | 只靠底色区分身份，其它与常规浮窗一致 |

### 短评集

`writings/BriefComments.md` 是一年一节的引文流，不设卡片。

| 元素 | 规格 |
| --- | --- |
| 年份区 | 标题左对齐、`--heading-color`、2.25rem、下压一条 2px `--border-color-strong` 横线；标题左侧是年份图标，兼作开合指示 |
| 年份图标 | 原生 512×512 RGBA 图片；收起 `rotate(-14deg) scale(0.9)`、`opacity 0.5`；展开回正、不透明；过渡 500ms（`opacity` + `transform`） |
| 年份 hover | 标题出现下划线，颜色取 `--global-link-decoration-hover`；字色不变 |
| 原来的年份分隔线 | 移除。图标从分隔线搬到标题左侧，两条主题色短横线不再绘制 |
| 条目 | 无卡片、无底色；每条上方 1px `--border-color` 分隔（首条无）；头像 2.25rem |
| 引用线 | 卡片左侧 2px `--border-color-strong`，hover 过渡到主题色，500ms |
| 条内分隔 | `0.2rem dotted --border-color`；原走动图标保留，不再染色 |

### cursor

navbar 与侧栏的选中项仍然可以点击（会重新进入当前页），所以保持 `cursor: pointer`；docsify tabs、TOC 切换器与字号预设的选中项点了没有效果，使用 `cursor: default`；面包屑当前页不是链接，无需 cursor 规则；其余可交互元素保持 `cursor: pointer`。

## swiss 主题

`swiss` 用「纸 / 墨 / 线」的版面语言。它与默认主题共用同一套交互意图，但取色只有黑白灰，主题色退到极少数几处（见「主题色预算」）。

### 交互标准

#### 四级阶梯

所有可交互元素沿同一条四级阶梯上行，每一列都从自己的静止状态起算，且不跳级；**选中 / 激活项被 hover 时停在本级**。swiss 与默认主题最大的差别是：**导航靠“线”变化，按钮靠“纸墨互换”变化，文字不参与**。

| 级 | 语义 | 线 / 条 | 表面（不带激活态） | 表面（带激活态） | 文字 / 图标 | 缩放 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 静止：无色 | `tone-line` 2px，或透明 3px 预留 | paper 底 + tone-line 边 | paper 底 + tone-line 边 | ink | 无 | 导航 hover 不改字色，只有线走阶梯 |
| 1 | hover：可以点 | `--border-color-mid`（中性灰） | ink 底 + ink 边 | 同左（尚未激活时） | paper | 无 | 中性灰比 tone-line 深一档，否则 tabs 的静态基线看不出变化 |
| 2 | 选中 / 激活（`.active`、`.active-btn`、`.is-active`） | ink-strong | 无此态 | ink 底 + ink 边 | paper | 无 | 带激活态按钮被 hover 时停在本级，不反相；反相只发生在“已激活 + hover”，见下 |
| 3 | 按下（`:active`） | 同第 1 级 | 同第 1 级 | 同第 1 级 | paper | 无 | 按下与 hover 同态。导航链接、行内链接、色卡点击无效果，故不设按下态 |

两条 swiss 独有的规则：

- **一律不缩放**（色轮 thumb 也不缩放）。默认主题用缩放表达的层级，swiss 全部用底色互换表达。
- **带激活态按钮“激活后 hover”反相**：纸底 + 墨边 + 墨字，表示“再点一次会退出该状态”。它属于第 2 级的一个子状态，只在已经激活时出现；按下不反相。

两处特意的不对称：

- **导航 hover 不改文字颜色**，只有线变灰；激活态才把线换成墨色并加粗文字。
- **常驻激活按钮的 hover 是“褪色”**：墨底纸字 → 纸底墨字，与“带激活态按钮激活后 hover”同一条规则。

#### 键盘焦点

同默认主题，只是颜色换墨：

- `outline: var(--global-focus-outline)`，宽度 `--global-focus-outline-width`（2px），颜色 `--global-focus-outline-color`（指向 `--sw-ink-strong`），`outline-offset` 2px
- 静止用透明 outline 预留，聚焦时不产生位移
- 作用于 `a[href]`、`button`、`summary`、`select`、`[tabindex]` 与各类 `input`

#### 过渡

只有两档，swiss 在主题文件里重定义：`--global-transition-duration` 200ms、`--global-transition-duration-fast` 160ms。

| 用途 | 时长 |
| --- | --- |
| 导航线、导航文字 | 160ms |
| 按钮底色、描边、文字 | 200ms |
| 输入框线、色卡描边 | 160ms |
| 表格行 hover | 160ms |
| 短评集年份开合图标 | 200ms |

#### 圆角

一律 0，不区分大面与控件。

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--global-el-border-radius` | 0 | 大面：卡片、浮窗、代码块 |
| `--global-el-border-radius-small` | 0 | 大面的小档 |
| `--global-icon-border-radius` | 0 | 图标控件 |
| `--global-widget-border-radius` | 0 | 右侧小组件 |
| `--global-scrollbar-border-radius` | 0 | 滚动条 |
| `--global-border-radius-round` | 50% | 圆形（头像），属于形状而非档位 |

#### 尺寸变量

| 变量 | swiss 取值 | 用途 |
| --- | --- | --- |
| `--global-container-width` | 25rem | 文章内容器宽度 |
| `--global-container-height` | 18.75rem | 文章内容器高度 |
| `--global-content-width` | `min(94%, var(--sw-max))` | 正文栏宽，`--sw-max` 为 80rem |
| `--global-sidebar-width` | 13.75rem | 侧栏宽 |

另有一组 swiss 自己的排版与几何令牌（`--sw-fs-*`、`--sw-gap-*`、`--sw-plate-*` 等），只影响版面，不参与交互。

#### 交互变量

颜色分两层：改主题色只改 `--theme-color`，改调色板只改第一层，改某条通道只改第二层。两层都定义在 `swiss.css` 的 `:root`。

**第一层：调色板与线宽**

| 变量 | 值 | 含义 |
| --- | --- | --- |
| `--sw-paper` | `var(--bg-color)` | 纸 |
| `--sw-ink` | `var(--text-color)` | 正文墨 |
| `--sw-ink-strong` | `var(--heading-color)` | 标题墨（最重的一档） |
| `--sw-ink-muted` | `var(--muted-color)` | 弱化文字 |
| `--sw-tone` | `var(--code-bg)` | 纸灰（浮窗、代码、高亮底） |
| `--sw-tone-line` | `var(--border-color)` | 淡线（静止线、结构基线） |
| `--sw-rule` | 0.1875rem（3px） | 导航条 / 粗线 |
| `--sw-rule-mid` | 0.125rem（2px） | 细线、中间档 |
| `--sw-rule-mast` | 0.375rem（6px） | 报头线 |
| `--sw-border` | `var(--sw-rule) solid var(--sw-ink-strong)` | 3px 墨色实线 |
| `--sw-border-mid` | `var(--sw-rule-mid) solid var(--sw-ink-strong)` | 2px 墨色实线 |
| `--sw-border-mast` | `var(--sw-rule-mast) solid var(--sw-ink-strong)` | 6px 墨色实线 |

**第二层：通道**

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--sw-nav-rest` | `transparent` | 导航条静止 |
| `--sw-nav-hover` | `var(--border-color-mid)` | 导航条 hover（中性灰） |
| `--sw-nav-active` | `var(--sw-ink-strong)` | 导航条激活 |
| `--sw-line-rest` | `var(--sw-tone-line)` | 输入框线静止 |
| `--sw-line-hover` | `var(--sw-ink-strong)` | 输入框线 hover / 聚焦 |
| `--sw-fill-rest` | `var(--sw-paper)` | 按钮底静止 |
| `--sw-fill-hover` | `var(--sw-ink-strong)` | 按钮底 hover / 按下 / 激活 |
| `--sw-fill-inverse` | `var(--sw-paper)` | 反相时的底（激活后 hover） |
| `--sw-on-rest` | `var(--sw-ink)` | 静止时的文字 |
| `--sw-on-fill` | `var(--sw-paper)` | 有墨底时的文字 |
| `--sw-swatch-rest` | `var(--sw-tone-line)` | 色卡描边静止 |
| `--sw-swatch-hover` | `var(--sw-ink-strong)` | 色卡描边 hover / 激活 |
| `--sw-swatch-outline` | `var(--sw-ink-strong)` | 色卡 hover / 激活附加的 2px outline |
| `--sw-accent` | `var(--theme-color)` | 唯一允许的彩色，只给下面「主题色预算」里列出的位置 |

### 主题色预算

swiss 只在下面这些位置使用主题色，其余一律纸 / 墨 / 灰：

| 位置 | 用途 |
| --- | --- |
| 文章报头 `--sw-mastline::before` 的短横线 | 正面装饰 |
| 页脚 `#footer-under-gitalk` 顶部的 6px 横线 | 正文与胶印页脚的分界 |
| 行内文字链接的 hover 下划线 | 可点反馈 |
| 分页标题、目录页标题的 hover 下划线 | 可点反馈 |
| `mark` 高亮底、`::selection` 底 | 选区 / 高亮语义 |
| 颜色选择器 thumb 的填充 | 它本身就是取色控件 |
| `--sw-accent` | 上面几处的公共别名 |

### 组件类型

按交互机制归类。状态格里依次写**底 / 边 / 字**；表里出现的变量名对应「交互变量」一节。

| 类型 | 分组 | 覆盖元素 | 静止（0） | hover（1） | 选中 / 激活（2） | 按下（3） | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **导航链接** | 链接 | 顶栏 navbar、侧栏、docsify tabs、TOC 切换器、面包屑 | 条 `--sw-nav-rest`，字 ink；tabs 例外，静止画 3px tone-line 基线 | 条 `--sw-nav-hover`，字不变 | 条 `--sw-nav-active`，字加粗 | 无此态 | 点击只是重新进入当前页，所以不设按下态。面包屑当前页取第 2 级的条 + 加粗，文字颜色不变 |
| **行内文字链接 1** | 链接 | 正文内联链接（`p` / `li` / `blockquote` / `table` 内的 `a`）、封面内的正文链接 | ink 下划线 2px | `--sw-accent` 下划线 | 无此态 | 无此态 | 点击即跳转，按下不额外反馈 |
| **行内文字链接 2** | 链接 | 站名、标题锚点、`summary`、分页标题、目录页标题、搜索结果、评论链接、gitalk 提示文字 | 透明下划线 | `--sw-accent` 下划线 | 无此态 | 无此态 | 点击即跳转，按下不额外反馈 |
| **正文图标链接** | 链接 | about-me 图标 | ink，1 倍 | ink-strong，不缩放 | 无此态 | ink-strong，不缩放 | 观感接近幽灵图标，但语义是正文里的图标链接；swiss 不缩放，所以只换颜色 |
| **不带激活态按钮** | 按钮 | widgets 九个图标、侧栏开关、toc 分页箭头、看大图左右箭头、cover chevron | paper 底 + tone-line 边 + ink 字 | ink 底 + ink 边 + paper 字 | 无此态 | 同 hover | 只有这一种反馈：纸墨互换 |
| **带激活态按钮** | 按钮 | gitalk 预览、TOC 切换器、字号预设 | paper 底 + tone-line 边 + ink 字 | ink 底 + ink 边 + paper 字 | ink 底 + ink 边 + paper 字 | 同 hover | 激活后 hover 反相成纸底墨字；gitalk 预览的激活条件是 `.gt-header-textarea` 带 `hide` 类 |
| **常驻激活按钮** | 按钮 | gitalk 登录与发布、复制代码 | ink 底 + ink 边 + paper 字 | paper 底 + ink 边 + ink 字 | 无此态 | 同 hover | 静止即激活态，hover 褪色 |
| **输入框** | 输入 | 搜索框、分页输入框、gitalk 文本框 | `--sw-line-rest`，字继承 | `--sw-line-hover`，字继承 | `--sw-line-hover`（`:focus`），字继承 | 无此态 | 聚焦与 hover 同值；按下无额外反馈 |
| **选择类色卡** | 按钮 | 主题预设、颜色预设、色轮 thumb | `--sw-swatch-rest` | `--sw-swatch-hover` + 2px `--sw-swatch-outline` | 同 hover | 同 hover | 色卡点击即生效，按下与 hover 同态。色轮 thumb 只换描边，不加 outline、不缩放，描边过渡只在 hover 时生效；它的填充取主题色 |

### 引导线

swiss 没有引导线：导航项之间只用线本身分隔，条宽由 `--sw-rule` 决定，默认主题“比引导线宽 2px”的规则不适用。

| 容器 | 结构线 | 位置 | 条宽 |
| --- | --- | --- | --- |
| 顶栏 navbar | 无 | 底边 | 3px |
| 侧栏 | 无 | 左边 | 3px |
| 侧栏（目录模式） | 无 | 左边 | 3px |
| docsify tabs | 3px tone-line 基线 | 底边 | 3px |
| TOC 切换器 | 3px tone-line 底边（容器） | 底边 | 3px |
| 面包屑 | 无 | 底边 | 2px |

两点补充：

- 导航项之间不留间隙（TOC 切换器 `gap: 0`），条才能连续相接；间距由各项的内边距承担。
- 面包屑字号 0.9rem，比顶栏小一级，所以条宽保持 2px；其余导航一律 3px，避免 tabs 切换时抖动。

### 表格

与默认主题同构：无斑马纹，单元格带 2px tone-line 全边框，行与行之间另有 2px tone-line 上边线，读数靠 hover。

| 部位 | 静止 | hover |
| --- | --- | --- |
| 表头 `thead th` | 无底色，加粗，文字取 `--sw-ink-strong` | 无此态 |
| 行 `tbody tr` | 透明 | `--sw-tone`，过渡 160ms |

合并单元格的处理与默认主题相同：hover 用行背景（`tbody tr:hover`），`rowspan` 单元格在它覆盖的其他行里也会一起染上；指针停在跨行单元格内部时只命中它所属的那一行。

### 浮窗

三种浮窗共用直角与「无阴影」，差别只在描边与底色：

| 种类 | 成员 | 描边 | 底色 | 其它 |
| --- | --- | --- | --- | --- |
| **组件浮窗** | widgets 的 popup（`.page-right-popups-div`） | 3px 墨色 `--sw-border` | paper | 无 backdrop-filter |
| **常规浮窗** | gitalk 评论卡 `.gt-comment-content`、`.gt-popup` 菜单、关于页右侧面板 | 2px tone-line | paper | 无阴影 |
| **突出浮窗** | 博主自己的评论（`.gt-comment.gt-comment-admin`） | 同常规浮窗 | `--sw-tone` | 只靠底色区分身份 |

### 短评集

与默认主题同一套引文流，但线全部换成灰与墨：

| 元素 | 规格 |
| --- | --- |
| 年份区 | 标题左对齐、`--sw-ink-strong`、2.25rem、下压一条 3px `--sw-border`；标题左侧是年份图标 |
| 年份图标 | 原生 512×512 RGBA 图片，`filter: grayscale(1)`；兼作开合指示：收起 `rotate(-14deg) scale(0.9)`、`opacity 0.5`；展开回正、不透明；过渡 200ms |
| 年份 hover | 标题出现 `--sw-accent` 下划线，字色不变 |
| 原来的年份分隔线 | 移除（图标搬到标题左侧，两条主题色短横线不再绘制） |
| 条目 | 无卡片、无底色；每条上方 2px `--sw-tone-line` 分隔（首条无）；头像 2.25rem |
| 引用线 | 2px `--sw-tone-line`，hover 过渡到 `--sw-ink-strong`，160ms |
| 条内分隔 | 2px dotted `--sw-tone-line`；原走动图标保留并转灰 |

### cursor

同默认主题：navbar 与侧栏的激活项仍可点击，`cursor: pointer`；docsify tabs、TOC 切换器与字号预设的激活项点了没有效果，`cursor: default`；面包屑当前页不是链接，无需 cursor 规则；其余可交互元素保持 `cursor: pointer`。
