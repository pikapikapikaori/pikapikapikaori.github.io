# pikapikapi-blog

[English](./Design.md) | 简体中文

## 交互标准

适用于默认主题，即除 `swiss` 之外的全部主题；`swiss` 自带一套交互规则。

### 三级阶梯

所有可交互元素都沿同一条阶梯上行。每一列都是从该列自身静止状态起算的三步阶梯，元素只沿自己所在的那一列上行，且不跳级。

| 级 | 语义 | 描边 / 条 | 表面（空心） | 表面（实心） | 缩放 |
| --- | --- | --- | --- | --- | --- |
| 静止 | — | 无 / 中性 1px | 透明 | accent 实色 | 1 |
| 1 | hover：可以点 | accent 45% | accent 45% | `-7` | 1.1 |
| 2 | 选中（`.active`）/ 聚焦（`:focus`） | accent 实色 | accent 55% | 无此态 | 1.2 |
| 3 | 按下（`:active`） | `-7` | accent 55% | `-8` | 1.3 |

阶梯使用的变量：

- accent 实色：`var(--theme-color)`
- accent 45%：`var(--global-theme-color-blur-weak)`
- accent 55%：`var(--global-theme-color-blur-strong)`
- `-7`、`-8`：`var(--global-theme-color-7)`、`var(--global-theme-color-8)`
- 缩放：`var(--global-transform-ratio-small)` 1.1、`var(--global-transform-ratio-normal)` 1.2、`var(--global-transform-ratio-big)` 1.3

表面（实心）这一列的起点就在 accent 实色，所以它的 hover 落在其它列的第三级位置上。这不是另一条规则，而是同一条规则遇到"起点已在高位"时的结果。

表面（空心）这一列没有选中态，因此只需要两级：hover 45%，按下 55%。

#### 按下

按下即 `:active`：指针停留在元素上按下的那段时间生效，松开后回到 hover 态或选中态。

以下元素不提供按下态，因为点击它们没有效果：navbar 项目、侧栏项目、docsify tabs、TOC 切换器按钮。它们的选中项同时使用 `cursor: default`。

选择类色卡改为"预告选中"：按下未选中的色卡时呈现第二级（实色描边、缩放 1.2），松开正好落入选中态；按下已选中的色卡则再上一级（`-7`、缩放 1.3）。

#### 键盘焦点

`:focus-visible` 不属于阶梯，并且刻意与 hover 保持差别：

- `outline: 2px solid var(--global-theme-color-8)`，`outline-offset: 2px`
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

由其组合出：`--global-transition-color`（color、text-decoration-color、border-color、outline-color、box-shadow、background-color）、`--global-transition-transform`、`--global-transition-filter`，以及 `-color-fast`、`-filter-fast`、`-transform-slow` 三个变体。

全部 hover 反馈使用 500ms 这一组；更短与更长的档位留给换主题、装饰动画等其它动效。

#### 圆角

当前变量：

| 变量 | 值 |
| --- | --- |
| `--global-el-border-radius` | 0.625rem |
| `--global-el-border-radius-small` | 0.125rem |
| `--global-el-border-radius-none` | 0 |
| `--global-icon-border-radius` | 0.3125rem |
| `--global-widget-border-radius` | 0.3rem |
| `--global-avatar-border-radius` | 50% |

标准保留三档：大面使用 `--global-el-border-radius`（0.625rem），控件一律使用 `--global-control-border-radius`（0.3125rem），直角使用 `0`。头像的圆角属于形状，不计入档位。

### 示例：元素归属

| 元素 | 静止 | hover（1） | 选中（2） | 按下（3） |
| --- | --- | --- | --- | --- |
| navbar 项目 | 2px 透明底边 | 2px 45% 底边 | 2px 实色底边，文字 accent + 加粗 | 无 |
| 侧栏项目 | 2px 透明左边 | 2px 45% 左边（1px 引导线内为 3px） | 2px 实色左边（引导线内 3px），文字 accent + 加粗 | 无 |
| docsify tabs | 3px 透明底边 | 3px 45% 底边 | 3px 实色底边，文字 accent + 加粗 | 无 |
| TOC 切换器 | 3px 透明底边 | 3px 45% 底边 | 3px 实色底边，文字 accent + 加粗 | 无 |
| 行内文字链接（正文、面包屑、站名、标题锚点、`summary`、分页标题、搜索与评论链接） | 正文为实色下划线，其余透明 | `-7` 下划线 | — | — |
| 幽灵图标（widgets、两处分页箭头、回顶部、阅读进度环、评论 like/edit/reply、about-me、文字内 svg） | 1 | 1.1 | — | 1.2 |
| 输入框（搜索、分页输入框、gitalk 文本框） | 中性描边 | 45% 描边 | `:focus` 实色描边 | — |
| 选择类色卡 | 中性描边，1 | 45% 描边，1.1 | 实色描边，1.2 | `-7` 描边，1.3 |
| 表面（空心）按钮（复制代码、评论内的文字按钮） | 透明 | 45% 表面 | — | 55% 表面 |
| 表面（实心）按钮（gitalk 登录与发布、cover 主按钮） | accent 底色 | `-7` 底色 | — | `-8` 底色 |

条宽随容器而定：accent 条比容器自身的基准线宽 2px。navbar 2px、侧栏 2px（在 TOC 侧栏的 1px 引导线内变为 3px）、docsify tabs 3px（其基准线 1px）、TOC 切换器 3px（其基准线 1px）。hover 与选中同宽，只差颜色。

### 示例：cursor

navbar、侧栏、docsify tabs、TOC 切换器的选中项使用 `cursor: default`，因为点击它们没有效果；其余可交互元素保持 `cursor: pointer`。
