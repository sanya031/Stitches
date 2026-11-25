---
name: sliders-are-stage-sliders
description: Every slider must be the stage slider (design/stage-slider.js), never the older .c-slider
metadata:
  type: feedback
---

Every time a slider is needed (panel, sheets, sketches), build it with `createStageSlider` from design/stage-slider.js, the same as Strands and Density: label above, the whole box is the slider, number on the right, drawing on a pill by the handle. If the setting doesn't exist, add it to `STAGE_SETTINGS` (as opacity was, 2026-11-12) instead of falling back to the older `.c-slider` markup.

**Why:** the user asked on 2026-11-12, after the Pattern sketch's Opacity used the old slider: "Everytime you create a slider make sure you create that one."
**How to apply:** no `.c-slider` in new work; pass `initial` for a starting value. Related: [[use-design-system-parts]].
