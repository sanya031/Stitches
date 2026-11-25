# Selvedge

**A free browser playground for realistic, interactive cross stitch and embroidery.**

Draw stitches by hand, turn a picture into thread, outline it, and (soon) embed the result on any website, where it stays live: the thread tugs under the cursor and wears out when rubbed, like real thread.

*Selvedge* is a fabric's self-finished edge. It's a working name.

**Live:** https://stitches-ruddy.vercel.app · **Studio:** https://stitches-ruddy.vercel.app/studio/

---

## What's here

| Page | What it is |
|---|---|
| [`/studio/`](https://stitches-ruddy.vercel.app/studio/) | **The studio.** The real editor: the designed panel on the WebGL thread renderer. Start here. |
| [`/`](https://stitches-ruddy.vercel.app/) | **Thread lab.** The first editor, used to prove the renderer and the picture pipeline. |
| [`/design/`](https://stitches-ruddy.vercel.app/design/) | **Design system gallery.** Icons, stitch drawings, colour and type tokens. |
| [`/design/controls.html`](https://stitches-ruddy.vercel.app/design/controls.html) | Every control in every state, built from tokens only. |
| [`/design/panel.html`](https://stitches-ruddy.vercel.app/design/panel.html) | The properties panel assembled from those controls. |
| [`/design/slider-lab.html`](https://stitches-ruddy.vercel.app/design/slider-lab.html) | The stage slider on its own, one version per iteration, to tune how it feels. |
| [`/mockup/`](https://stitches-ruddy.vercel.app/mockup/) | Clickable mockup of the full product: Stitch, Picture, Letters, Close-up, Embed. |
| [`/reel/`](https://stitches-ruddy.vercel.app/reel/) | Pages for recording short demo clips. |

The design system (principles, tokens, controls, motion and how to extend it) is in **[DESIGN.md](DESIGN.md)**, with every token and its light and dark value in **[design/TOKENS.md](design/TOKENS.md)**.

---

## The studio

It opens on a stitched calla lily, ready to edit.

**Tools** (the floating bar on the left): Select, Stitch, Fill, Pattern, Picture, Erase, Pan.

**The panel**, top to bottom:

- **Canvas**: zoom, fabric (dot grid, Aida, linen, denim), coverage (fabric count), cell size and sheet size.
- **Eraser**: only while erasing. Choose what it erases (stitches, pattern squares or both) and its size, 1 to 12 squares a side.
- **Stitch**: every counted stitch and fill. Full, half, quarter and three-quarter cross, backstitch, and long-stitch fills such as laid, woven, blocks, fern, seed, knots and burst.
- **Thread**: colour, strands and density.
- **Pattern**: a picture to stitch over, and the pattern's colours with opacity, an eye and a bin.
- **Outline**: a list of saved outlines. Each one goes round the whole cloth or round a selected area. It is drawn in a darker shade of each colour it borders, or in one colour of your choice. There are six stitches: backstitch, running, stem, split, chain and whipped backstitch.
- **Canvas colours / Canvas stitches**: everything on the cloth by colour and by stitch. Each can be retyped, hidden, deleted or selected. While something is selected, these lists cover just the selection.

**Selecting.** Drag a rectangle, or click to select a connected patch of one colour. The **selection bar** floats above the selection, with these controls:
- Stitch | Colour: change either for just the selection.
- Outline.
- Hide.
- Delete.
- More: duplicate, copy, paste, flip, invert, turn into pattern.

Selections can also be dragged, nudged with the arrow keys, and copied with ⌘C, ⌘V and ⌘D.

**Pictures.** Drop or paste any image. The picture pop-up converts it live:
- crop, rotate and compare;
- size;
- 4, 8 or 16 colours, with dither;
- saturation and brightness;
- one stitch for each of light, mid and dark tones.

Colours snap to real **DMC** threads (454 of them), and each has its **Anchor** equivalent.

**The colour picker** has three tabs:
- **Custom**: a colour field, hue and eyedropper.
- **Extract**: pull a palette out of an image.
- **Saved**: your palettes.

Values can be shown as Hex, RGB, HSL, DMC or Anchor, and typing a DMC or Anchor number searches the threads. Your current palette can be torn off and float over the cloth.

**Keys:** ⌘Z undo · Delete removes the selection · arrows nudge (Shift ×10) · + − 0 zoom · Escape lets go.

---

## How it's built

Plain HTML, CSS and JavaScript ES modules. **No build step, no framework.**

```
studio/            the studio page (index.html, studio.js: panel, tool bar, selection bar, pop-ups)
lab/
  editor.js        the engine with no UI: piece, camera, tools, selection, outlines, undo
  renderer.js      WebGL2: procedural fabrics, instanced thread legs in three layers, stray fibres, LOD
  picture.js       picture → thread: sample, remove background, k-means in Lab, snap to DMC, tones, outline
  fills.js         long-stitch fills clipped to a shape of squares
  floss.js         the 454 DMC threads, with names and Anchor equivalents
  starter.js       draws the starter calla lilies
  main.js          the thread lab's own editor (to move onto editor.js)
design/            the design system: tokens, controls, icons, and the pages that show them
mockup/            the clickable product mockup
reel/              demo recording pages
notes/             working rules kept for Claude Code (see below)
```

**How the thread is drawn.** Every stitch becomes a set of **legs**: lens-shaped quads drawn instanced on the GPU.
- Each leg has two-strand shading with a centre groove, twist grooves, sheen and a soft shadow on the cloth.
- Each end is flagged as either entering the fabric, which pinches it into its hole, or carrying on as the same thread.
- Far away, stitches read as blocks of colour. Up close you see stitch shapes, then plies and stray fibres.

### Run it locally

```bash
npx serve .
```

Then open the printed URL and go to `/studio/`. Any static server works, for example `python3 -m http.server 5179`. Opening the files straight from disk won't work, because ES modules need http.

### Deploy

It's a static site on Vercel with no build command. **Every push to `main` redeploys** https://stitches-ruddy.vercel.app. `vercel.json` adds the trailing-slash redirects the pages need for their relative imports.

### Icons

The line icons are in `design/icons/icons.js`, and the thread icons for stitches and fills are in `design/icons/thread.js` and `primitives.js`. After editing any of them, run this:

```bash
node design/icons/build.mjs
```

It regenerates `svg/`, `sprite.svg`, `icons.css` and the thread and primitive exports.

---

## Where it's going

1. ~~Thread renderer that looks real at zoom~~
2. Anchored-spring hover physics: stitch ends stay pinned in their holes, and the span bows under the cursor.
3. Wear: fresh, then dulled, fuzzed, split and finally snapped. A Mend tool restitches.
4. ~~Editor with counted stitches~~
5. ~~Picture conversion~~
6. Letters: sampler pixel fonts, and script fonts stitched along a path.
7. Freeform stitches that follow a drawn path.
8. Embed: `<stitch-piece>` and `<stitch-text>` web components. Wear is per visitor, or **shared**, where everyone wears the same piece.

The full product brief, engine notes and build order are in **[CLAUDE.md](CLAUDE.md)**.

---

## Working with Claude Code

This project is built with Claude Code.
- **[CLAUDE.md](CLAUDE.md)** describes every file and decision in detail. Claude reads it at the start of every session.
- **[CLAUDE.md](CLAUDE.md)** also ends with the working rules and **where we left off**.
- **[notes/claude-memory/](notes/claude-memory/)** holds the rules one per file. [notes/README.md](notes/README.md) says how to restore them as memory on a new machine.

## Credits

- **Thread colours:** the [dmc](https://github.com/sharlagelfand/dmc) package by Sharla Gelfand (MIT), from community screen colours. DMC publishes none.
- **Anchor equivalents:** from Tiny Modernist's DMC → Anchor guide, checked against Cyberstitchers' chart.
- **Type:** [Golos Text](https://fonts.google.com/specimen/Golos+Text) (OFL).
