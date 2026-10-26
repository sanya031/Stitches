# Selvedge

A playground for realistic, interactive cross stitch and embroidery — draw stitches, turn pictures into thread, stitch letters, and embed live thread that tugs and wears on any website.

Live at https://stitches-ruddy.vercel.app. Plain HTML, CSS and JavaScript, no build step.

- **Home page: the thread lab** — stitched calla lilies to start from, a full stitch editor, and Picture: turn a photo into stitching or into a pattern to stitch over.
- **`/mockup/`** — the clickable mockup of the full editor: five screens (Stitch, Picture, Letters, Close-up, Embed).

- **`/design/`** — the icon set: 70 line icons for tools, stitches, fills, actions, view, thread, canvas and product, with a gallery to preview sizes and stroke weights and copy SVGs.

## Icons

Two styles. **Line icons** (`design/icons/icons.js`) for every control. **Thread icons** (`design/icons/thread.js`) for stitches and fills, drawn as real thread in any colour: `threadSvg(name, { colour, size, paper })`. After editing either, run `node design/icons/build.mjs` to regenerate `design/icons/svg/*.svg`, `design/icons/sprite.svg` and `design/icons/thread/*.svg`. Rules: 24 px grid, 2 px padding, 1.75 stroke, round caps and joins, `currentColor`; stitch icons show fabric holes as dots.

## Run it

```bash
npx serve .
```

Then open the URL it prints. Any static server works; opening `index.html` directly from disk won't, because the scripts are ES modules.

## Thread lab

- **Tools:** Stitch, Fill, Pattern, Select, Erase, Pan.
- **Select and recolour:** drag a rectangle or click a part to select the connected patch of one colour (Shift adds). The colours in the selection are listed; pick one and choose a new thread (same-family shades suggested first) to change it only there.
- **Stitches:** full cross, half, quarter, three-quarter, backstitch.
- **Fills:** long stitches laid across a whole shape: rows, columns, hatch, woven (3×3, 5×5, diagonal), satin blocks, fern, seed, French knots, burst; plus cross and tweed (one per square). Drag a rectangle, or click a pattern shape to fill it in its own colours. Density runs from open to solid satin. Fills and stitches mix freely in the same row.
- **Pattern:** paint squares to plan your own design, then stitch or fill over it; "Show pattern" hides it.
- **Picture:** *Stitch a photo* turns it into finished stitching; *Pattern from a photo* turns it into coloured pattern squares only, to stitch over by hand or fill shape by shape (your stitches are never touched when the pattern rebuilds). The photo fits inside the canvas, centred. Set its size and number of colours, remove the background, dither. Light, mid and dark tones each become a stitch or fill (satin follows the picture's edges). Colours snap to a named floss palette, with a floss list of what you'd need, and an optional backstitch outline in a darker shade.
- **Canvas:** size presets (Square, Landscape, Wide, Portrait) or a custom width × height, rotate, and a cell size that sets how many squares fit on it. Surface: dot grid (default), Aida, linen or denim; count 11–18 squares per inch.
- **Thread:** 20 colours plus custom, recent threads, 1–3 strands; twist, sheen and fuzz sliders.

Scroll or pinch to zoom, right-drag or hold Space to pan, Cmd/Ctrl+Z to undo. Code: `index.html`, `lab/main.js` (editor), `lab/picture.js` (picture conversion), `lab/floss.js` (thread palette), `lab/fills.js` (fill generators), `lab/renderer.js` (WebGL2).

## Deploy to Vercel

Import this repo at [vercel.com/new](https://vercel.com/new). No build command, no output directory — it's a static site. Every push to `main` redeploys.

## Next

See `CLAUDE.md` for the product brief, the engine plan and the build order.
