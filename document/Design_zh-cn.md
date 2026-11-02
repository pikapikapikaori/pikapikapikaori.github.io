# pikapikapi-blog

[English](./Design.md) | 简体中文

> 短评集（`writings/BriefComments.md`）是特殊页面，设计独立，不跟随本文档的全局设计。

## 默认主题

### 变量命名

所有变量前缀恒为 `global`，完整写法是 `--global-<name>-<level>-<suffix>`；`level` 是下面讲的五级分档，`suffix` 取变量表的「变量后缀」列，两者都按需省略。

框架变量按「离中档的距离」分档，最多每侧五级，中档统一叫 `normal`，从上到下共 11 级：

- `ultra-<suffix>`
- `extra-<suffix>`
- `very-<suffix>`
- `<suffix>`
- `semi-<suffix>`
- `normal`
- `semi-<suffix>`
- `<suffix>`
- `very-<suffix>`
- `extra-<suffix>`
- `ultra-<suffix>`

其中 `none` 表示 0，`full` 表示满值（若该类有，如 `--global-opacity-full: 1`）。

| 变量语义 | 变量名称 | 变量后缀 | 备注 |
| --- | --- | --- | --- |
| 主题色 | `theme-color` | `weak` / `strong` | 按明度偏移分档，`normal` 为中档；另有叠透明度的 `blur`、向白偏移的 `light`、翻明度作反色墨的 `dark` |
| 透明度 | `opacity` | `weak` / `strong` | `none` 为 0、`full` 为 1 |
| 边框 | `border` | `weak` / `strong` | 实线；`weak` 是点线 |
| 边框宽度 | `border-<level>-width` | — | 与 `border` 同档 |
| 内阴影 | `inset-box-shadow` | `strong` | 实心按钮的墨色内环用 |
| 圆角 | `border-radius` | `small` / `big` | `none` 是直角、`round` 是圆形 |
| 裁剪 | `clip-path-vertical` | `none` / `full` | 垂直方向上从顶边展开 / 折叠的两个端点 |
| 过渡时长 | `transition-duration` | `fast` / `slow` | 全部悬停反馈用 `normal`，更短与更长的档位留给换主题、装饰动画等其它动效 |
| 变换比 | `transform-ratio` | `small` / `big` | 供悬停、选中、按下的缩放取用 |
| 容器尺寸 | `container-width`、`container-height`、`content-width`、`sidebar-width` | — | 文章内容器、正文栏、侧栏 |

过渡按用途提供四套通用模板：

| 变量名称 | 覆盖的属性 |
| --- | --- |
| `transition-color` | `color`、`text-decoration-color`、`border-color`、`outline-color`、`box-shadow`、`background-color` |
| `transition-transform` | `transform` |
| `transition-filter` | `opacity`、`filter` |
| `transition-open-vertical`、`transition-close-vertical` | `clip-path`、`visibility` |

### 交互标准

#### 四级阶梯

所有可交互元素都沿同一条四级阶梯上行。每一列都是从该列自身的静止状态起算的阶梯，元素只沿自己所在的那一列上行，且不跳级；**选中项被悬停时停留在第 2 级**，不退回第 1 级。链接列从第 2 级起步（静止为第 2 级，悬停换第 3 级），所以选中态比悬停再深一级，取 `accent-level-4`。

| 级 | 语义 | 变量后缀 | 代表色变量 | 备注 |
| --- | --- | --- | --- | --- |
| 0 | 静止 | `rest` | — | 静止不显示任何强调 |
| 1 | 悬停（`:hover`） | `hover` | `accent-level-1` | 只表达“可以点”，文字不动 |
| 2 | 选中（`.active`）、聚焦（`:focus`） | `active` | `accent-level-2` | 比第 1 级深一级；选中项被悬停时停在本级 |
| 3 | 按下（`:active`） | `press` | `accent-level-3`（底、边）、`accent-level-4`（空心描边） | 按住期间生效，松开回到悬停或选中。导航链接、行内链接、色卡点击无效果，故不设按下态 |

键盘焦点 `:focus-visible` 不属于阶梯，并且刻意与悬停保持差别。它作用于 `a[href]`、`button`、`summary`、`select`、`[tabindex]` 以及各类非文本输入的 `input`；文本输入框与 `textarea` 不画焦点环。

### 组件类型

按交互机制归类。变量前缀恒为 `global`，合起来是 `--global-<name>-<suffix>`；`suffix` 见四级阶梯表的「变量后缀」列，`name` 与它落在哪个属性上见下表的「变量名称」列（写作 `通道 (属性)`）。

| 类型 | 分组 | 覆盖元素 | 变量名称 | 缺失等级 | 鼠标指针样式 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| **导航链接** | 链接 | 顶栏 navbar、侧栏、docsify tabs、TOC 切换器、面包屑 | `nav-bar (border-bottom、border-left)` | `press` | `pointer`；docsify tabs、TOC 切换器的选中项 `default`；面包屑当前页不是链接，无规则 | 点击只是重新进入当前页，没有额外反馈。面包屑的当前页语义上是选中态，取第 2 级 |
| **导航展开按钮** | 按钮 | 顶栏里带子菜单的项（`语言`） | `nav-bar (border-bottom)` | `press` | `pointer` | 点击开合，不随悬停展开；`makeButtonLike` 只给它 `tabindex="0"`，Enter / Space 等同点击；焦点离开整项即收起 |
| **行内文字链接 1** | 链接 | 正文内联链接（`p` / `li` / `blockquote` / `table` 内的 `a`）、封面内的正文链接 | `link-decoration (text-decoration-color)` | `active`、`press` | `pointer` | 静止是第 2 级下划线，悬停换第 3 级；字色不变，点击即跳转 |
| **行内文字链接 2** | 链接 | 站名、标题锚点、`summary`、分页标题、搜索结果、评论链接、gitalk 提示文字 | `link-decoration (text-decoration-color)` | `press` | `pointer` | 同上，只是静止为透明下划线；选中态比悬停再深一级（`accent-level-4`），落在 gitalk 用户名菜单打开与 `details[open] > summary` 上，选中项被悬停时停在本级 |
| **正文图标链接** | 链接 | about-me 图标 | `scale (transform)` | `rest`、`active` | `pointer` | 观感与幽灵图标完全相同，但语义是正文里的图标链接，所以单独成行，不参与按钮层级 |
| **幽灵图标** | 按钮 | widgets 九个图标、侧栏开关、回顶部、阅读进度环、评论 like/edit/reply、封面 chevron | `scale (transform)` | `rest`、`active` | `pointer` | 只有缩放，没有底也没有描边 |
| **输入框** | 输入 | 搜索框、分页输入框、gitalk 文本框 | `control-border (border-color)` | `press` | `text` | `active` 兼作 `:focus`，与选中同值 |
| **选择类色卡** | 按钮 | 主题预设、颜色预设、色轮 thumb | `control-border (border-color)`、`scale (transform)` | `rest`（`scale`） | `pointer` | 按下即“预告选中”：未选中的色卡按下时呈现第 2 级，松开正好落入选中；已选中的色卡按下时再上一级。色轮 thumb 沿用同一组 `control-border` 与 `scale`，按下取第 2 级描边与第 3 级缩放，且按下的过渡只留 `transform`；它的填充恒为主题色实色 |
| **表面（空心）按钮** | 按钮 | toc 分页箭头、看大图左右箭头、gitalk 预览、字号预设 | `surface-hollow (background-color)`、`surface-hollow-border (border-color)`、`surface-hollow-text (color)` | `press` | `pointer`；字号预设的选中项 `default` | 只有描边、没有实心底，选中态只用于字号预设；文字始终跟随描边取同一档，因此不会掉对比度 |
| **表面（实心）按钮** | 按钮 | gitalk 登录与发布、cover 主按钮、复制代码 | `surface-solid (background-color)`、`surface-solid-text (color)`、`surface-solid-ring (box-shadow)`、`surface-solid-inset-ring (box-shadow)` | `rest`（`surface-solid-ring` 缺 `rest`；`surface-solid-inset-ring` 缺 `rest`、`active`；`surface-solid-text` 无后缀） | `pointer` | 静止即实心底。判定：有实心底为实心，只有描边为空心。 |

### 其他组件

#### 引导线

所有引导线在视觉上统一为 2px：元素在引导线所在位置本来没有边框时，引导线自身就是 2px；如果该位置本来就有一条边框，引导线就画在这条边框之上，只让突出于原边框的部分保持 2px，于是总宽变成「原边框 + 2px」。

同一组导航项之间不留间隙，条才能连续相接，间距由各项的内边距承担。

#### 表格

| 悬停等级 | 悬停语义 | 变量名称 | 备注 |
| --- | --- | --- | --- |
| 0 | 静止 | — | 表头（`thead th`）不参与悬停，加粗且不带底色；没有合并单元格的表只有第 2 级一档 |
| 1 | 悬停：这一组的浅托底 | `table-group (background-color)` | 合并块内的其他行（`tr.is-group-hover`） |
| 2 | 选中：指针所在行 | `table-row (background-color)` | 当前行里 `rowspan === 1` 的普通格（`td.is-row-hover`）；行背景铺满整条带，合并出来的单元格在被覆盖的每一行里都会染上 |

#### 浮窗

所有浮窗点空白处、或键盘焦点离开「触发图标 + 弹层」这一组时自动收起。三种浮窗共用大面圆角 `--global-el-border-radius`。

| 类型 | 覆盖元素 | 变量名称 | 备注 |
| --- | --- | --- | --- |
| **组件浮窗** | widgets 的 popup（`.page-right-popups-div`） | `theme-color (border-color)`、`theme-color-blur-ultra-weak (background-color)`、`backdrop-filter` | — |
| **常规浮窗** | gitalk 评论卡 `.gt-comment-content`、`.gt-popup` 菜单、关于页右侧面板 `.main-page-right-panel-container` | `border-color-strong (border-color)`、`zebra-bg (background-color)` | — |
| **突出浮窗** | 博主自己的评论（`.gt-comment.gt-comment-admin`） | `border-color-strong (border-color)`、`theme-color-blur-ultra-weak (background-color)` | 只靠底色区分身份，其它与常规浮窗一致 |

## swiss 主题

`swiss` 用「纸 / 墨 / 线」的版面语言。它与默认主题共用同一套交互意图，但取色只有黑白灰，主题色退到极少数几处（见「主题色预算」）。整本主题只有一档主题色，没有能再深一级的色阶，所以 `hover` 与 `active` 同值：需要选中态的地方不另设表现，与悬停完全相同。

### 主题色预算

swiss 只在下面这些位置使用主题色，其余一律纸 / 墨 / 灰：

| 位置 | 用途 |
| --- | --- |
| 文章报头 `--sw-mastline::before` 的短横线 | 正面装饰 |
| 页脚 `#footer-under-gitalk` 顶部的 6px 横线 | 正文与胶印页脚的分界 |
| 行内文字链接的悬停下划线 | 可点反馈 |
| 分页标题、目录页标题的悬停下划线 | 可点反馈 |
| `mark` 高亮底、`::selection` 底 | 选区 / 高亮语义 |
| 颜色选择器 thumb 的填充 | 它本身就是取色控件 |
| `--sw-accent` | 上面几处的公共别名 |

### 组件类型

按交互机制归类。变量有两种前缀：swiss 自己的 `sw`（`--sw-<name>-<suffix>`），以及被 swiss 覆写的框架变量沿用的 `global`（`--global-<name>-<level>-<suffix>`）；`suffix` 见默认主题「四级阶梯」的「变量后缀」列，`name` 与它落在哪个属性上见下表的「变量名称」列（写作 `通道 (属性)`）。颜色一律取自调色板：纸 `--sw-paper`、墨 `--sw-ink` / `--sw-ink-strong`、纸灰 `--sw-tone`、淡线 `--sw-tone-line`。

| 类型 | 分组 | 覆盖元素 | 变量名称 | 缺失等级 | 鼠标指针样式 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| **导航链接** | 链接 | 顶栏 navbar、侧栏、docsify tabs、TOC 切换器、面包屑 | `--sw-nav (border-bottom、border-left)` | `press` | `pointer`；docsify tabs、TOC 切换器的选中项 `default`；面包屑当前页不是链接，无规则 | tabs 例外，静止画一条 `--sw-border-soft-rule` 基线。面包屑当前页取第 2 级的条 + 加粗，文字颜色不变 |
| **导航展开按钮** | 按钮 | 顶栏里带子菜单的项（`言語` / `Language`） | `--sw-nav (border-bottom)` | `press` | `pointer` | 点击开合，不随悬停展开；`makeButtonLike` 只给它 `tabindex="0"`，Enter / Space 等同点击；焦点离开整项即收起 |
| **行内文字链接 1** | 链接 | 正文内联链接（`p` / `li` / `blockquote` / `table` 内的 `a`）、封面内的正文链接 | `--sw-link-hover (text-decoration-color)` | `active`、`press` | `pointer` | 静止是墨色下划线，悬停换 `--sw-accent`，字色不变 |
| **行内文字链接 2** | 链接 | 站名、标题锚点、`summary`、分页标题、目录页标题、搜索结果、评论链接、gitalk 提示文字 | `--sw-link-hover (text-decoration-color)` | `active`、`press` | `pointer` | 同上，只是静止为透明下划线 |
| **正文图标链接** | 链接 | about-me 图标 | `--sw-on (color)` | `active`、`press` | `pointer` | swiss 不缩放，只把文字色换成墨色；观感接近幽灵图标，但语义是正文里的图标链接 |
| **不带激活态按钮** | 按钮 | widgets 九个图标、侧栏开关、toc 分页箭头、看大图左右箭头、cover chevron | `--sw-fill (background-color)`、`--sw-line (border-color)`、`--sw-on (color)` | `active` | `pointer` | 悬停即纸墨互换 |
| **带激活态按钮** | 按钮 | gitalk 预览、TOC 切换器、字号预设 | `--sw-fill (background-color)`、`--sw-fill-inverse (background-color)`、`--sw-line (border-color)`、`--sw-on (color)` | — | `pointer`；TOC 切换器、字号预设的选中项 `default` | `active` 为墨底；激活后再悬停反相成 `--sw-fill-inverse`；按下与悬停同态；gitalk 预览的激活条件是 `.gt-header-textarea` 带 `hide` 类 |
| **常驻激活按钮** | 按钮 | gitalk 登录与发布、复制代码 | `--sw-fill (background-color)`、`--sw-fill-inverse (background-color)`、`--sw-line (border-color)`、`--sw-on (color)` | — | `pointer` | 静止即激活态，悬停褪色 |
| **输入框** | 输入 | 搜索框、分页输入框、gitalk 文本框 | `--sw-line (border-color)` | `press` | `text` | `hover` 兼作 `:focus` |
| **选择类色卡** | 按钮 | 主题预设、颜色预设、色轮 thumb | `--sw-line (border-color)`、`--sw-swatch (border-color)`、`--sw-ink-strong (outline-color)` | `press` | `pointer` | 按下与悬停同态：主题预设与颜色预设的边框走 `--sw-line`，悬停、激活与聚焦时再加一圈 2px（`--sw-rule-mid`）墨色 outline，且一律不缩放；色轮 thumb 只走 `--sw-swatch` 描边，不加 outline、不缩放，描边过渡只在悬停时生效，填充取主题色 |

### 其他组件

#### 浮窗

三种浮窗共用直角与「无阴影」。

| 类型 | 覆盖元素 | 变量名称 | 备注 |
| --- | --- | --- | --- |
| **组件浮窗** | widgets 的 popup（`.page-right-popups-div`） | `--sw-border`、`--sw-paper (background-color)` | — |
| **常规浮窗** | gitalk 评论卡 `.gt-comment-content`、`.gt-popup` 菜单、关于页右侧面板 | `--sw-border-soft`、`--sw-paper (background-color)` | — |
| **突出浮窗** | 博主自己的评论（`.gt-comment.gt-comment-admin`） | `--sw-border-soft`、`--sw-tone (background-color)` | 只靠底色区分身份 |
