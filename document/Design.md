# pikapikapi-blog

English | [简体中文](./Design_zh-cn.md)

> The brief-comments page (`writings/BriefComments.md`) is a special page: its design is independent and does not follow the global design described here.

## Default Theme

### Variable Naming

Every variable carries the `global` prefix, so the full form is `--global-<name>-<level>-<suffix>`; `level` is the five-step grading described below and `suffix` comes from the "Suffix" column of the variable table, and either may be omitted.

Framework variables are graded by distance from the middle level, at most five steps per side, with the middle level always called `normal`; top to bottom there are 11 steps:

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

`none` means 0 and `full` means the maximum value (where the class has one, e.g. `--global-opacity-full: 1`).

| Meaning | Name | Suffix | Notes |
| --- | --- | --- | --- |
| Theme colour | `theme-color` | `weak` / `strong` | graded by a lightness offset, with `normal` in the middle; `blur` lays transparency over it, `light` offsets it towards white, and `dark` flips its lightness into the inverted ink |
| Opacity | `opacity` | `weak` / `strong` | `none` is 0 and `full` is 1 |
| Border | `border` | `weak` / `strong` | solid; `weak` is dotted |
| Border width | `border-<level>-width` | — | the same steps as `border` |
| Inset shadow | `inset-box-shadow` | `strong` | used by the ink ring of a solid button |
| Corner radius | `border-radius` | `small` / `big` | `none` is square and `round` is a circle |
| Clip | `clip-path-vertical` | `none` / `full` | the two end points of a vertical reveal / collapse from the top edge |
| Transition duration | `transition-duration` | `fast` / `slow` | every hover feedback uses `normal`; the longer and shorter steps are reserved for other motion such as theme switching and decorative animation |
| Scale ratio | `transform-ratio` | `small` / `big` | used by the hover, selected and press scales |
| Container size | `container-width`, `container-height`, `content-width`, `sidebar-width` | — | the article content container, the body column, the sidebar |

Transitions come in four general templates by purpose:

| Name | Properties covered |
| --- | --- |
| `transition-color` | `color`, `text-decoration-color`, `border-color`, `outline-color`, `box-shadow`, `background-color` |
| `transition-transform` | `transform` |
| `transition-filter` | `opacity`, `filter` |
| `transition-open-vertical`, `transition-close-vertical` | `clip-path`, `visibility` |

### Interaction Standard

#### Emphasis Ladder

Every interactive element walks up one four-step ladder. Each column is that column's own ramp, measured from its resting state, and an element only walks up its own column without skipping a step; **a selected control that is hovered stays on level 2** and does not fall back to level 1. The link columns start at level 2 (level 2 at rest, level 3 on hover), so their selected state goes one step deeper still, to `accent-level-4`.

| Level | Meaning | Suffix | Colour variable | Notes |
| --- | --- | --- | --- | --- |
| 0 | rest | `rest` | — | rest shows no emphasis at all |
| 1 | hover (`:hover`) | `hover` | `accent-level-1` | says "this can be clicked", the text stays put |
| 2 | selected (`.active`) / focus (`:focus`) | `active` | `accent-level-2` | one step deeper than level 1; a hovered selected control stays here |
| 3 | press (`:active`) | `press` | `accent-level-3` (fill and border), `accent-level-4` (hollow border) | held while the pointer is down and released back to hover or to the selected state. Navigation links, inline links and swatches do nothing when clicked, so they have no press state |

Keyboard focus `:focus-visible` is not part of the ladder and deliberately differs from hover. It applies to `a[href]`, `button`, `summary`, `select`, `[tabindex]` and every non-text `input`; text inputs and `textarea` draw no ring.

### Component Types

Grouped by interaction mechanism. Every variable carries the `global` prefix, so the full form is `--global-<name>-<suffix>`; the `suffix` comes from the "Suffix" column of the emphasis ladder, and the `name` with the property it lands on comes from the "Variable names" column below, written `channel (property)`.

| Type | Group | Covered elements | Variable names | Missing levels | Cursor | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Navigation link** | Link | top navbar, sidebar, docsify tabs, TOC switcher, breadcrumb | `nav-bar (border-bottom, border-left)` | `press` | `pointer`; selected items of docsify tabs and the TOC switcher `default`; the current breadcrumb is not a link and has no rule | clicking only re-enters the current page and gives no extra feedback. The current breadcrumb is selected in meaning and takes level 2 |
| **Nav disclosure** | Button | the navbar item that holds a submenu (`语言`) | `nav-bar (border-bottom)` | `press` | `pointer` | a click opens and closes it and hover never opens it; `makeButtonLike` only gives it `tabindex="0"`, with Enter / Space acting as a click; focus leaving the item closes it |
| **Inline text link 1** | Link | links inside the article body (`p` / `li` / `blockquote` / `table`), links inside the cover | `link-decoration (text-decoration-color)` | `active`, `press` | `pointer` | the underline is level 2 at rest and level 3 on hover; the text keeps its colour and a click navigates away |
| **Inline text link 2** | Link | site name, heading anchor, `summary`, pagination title, search results, comment links, gitalk tip | `link-decoration (text-decoration-color)` | `press` | `pointer` | the same, except the resting underline is `transparent`; the selected state goes one step deeper (`accent-level-4`) and lands on the gitalk user name while its menu is open and on `details[open] > summary`, with a hovered selected item staying there |
| **Inline icon link** | Link | the about-me icons | `scale (transform)` | `rest`, `active` | `pointer` | it looks exactly like a ghost icon, but it is a link inside the article, so it gets its own row and takes no part in the button ladder |
| **Ghost icon** | Button | the nine widgets, sidebar toggle, back to top, reading progress, comment like/edit/reply, cover chevron | `scale (transform)` | `rest`, `active` | `pointer` | scale alone, no fill and no border |
| **Input** | Input | search box, pagination input, gitalk textarea | `control-border (border-color)` | `press` | `text` | `active` doubles as `:focus` and shares the selected value |
| **Selection swatch** | Button | theme presets, colour presets, colour picker thumb | `control-border (border-color)`, `scale (transform)` | `rest` (`scale`) | `pointer` | press previews the selection: an unselected swatch shows level 2 while held and lands on the selected state on release, a selected one goes one step further. The colour picker thumb uses the same `control-border` and `scale`, taking the level 2 border and the level 3 scale while held, with `transform` as its only transition then; its fill is always the solid theme colour |
| **Hollow surface button** | Button | toc pagination arrows, full-image arrows, gitalk preview, font presets | `surface-hollow (background-color)`, `surface-hollow-border (border-color)`, `surface-hollow-text (color)` | `press` | `pointer`; the selected font preset `default` | border only, no solid fill, and the selected state is used by the font presets alone; the text always follows the border's step, so it never loses contrast |
| **Solid surface button** | Button | gitalk login and publish, cover primary button, copy code | `surface-solid (background-color)`, `surface-solid-text (color)`, `surface-solid-ring (box-shadow)`, `surface-solid-inset-ring (box-shadow)` | `rest` (`surface-solid-ring` lacks `rest`; `surface-solid-inset-ring` lacks `rest` and `active`; `surface-solid-text` has no suffix) | `pointer` | solid at rest. How to tell them apart: a solid fill means solid, a border alone means hollow. |

### Other Components

#### Guide Line

All guide lines are 2px to the eye: where the element has no border at the guide line's position, the guide line itself is 2px; where a border already runs there, the guide line is drawn on top of it and only the part protruding beyond that border stays 2px, so the total width becomes "existing border + 2px".

Items inside one group of navigation links leave no gap between them, so their bars meet; the spacing comes from each item's padding.

#### Tables

| Hover level | Hover meaning | Variable names | Notes |
| --- | --- | --- | --- |
| 0 | rest | — | the header (`thead th`) takes no part in hover, staying bold and unfilled; a table without merged cells shows level 2 only |
| 1 | hover: a faint ground for this group | `table-group (background-color)` | the other rows of a merged block (`tr.is-group-hover`) |
| 2 | selected: the row under the pointer | `table-row (background-color)` | the plain cells of the current row whose `rowspan === 1` (`td.is-row-hover`); a row background fills the whole band, so a merged cell is tinted in every row it covers |

#### Popups

Every popup closes on a click outside it, and when keyboard focus leaves the "trigger + popup" pair. The three kinds share the large radius `--global-el-border-radius`.

| Type | Covered elements | Variable names | Notes |
| --- | --- | --- | --- |
| **Widget popup** | the widgets popup (`.page-right-popups-div`) | `theme-color (border-color)`, `theme-color-blur-ultra-weak (background-color)`, `backdrop-filter` | — |
| **Regular popup** | gitalk comment card `.gt-comment-content`, `.gt-popup` menu, about page right panel `.main-page-right-panel-container` | `border-color-strong (border-color)`, `zebra-bg (background-color)` | — |
| **Highlighted popup** | the blog owner's own comments (`.gt-comment.gt-comment-admin`) | `border-color-strong (border-color)`, `theme-color-blur-ultra-weak (background-color)` | identity is told by the fill alone, everything else matches a regular popup |

## swiss Theme

`swiss` speaks a "paper / ink / line" language. It shares the interaction intent of the default theme, but its palette is black, white and grey only, and the theme colour retreats to a handful of places (see "Theme Colour Budget"). The whole theme has a single step of theme colour and no darker step, so `hover` and `active` share one value: wherever a selected state is needed it adds nothing and looks exactly like hover.

### Theme Colour Budget

swiss uses the theme colour in these places only; everything else is paper, ink or grey:

| Place | Purpose |
| --- | --- |
| the short rule of the article masthead (`--sw-mastline::before`) | a decorative accent |
| the 6px rule on top of the footer (`#footer-under-gitalk`) | the boundary between the article and the letterpress footer |
| the hover underline of inline text links | clickable feedback |
| the hover underline of pagination and toc-page titles | clickable feedback |
| the `mark` fill and the `::selection` fill | highlight / selection meaning |
| the fill of the colour picker thumb | it is a colour-picking control |
| `--sw-accent` | the shared alias for the above |

### Component Types

Grouped by interaction mechanism. Variables carry one of two prefixes: swiss's own `sw` (`--sw-<name>-<suffix>`), and `global` (`--global-<name>-<level>-<suffix>`) for the framework variables swiss overrides; the `suffix` comes from the "Suffix" column of the default theme's emphasis ladder, and the `name` with the property it lands on comes from the "Variable names" column below, written `channel (property)`. Colours always come from the palette: paper `--sw-paper`, ink `--sw-ink` / `--sw-ink-strong`, paper grey `--sw-tone`, light line `--sw-tone-line`.

| Type | Group | Covered elements | Variable names | Missing levels | Cursor | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Navigation link** | Link | top navbar, sidebar, docsify tabs, TOC switcher, breadcrumb | `--sw-nav (border-bottom, border-left)` | `press` | `pointer`; selected items of docsify tabs and the TOC switcher `default`; the current breadcrumb is not a link and has no rule | tabs excepted, they draw a `--sw-border-soft-rule` baseline at rest. The current breadcrumb takes the level 2 bar and bold text, its colour unchanged |
| **Nav disclosure** | Button | the navbar item that holds a submenu (`言語` / `Language`) | `--sw-nav (border-bottom)` | `press` | `pointer` | a click opens and closes it and hover never opens it; `makeButtonLike` only gives it `tabindex="0"`, with Enter / Space acting as a click; focus leaving the item closes it |
| **Inline text link 1** | Link | links inside the article body (`p` / `li` / `blockquote` / `table`), links inside the cover | `--sw-link-hover (text-decoration-color)` | `active`, `press` | `pointer` | an ink underline at rest, `--sw-accent` on hover, the text colour unchanged |
| **Inline text link 2** | Link | site name, heading anchor, `summary`, pagination title, toc-page title, search results, comment links, gitalk tip | `--sw-link-hover (text-decoration-color)` | `active`, `press` | `pointer` | the same, except the resting underline is `transparent` |
| **Inline icon link** | Link | the about-me icons | `--sw-on (color)` | `active`, `press` | `pointer` | swiss never scales, so only the text colour changes; close to a ghost icon, but it is a link inside the article |
| **Unlatched button** | Button | the nine widgets, sidebar toggle, toc pagination arrows, full-image arrows, cover chevron | `--sw-fill (background-color)`, `--sw-line (border-color)`, `--sw-on (color)` | `active` | `pointer` | one feedback only: paper and ink swap on hover |
| **Latched button** | Button | gitalk preview, TOC switcher, font presets | `--sw-fill (background-color)`, `--sw-fill-inverse (background-color)`, `--sw-line (border-color)`, `--sw-on (color)` | — | `pointer`; the selected TOC switcher and font preset `default` | `active` is the ink fill; latched + hover inverts to `--sw-fill-inverse`; press equals hover; gitalk preview is latched while `.gt-header-textarea` carries the `hide` class |
| **Permanently latched button** | Button | gitalk login and publish, copy code | `--sw-fill (background-color)`, `--sw-fill-inverse (background-color)`, `--sw-line (border-color)`, `--sw-on (color)` | — | `pointer` | latched at rest; hover fades it |
| **Input** | Input | search box, pagination input, gitalk textarea | `--sw-line (border-color)` | `press` | `text` | `hover` doubles as `:focus` |
| **Selection swatch** | Button | theme presets, colour presets, colour picker thumb | `--sw-line (border-color)`, `--sw-swatch (border-color)`, `--sw-ink-strong (outline-color)` | `press` | `pointer` | press equals hover: a theme or colour preset takes its border from `--sw-line` and adds a 2px (`--sw-rule-mid`) ink outline on hover, active and focus, and never scales; the colour picker thumb takes `--sw-swatch` only, adding no outline and no scale, its border transitioning on hover only, and its fill is the theme colour |

### Other Components

#### Popups

All three kinds share square corners and no shadow.

| Type | Covered elements | Variable names | Notes |
| --- | --- | --- | --- |
| **Widget popup** | the widgets popup (`.page-right-popups-div`) | `--sw-border`, `--sw-paper (background-color)` | — |
| **Regular popup** | gitalk comment card `.gt-comment-content`, `.gt-popup` menu, about page right panel | `--sw-border-soft`, `--sw-paper (background-color)` | — |
| **Highlighted popup** | the blog owner's own comments (`.gt-comment.gt-comment-admin`) | `--sw-border-soft`, `--sw-tone (background-color)` | identity is told by the fill alone |
