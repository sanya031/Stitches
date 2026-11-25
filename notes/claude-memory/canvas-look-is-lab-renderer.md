---
name: canvas-look-is-lab-renderer
description: The stitches on the canvas must look like the live lab renderer; panel/function sketches only finalise controls
metadata:
  type: project
---

On 2026-11-12 the user made clear: the panel and function work (Pattern, picture pop-up, Outline, switches, sliders) is about finalising the controls and how the subsections look. The canvas and the look of the stitches are already what they want: the lab's WebGL renderer as on https://stitches-ruddy.vercel.app (lab/renderer.js + lab/main.js). They were unhappy with a sketch that drew stitches as flat lines.

**Why:** the realistic thread look is the product's core; a flat stand-in reads as a regression.
**How to apply:** in sketches, either drive the real lab renderer or say plainly the cloth is a placeholder; never present a new stitch drawing as the canvas. When the panel is built into the app, it controls the lab renderer, not a new drawing. Related: [[icons-design-page-only]].
