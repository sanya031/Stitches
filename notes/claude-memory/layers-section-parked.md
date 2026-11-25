---
name: layers-section-parked
description: "The Layers section was taken out of the Panel tab on 2026-11-11 but kept, to be placed somewhere else later"
metadata:
  node_type: memory
  type: project
  originSessionId: d1c7cf26-e033-426f-8dd4-724c3155fc48
  modified: 2026-11-11T19:46:48.839Z
---

On 2026-11-11 the user removed Layers from the properties panel (design/panel.js) but asked to remember its contents, since it may go somewhere else (e.g. its own place near the canvas).

What it was: a "Layers" section with an Add layer (+) icon button in its header, and one row per layer (`c-layer`, `layerRow()` in panel.js, styled by `@control layer-row`): name, an eye toggle (show/hide; hidden rows dim and the icon becomes eye-off) and a lock toggle. Sample rows: Lettering, Stitches (selected), Calla lilies photo (hidden). It sat last in the Tool, Selection, Image and Text panels.

**Why:** the user wants the panel to focus on stitch and thread settings; layers may belong elsewhere.
**How to apply:** the `layers` const is still defined in panel.js (unused); when the user decides where layers go, reuse it rather than rebuilding. Raise it when laying out the editor around the canvas. Related: [[icons-design-page-only]].
