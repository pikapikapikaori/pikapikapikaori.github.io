# pikapikapi-blog

English | [简体中文](./Design_zh-cn.md)

## Interaction Standard

Applies to the default theme, i.e. every theme except `swiss`, which carries its own interaction rules.

### Emphasis Ladder

Every interactive element walks up one ladder. Each column is a three-step ramp measured from that column's own resting state, and an element only walks up its own column without skipping a step.

| Level | Meaning | Border / Bar | Surface (hollow) | Surface (solid) | Text / Icon | Scale |
| --- | --- | --- | --- | --- | --- | --- |
| Rest | — | none / neutral 1px | transparent | accent fill | accent | 1 |
| 1 | hover: this can be clicked | accent 45% | accent 45% | `-7` | `-7` | 1.1 |
| 2 | selected (`.active`) / focus (`:focus`) | accent (solid) | accent 55% | not applicable | — | 1.2 |
| 3 | press (`:active`) | `-7` | accent 55% | `-8` | `-7` | 1.3 |

Three consequences, none of them extra rules:

- **Surface (solid)** starts on the accent fill, so its hover and press can only continue upwards, landing on levels 3 and 4.
- **Surface (hollow)** has no selected state, so it needs two steps only: 45% on hover, 55% on press.
- **The border of a hollow button** starts on level 1: 45% at rest, solid on hover, `-7` on press. This is the same rule as "the fill of a solid button starts on level 2" — a higher start point means fewer steps to walk.

The text column applies to hollow buttons only; the text and icon of a solid button stay on `--global-surface-solid-text` (a light colour) because deepening the fill only improves contrast.

#### Press

Press is `:active`: it lasts for as long as the pointer is held down on the element and reverts to hover or to the selected state on release.

The following elements provide no press state, because clicking them has no effect: navbar items, sidebar items, docsify tabs and TOC switcher buttons.

Color swatches preview the selection instead: pressing an unselected swatch shows the second level (solid border, scale 1.2) and releases into exactly the selected state, while pressing an already selected swatch goes one step further (`-7`, scale 1.3).

#### Keyboard focus

`:focus-visible` is not part of the ladder and deliberately differs from hover:

- `outline: 2px solid var(--global-theme-color-8)`, `outline-offset: var(--global-outline-offset)` (2px)
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

| Token | Value | Use |
| --- | --- | --- |
| `--global-border-radius-big` | 0.625rem | large surfaces: cards, popups, code blocks |
| `--global-border-radius` | 0.3125rem | controls: buttons, inputs, swatches |
| `--global-border-radius-small` | 0.125rem | small parts |
| `--global-border-radius-none` | 0 | square corners |
| `--global-border-radius-round` | 50% | circles (avatars), a shape rather than a step |

Semantic aliases (never write the numbers directly): `--global-el-border-radius` = big, `--global-control-border-radius` = default step, `--global-avatar-border-radius` = round.

#### Size tokens

| Token | Value | Use |
| --- | --- | --- |
| `--global-container-width` | 25rem | the width of the article content container |
| `--global-container-height` | 18.75rem | the height of the article content container |
| `--global-writing-container-height` | `var(--global-container-height)` | the height reference of that container |
| `--global-sidenote-width` | `var(--global-container-width)` | the max width of a sidenote |

The last two derive from the first two: changing `--global-container-width` changes both the content container width and the sidenote width, and the same holds for the height.

#### Interaction Tokens

The ladder's colours are defined in two layers: changing the theme colour means changing `--theme-color` only, changing the ladder means changing the first layer only, and re-colouring one channel means changing the second layer only. All of them live in the "control variables" block of `base.css`.

**Layer 1: the ladder**

| Token | Value | Meaning |
| --- | --- | --- |
| `--global-accent-level-1` | `var(--global-theme-color-blur-weak)` (accent 45%) | level 1: hover |
| `--global-accent-level-2` | `var(--theme-color)` (accent, solid) | level 2: selected / focus |
| `--global-accent-level-3` | `var(--global-theme-color-7)` | level 3: press |
| `--global-accent-level-4` | `var(--global-theme-color-8)` | level 4: only used by the press of a solid button |
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

### Component Types

Elements are grouped by interaction mechanism; every element of a type shares the same values. The token names refer to "Interaction Tokens".

| Type | Covered elements | Rest | Hover (1) | Selected (2) | Press (3) | Text / Icon |
| --- | --- | --- | --- | --- | --- | --- |
| **Navigation link** | top navbar, sidebar, docsify tabs, TOC switcher, breadcrumb | `--global-nav-bar-rest` | `--global-nav-bar-hover` | `--global-nav-bar-active` bar + accent + bold text | none | inherits; accent + bold when selected |
| **Inline text link 1** | links inside the article body (`p` / `li` / `blockquote` / `table`), links inside the cover | `--global-link-decoration-rest` underline | `--global-link-decoration-hover` underline | — | — | inherits |
| **Inline text link 2** | site name, heading anchor, `summary`, pagination title, search results, comment links, gitalk tip | `transparent` underline | `--global-link-decoration-hover` underline | — | — | inherits |
| **Ghost icon** | the nine widgets, sidebar toggle, back to top, reading progress, comment like/edit/reply, about-me icons, cover chevron | 1 | `--global-scale-hover` | — | `--global-scale-active` | accent, does not change |
| **Input** | search box, pagination input, gitalk textarea | `--global-control-border-rest` | `--global-control-border-hover` | `--global-control-border-active` (`:focus`) | — | inherits |
| **Selection swatch** | theme / colour / font presets | `--global-control-border-rest`, 1 | `--global-control-border-hover`, `--global-scale-hover` | `--global-control-border-active`, `--global-scale-active` | unselected: the selected values; selected: `--global-control-border-press`, `--global-scale-press` | inherits |
| **Hollow surface button** | toc pagination arrows, full-image arrows, gitalk preview | 45% border, transparent fill | solid border, 45% fill, `-7` text | — | `-7` border, 55% fill, `-7` text | accent → `-7` → `-7` |
| **Solid surface button** | gitalk login and publish, cover primary button, copy code | `--global-surface-solid-rest` | `--global-surface-solid-hover` | — | `--global-surface-solid-press` | always `--global-surface-solid-text` |

The current breadcrumb page (`.breadcrumb li.active`) is not a link, but it is selected in meaning and takes level 2: a `--global-nav-bar-active` bar plus accent and bold text.

### The Three Kinds of Button

| Kind | Surface | Border | Feedback | Members |
| --- | --- | --- | --- | --- |
| **Ghost icon** | none | none | scale only | the nine widgets, sidebar toggle, back to top, reading progress, comment like/edit/reply, about-me icons, cover chevron |
| **Hollow surface button** | yes (ladder fill) | 1px (ladder border) | border, fill and text walk the ladder together | toc pagination arrows, full-image arrows, gitalk preview |
| **Solid surface button** | yes (solid fill) | same colour as the fill | only the fill deepens, the text colour is constant | gitalk login and publish, cover primary button, copy code |

How to tell them apart: **a surface means it is a surface button, no surface means it is a ghost icon**; among surface buttons, a solid fill at rest means solid, a border only means hollow.

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

Two notes:

- Items inside one group of navigation links leave no gap between them (TOC switcher `gap: 0`), so their bars meet; the spacing comes from each item's padding.
- The current breadcrumb page wraps naturally and draws one bar per line — that is expected, because that is how an inline element's border works. The breadcrumb is set at `0.9rem`, one step below the navbar.

### Popups

The three kinds of popup share the large radius `--global-el-border-radius` and differ only in whether the border uses the theme colour and whether the fill is the zebra background or a light theme tint:

| Kind | Members | Border | Fill | Other |
| --- | --- | --- | --- | --- |
| **Widget popup** | the widgets popup (`.page-right-popups-div`) | 1px **accent** | `--global-theme-color-blur` (10% accent) | `backdrop-filter: var(--global-backdrop-filter)` |
| **Regular popup** | gitalk comment card `.gt-comment-content`, `.gt-popup` menu, about page right panel `.main-page-right-panel-container` | 1px `--border-color-strong` | `--zebra-bg` | — |
| **Highlighted popup** | the blog owner's own comments (`.gt-comment.gt-comment-admin`) | same as a regular popup | `--global-theme-color-blur` (10% accent) | identity is told by the fill alone |

### Cursor

Selected items of navbar and sidebar stay clickable (they re-enter the current page), so they keep `cursor: pointer`; selected items of docsify tabs and TOC switcher do nothing when clicked and use `cursor: default`; the current breadcrumb is not a link and needs no cursor rule; every other interactive element keeps `cursor: pointer`.
