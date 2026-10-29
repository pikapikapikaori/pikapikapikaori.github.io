# pikapikapi-blog

English | [简体中文](./Design_zh-cn.md)

## Interaction Standard

Applies to the default theme, i.e. every theme except `swiss`, which carries its own interaction rules.

### Emphasis Ladder

Every interactive element walks up one ladder. Each column is a three-step ramp measured from that column's own resting state, and an element only walks up its own column without skipping a step.

| Level | Meaning | Border / Bar | Surface (hollow) | Surface (solid) | Scale |
| --- | --- | --- | --- | --- | --- |
| Rest | — | none / neutral 1px | transparent | accent fill | 1 |
| 1 | hover: this can be clicked | accent 45% | accent 45% | `-7` | 1.1 |
| 2 | selected (`.active`) / focus (`:focus`) | accent (solid) | accent 55% | not applicable | 1.2 |
| 3 | press (`:active`) | `-7` | accent 55% | `-8` | 1.3 |

Tokens used by the ladder:

- accent (solid): `var(--theme-color)`
- accent 45%: `var(--global-theme-color-blur-weak)`
- accent 55%: `var(--global-theme-color-blur-strong)`
- `-7`, `-8`: `var(--global-theme-color-7)`, `var(--global-theme-color-8)`
- scale: `var(--global-transform-ratio-small)` 1.1, `var(--global-transform-ratio-normal)` 1.2, `var(--global-transform-ratio-big)` 1.3

The surface (solid) column starts at the accent fill, so its hover lands where the other columns have their third step. This is not a separate rule, it is the same rule applied to a start point that is already high.

The surface (hollow) column has no selected state, so it only needs two steps: 45% on hover, then 55% on press.

#### Press

Press is `:active`: it lasts for as long as the pointer is held down on the element and reverts to hover or to the selected state on release.

The following elements provide no press state, because clicking them has no effect: navbar items, sidebar items, docsify tabs and TOC switcher buttons. Their selected item also uses `cursor: default`.

Color swatches preview the selection instead: pressing an unselected swatch shows the second step (solid border, scale 1.2) and releases into exactly the selected state, while pressing an already selected swatch goes one step further (`-7`, scale 1.3).

#### Keyboard focus

`:focus-visible` is not part of the ladder and deliberately differs from hover:

- `outline: 2px solid var(--global-theme-color-8)`, `outline-offset: 2px`
- the resting state reserves the ring with `outline: 2px solid transparent`, so focusing never shifts the layout
- applies to `a[href]`, `button`, `summary`, `select`, `[tabindex]` and the various `input` types

#### Transitions

Six durations are defined:

| Token | Value |
| --- | --- |
| `--global-transition-duration-fast` | 250ms |
| `--global-transition-duration` | 500ms |
| `--global-transition-duration-slow` | 1s |
| `--global-transition-duration-very-slow` | 2s |
| `--global-transition-duration-super-slow` | 3s |
| `--global-transition-duration-most-slow` | 5s |

Composed from them: `--global-transition-color` (color, text-decoration-color, border-color, outline-color, box-shadow, background-color), `--global-transition-transform`, `--global-transition-filter`, plus the `-color-fast`, `-filter-fast` and `-transform-slow` variants.

All hover feedback uses the 500ms group; the shorter and longer groups are reserved for other motion such as theme switching and decorative animation.

#### Border radius

Current tokens:

| Token | Value |
| --- | --- |
| `--global-el-border-radius` | 0.625rem |
| `--global-el-border-radius-small` | 0.125rem |
| `--global-el-border-radius-none` | 0 |
| `--global-icon-border-radius` | 0.3125rem |
| `--global-widget-border-radius` | 0.3rem |
| `--global-avatar-border-radius` | 50% |

The standard keeps three of them: large surfaces use `--global-el-border-radius` (0.625rem), every control uses `--global-control-border-radius` (0.3125rem), and square corners use `0`. The avatar radius is a shape rather than a step of the scale.

### Example: Element Ownership

| Element | Rest | Hover (1) | Selected (2) | Press (3) |
| --- | --- | --- | --- | --- |
| navbar item | 2px transparent bottom edge | 2px 45% bottom edge | 2px solid bottom edge, accent + bold text | none |
| sidebar item | 2px transparent left edge | 2px 45% left edge (3px inside the 1px guide line) | 2px solid left edge (3px inside the guide line), accent + bold text | none |
| docsify tabs | 3px transparent bottom edge | 3px 45% bottom edge | 3px solid bottom edge, accent + bold text | none |
| TOC switcher | 3px transparent bottom edge | 3px 45% bottom edge | 3px solid bottom edge, accent + bold text | none |
| Inline text link (article body, breadcrumb, site name, heading anchor, `summary`, pagination title, search and comment links) | solid underline in article body, transparent elsewhere | `-7` underline | — | — |
| Ghost icon (widgets, both pagers, back to top, reading progress, comment like/edit/reply, about-me, svg inside text) | 1 | 1.1 | — | 1.2 |
| Input (search, pagination input, gitalk textarea) | neutral border | 45% border | solid border on `:focus` | — |
| Color swatch | neutral border, 1 | 45% border, 1.1 | solid border, 1.2 | `-7` border, 1.3 |
| Hollow surface button (copy code, text buttons in comments) | transparent | 45% surface | — | 55% surface |
| Solid surface button (gitalk login and publish, cover primary button) | accent fill | `-7` fill | — | `-8` fill |

Bar widths follow the container: a bar is two pixels wider than the container's own baseline line. navbar 2px, sidebar 2px (the same 2px becomes 3px inside the 1px guide line of the TOC sidebar), docsify tabs 3px (above its 1px baseline), TOC switcher 3px (above its 1px baseline). Hover and selected share the same width and differ only in colour.

### Example: Cursor

Selected items of navbar, sidebar, docsify tabs and TOC switcher use `cursor: default`, because clicking them does nothing. Every other interactive element keeps `cursor: pointer`.
