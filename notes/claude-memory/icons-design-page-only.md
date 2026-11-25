---
name: icons-design-page-only
description: "The /design/ page is the design system for icons AND controls; build them there, never in the lab app (lab/main.js, index.html)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d1c7cf26-e033-426f-8dd4-724c3155fc48
  modified: 2026-10-27T19:56:27.673Z
---

Icons and UI controls (tooltips, sliders, previews, etc.) are built only in the design system on the design page (`design/`), not in the lab app on the home page (`lab/main.js`, root `index.html`).

**Why:** the user said "dont implement any icon changes to main. Only the design page" (2026-10-27), and again after the strands/count/density tooltips went into the lab: "dont make this to the lab only design page" and "all of these are where we are building a design system for various controls" (2026-10-27). That lab change had to be reverted.

**How to apply:** even when a request names a lab control (Strands, Count, Density…), build it as a component/demo in `design/`. Don't touch the lab home page unless the user explicitly asks to wire something in.

Update 2026-11-16: the user asked for a live version, so the designed panel now runs on the real renderer at `/studio/` (studio/studio.js on lab/editor.js). Components are still designed in `design/`; the studio only uses them. The lab home page (`index.html` + `lab/main.js`) stays as it was.
