# Token reference

Generated from [`tokens.css`](tokens.css) by `node design/tokens-doc.mjs`. **Don't edit by hand**: change tokens.css, then run the script.
What the tokens are for and the rules for using them are in [DESIGN.md](../DESIGN.md).

Use tokens in CSS as `var(--name)`; type tokens as `font: var(--type-…)`. Components use **roles** (below), never palette steps.

## Palettes

Tonal, 50 → 950. One OKLCH lightness per step, shared by every palette, so a pair of steps has about the same contrast in any hue. `--primary` is `terracotta-500`.

| Step | terracotta | neutral | crimson | ochre | periwinkle | leaf | lilac |
|---|---|---|---|---|---|---|---|
| *Use* | *Primary* | *Neutral* | *Status (errors only)* | *Brand* | *Brand* | *Brand* | *Brand* |
| 0 |  | `#FFFFFF` |  |  |  |  |  |
| 50 | `#FAF6F4` | `#F7F7F5` | `#FAF6F6` | `#FAF6EF` | `#F6F7F9` | `#F1F9F4` | `#F7F6F9` |
| 100 | `#F8E5DF` | `#EAE9E8` | `#F5E5E7` | `#F7E8CA` | `#E5EAF3` | `#D2F3DE` | `#EBE7F2` |
| 200 | `#F9CABB` | `#D7D6D4` | `#F2CAD0` | `#F6D180` | `#CBD6ED` | `#ADE5C3` | `#DAD0EC` |
| 300 | `#FBA083` | `#BBBAB8` | `#F0A1AE` | `#E4B33D` | `#A6BBE5` | `#8DCBA6` | `#C3B0E3` |
| 400 | `#EB7049` | `#9B9A98` | `#E96A86` | `#BF9131` | `#7A99D9` | `#6CAA86` | `#A48CC9` |
| 500 | `#B84216` | `#6F6E6C` | `#B73A5B` | `#8D6621` | `#4F6CAB` | `#447C5D` | `#78619A` |
| 600 | `#90320F` | `#565553` | `#902C46` | `#704E17` | `#38528F` | `#346047` | `#5F487F` |
| 700 | `#702509` | `#42413F` | `#6F2035` | `#573B10` | `#243D78` | `#264A36` | `#4A3369` |
| 800 | `#531905` | `#302F2D` | `#531526` | `#412A09` | `#142A63` | `#1A3627` | `#382154` |
| 900 | `#381408` | `#21201F` | `#38111A` | `#2D1D0A` | `#0A1C4A` | `#14251B` | `#261839` |
| 950 | `#1F0904` | `#11100F` | `#1F080D` | `#180E05` | `#050E28` | `#09130D` | `#140C1F` |

## Roles (light and dark)

Light is the default (`:root`, `[data-theme="light"]`); dark comes from `[data-theme="dark"]` or, with no theme set, the system's dark mode.

| Role | Light | Dark | Use |
|---|---|---|---|
| **Surfaces** | | | |
| `--surface-bench` | `neutral-200` #D7D6D4 | `neutral-950` #11100F | the ground around the cloth |
| `--surface-panel` | `neutral-50` #F7F7F5 | `neutral-900` #21201F | the properties panel |
| `--surface-field` | `neutral-100` #EAE9E8 | `neutral-800` #302F2D | fields, selects, split fields |
| `--surface-well` | `neutral-100` #EAE9E8 | `neutral-900` #21201F | an inset well inside something raised (the picker's pill and pans) |
| `--surface-raised` | `neutral-0` #FFFFFF | `neutral-800` #302F2D | pop-ups, menus, floating bars |
| `--surface-selected` | `neutral-0` #FFFFFF | `neutral-700` #42413F | a selected item: tile, pill option, tool, toggle |
| `--surface-hover` | `neutral-50` #F7F7F5 | `color-mix(in oklch, neutral-700 50%, neutral-800)` | a menu item under the pointer, on a raised surface: fainter than selected |
| `--surface-selected-raised` | `neutral-100` #EAE9E8 | `neutral-700` #42413F | the selected menu item, on a raised surface (selected is white, like the surface) |
| `--slider-fill` | `neutral-0` #FFFFFF | `neutral-600` #565553 | the filled part of a bar slider |
| **Text and icons** | | | |
| `--text-strong` | `neutral-950` #11100F | `neutral-50` #F7F7F5 | headings, selected labels, values |
| `--text` | `neutral-900` #21201F | `neutral-100` #EAE9E8 | body text |
| `--text-muted` | `neutral-600` #565553 | `neutral-400` #9B9A98 | secondary text, units, placeholders |
| `--text-disabled` | `neutral-400` #9B9A98 | `neutral-500` #6F6E6C | disabled text |
| `--icon` | `neutral-500` #6F6E6C | `neutral-400` #9B9A98 | icons at rest |
| `--icon-active` | `neutral-950` #11100F | `neutral-50` #F7F7F5 | icons hovered or selected |
| `--icon-faint` | `neutral-300` #BBBAB8 | `neutral-700` #42413F | decorative, very quiet marks |
| **Lines** | | | |
| `--border-subtle` | `neutral-200` #D7D6D4 | `neutral-800` #302F2D | dividers |
| `--border` | `neutral-300` #BBBAB8 | `neutral-700` #42413F | field and swatch edges |
| `--border-strong` | `neutral-500` #6F6E6C | `neutral-400` #9B9A98 | a field hovered, open or being typed in |
| **Controls** | | | |
| `--control-track` | `neutral-300` #BBBAB8 | `neutral-700` #42413F | the empty part of a track |
| `--control-fill` | `neutral-600` #565553 | `neutral-300` #BBBAB8 | a filled track or handle |
| `--focus` | `neutral-950` #11100F | `neutral-50` #F7F7F5 | the keyboard focus ring (only on :focus-visible) |
| **Accent** | | | |
| `--accent` | `terracotta-500` #B84216 | `terracotta-400` #EB7049 | the primary button, the selected tool, the selection outline |
| `--accent-hover` | `terracotta-600` #90320F | `terracotta-300` #FBA083 | the accent hovered |
| `--accent-pressed` | `terracotta-700` #702509 | `terracotta-200` #F9CABB | the accent pressed |
| `--on-accent` | `neutral-50` #F7F7F5 | `neutral-950` #11100F | text and icons on the accent |
| `--accent-text` | `terracotta-600` #90320F | `terracotta-300` #FBA083 | accent-coloured text, sparingly |
| **Danger** | | | |
| `--danger` | `crimson-600` #902C46 | `crimson-400` #E96A86 | error text and edges |
| `--danger-fill` | `crimson-500` #B73A5B | `crimson-400` #E96A86 | a destructive button |
| `--danger-hover` | `crimson-600` #902C46 | `crimson-300` #F0A1AE | that button hovered |
| `--danger-pressed` | `crimson-700` #6F2035 | `crimson-200` #F2CAD0 | that button pressed |
| `--on-danger` | `neutral-50` #F7F7F5 | `neutral-950` #11100F | text on the danger fill |
| `--danger-subtle` | `crimson-100` #F5E5E7 | `crimson-900` #38111A | a faint error background |
| **Shadows** | | | |
| `--shadow-float` | `0 1px 2px rgba(17,16,15,.08), 0 4px 12px rgba(17,16,15,.08)` | `0 1px 2px rgba(0,0,0,.45), 0 4px 12px rgba(0,0,0,.35)` | floating bars over the cloth |
| `--shadow-popover` | `0 2px 4px rgba(17,16,15,.08), 0 12px 32px rgba(17,16,15,.14)` | `0 2px 4px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.5)` | pop-ups, menus, the colour picker |
| `--shadow-sheet` | `0 8px 16px rgba(17,16,15,.10), 0 24px 64px rgba(17,16,15,.22)` | `0 8px 16px rgba(0,0,0,.45), 0 24px 64px rgba(0,0,0,.6)` | sheets and dialogs |

## Type, space, shape, size, layering, motion

### Type

| Token | Value | Use |
|---|---|---|
| `--font-ui` | `'Golos Text', system-ui, -apple-system, 'Segoe UI', sans-serif` |  |
| `--weight-regular` | `400` |  |
| `--weight-medium` | `500` |  |
| `--weight-semibold` | `600` |  |
| `--numeric` | `tabular-nums` |  |
| `--type-title` | `600 20px/26px var(--font-ui)` | sheet and dialog titles |
| `--type-heading` | `600 15px/20px var(--font-ui)` | panel section titles |
| `--type-subheading` | `600 13px/18px var(--font-ui)` | groups inside a section |
| `--type-body` | `400 13px/18px var(--font-ui)` | descriptions, inputs, menu items |
| `--type-label` | `400 12px/16px var(--font-ui)` | control labels |
| `--type-label-strong` | `500 12px/16px var(--font-ui)` | the selected label, values |
| `--type-caption` | `400 11px/14px var(--font-ui)` | hints, units, counts |
| `--type-eyebrow` | `600 11px/14px var(--font-ui)` | small group labels, in capitals |
| `--type-caption-tracking` | `0.01em` |  |
| `--type-eyebrow-tracking` | `0.06em` |  |

### Space

| Token | Value | Use |
|---|---|---|
| `--space-2` | `2px` |  |
| `--space-4` | `4px` |  |
| `--space-6` | `6px` |  |
| `--space-8` | `8px` |  |
| `--space-12` | `12px` |  |
| `--space-16` | `16px` |  |
| `--space-20` | `20px` |  |
| `--space-24` | `24px` |  |
| `--space-32` | `32px` |  |
| `--space-40` | `40px` |  |
| `--space-48` | `48px` |  |
| `--space-64` | `64px` |  |
| `--inline-gap` | `var(--space-6)` | icon to its label |
| `--row-gap` | `var(--space-8)` | between rows in a group |
| `--control-padding-x` | `var(--space-12)` | inside fields and buttons |
| `--panel-padding` | `var(--space-16)` | inside the panel and popovers |
| `--section-gap` | `var(--space-24)` | between panel sections |

### Shape

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | `4px` | swatches, small badges |
| `--radius-sm` | `6px` | stitch tiles, items in a grid |
| `--radius-md` | `8px` | fields, grids, menus |
| `--radius-lg` | `12px` | panel, popovers, floating bars |
| `--radius-xl` | `16px` | sheets and dialogs |
| `--radius-pill` | `999px` |  |
| `--border-width` | `1px` |  |
| `--focus-width` | `2px` |  |
| `--focus-offset` | `2px` |  |

### Size

| Token | Value | Use |
|---|---|---|
| `--target-min` | `44px` |  |
| `--control-sm` | `32px` | dense grids, pills in a row |
| `--control-md` | `36px` | fields, buttons in the panel |
| `--row-height` | `var(--control-md)` | every panel row: fields, sliders, pills, selects |
| `--control-lg` | `44px` | primary actions, floating bars |
| `--icon-sm` | `16px` |  |
| `--icon-md` | `20px` |  |
| `--icon-lg` | `24px` |  |
| `--panel-width` | `300px` |  |
| `--toolbar-width` | `52px` |  |
| `--stitch-tile` | `var(--control-sm)` | 32 px tile + 4 px gap = one row height, so the grid keeps the panel's rhythm |

### Layering

| Token | Value | Use |
|---|---|---|
| `--z-canvas` | `0` |  |
| `--z-canvas-overlay` | `10` | selection outline, guides |
| `--z-floating` | `100` | tool bar, zoom, selection bar |
| `--z-panel` | `200` |  |
| `--z-popover` | `300` |  |
| `--z-sheet` | `400` |  |
| `--z-tooltip` | `500` |  |
| `--z-toast` | `600` |  |

### Motion

| Token | Value | Use |
|---|---|---|
| `--motion-pill-duration` | `0.38` | spring, visual duration in seconds |
| `--motion-pill-bounce` | `0.18` | spring bounce, 0 to 1 |
| `--motion-pill-squash` | `0.6` | how much it flattens at full speed |
| `--motion-pill-stretch` | `0.02` | how much it lengthens at full speed |
| `--motion-pill-label-fade` | `120` | label colour fade, in ms |
| `--motion-tooltip-duration` | `150ms` |  |
| `--tooltip-offset` | `var(--space-4)` |  |

