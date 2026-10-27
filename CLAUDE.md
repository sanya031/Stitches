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
- `design/icons/icons.js` — the icon set (name → group, label, SVG body) and `svg(name, opts)`. Edit here, then `node design/icons/build.mjs` writes `svg/*.svg` and `sprite.svg`. Rules: 24 grid, 2 px padding, 1.75 stroke, round caps/joins, currentColor, fabric holes as dots (r 1.25), stitch legs stop 1.5 short of a hole. Solid fills only where they mean something.
- `design/icons/thread.js` — thread-style icons for stitches and fills, each shown in one square between its four holes (quarter and three-quarter in all four corners). Drawn to match the canvas: lens-shaped legs in their own rotated frame, two-strand shading with a centre groove, twist grooves at ~35°, dark ends, contact shadow; widths as on the canvas at count 14. Every fill comes from `lab/fills.js` for a single square, exactly as the canvas draws one square of it (no icon-only patterns). `threadSvg(name, { colour, size, paper, id })`; pass a unique `id` when several sit on one page.
  `frame`: `'square'` (default, the first frame), `'patch'` (the last frame: a 4 × 4 patch in the same square, fills from `lab/fills.js` over the whole patch so weaves, blocks and bursts show their real repeat) or `'zoom'` (hover animation between them, from `zoomStyle()`: patch 4× → 1× and square 1× → ¼×, both about (18, 18) on the 48 frame; plays on hovering the svg or an ancestor with class `tz-host`; reduced motion crossfades). Built to `thread/`, `thread-patch/`, `thread-zoom/` (inline zoom svgs; an `<img>` shows only the square).
- `design/icons/primitives.js` — the same 25 stitches and fills as clean line primitives (same names): four hole dots, the one-square shape with fewer lines, fills at 0.7× stroke, gaps where a thread passes under. Same three frames (`primitiveSvg(name, { size, stroke, frame, id })`): the patch is drawn from `lab/fills.js` at a more open density with a mask cutting under-threads, zooming about (9.67, 9.67) on the 24 grid. Built to `primitive/`, `primitive-patch/`, `primitive-zoom/`, and the square as `p-<name>` in `sprite.svg`. Icon work stays on the design page; the lab does not use these icons.
- `design/index.html` — gallery: sizes, stroke weight, bench/cloth backgrounds, click to copy.

The mockup's SVG stitches are **stand-ins**. The lab's renderer replaces them; the mockup screens' layout and controls are what carry forward.

Run locally: `npx serve .` (or any static server — ES modules need http, not file://). Deploys to Vercel as a static site (`vercel.json` only redirects the old `/prototype/` link to `/`); every push to `main` redeploys https://stitches-ruddy.vercel.app.

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
- Ground `#121418`, panels `#16181D`, text `#EEE9E0`, one brass accent `#E9B949` (dark ink `#1A1305` on it). Linen `#ECE5D6`.
- Type: Instrument Sans (UI), IBM Plex Mono (counts, measurements). Pacifico only as the sample script face.
- Mode switcher is a pill; threads appear as skeins, not flat swatches.
- **Must not resemble Epoch Playground** (the inspiration): no light grey UI, no dashed panel borders, no black active tab bar, no red slider thumbs, no three-rail clone.
- No emoji, no gradient washes. Real buttons, 44px targets, 4.5:1 text contrast.
