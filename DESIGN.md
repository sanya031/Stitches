# Selvedge design system

How Selvedge looks, moves and behaves, and the rules behind each decision.

Everything lives in **`design/`** and is shown on its pages:
- [gallery](https://stitches-ruddy.vercel.app/design/)
- [controls](https://stitches-ruddy.vercel.app/design/controls.html)
- [panel](https://stitches-ruddy.vercel.app/design/panel.html)
- [slider lab](https://stitches-ruddy.vercel.app/design/slider-lab.html)

The [studio](https://stitches-ruddy.vercel.app/studio/) is where these parts are used for real.

---

## Principles

1. **The cloth is the brightest thing on screen.** The interface sits around the work, quiet and warm, and never competes with the thread.
2. **Stitches look like stitches.** Anything drawn on the canvas comes from the lab's WebGL renderer: real thread, holes and fabric. Panel sketches only decide the controls.
3. **Say it in thread.** Settings people may not know (strands, density, fabric count, eraser size) show their effect as a stitch drawing, not a number.
4. **One system, no one-offs.** Every icon, control and colour comes from the system. Anything new is built on the design page first, then used in the app.
5. **Calm by default.** Hover only brightens. A fill means selected. Colour is kept for the few things that need it.

---

## Colour

All colours are tokens in [`design/tokens.css`](design/tokens.css). Components use **roles**, never palette steps directly.

### Palettes
Tonal ramps run from 50 to 950. Every palette shares **one OKLCH lightness per step**, so a pair of steps has about the same contrast in any hue.

| Palette | Use |
|---|---|
| **Terracotta** (`--primary`, 500 = `#B84216`) | The primary button, and the few selected states named as exceptions: the selected tool, the selection outline. |
| **Neutral** (warm, plus `--neutral-0` white) | Everything else: surfaces, text, icons, lines, selected states. |
| **Crimson** | Errors only, and the last step of a delete. |
| **Ochre, periwinkle, leaf, lilac** | Brand: the website and illustrations. **Never in components.** |

### Roles
Each role has a light and a dark value. Light is the default; dark comes from `[data-theme="dark"]` or the system setting.

- **Surfaces:**
  - `--surface-bench` is the ground around the cloth.
  - `--surface-panel` is the panel.
  - `--surface-field` is fields.
  - `--surface-raised` is pop-ups and floating bars.
  - `--surface-well` is an inset well inside something raised. Fields inside a pop-up sit on it, because in dark the pop-up is as light as a field.
  - `--surface-selected` is a selected item.
  - `--surface-hover` is a menu item under the pointer, fainter than selected.
- **Text and icons:** `--text-strong`, `--text`, `--text-muted` and `--text-disabled`; `--icon`, `--icon-active` and `--icon-faint`.
- **Lines:** `--border-subtle`, `--border` and `--border-strong`.
- **Accent:** `--accent`, with its hover and pressed states and `--on-accent`. **Danger:** `--danger`, with its fill and states.
- **Focus:** `--focus`, a 2px ring 2px outside, for **keyboard focus only** (`:focus-visible`).

### Threads are not interface colours
Interface colours are hex values from tokens. Thread colours come from [`lab/floss.js`](lab/floss.js), which has the 454 DMC threads, each with its name and Anchor equivalent. A thread colour appears in the interface as a **swatch**, a small rounded square with a faint edge.

---

## Type

**Golos Text** is the only face, numbers included, with tabular figures through `--numeric`. Use the steps as `font: var(--type-…)`.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--type-title` | 20 / 26 | 600 | Sheet and dialog titles |
| `--type-heading` | 15 / 20 | 600 | Panel section titles |
| `--type-subheading` | 13 / 18 | 600 | Groups inside a section |
| `--type-body` | 13 / 18 | 400 | Descriptions, inputs, menu items |
| `--type-label` | 12 / 16 | 400 | Control labels |
| `--type-label-strong` | 12 / 16 | 500 | The selected label, values |
| `--type-caption` | 11 / 14 | 400 | Units, counts |
| `--type-eyebrow` | 11 / 14 | 600, caps | Small group labels |

Copy is plain and specific. Name the thing ("Add stitches", "Outline the selection"), not the mechanism, and nothing cute.

---

## Space, shape and size

- **Space:** `--space-2` to `--space-64`, on a 4px base.
  - Named gaps: `--inline-gap` 6, `--row-gap` 8, `--control-padding-x` 12, `--panel-padding` 16, `--section-gap` 24.
- **Radius:** `xs` 4 (swatches), `sm` 6 (tiles), `md` 8 (fields, menus), `lg` 12 (panel, pop-ups, bars), `xl` 16 (sheets), and `pill`.
  - Nested corners are the outer radius minus the padding.
- **Rows:** every panel row is **36px** (`--row-height`): fields, sliders, selects, switches and pills.
  - Each row is one container with its label on the left and its value on the right.
  - A stitch tile is 32px; with its 4px gap it makes one row height, so grids keep the panel's rhythm.
- **Targets:** a control can look compact, but every pointer target is at least 44px (`--target-min`).
- **Lines:** one 1px border width.
- **Shadows:** only for things that float over the canvas (`--shadow-float`, `-popover`, `-sheet`). The panel stays flat.
- **Layering:** canvas, then canvas overlay, floating bars, panel, pop-over, sheet, tooltip, toast (`--z-*`).
- **Panel** 300px. **Tool bar** 52px.

---

## States

| State | Looks like |
|---|---|
| **Hover** | The icon or text brightens. No fill, except menu items, which take a faint `--surface-hover`. |
| **Selected** | A neutral fill one step lighter (`--surface-selected`), the icon or label at full strength, medium weight. |
| **Open / typing** | A field, select or chip that's open or being typed in keeps its hover edge (`--border-strong`), never a focus border. |
| **Keyboard focus** | The `--focus` ring. Focus moved by a click shows no ring. |
| **Disabled** | `--text-disabled`. |
| **Hidden** (eye off) | The row fades and the icon becomes `eye-off`. |
| **Mixed** | A selection with several values: an empty chip ("Mixed"), several drawings side by side, or overlapping chips. |
| **Error** | Crimson edge while typing an invalid value. Escape restores the old one. |

**Terracotta is the exception, not the rule.** It is used only for:
- the primary button
- the selected tool in the tool bar
- the selection outline on the cloth

---

## Behaviour rules

These are decisions made while building, and they apply everywhere.

- **The eye vs. a switch.** An eye shows or hides something that exists, such as a colour, a pattern colour or an outline. A switch is only for a setting that changes the result, such as Add stitches or Dither.
- **No hint lines.** Explanations go in short tooltips, never in captions under controls.
- **Tooltips only when needed.** Obvious controls like − and + get none, but keep their `aria-label`.
- **Trailing icons align optically.** A row's last icon button, after a field, hangs into the gutter so its glyph lines up with the fields' right edge above.
- **Settings follow the stitch.** Strands and density belong to each stitch. The next stitch takes the current value, and editing with a selection changes only what's selected.
- **Lists act on scope.** With nothing selected, Canvas colours and stitches act on the whole cloth. With a selection they become Selection colours and stitches, and act only inside it.
- **Nothing covers the work.** Pop-ups from the selection bar open on whichever side covers none of the selection. If none fits, the view glides out just enough to keep it clear.
- **Every change is one undo step**, however long the picker stays open or the drag lasts.

---

## Motion

Motion is decided control by control and tuned live with DialKit panels before it's fixed in tokens. It always respects `prefers-reduced-motion`.

- **Pill motion: Squash.** Any pill whose selected fill travels (segmented pills, the tool bar, stitch tiles) moves it with a spring that flattens with speed and settles round again.
  - Tokens: `--motion-pill-duration` 0.38s, `-bounce` 0.18, `-squash` 0.6, `-stretch` 0.02.
  - Code: [`seg-motion.js`](design/seg-motion.js).
- **Tooltips only fade.** They open at once and fade in and out over 150ms, never sliding, rising or growing. Moving straight to the next control switches with no fade. Tool bar tooltips wait 700ms.
- **Morphs keep identity.** When a list changes, items that stay glide to their new places, new ones fade in, gone ones fade out where they were, and the height eases. This covers pills, palettes and saved colours.
- **Shared elements fly.** Colours fly into a saved palette and out of a folded row into its grid, one after another.
- **Changes to the cloth crossfade.** Restyling from the selection bar fades the old cloth out over the new (260ms).
- **Hover zoom on stitch icons.** The stitch shrinks to the corner of a 4 × 4 patch, and the rest sweeps in from it to show the real repeat.

---

## Iconography

**Line icons** ([`design/icons/icons.js`](design/icons/icons.js)) are for the interface.
- Drawn on a 24 grid, with centre-lines inside 3 to 21.
- Keylines: a square from 4 to 20, a circle of radius 8.5.
- One 1.75 stroke with round caps and joins, in `currentColor`, stroke only. No fills, no second tone. A dot is a zero-length stroke.
- Icons never move as a whole. Only a named part moves on hover, and only for the tools: stitch, pattern, select, erase and pan.

**Stitch drawings** come in two styles:
- **Thread** ([`thread.js`](design/icons/thread.js)): drawn the way the canvas draws them, with lens-shaped legs, strand shading, twist and holes.
- **Primitives** ([`primitives.js`](design/icons/primitives.js)): the same 25 stitches and fills as clean lines.

Each style has a single square and a 4 × 4 patch.

---

## Controls

Every control is in [`design/controls.css`](design/controls.css), split by `/* @control <id> */` markers. Each one is shown in every state on the [Controls page](https://stitches-ruddy.vercel.app/design/controls.html).

| Control | Notes |
|---|---|
| **Stage slider** ([`stage-slider.js`](design/stage-slider.js)) | **Every slider is a stage slider.** The label sits above, and the whole box is the slider, filling from the left to a handle. The number inside is a typeable field. While dragging, the stitch drawing rides beside the handle on a small raised pill. Hand feel: drag moves the value from where it is, the box grows while held, it rubber-bands past the ends, and it settles on a stop with the pill's spring. New settings go in `STAGE_SETTINGS`. |
| **Segmented pill** | Soft corners on a well, with Squash motion. Labels are short words. |
| **Switch** | A field with its label on the left, and Off / On always visible as a small pill. There is no track-and-knob switch. |
| **Split field** | One field cut into cells: chip and hex, count, strands, density. Each cell can be typed into or scrubbed. |
| **Number box** (cell size, zoom, W \| H) | Drag in any direction to scrub, click to type, arrows to step (Shift for more), Escape to restore. |
| **Swatch** ([`swatch.js`](design/swatch.js)) | A thread colour as a small rounded square with a faint edge. |
| **Colour picker** ([`colour-picker.js`](design/colour-picker.js)) | Custom, Extract and Saved. A live stitched preview on your fabric. Values as Hex, RGB, HSL, DMC or Anchor. A paint-set palette that can float. |
| **Selection bar** ([`selection-bar.js`](design/selection-bar.js)) | Stitch \| Colour in one split box, then Outline, Hide, Delete and More. |
| **Tooltip** ([`tooltip.js`](design/tooltip.js)) | Add `data-tip` to any element. Never use `title`. |
| **Picture pop-up** ([`picture-popup.js`](design/picture-popup.js)) | Image, Size, Colours and Tones. It converts live through the real pipeline. |
| **Fabric, Coverage, Cell size** | Fabric swatches drawn like the renderer's surfaces. Coverage is shown as crosses getting fuller. |

---

## Visual direction (don't lose it)

- A warm, quiet workbench, with the cloth as the brightest thing on it.
- Thread colours appear as chips, and the mode switcher is a pill.
- **It must not resemble Epoch Playground**, the inspiration. Avoid:
  - light grey UI
  - dashed panel borders
  - a black active tab bar
  - red slider thumbs
  - a three-rail clone
- No emoji and no gradient washes. Real buttons, 44px targets, and at least 4.5:1 text contrast.

---

## Working on the system

1. **Build controls on the design page, never in the app.** Then use them in the studio.
2. **Use the system's own parts.** If something has to be made from scratch, flag it and agree on it first.
3. **Ask before writing a finalised decision to the design page.**
4. Tune motion and feel with DialKit, then make the winning values the defaults in tokens or `*_TUNING`.
5. Clicking a state's name on the Controls page copies it as SVG for Figma.

The full checklist is in [`design/CHECKLIST.md`](design/CHECKLIST.md). File-by-file detail is in [CLAUDE.md](CLAUDE.md).
