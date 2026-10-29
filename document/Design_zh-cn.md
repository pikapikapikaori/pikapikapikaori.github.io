# pikapikapi-blog

[English](./Design.md) | 简体中文

## 交互标准

适用于默认主题，即除 `swiss` 之外的全部主题；`swiss` 自带一套交互规则。

### 三级阶梯

所有可交互元素都沿同一条阶梯上行。每一列都是从该列自身静止状态起算的三步阶梯，元素只沿自己所在的那一列上行，且不跳级。

| 级 | 语义 | 描边 / 条 | 表面（空心） | 表面（实心） | 文字 / 图标 | 缩放 |
| --- | --- | --- | --- | --- | --- | --- |
| 静止 | — | 无 / 中性 1px | 透明 | accent 实色 | accent | 1 |
| 1 | hover：可以点 | accent 45% | accent 45% | `-7` | `-7` | 1.1 |
| 2 | 选中（`.active`）/ 聚焦（`:focus`） | accent 实色 | accent 55% | 无此态 | — | 1.2 |
| 3 | 按下（`:active`） | `-7` | accent 55% | `-8` | `-7` | 1.3 |

三条推论，都不是额外规则：

- **表面（实心）** 的起点就在 accent 实色，所以它的 hover / 按下只能继续上行，落在第 3 / 第 4 级。
- **表面（空心）** 没有选中态，所以它只需要两级：hover 45%，按下 55%。
- **表面（空心）的描边** 从第 1 级起步：静止 45%、hover 实色、按下 `-7`。这和“实心按钮的底色从第 2 级起步”是同一条规则——起点高就少走一步。

文字列只适用于表面（空心）按钮；表面（实心）按钮的文字与图标恒为 `--global-surface-solid-text`（亮色），因为底色加深只会提高对比度，不需要跟着变。

#### 按下

按下即 `:active`：指针停留在元素上按下的那段时间生效，松开后回到 hover 态或选中态。

以下元素不提供按下态，因为点击它们没有效果：navbar 项目、侧栏项目、docsify tabs、TOC 切换器按钮。

选择类色卡改为“预告选中”：按下未选中的色卡时呈现第二级（实色描边、缩放 1.2），松开正好落入选中态；按下已选中的色卡则再上一级（`-7`、缩放 1.3）。

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
| `--global-writing-container-height` | `var(--global-container-height)` | 该容器的高度引用 |
| `--global-sidenote-width` | `var(--global-container-width)` | sidenote 的最大宽度 |

后两个从前者派生：改 `--global-container-width` 会同时改变文章内容器宽度与 sidenote 宽度，改高度同理。

#### 交互变量

阶梯的颜色分两层：改主题色只改 `--theme-color`，改阶梯只改第一层，改某条通道的取色只改第二层。全部定义在 `base.css` 的「控件变量」一节。

**第一层：阶梯**

| 变量 | 值 | 含义 |
| --- | --- | --- |
| `--global-accent-level-1` | `var(--global-theme-color-blur-weak)`（accent 45%） | 第 1 级：hover |
| `--global-accent-level-2` | `var(--theme-color)`（accent 实色） | 第 2 级：选中 / 聚焦 |
| `--global-accent-level-3` | `var(--global-theme-color-7)` | 第 3 级：按下 |
| `--global-accent-level-4` | `var(--global-theme-color-8)` | 第 4 级：只有实心按钮的按下会用到 |
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
| `--global-surface-hollow-hover` | `var(--global-accent-level-1)` |
| `--global-surface-hollow-press` | `color-mix(in srgb, var(--theme-color) 55%, transparent)` |
| `--global-surface-hollow-border-rest` | `var(--global-accent-level-1)` |
| `--global-surface-hollow-border-hover` | `var(--global-accent-level-2)` |
| `--global-surface-hollow-border-press` | `var(--global-accent-level-3)` |
| `--global-surface-hollow-text-rest` | `var(--global-accent-level-2)` |
| `--global-surface-hollow-text-hover` | `var(--global-accent-level-3)` |
| `--global-surface-hollow-text-press` | `var(--global-accent-level-3)` |
| `--global-surface-solid-rest` | `var(--global-accent-level-2)` |
| `--global-surface-solid-hover` | `var(--global-accent-level-3)` |
| `--global-surface-solid-press` | `var(--global-accent-level-4)` |
| `--global-surface-solid-text` | `var(--accent-text-color)` |

### 组件类型

按交互机制归类，同一类型的元素共用同一套取值；表里的变量名对应「交互变量」一节。

| 类型 | 覆盖元素 | 静止 | hover（1） | 选中（2） | 按下（3） | 文字 / 图标 |
| --- | --- | --- | --- | --- | --- | --- |
| **导航链接** | 顶栏 navbar、侧栏、docsify tabs、TOC 切换器、面包屑 | `--global-nav-bar-rest` | `--global-nav-bar-hover` | `--global-nav-bar-active` 条 + accent 文字 + 加粗 | 无 | 继承 → 选中态 accent + 加粗 |
| **行内文字链接 1** | 正文内联链接（`p` / `li` / `blockquote` / `table` 内的 `a`）、封面内的正文链接 | `--global-link-decoration-rest` 下划线 | `--global-link-decoration-hover` 下划线 | — | — | 继承 |
| **行内文字链接 2** | 站名、标题锚点、`summary`、分页标题、搜索结果、评论链接、gitalk 提示文字 | `transparent` 下划线 | `--global-link-decoration-hover` 下划线 | — | — | 继承 |
| **幽灵图标** | widgets 九个图标、侧栏开关、回顶部、阅读进度环、评论 like/edit/reply、about-me 图标、封面 chevron | 1 | `--global-scale-hover` | — | `--global-scale-active` | accent，不随状态变化 |
| **输入框** | 搜索框、分页输入框、gitalk 文本框 | `--global-control-border-rest` | `--global-control-border-hover` | `--global-control-border-active`（`:focus`） | — | 继承 |
| **选择类色卡** | 主题 / 颜色 / 字号预设 | `--global-control-border-rest`，1 | `--global-control-border-hover`，`--global-scale-hover` | `--global-control-border-active`，`--global-scale-active` | 未选中：按选中态取值；已选中：`--global-control-border-press`，`--global-scale-press` | 继承 |
| **表面（空心）按钮** | toc 分页箭头、看大图左右箭头、gitalk 预览 | 描边 45%，底透明 | 描边实色，底 45%，文字 `-7` | — | 描边 `-7`，底 55%，文字 `-7` | accent → `-7` → `-7` |
| **表面（实心）按钮** | gitalk 登录与发布、cover 主按钮、复制代码 | `--global-surface-solid-rest` | `--global-surface-solid-hover` | — | `--global-surface-solid-press` | 恒为 `--global-surface-solid-text` |

面包屑的当前页（`.breadcrumb li.active`）不是链接，但语义上属于选中态，取第 2 级：`--global-nav-bar-active` 条 + accent 文字 + 加粗。

### 三种按钮

| 种类 | 面 | 描边 | 反馈 | 成员 |
| --- | --- | --- | --- | --- |
| **幽灵图标** | 无 | 无 | 只有缩放 | widgets 九个图标、侧栏开关、回顶部、阅读进度环、评论 like/edit/reply、about-me 图标、封面 chevron |
| **表面（空心）按钮** | 有（阶梯底色） | 1px（阶梯描边） | 描边、底色、文字一起走阶梯 | toc 分页箭头、看大图左右箭头、gitalk 预览 |
| **表面（实心）按钮** | 有（实心底） | 与底色同色 | 只有底色加深，文字色恒定 | gitalk 登录与发布、cover 主按钮、复制代码 |

判定方法：**有底色就是表面按钮，没有底色就是幽灵图标**；表面按钮再看静止时有没有实心底——有就是实心，只有描边就是空心。

### 引导线

导航链接的 accent 条永远比所在容器的引导线宽 2px，因此有引导线的地方是 3px、没有的地方是 2px，视觉上“粗出的量”保持一致；hover 与选中同宽，只差颜色。

| 容器 | 引导线 | 位置 | 条宽 |
| --- | --- | --- | --- |
| 顶栏 navbar | 无 | 底边 | 2px |
| 侧栏 | 无 | 左边 | 2px |
| 侧栏（目录模式，`.sidebar:has(.toc-btn.active-btn) .sidebar-nav>ul>li>ul>li ul ul` 这一层） | 1px | 左边 | 3px |
| docsify tabs | 1px | 底边 | 3px |
| TOC 切换器 | 1px | 底边 | 3px |
| 面包屑 | 无 | 底边 | 2px |

两点补充：

- 同一组导航项之间不留间隙（TOC 切换器 `gap: 0`），条才能连续相接；间距由各项的内边距承担。
- 面包屑的当前页允许自然换行，折行时每一行各画一条——这是预期行为（inline 元素的边框就是这样工作的）。面包屑字号 `0.9rem`，比顶栏小一级。

### 浮窗

三种浮窗共用大面圆角 `--global-el-border-radius`，差别只在描边用不用主题色、底色是斑马底还是主题色浅底：

| 种类 | 成员 | 描边 | 底色 | 其它 |
| --- | --- | --- | --- | --- |
| **组件浮窗** | widgets 的 popup（`.page-right-popups-div`） | 1px **accent** | `--global-theme-color-blur`（10% accent） | `backdrop-filter: var(--global-backdrop-filter)` |
| **常规浮窗** | gitalk 评论卡 `.gt-comment-content`、`.gt-popup` 菜单、关于页右侧面板 `.main-page-right-panel-container` | 1px `--border-color-strong` | `--zebra-bg` | — |
| **突出浮窗** | 博主自己的评论（`.gt-comment.gt-comment-admin`） | 同常规浮窗 | `--global-theme-color-blur`（10% accent） | 只靠底色区分身份，其它与常规浮窗一致 |

### cursor

navbar 与侧栏的选中项仍然可以点击（会重新进入当前页），所以保持 `cursor: pointer`；docsify tabs 与 TOC 切换器的选中项点了没有效果，使用 `cursor: default`；面包屑当前页不是链接，无需 cursor 规则；其余可交互元素保持 `cursor: pointer`。
