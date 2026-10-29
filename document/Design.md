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

Composed from them: `--global-transition-color` (color, text-decoration-color, border-color, outline-color, box-shadow, background-color), `--global-transition-transform`, `--global-transition-filter`, `--global-transition-font` (font-weight), plus the `-color-fast`, `-filter-fast` and `-transform-slow` variants.

All hover feedback uses the 500ms group; the shorter and longer groups are reserved for other motion such as theme switching and decorative animation.

`font-weight` interpolates as a number, but a static font only carries a few weights, so the browser picks the nearest available face while interpolating. The weight therefore changes as a softened step rather than a continuous morph.

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

#### Interaction Tokens

The ladder's colours are defined in two layers: changing the theme colour means changing `--theme-color` only, changing the ladder means changing the first layer only, and re-colouring one channel means changing the second layer only. All of them live in the "control variables" block of `base.css`.

**Layer 1: the ladder**

| Token | Value | Meaning |
| --- | --- | --- |
| `--global-accent-level-1` | `var(--global-theme-color-blur-weak)` (accent 45%) | level 1: hover |
| `--global-accent-level-2` | `var(--theme-color)` (accent, solid) | level 2: selected / focus |
| `--global-accent-level-3` | `var(--global-theme-color-7)` | level 3: press |
| `--global-accent-level-4` | `var(--global-theme-color-8)` | level 4: only used by the press of a solid button, whose rest state already sits on level 2 |
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
| `--global-control-border-rest` | `var(--border-color)` |
| `--global-control-border-hover` | `var(--global-accent-level-1)` |
| `--global-control-border-active` | `var(--global-accent-level-2)` |
| `--global-control-border-press` | `var(--global-accent-level-3)` |
| `--global-surface-hollow-rest` | `transparent` |
| `--global-surface-hollow-hover` | `var(--global-accent-level-1)` |
| `--global-surface-hollow-press` | `color-mix(in srgb, var(--theme-color) 55%, transparent)` |
| `--global-surface-solid-rest` | `var(--global-accent-level-2)` |
| `--global-surface-solid-hover` | `var(--global-accent-level-3)` |
| `--global-surface-solid-press` | `var(--global-accent-level-4)` |

### Component Types

Elements are grouped by interaction mechanism; every element of a type shares the same values. The token names refer to "Interaction Tokens".

| Type | Covered elements | Rest | Hover (1) | Selected (2) | Press (3) |
| --- | --- | --- | --- | --- | --- |
| **Navigation link** | top navbar, sidebar, docsify tabs, TOC switcher, breadcrumb | `--global-nav-bar-rest` | `--global-nav-bar-hover` | `--global-nav-bar-active` bar + accent + bold text | none |
| **Inline text link 1** | links inside the article body (`p` / `li` / `blockquote` / `table`) | `--global-link-decoration-rest` underline | `--global-link-decoration-hover` underline | — | — |
| **Inline text link 2** | site name, heading anchor, `summary`, pagination title, search results, comment links, gitalk tip | `transparent` underline | `--global-link-decoration-hover` underline | — | — |
| **Ghost icon** | the nine widgets, sidebar toggle, back to top, reading progress, comment like/edit/reply, about-me icons | 1 | `--global-scale-hover` | — | `--global-scale-active` |
| **Input** | search box, pagination input, gitalk textarea | `--global-control-border-rest` | `--global-control-border-hover` | `--global-control-border-active` (`:focus`) | — |
| **Selection swatch** | theme / colour / font presets | `--global-control-border-rest`, 1 | `--global-control-border-hover`, `--global-scale-hover` | `--global-control-border-active`, `--global-scale-active` | unselected: the selected values; selected: `--global-control-border-press`, `--global-scale-press` |
| **Hollow surface button** | toc pagination arrows, full-image arrows, text buttons inside comments | `--global-surface-hollow-rest` | `--global-surface-hollow-hover` | — | `--global-surface-hollow-press` |
| **Solid surface button** | gitalk login and publish, cover primary button, copy code | `--global-surface-solid-rest` | `--global-surface-solid-hover` | — | `--global-surface-solid-press` |

The current breadcrumb page (`.breadcrumb li.active`) is not a link, but it is selected in meaning and takes level 2: a `--global-nav-bar-active` bar plus accent and bold text.

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

Two details kept on purpose:

- The breadcrumb is set at `0.9rem`, one step below the navbar, and its current page is kept on a single line with an ellipsis when it is wider than the container, because an inline border is drawn again on every line it wraps onto; the full title sits in the `h1` right below.
- Copy code is always visible (it does not depend on hover), uses the same font size as its success and failure message, and reports them by covering the button label.

### Cursor

Selected items of navbar, sidebar, docsify tabs and TOC switcher use `cursor: default`, because clicking them does nothing. The current breadcrumb is not a link, so it needs no cursor rule. Every other interactive element keeps `cursor: pointer`.
