# Selvedge

A playground for realistic, interactive cross stitch and embroidery — draw stitches, turn pictures into thread, stitch letters, and embed live thread that tugs and wears on any website.

Live at https://stitches-ruddy.vercel.app. Plain HTML, CSS and JavaScript, no build step.

- **Home page: the thread lab** — a WebGL2 patch of Aida with a half-stitched strawberry kit you can keep stitching.
- **`/mockup/`** — the clickable mockup of the full editor: five screens (Stitch, Picture, Letters, Close-up, Embed).

## Run it

```bash
npx serve .
```

Then open the URL it prints. Any static server works; opening `index.html` directly from disk won't, because the scripts are ES modules.

## Thread lab

Pick a stitch type (full, half, quarter, three-quarter, backstitch), a thread, strands, fabric count and colour; adjust twist, sheen and fuzz. Click or drag to stitch, scroll or pinch to zoom, right-drag or hold Space to pan, Cmd/Ctrl+Z to undo. Code: `index.html`, `lab/main.js` (editor), `lab/renderer.js` (WebGL2).

## Deploy to Vercel

Import this repo at [vercel.com/new](https://vercel.com/new). No build command, no output directory — it's a static site. Every push to `main` redeploys.

## Next

See `CLAUDE.md` for the product brief, the engine plan and the build order.
