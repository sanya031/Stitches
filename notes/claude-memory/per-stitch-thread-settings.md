---
name: per-stitch-thread-settings
description: "Strands and density must belong to each stitch, not the whole canvas — bring this up when building the lab editor's thread settings"
metadata:
  node_type: memory
  type: project
  originSessionId: d1c7cf26-e033-426f-8dd4-724c3155fc48
  modified: 2026-11-05T03:37:23.822Z
---

Agreed on 2026-11-04: in the lab, strands is one global value (`state.strands`, `threadWidth()` in lab/main.js), so moving the slider re-thickens every stitch; picture fills also follow the density slider live. The user wants it like real cloth:
- Nothing selected: sliders set the *next* stitch; each stitch stores its own strands (fills also density) and keeps it until changed.
- One stitch or a selection: sliders show and change only those; mixed values show a mixed state, moving sets them all.
- A picture's fills are one group: density on a selected picture changes its fills only.
- Fabric count stays global (it is the cloth).

**Why:** it's a virtual product; you should be able to vary thickness stitch by stitch, as on real fabric.
**How to apply:** when building the editor/panel thread settings (or touching strands/density in lab/main.js), raise this and build it this way. Ties to the Panel tab's "Showing" states and Canvas stitches rows. Related: [[icons-design-page-only]].
