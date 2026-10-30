# pikapikapi-blog

English | [简体中文](./Design_zh-cn.md)

## Default Theme

Every theme except `swiss`. All colours derive from `--theme-color`, so changing the theme colour changes every state colour.

### Interaction Standard

#### Emphasis Ladder

Every interactive element walks up one four-step ladder. Each column is that column's own ramp, measured from its resting state, and an element only walks up its own column without skipping a step; **a selected control that is hovered stays on level 2** and does not fall back to level 1.

| Level | Meaning | Border / Bar | Surface (hollow) | Surface (solid) | Text / Icon | Scale | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | rest: colourless | none / neutral 1px | transparent | theme colour, solid | hollow `ultra-strong`; solid inverted ink | 1 | rest shows no emphasis at all |
| 1 | hover: this can be clicked | theme colour 45% | theme colour 30% | theme colour + 10% white, 2px 45% ink ring | hollow `ultra-strong`; solid inverted ink | 1.1 | says "this can be clicked", the text stays put |
| 2 | selected (`.active`) / focus (`:focus`) | theme colour, solid | theme colour 30%, `extra-strong` border | theme colour + 16% white, 2px solid ink ring | hollow `ultra-strong`; solid inverted ink | 1.2 | one step deeper than level 1; a hovered selected control stays here |
| 3 | press (`:active`) | `extra-strong` | theme colour 40%, `ultra-strong` border | theme colour + 24% white, 3px solid ink ring | hollow `ultra-strong`; solid inverted ink | 1.3 | press is `:active`, held while the pointer is down and released back to hover or to the selected state. Navigation links, inline links and swatches do nothing when clicked, so they have no press state |

Three consequences, none of them extra rules:

- **The fill of a solid button is already the lightest step.** The theme colour is the brightest colour there is, so deepening it drowns the inverted ink text (the resting state already measures 4.88 at worst). Its ladder therefore moves **towards white**, and the ink ring's density and weight carry the steps.
- **The text of a hollow button never changes.** `ultra-strong` is the step furthest from the paper, the fill only lays down 30% / 40%, and the text stays put, so contrast never drops in any state.
- **The border of a hollow button** starts on level 1: 45% at rest, solid on hover, `extra-strong` when selected, `ultra-strong` when pressed. This is the same rule as "the fill of a solid button starts on level 2" — a higher start point means fewer steps to walk.

The text column: a hollow button always uses `--global-theme-color-ultra-strong` (coloured text), a solid button always uses `--global-theme-color-dark-normal` (the theme colour flipped to the other end of the lightness axis). The two are told apart by hue — **hollow is "no fill + coloured text", solid is "coloured fill + inverted text"**.

#### Keyboard focus

`:focus-visible` is not part of the ladder and deliberately differs from hover:

- `outline: 2px solid var(--global-theme-color-ultra-strong)`, `outline-offset: var(--global-outline-offset)` (2px)
- the resting state reserves the ring with `outline: 2px solid transparent`, so focusing never shifts the layout
- applies to `a[href]`, `button`, `summary`, `select`, `[tabindex]` and the various `input` types

#### Level naming

Framework variables are graded by distance from the middle level, at most five steps per side, and the middle level is always `normal`:

```
none < ultra-<word> < extra-<word> < very-<word> < <word> < semi-<word> < normal
     < semi-<word> < <word> < very-<word> < extra-<word> < ultra-<word>
```

The `<word>` depends on the class: `weak` / `strong` for opacity and tone, `thin` / `bold` for font weight, `small` / `big` for size, `fast` / `slow` for duration. When a side currently has only two or three steps, they take the first slots counting outward from `normal`; `semi-*` is reserved for steps inserted closer to the middle later. `none` means 0 and `full` means the maximum value (e.g. `--global-opacity-full: 1`).

#### Transitions

Six durations are defined:

| Token | Value |
| --- | --- |
| `--global-transition-duration-fast` | 250ms |
| `--global-transition-duration-normal` | 500ms |
| `--global-transition-duration-slow` | 1s |
| `--global-transition-duration-very-slow` | 2s |
| `--global-transition-duration-extra-slow` | 3s |
| `--global-transition-duration-ultra-slow` | 5s |

Composed from them: `--global-transition-color` (color, text-decoration-color, border-color, outline-color, box-shadow, background-color), `--global-transition-transform`, `--global-transition-filter`, `--global-transition-font` (font-weight), plus the `-color-fast`, `-filter-fast` and `-transform-slow` variants.

All hover feedback uses the 500ms group; the shorter and longer groups are reserved for other motion such as theme switching and decorative animation.

`font-weight` interpolates as a number, but a static font only carries a few weights, so the browser picks the nearest available face while interpolating. The weight therefore changes as a softened step rather than a continuous morph.

#### Border radius

| Token | Value | Use |
| --- | --- | --- |
| `--global-border-radius-big` | 0.625rem | large surfaces: cards, popups, code blocks |
| `--global-border-radius-normal` | 0.3125rem | controls: buttons, inputs, swatches |
| `--global-border-radius-small` | 0.125rem | small parts |
| `--global-border-radius-none` | 0 | square corners |
| `--global-border-radius-round` | 50% | circles (avatars), a shape rather than a step |

Semantic aliases (never write the numbers directly): `--global-el-border-radius` = big, `--global-control-border-radius` = default step, `--global-avatar-border-radius` = round.

#### Size tokens

| Token | Value | Use |
| --- | --- | --- |
| `--global-container-width` | 25rem | the width of the article content container |
| `--global-container-height` | 18.75rem | the height of the article content container |

#### Interaction Tokens

The ladder's colours are defined in two layers: changing the theme colour means changing `--theme-color` only, changing the ladder means changing the first layer only, and re-colouring one channel means changing the second layer only. All of them live in the "control variables" block of `layout/variable.css`.

**Layer 1: the ladder**

| Token | Value | Meaning |
| --- | --- | --- |
| `--global-accent-level-1` | `var(--global-theme-color-blur-normal)` (theme colour 45%) | level 1: hover |
| `--global-accent-level-2` | `var(--global-theme-color-normal)` (theme colour, solid) | level 2: selected / focus |
| `--global-accent-level-3` | `var(--global-theme-color-extra-strong)` | level 3: the border of a selected hollow button, and press |
| `--global-accent-level-4` | `var(--global-theme-color-ultra-strong)` | level 4: the border of a pressed hollow button |
| `--global-scale-hover` | `var(--global-transform-ratio-small)` (1.1) | level 1 scale |
| `--global-scale-active` | `var(--global-transform-ratio-normal)` (1.2) | level 2 scale |
| `--global-scale-press` | `var(--global-transform-ratio-big)` (1.3) | level 3 scale |

**Layer 2: the channels**

| Token | Value |
| --- | --- |
| `--global-nav-bar-rest` | `transparent` |
| `--global-nav-bar-hover` | `var(--global-accent-level-1)` |
| `--global-nav-bar-active` | `var(--global-accent-level-2)` |
| `--global-link-decoration-rest` | `var(--global-accent-level-2)` |
| `--global-link-decoration-hover` | `var(--global-accent-level-3)` |
| `--global-control-border-rest` | `var(--global-border-color)` |
| `--global-control-border-hover` | `var(--global-accent-level-1)` |
| `--global-control-border-active` | `var(--global-accent-level-2)` |
| `--global-control-border-press` | `var(--global-accent-level-3)` |
| `--global-surface-hollow-rest` | `transparent` |
| `--global-surface-hollow-hover` | `color-mix(in srgb, var(--global-theme-color-normal) 30%, transparent)` |
| `--global-surface-hollow-active` | `color-mix(in srgb, var(--global-theme-color-normal) 30%, transparent)` |
| `--global-surface-hollow-press` | `color-mix(in srgb, var(--global-theme-color-normal) 40%, transparent)` |
| `--global-surface-hollow-border-rest` | `var(--global-accent-level-1)` |
| `--global-surface-hollow-border-hover` | `var(--global-accent-level-2)` |
| `--global-surface-hollow-border-active` | `var(--global-accent-level-3)` |
| `--global-surface-hollow-border-press` | `var(--global-accent-level-4)` |
| `--global-surface-hollow-text-rest` | `var(--global-theme-color-ultra-strong)` |
| `--global-surface-hollow-text-hover` | `var(--global-theme-color-ultra-strong)` |
| `--global-surface-hollow-text-active` | `var(--global-theme-color-ultra-strong)` |
| `--global-surface-hollow-text-press` | `var(--global-theme-color-ultra-strong)` |
| `--global-surface-solid-rest` | `var(--global-accent-level-2)` |
| `--global-surface-solid-hover` | `color-mix(in oklab, var(--global-theme-color-normal) 90%, #fff)` |
| `--global-surface-solid-active` | `color-mix(in oklab, var(--global-theme-color-normal) 84%, #fff)` |
| `--global-surface-solid-press` | `color-mix(in oklab, var(--global-theme-color-normal) 76%, #fff)` |
| `--global-surface-solid-text` | `var(--global-theme-color-dark-normal)` |
| `--global-surface-solid-ring-hover` | `color-mix(in srgb, var(--global-theme-color-dark-normal) 45%, transparent)` |
| `--global-surface-solid-ring-active` | `var(--global-theme-color-dark-normal)` |
| `--global-surface-solid-ring-press` | `var(--global-theme-color-dark-normal)` |
| `--global-surface-solid-inset-ring-hover` | `var(--global-inset-box-shadow-normal) var(--global-surface-solid-ring-hover)` |
| `--global-surface-solid-inset-ring-press` | `var(--global-inset-box-shadow-semi-strong) var(--global-surface-solid-ring-press)` |
| `--global-table-row-hover` | `color-mix(in srgb, var(--global-theme-color-normal) 18%, transparent)` |
| `--global-table-group-hover` | `color-mix(in srgb, var(--global-theme-color-normal) 10%, transparent)` |

One more token, `--global-theme-color-dark-normal`, is computed automatically in `layout/variable.css`; it needs neither the light/dark scheme nor a per-theme value:

```css
--global-theme-color-dark-normal: color-mix(in srgb, var(--global-theme-color-normal) 12%, var(--global-dark));

@supports (color: oklch(from red 0.5 0 h)) {
    :root {
        --global-theme-color-dark-normal: oklch(from var(--global-theme-color-normal) clamp(0.08, calc(1 - l), 0.92) 0 h);
    }
}
```

Where relative colour syntax is supported it uses `oklch()`: it flips the OKLCH lightness of the theme colour to the other end (`1 - l`, clamped to 0.08–0.92), so a light theme colour yields a dark grey and a dark one a light grey, whatever the hue. Measured: lavender `#c7a2ec` becomes `#1c1c1c` (7.92:1), matcha `#c7eca2` becomes `#030303` (15.62:1), misty `#a2d9ec` becomes `#0a0a0a` (12.87:1). Elsewhere the `color-mix` approximation stays in place. Both the text and the ring of a solid button use it.

The fallback has to be wrapped in `@supports`: custom properties are not validated when declared, so a repeated declaration simply overrides the previous one; the invalid value only surfaces when it is used (`color: var(--global-theme-color-dark-normal)`), and the result is "inherit", not "fall back".

### Component Types

Grouped by interaction mechanism. Each state cell reads **fill / border / text**; the token names refer to "Interaction Tokens".

| Type | Group | Covered elements | Rest (0) | Hover (1) | Selected (2) | Press (3) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Navigation link** | Link | top navbar, sidebar, docsify tabs, TOC switcher, breadcrumb | `--global-nav-bar-rest` bar (transparent), text inherits | `--global-nav-bar-hover` bar (45%), text unchanged | `--global-nav-bar-active` bar (solid), text in the theme colour + bold | not applicable | Clicking only re-enters the current page and gives no extra feedback, so there is no press state. The current breadcrumb is not a link but is selected in meaning and takes level 2 |
| **Inline text link 1** | Link | links inside the article body (`p` / `li` / `blockquote` / `table`), links inside the cover | `--global-link-decoration-rest` underline, text inherits | `--global-link-decoration-hover` underline, text inherits | not applicable | not applicable | Clicking navigates away; press gives no extra feedback |
| **Inline text link 2** | Link | site name, heading anchor, `summary`, pagination title, search results, comment links, gitalk tip | `transparent` underline, text inherits | `--global-link-decoration-hover` underline, text inherits | not applicable | not applicable | Clicking navigates away; press gives no extra feedback |
| **Inline icon link** | Link | the about-me icons | icon at 1 | `--global-scale-hover` | not applicable | `--global-scale-active` | Looks exactly like a ghost icon, but it is a link inside the article, so it gets its own row and takes no part in the button ladder |
| **Ghost icon** | Button | the nine widgets, sidebar toggle, back to top, reading progress, comment like/edit/reply, cover chevron | icon at 1 | `--global-scale-hover` | not applicable | `--global-scale-active` | Scale only; no fill and no border |
| **Input** | Input | search box, pagination input, gitalk textarea | `--global-control-border-rest`, text inherits | `--global-control-border-hover`, text inherits | `--global-control-border-active` (`:focus`), text inherits | not applicable | Focus shares the selected value; press gives no extra feedback |
| **Selection swatch** | Button | theme presets, colour presets, colour picker thumb | `--global-control-border-rest`, scale 1 | `--global-control-border-hover`, `--global-scale-hover` | `--global-control-border-active`, `--global-scale-active` | unselected: the level 2 values; selected: `--global-control-border-press`, `--global-scale-press` | Press previews the selection: an unselected swatch shows level 2 while held and lands on the selected state on release, a selected one goes one step further. The colour picker thumb only swaps its border (`--global-border-color` to `--global-theme-color-normal`), adds no ring and does not scale, and its border transitions on hover only |
| **Hollow surface button** | Button | toc pagination arrows, full-image arrows, gitalk preview, font presets | transparent fill, `--global-accent-level-1` border, `ultra-strong` text | 30% fill, `--global-accent-level-2` border, `ultra-strong` text | 30% fill, `--global-accent-level-3` border, `ultra-strong` text | 40% fill, `--global-accent-level-4` border, `ultra-strong` text | Border only, no solid fill; the selected state is used by the font presets alone |
| **Solid surface button** | Button | gitalk login and publish, cover primary button, copy code | `--global-surface-solid-rest` fill, inverted ink text | fill +10% white, 2px 45% ink ring, inverted ink text | fill +16% white, 2px solid ink ring, inverted ink text | fill +24% white, 3px solid ink ring, inverted ink text | Solid at rest. How to tell them apart: a solid fill means solid, a border alone means hollow |

### Guide Line

A navigation bar is always 2px wider than the guide line of its container, so it is 3px where a guide line exists and 2px where none does; the extra weight stays the same in both cases. Hover and selected share the width and differ only in colour.

| Container | Guide line | Edge | Bar width |
| --- | --- | --- | --- |
| top navbar | none | bottom | 2px |
| sidebar | none | left | 2px |
| sidebar (TOC mode, the level selected by `.sidebar:has(.toc-btn.active-btn) .sidebar-nav>ul>li>ul>li ul ul`) | 1px | left | 3px |
| docsify tabs | 1px | bottom | 3px |
| TOC switcher | 1px | bottom | 3px |
| breadcrumb | none | bottom | 2px |

Three notes:

- Items inside one group of navigation links leave no gap between them (TOC switcher `gap: 0`), so their bars meet; the spacing comes from each item's padding.
- The current breadcrumb page wraps naturally and draws one bar per line — that is expected, because that is how an inline element's border works. The breadcrumb is set at `0.9rem`, one step below the navbar.
- A toc pagination button is a 28×28 outer box (1.75rem) holding a 100% svg that `padding: var(--global-border-normal-width)` on the parent brings down to 24px (28 − 1px border ×2 − 1px padding ×2). swiss draws a 2px border, so its `padding` is 0 and the icon is 24px there too.

### Tables

A body table already carries a 1px `--global-border-color-strong` border on every cell (from base) plus a 1px `--global-border-color-mid` top border per row; **no zebra stripes are drawn, and reading is carried by hover**.

| Part | Rest | Hover |
| --- | --- | --- |
| Header `thead th` | no fill, bold, text in `--global-heading-color` | not applicable |
| Plain cells of the row under the pointer, `td.is-row-hover` | transparent | `--global-table-row-hover` (18% theme colour), 500ms transition |
| Other rows of a merged block, `tr.is-group-hover` | transparent | `--global-table-group-hover` (10% theme colour), 500ms transition |

Three notes:

- The highlight is painted on the row, not on the cells: a cell merged by `rowspan` belongs to the first row, and a row background fills the whole band, so it is tinted in the second and third rows it covers as well; a `colspan` row naturally changes as one.
- Cross-row blocks use two tones: every `tr` of the block gets `.is-group-hover` with `--global-table-group-hover` (10% theme colour) as a faint ground for “this group”; the cells of the row under the pointer whose `rowspan === 1` then get `.is-row-hover` with `--global-table-row-hover` (18% theme colour). When the pointer sits on a merged cell there is no single current row, so only the faint ground shows. Rules live in `plugins/markdownHelper.css`; swiss swaps both tones for `color-mix(--sw-tone 60%, --sw-paper)` and `--sw-tone` at the end of `swiss.css`. A table without merged cells shows one tone only, exactly as before.
- The header never takes part in hover; its edge is expressed by weight and the grid, not by a fill.

### Popups

The three kinds of popup share the large radius `--global-el-border-radius` and differ only in whether the border uses the theme colour and whether the fill is the zebra background or a light theme tint:

| Kind | Members | Border | Fill | Other |
| --- | --- | --- | --- | --- |
| **Widget popup** | the widgets popup (`.page-right-popups-div`) | 1px **theme colour** | `--global-theme-color-blur-ultra-weak` (10% theme colour) | `backdrop-filter: var(--global-backdrop-filter)` |
| **Regular popup** | gitalk comment card `.gt-comment-content`, `.gt-popup` menu, about page right panel `.main-page-right-panel-container` | 1px `--global-border-color-strong` | `--global-zebra-bg` | none |
| **Highlighted popup** | the blog owner's own comments (`.gt-comment.gt-comment-admin`) | same as a regular popup | `--global-theme-color-blur-ultra-weak` (10% theme colour) | identity is told by the fill alone |

### Brief Comments

`writings/BriefComments.md` is a year-by-year quote stream with no cards.

| Element | Spec |
| --- | --- |
| Year block | title left-aligned, `--global-heading-color`, 2.25rem, with a 2px `--global-border-color-strong` rule underneath; the year icon sits to the left of the title and doubles as the open/closed indicator |
| Year icon | a native 512×512 RGBA image; closed: `rotate(-14deg) scale(0.9)`, `opacity 0.5`; open: back to normal and opaque; 500ms transition on `opacity` and `transform` |
| Year hover | the title gains an underline in `--global-link-decoration-hover`; its colour does not change |
| The old year divider | removed. The icon moves from the divider to the left of the title, and the two short theme-colour rules are no longer drawn |
| Entry | no card, no fill; a 1px `--global-border-color` top border per entry (none on the first); avatar 2.25rem |
| Quote line | 2px `--global-border-color-strong` on the left of the card, easing to the theme colour on hover, 500ms |
| Inner divider | `0.2rem dotted --global-border-color`; the original walking icon is kept and no longer coloured |

### Cursor

Selected items of navbar and sidebar stay clickable (they re-enter the current page), so they keep `cursor: pointer`; selected items of docsify tabs, the TOC switcher and the font presets do nothing when clicked and use `cursor: default`; the current breadcrumb is not a link and needs no cursor rule; every other interactive element keeps `cursor: pointer`.

## swiss Theme

`swiss` speaks a "paper / ink / line" language. It shares the interaction intent of the default theme, but its palette is black, white and grey only, and the theme colour retreats to a handful of places (see "Theme Colour Budget").

### Interaction Standard

#### Emphasis Ladder

Every interactive element walks up one four-step ladder, each column measured from its own resting state, without skipping a step; **a selected or latched control that is hovered stays on its level**. The big difference from the default theme: **navigation moves by its line, buttons move by swapping paper and ink, and text stays put**.

| Level | Meaning | Line / Bar | Surface (unlatched) | Surface (latched) | Text / Icon | Scale | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | rest: colourless | `tone-line` 2px, or transparent 3px reserved | paper fill + tone-line border | paper fill + tone-line border | ink | none | navigation hover never changes the text, only the line walks |
| 1 | hover: this can be clicked | `--global-border-color-mid` (neutral grey) | ink fill + ink border | same, while not latched | paper | none | the neutral grey is one step deeper than tone-line, otherwise the tabs' resting baseline would show no change |
| 2 | selected / latched (`.active`, `.active-btn`, `.is-active`) | ink-strong | not applicable | ink fill + ink border | paper | none | a hovered latched button stays here and does not invert; inversion happens only at "latched + hover", see below |
| 3 | press (`:active`) | same as level 1 | same as level 1 | same as level 1 | paper | none | press equals hover. Navigation links, inline links and swatches do nothing when clicked, so they have no press state |

Two rules of its own:

- **Nothing scales** (the colour picker thumb included). Everything the default theme expresses with scale, swiss expresses by swapping fill.
- **A latched button inverts on hover once latched**: paper fill, ink border, ink text, meaning "clicking again leaves this state". It is a sub-state of level 2 and appears only while already latched; press does not invert.

Two deliberate asymmetries:

- **Navigation hover never changes the text colour**; only the line turns grey. Only the selected state turns the line to ink and bolds the text.
- **A permanently latched button fades on hover**: ink fill with paper text becomes paper fill with ink text, the same rule as "a latched button inverts on hover once latched".

#### Keyboard focus

Same as the default theme with the ink colour swapped in:

- `outline: var(--global-focus-outline)`, width `--global-focus-outline-width` (2px), colour `--global-focus-outline-color` (pointing at `--sw-ink-strong`), `outline-offset` 2px
- the resting state reserves a transparent outline, so focusing never shifts the layout
- applies to `a[href]`, `button`, `summary`, `select`, `[tabindex]` and the various `input` types

#### Transitions

Two durations only, redefined by swiss in its theme file: `--global-transition-duration-normal` 200ms and `--global-transition-duration-fast` 160ms.

| Use | Duration |
| --- | --- |
| navigation line, navigation text | 160ms |
| button fill, border, text | 200ms |
| input line, swatch border | 160ms |
| table row hover | 160ms |
| brief-comments year icon | 200ms |

#### Border radius

Always `0`; large surfaces and controls are not distinguished.

| Token | Value | Use |
| --- | --- | --- |
| `--global-el-border-radius` | 0 | large surfaces: cards, popups, code blocks |
| `--global-el-border-radius-small` | 0 | the small step of large surfaces |
| `--global-icon-border-radius` | 0 | icon controls |
| `--global-widget-border-radius` | 0 | the right-hand widgets |
| `--global-scrollbar-border-radius` | 0 | the scrollbar |
| `--global-border-radius-round` | 50% | circles (avatars), a shape rather than a step |

#### Size tokens

| Token | swiss value | Use |
| --- | --- | --- |
| `--global-container-width` | 25rem | the width of the article content container |
| `--global-container-height` | 18.75rem | the height of the article content container |
| `--global-content-width` | `min(94%, var(--sw-max))` | the body column width, with `--sw-max` at 80rem |
| `--global-sidebar-width` | 13.75rem | the sidebar width |

swiss also carries a set of typographic and geometric tokens of its own (`--sw-fs-*`, `--sw-gap-*`, `--sw-plate-*`). They shape the page and take no part in interaction.

#### Interaction Tokens

Colours come in two layers: changing the theme colour touches `--theme-color` only, changing the palette touches layer 1 only, and re-colouring one channel touches layer 2 only. Both live in the `:root` of `swiss.css`.

**Layer 1: palette and line weights**

| Token | Value | Meaning |
| --- | --- | --- |
| `--sw-paper` | `var(--global-bg-color)` | paper |
| `--sw-ink` | `var(--global-text-color)` | body ink |
| `--sw-ink-strong` | `var(--global-heading-color)` | heading ink (the heaviest step) |
| `--sw-ink-muted` | `var(--global-muted-color)` | muted text |
| `--sw-tone` | `var(--global-code-bg)` | paper grey (popups, code, highlighted fills) |
| `--sw-tone-line` | `var(--global-border-color)` | light line (resting lines, structural baseline) |
| `--sw-rule` | 0.1875rem (3px) | navigation bar / heavy rule |
| `--sw-rule-mid` | 0.125rem (2px) | thin rule, the middle step |
| `--sw-rule-mast` | 0.375rem (6px) | masthead rule |
| `--sw-border` | `var(--sw-rule) solid var(--sw-ink-strong)` | 3px solid ink |
| `--sw-border-mid` | `var(--sw-rule-mid) solid var(--sw-ink-strong)` | 2px solid ink |
| `--sw-border-mast` | `var(--sw-rule-mast) solid var(--sw-ink-strong)` | 6px solid ink |

**Layer 2: the channels**

| Token | Value | Use |
| --- | --- | --- |
| `--sw-nav-rest` | `transparent` | navigation bar at rest |
| `--sw-nav-hover` | `var(--global-border-color-mid)` | navigation bar on hover (neutral grey) |
| `--sw-nav-active` | `var(--sw-ink-strong)` | navigation bar when active |
| `--sw-line-rest` | `var(--sw-tone-line)` | input line at rest |
| `--sw-line-hover` | `var(--sw-ink-strong)` | input line on hover / focus |
| `--sw-fill-rest` | `var(--sw-paper)` | button fill at rest |
| `--sw-fill-hover` | `var(--sw-ink-strong)` | button fill on hover / press / latched |
| `--sw-fill-inverse` | `var(--sw-paper)` | the fill when inverted (latched + hover) |
| `--sw-on-rest` | `var(--sw-ink)` | text at rest |
| `--sw-on-fill` | `var(--sw-paper)` | text on an ink fill |
| `--sw-swatch-rest` | `var(--sw-tone-line)` | swatch border at rest |
| `--sw-swatch-hover` | `var(--sw-ink-strong)` | swatch border on hover / active |
| `--sw-swatch-outline` | `var(--sw-ink-strong)` | the 2px outline a swatch adds on hover / active |
| `--sw-accent` | `var(--global-theme-color-normal)` | the only colour allowed, and only where "Theme Colour Budget" lists it |

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

Grouped by interaction mechanism. Each state cell reads **fill / border / text**; the token names refer to "Interaction Tokens".

| Type | Group | Covered elements | Rest (0) | Hover (1) | Selected / latched (2) | Press (3) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Navigation link** | Link | top navbar, sidebar, docsify tabs, TOC switcher, breadcrumb | `--sw-nav-rest` bar, ink text; tabs excepted, they draw a 3px tone-line baseline at rest | `--sw-nav-hover` bar, text unchanged | `--sw-nav-active` bar, bold text | not applicable | Clicking only re-enters the current page, so there is no press state. The current breadcrumb takes the level 2 bar and bold text, its colour unchanged |
| **Inline text link 1** | Link | links inside the article body (`p` / `li` / `blockquote` / `table`), links inside the cover | ink underline, 2px | `--sw-accent` underline | not applicable | not applicable | Clicking navigates away; press gives no extra feedback |
| **Inline text link 2** | Link | site name, heading anchor, `summary`, pagination title, toc-page title, search results, comment links, gitalk tip | transparent underline | `--sw-accent` underline | not applicable | not applicable | Clicking navigates away; press gives no extra feedback |
| **Inline icon link** | Link | the about-me icons | ink, at 1 | ink-strong, no scale | not applicable | ink-strong, no scale | Close to a ghost icon, but it is a link inside the article; swiss never scales, so only the colour changes |
| **Unlatched button** | Button | the nine widgets, sidebar toggle, toc pagination arrows, full-image arrows, cover chevron | paper fill + tone-line border + ink text | ink fill + ink border + paper text | not applicable | same as hover | One feedback only: paper and ink swap |
| **Latched button** | Button | gitalk preview, TOC switcher, font presets | paper fill + tone-line border + ink text | ink fill + ink border + paper text | ink fill + ink border + paper text | same as hover | Latched + hover inverts to paper fill with ink text; gitalk preview is latched while `.gt-header-textarea` carries the `hide` class |
| **Permanently latched button** | Button | gitalk login and publish, copy code | ink fill + ink border + paper text | paper fill + ink border + ink text | not applicable | same as hover | Latched at rest; hover fades it |
| **Input** | Input | search box, pagination input, gitalk textarea | `--sw-line-rest`, text inherits | `--sw-line-hover`, text inherits | `--sw-line-hover` (`:focus`), text inherits | not applicable | Focus shares the hover value; press gives no extra feedback |
| **Selection swatch** | Button | theme presets, colour presets, colour picker thumb | `--sw-swatch-rest` | `--sw-swatch-hover` + 2px `--sw-swatch-outline` | same as hover | same as hover | A swatch applies on click, so press equals hover. The colour picker thumb only swaps its border, adds no outline and does not scale; its border transitions on hover only, and its fill is the theme colour |

### Guide Line

swiss has no guide line: navigation items are separated by the line itself, the bar width comes from `--sw-rule`, and the default theme's "2px wider than the guide line" rule does not apply.

| Container | Structural line | Edge | Bar width |
| --- | --- | --- | --- |
| top navbar | none | bottom | 3px |
| sidebar | none | left | 3px |
| sidebar (TOC mode) | none | left | 3px |
| docsify tabs | a 3px tone-line baseline | bottom | 3px |
| TOC switcher | a 3px tone-line bottom border on the container | bottom | 3px |
| breadcrumb | none | bottom | 2px |

Two notes:

- Items inside one group leave no gap (TOC switcher `gap: 0`) so the bars meet; spacing comes from each item's padding.
- The breadcrumb is set at 0.9rem, one step below the navbar, so its bar stays 2px; every other navigation bar is 3px, which keeps the tabs from jumping when they change state.

### Tables

Same shape as the default theme: no zebra stripes, every cell carries a 2px tone-line border and each row a 2px tone-line top border, and reading is carried by hover.

| Part | Rest | Hover |
| --- | --- | --- |
| Header `thead th` | no fill, bold, text in `--sw-ink-strong` | not applicable |
| Plain cells of the row under the pointer, `td.is-row-hover` | transparent | `--sw-tone`, 160ms transition |
| Other rows of a merged block, `tr.is-group-hover` | transparent | `color-mix(in srgb, var(--sw-tone) 60%, var(--sw-paper))`, 160ms transition |

Merged cells behave as in the default theme: the other rows of the block take a faint ground of `color-mix(in srgb, var(--sw-tone) 60%, var(--sw-paper))` and the plain cells of the row under the pointer take `--sw-tone`, both driven by `.is-group-hover` / `.is-row-hover` from `markdownHelper`.

### Popups

All three kinds share square corners and no shadow, and differ only in border and fill:

| Kind | Members | Border | Fill | Other |
| --- | --- | --- | --- | --- |
| **Widget popup** | the widgets popup (`.page-right-popups-div`) | 3px ink `--sw-border` | paper | no backdrop-filter |
| **Regular popup** | gitalk comment card `.gt-comment-content`, `.gt-popup` menu, about page right panel | 2px tone-line | paper | no shadow |
| **Highlighted popup** | the blog owner's own comments (`.gt-comment.gt-comment-admin`) | same as a regular popup | `--sw-tone` | identity is told by the fill alone |

### Brief Comments

The same quote stream as the default theme, with every line turned to grey or ink.

| Element | Spec |
| --- | --- |
| Year block | title left-aligned, `--sw-ink-strong`, 2.25rem, with a 3px `--sw-border` underneath; the year icon sits to the left of the title |
| Year icon | a native 512×512 RGBA image, `filter: grayscale(1)`, doubling as the open/closed indicator: closed `rotate(-14deg) scale(0.9)`, `opacity 0.5`; open back to normal and opaque; 200ms transition |
| Year hover | the title gains a `--sw-accent` underline; its colour does not change |
| The old year divider | removed (the icon moves to the left of the title and the two short theme-colour rules are no longer drawn) |
| Entry | no card, no fill; a 2px `--sw-tone-line` top border per entry (none on the first); avatar 2.25rem |
| Quote line | 2px `--sw-tone-line`, easing to `--sw-ink-strong` on hover, 160ms |
| Inner divider | 2px dotted `--sw-tone-line`; the original walking icon is kept and desaturated |

### Cursor

Same as the default theme: active items of navbar and sidebar stay clickable, so they keep `cursor: pointer`; active items of docsify tabs, the TOC switcher and the font presets do nothing when clicked and use `cursor: default`; the current breadcrumb is not a link and needs no cursor rule; every other interactive element keeps `cursor: pointer`.
