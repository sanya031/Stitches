# Selvedge — stitch playground

A free browser playground for **realistic, interactive cross stitch and embroidery**. People draw stitches by hand, turn pictures into thread, stitch letters, and embed the result on any website — where it stays live: it tugs under the cursor and wears out when rubbed, like real thread.

"Selvedge" (a fabric's self-finished edge) is a working name.

## Where things are now

Plain HTML/CSS/JS, no build step. Two parts:

**Thread lab** (the home page, build step 1 in progress):
- `index.html` — page, panel and HUD markup + styles.
- `lab/renderer.js` — WebGL2 renderer: procedural surfaces (dot grid, Aida, linen, denim) with the pattern as a texture on top, instanced stitch legs in three layers (under, top, backstitch), stray fibres. Frequency-based LOD from colour blobs to fibres.
- `lab/main.js` — the editor. Every counted stitch and fill is a per-square entry that `legsOf()` turns into legs (the panel's card previews use it too). Tools: stitch, fill (rectangle or flood a pattern shape), pattern (planned squares), erase, pan. Select tool: rectangle or magic-wand selection; recolouring changes one colour inside the selection only, splitting fills that cross its edge. Undo snapshots stitches, backstitches, pattern and fills. The canvas is a sheet (preset or custom px) divided by the cell size into `COLS × ROWS` squares; resizing keeps work centred and only hides what falls outside, never deletes it.
- `lab/starter.js` — draws the starter calla lilies on a transparent canvas; `main.js` loads them through the picture pipeline on start.
- `lab/picture.js` — picture → thread: sample to the grid, flood the border colour out as background, k-means in Lab snapped to `lab/floss.js`, tone bands by lightness share mapped to stitches or fills (satin angle from the region's structure tensor), outline from undithered colours in a darker shade of the same floss family. Returns plain data; `main.js` applies it and rebuilds live on every setting change. Two modes: stitched (replaces stitches, fills, outline) and pattern only (replaces just the pattern squares).
- `lab/fills.js` — region fills: long stitches clipped to a shape of squares (laid lines, woven over/under, blocks, fern, seed, knots, burst). Legs carry per-end flags: 1 = enters the fabric (pinched), 0 = continues as the same thread.

**Clickable mockup** of the full product, at `/mockup/`:
- `mockup/index.html` — shell + header; `mockup/styles.css` — all styling and design tokens.
- `mockup/js/app.js` — hash router (`#stitch`, `#picture`, `#letters`, `#closeup`, `#embed`) and a tiny state store. Screens re-render on every action.
- `mockup/js/screens/*.js` — one module per screen: `{ title, file, status, initial, render(state), actions }`. Wire controls with `data-act="name" data-arg="…"` (click), `data-input` (live input), `data-change` (sliders, commit on release).
- `mockup/js/thread.js` — SVG stitch drawing (`crossSVG`, `cellsHTML`, `wornStitchSVG`), the strawberry motif, stitch picker icons.

**Design system** at `/design/`:
- `design/icons/icons.js` — the line icon set for the interface (tools, actions, view, thread, canvas, product): name → group, label, SVG body, hover motion. Edit here, then `node design/icons/build.mjs` writes `svg/*.svg`, `sprite.svg` and `icons.css` (hover motion as hover-state transitions: eases in, holds while hovered, eases back on leave; on the icon or an ancestor with class `si-host`). Icons never move as a whole; only the named part moves, and only for the icons the user has specified (currently the stitch, pattern, select, erase and pan tools). Rules: 24 grid, centre-lines inside 3..21, keylines (square 4..20, round r 8.5), one 1.75 stroke, round caps/joins, currentColor, stroke only — no fills, no second tone or opacity; a dot is a zero-length stroke. Stitch and fill icons live in thread.js and primitives.js, not here.
- `design/icons/thread.js` — thread-style icons for stitches and fills, each shown in one square between its four holes (quarter and three-quarter in all four corners). Drawn to match the canvas: lens-shaped legs in their own rotated frame, two-strand shading with a centre groove, twist grooves at ~35°, dark ends, contact shadow; widths as on the canvas at count 14. Every fill comes from `lab/fills.js` for a single square, exactly as the canvas draws one square of it (no icon-only patterns). `threadSvg(name, { colour, size, paper, id })`; pass a unique `id` when several sit on one page.
  `frame`: `'square'` (default, the first frame), `'patch'` (the last frame: a 4 × 4 patch in the same square, fills from `lab/fills.js` over the whole patch so weaves, blocks and bursts show their real repeat) or `'zoom'` (hover animation between them, from `zoom-css.js`: the stitch shrinks in place to the patch's top-left square and the rest sweeps in from it; plays on hovering the svg or an ancestor with class `tz-host`; reduced motion crossfades). Built to `thread/`, `thread-patch/`, `thread-zoom/` (inline zoom svgs; an `<img>` shows only the square). In the patch, seed, knots and burst are stitched square by square (first square = the single icon); hand jitter is seeded by each leg's position so a stitch looks the same in both frames; holes are faint (`holes`, default 0.35) and shrink with the zoom.
- `design/icons/primitives.js` — the same 25 stitches and fills as clean line primitives (same names). One drawing in square units for both frames: the single icon is n = 1, the patch is the same with n × n squares scaled into the same 5..19 square, so its first square is exactly the single icon (lines, strokes and holes shrink together). Laid and woven fills run on across squares as one thread (four lines a square; weaves cut gaps where the under thread passes), counted and scattered stitches repeat square by square. Holes are faint (`holes` opacity, default 0.3). `primitiveSvg(name, { size, stroke, frame, id, n, holes })`; built to `primitive/`, `primitive-patch/`, `primitive-zoom/`, and the square as `p-<name>` in `sprite.svg`. Icon work stays on the design page; the lab does not use these icons.
- `design/icons/zoom-css.js` — the hover zoom's tuning (`TUNING`: duration, smoothness) and `motionFrom()`, shared by the design page and the exports; `zoomMarkup()` bakes it into standalone SVG: the page's spring is simulated per property and written as CSS `linear()` timing (ease-out fallback), with the sweep as a mask circle scaling from the first square. Change `TUNING` and rebuild to retune the files.
- `design/stage-slider.js` — controls: the stage slider for settings newcomers may not know (strands, count, density). Like Procreate's brush-size preview, dragging shows a bubble over the thumb with one square of cloth and the thread on it, redrawn live (in-between values while dragging, settles on a real stop on release, then fades); arrow keys move a stop at a time. Thread or primitive style. Uses the `strands`, `count`, `density` and `scale` options of `threadSvg` / `primitiveSvg` (defaults leave the icons unchanged). The design page is the design system for icons and controls: build controls here, not in the lab.
- `design/tokens.css` — colour tokens. Palettes: tonal (`--<palette>-<50…950>`), one OKLCH lightness per step shared by every palette (step 500 = the primary), so a step pair has about the same contrast in any hue. Primary terracotta (`--primary` = terracotta 500 `#B84216`); neutral with a hint of warmth plus `--neutral-0` (white); no separate accent; status crimson (errors only); brand ochre, periwinkle, leaf, lilac (website and illustrations, never components). Roles (`--surface-*`, `--text*`, `--icon*`, `--border*`, `--control-*`, `--focus`, `--accent*`, `--on-accent`, `--danger*`): what components use, each pointing at a step; light by default, dark under `[data-theme="dark"]` or the system setting. Selected states are neutral: a one-step-lighter fill (`--surface-selected`), the icon or label at full strength (`--icon-active`), medium weight; hover only brightens the icon; focus is a ring in `--focus`. Terracotta is the primary button and the few selected states the user names. Type: Golos Text only (free, OFL; loaded by an `@import` at the top of tokens.css), numbers included via `--numeric` (tabular figures); steps `--type-title` 20/26 600, `--type-heading` 15/20 600, `--type-subheading` 13/18 600, `--type-body` 13/18, `--type-label` 12/16, `--type-label-strong` 12/16 500, `--type-caption` 11/14, `--type-eyebrow` 11/14 600 caps, used as `font: var(--type-…)`. Space and shape: `--space-<px>` (2–64, 4-based) plus named gaps (`--inline-gap`, `--row-gap`, `--control-padding-x`, `--panel-padding`, `--section-gap`); `--radius-xs…xl` (4/6/8/12/16) and `--radius-pill`, nested corners = outer minus padding; one `--border-width` 1px, focus ring `--focus-width`/`--focus-offset` 2px; `--shadow-float`/`-popover`/`-sheet` (theme-dependent, only for things that float over the canvas; the panel stays flat); `--target-min` 44px with compact `--control-sm/md/lg` (32/36/44), `--icon-sm/md/lg`, `--panel-width` 300px, `--toolbar-width`, `--stitch-tile`; `--z-*` layering from canvas to toast. Motion tokens are deferred until components. Plan and control list: `design/CHECKLIST.md`.
- `design/index.html` — gallery: sizes, stroke weight, bench/cloth backgrounds, frame switch (hover zoom / first / last), click to copy. Colour and type sections: the palettes (click to copy) and the roles, as a numbered colour specimen (not the panel design) beside a list where each role can be pointed at another step per theme, with live contrast and a copy-as-CSS of the changes (kept in localStorage `selvedge-role-edits`), the type scale, and space and shape (spacing, radius, borders and focus, shadows in both themes, sizes, layering), each sample drawn with its own token and its value read back from tokens.css. The page's own chrome still uses its old dark variables (`--ink`, `--brass`, …), renamed so they don't clash with the roles. Page controls: icon size per set (the patch drops to fewer squares at small sizes: about 10 px a square for primitives, 18 px for thread, 2–6 a side), colours per set, faint / no / full holes. A DialKit panel (dialkit@2.0.0 vanilla from jsDelivr, persisted as `selvedge-hover-zoom-3`) holds just Duration and Smoothness (defaults from `TUNING`). `design/zoom-motion.js` drives `.tz-one`/`.tz-many` with an interruptible spring: the hovered stitch shrinks in place to the top-left square and the rest of the patch sweeps out from it; the exported `*-zoom` files still carry the earlier centred CSS version.

The mockup's SVG stitches are **stand-ins**. The lab's renderer replaces them; the mockup screens' layout and controls are what carry forward.

Run locally: `npx serve .` (or any static server — ES modules need http, not file://). Deploys to Vercel as a static site (`vercel.json` redirects the old `/prototype/` link to `/`, and `/design` and `/mockup` to their trailing-slash URLs, since the pages load their scripts by relative path); every push to `main` redeploys https://stitches-ruddy.vercel.app.

## Product

### Two stitch families (the core engine decision)
- **Counted** — snap to fabric holes: full cross, half cross, quarter, three-quarter, backstitch, French knot, long stitch. Image conversion and sampler lettering produce these.
- **Freeform** — follow a drawn path: running, backstitch on curves, stem, split, chain, satin, long-and-short, lazy daisy, seed. Cursive lettering and outlines use these.
- Open question: one picker for both (current mockup) or freeform as its own mode.

### Realism
- Fabric: Aida 11/14/16/18, evenweave, linen. Weave and holes visible when zoomed; stitches enter real holes.
- Thread: stranded cotton = 6 twisted plies, usually 2 used. Sheen shifts along the twist. Every cross's top leg goes the same direction. Slight tension jitter. Soft shadow onto fabric.
- Zoom LOD: far = colour blobs → mid = stitch shapes → close = plies and stray fibres.
- Hover physics: stitch ends are **pinned in their holes**; the span between bows/lifts under the cursor and springs back. Don't move whole stitches.

### Wear (per-stitch `wear` 0→1, grows with pointer speed × dwell)
1. Fresh — tight twist, full sheen
2. Dulled — sheen rubs off first
3. Fuzzed — fibres lift and pill
4. Split — plies drift apart
5. Snapped — a strand breaks, loose ends curl and dangle with physics

Fabric under heavy rubbing fuzzes too. **Mend** tool restitches worn areas. Settings: wear rate, snap threshold, heals slowly vs stays worn.

### Picture → thread pipeline
Crop → physical size (fabric count sets grid) → colour reduction to a floss-style palette (k-means + palette match, optional dither) → background removal → tone → stitch mapping (light = half, mid = full, dark = full with more strands) → auto backstitch outline from edge detection → fully editable result.

### Letters
- **Sampler**: pixel fonts filled with counted stitches.
- **Script**: single-line (centreline) fonts stitched along the path in backstitch/stem/chain/satin. Skeletonizing regular fonts is the fallback, and messier.
- Text stays editable as an object. Straight or arc baseline, per-word colour, stitch spacing.

### Embed
A piece is **data, not an image** (fabric, stitches, threads, wear), so it stays interactive:
```html
<script src="https://[cdn]/selvedge.js" defer></script>
<stitch-piece src="abc123" interactive wear="visitor"></stitch-piece>
<stitch-text font="script-single" stitch="stem" color="#c0392b">Hello</stitch-text>
```
Wear modes: off / per visitor (local) / **shared** (everyone wears the same piece — the viral hook, needs a backend). Static fallback; respect `prefers-reduced-motion`.

## Tech plan
- Render: WebGL2 (or regl/three.js) with instanced stitches; each leg = twisted plies with sheen and shadow.
- Physics: CPU springs only for stitches near the pointer (spatial hash). Endpoints fixed at holes.
- Wear: one float per stitch in a texture/buffer.
- Embed: the same engine packaged as a web component.
- Pieces stored as JSON.

## Build order
1. Thread renderer that looks real at zoom
2. Anchored-spring hover physics
3. Wear
4. Editor with counted stitches
5. Image conversion
6. Type
7. Freeform stitches
8. Embed

1–3 are the riskiest and the reason the product exists. Prove them on a single patch of fabric before building more UI.

## Visual direction (keep it)
- Dark workbench; the cloth is the brightest thing on screen.
- Ground `#121418`, panels `#16181D`, text `#EEE9E0`, one brass accent `#E9B949` (dark ink `#1A1305` on it). Linen `#ECE5D6`. (Current pages.) The design system is moving to `design/tokens.css`: terracotta `#B84216` as the one primary/accent, warm neutrals, light and dark themes.
- Type: Instrument Sans (UI), IBM Plex Mono (counts, measurements) on the current pages; the design system moves to Golos Text for everything (see tokens.css). Pacifico only as the sample script face.
- Mode switcher is a pill; threads appear as skeins, not flat swatches.
- **Must not resemble Epoch Playground** (the inspiration): no light grey UI, no dashed panel borders, no black active tab bar, no red slider thumbs, no three-rail clone.
- No emoji, no gradient washes. Real buttons, 44px targets, 4.5:1 text contrast.
