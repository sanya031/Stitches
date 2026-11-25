---
name: use-design-system-parts
description: "Every component uses the design system's own parts (icons from icons.js, primitives + hover zoom, stage slider, tokens); anything made from scratch must be flagged and confirmed before it's added to the system"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d1c7cf26-e033-426f-8dd4-724c3155fc48
  modified: 2026-11-03T19:51:56.698Z
---

Every component uses the design system's own parts: line icons only from `design/icons/icons.js`, stitch tiles as primitives with the gallery's hover zoom (`frame: 'zoom'`, `patchSquares(size)`, `createZoomMotion`), the stage slider, tokens. Use shared rules and helpers, never copied numbers.

If something doesn't exist yet (an icon, a state, a helper), don't draw it inline. Tell the user it's new, and get their OK before adding it to the system (for example `icons.js`, then `node design/icons/build.mjs`).

**Why:** on 2026-11-03 the user found hand-drawn icons, static tiles, and a hardcoded 3 × 3 zoom patch that looked different from the gallery. They said: "make sure whenever you make some component, icon is from the design system !! if you are making something from scratch, tell me and confirm to add it to the system".

**How to apply:** before writing markup, check `design/icons/*`, `controls.css` and `tokens.css` for an existing piece. Anything new is named in chat and confirmed first. Related: [[icons-design-page-only]], [[ask-before-design-page]].
