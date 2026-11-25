---
name: tooltip-no-movement
description: "Tooltips (and similar small popups) must not slide, rise or grow in; only fade, and switch instantly between controls"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d1c7cf26-e033-426f-8dd4-724c3155fc48
  modified: 2026-11-03T20:58:16.510Z
---

The tooltip only fades in and out, with no slide, rise or scale. Moving straight from one control to the next switches it instantly. Copy a reference's look (e.g. shadcn), but not motion the user finds distracting.

**Why:** shadcn's tooltip slides 8px and zooms from 95%. The user asked to remove the slide, then said a 2px rise was "still moving in, which is so distracting" (2026-11-03).

**How to apply:** for small popups, default to opacity only. Ask before adding any movement. Related: [[pill-motion-squash]].
