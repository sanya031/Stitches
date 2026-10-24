# Selvedge — stitch playground

A free browser playground for **realistic, interactive cross stitch and embroidery**. People draw stitches by hand, turn pictures into thread, stitch letters, and embed the result on any website — where it stays live: it tugs under the cursor and wears out when rubbed, like real thread.

"Selvedge" (a fabric's self-finished edge) is a working name.

## Where things are now

This repo is a **clickable mockup**, not the product yet. Plain HTML/CSS/JS, no build step:

- `index.html` — shell + header; `styles.css` — all styling and design tokens.
- `js/app.js` — hash router (`#stitch`, `#picture`, `#letters`, `#closeup`, `#embed`) and a tiny state store. Screens re-render on every action.
- `js/screens/*.js` — one module per screen: `{ title, file, status, initial, render(state), actions }`. Wire controls with `data-act="name" data-arg="…"` (click), `data-input` (live input), `data-change` (sliders, commit on release).
- `js/thread.js` — SVG stitch drawing (`crossSVG`, `cellsHTML`, `wornStitchSVG`), the strawberry motif, stitch picker icons.

The SVG stitches are **stand-ins**. The real renderer (below) replaces them; the screens' layout and controls are what carry forward.

Run locally: `npx serve .` (or any static server — ES modules need http, not file://). Deploys to Vercel as a static site with no config.

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
