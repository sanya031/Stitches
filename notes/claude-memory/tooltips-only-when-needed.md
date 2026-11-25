---
name: tooltips-only-when-needed
description: Don't put tooltips on self-explanatory controls (− / +, obvious icons); tooltips only where meaning isn't clear
metadata:
  type: feedback
---

Don't give every control a tooltip. Obvious ones (− and + steppers, a close cross, a chevron, a control whose cursor already says what it does) get none; keep the aria-label for screen readers. Tooltips are for what isn't self-evident: icon-only tools, stitch drawings, numbers whose meaning isn't on screen.

**Why:** the user, 2026-11-16, on the cell size − / +: "remove the tool tip for smaller bigger, that is very intuitive. dont need immediate tooltips for everything".
**How to apply:** when adding a control, decide if a tooltip earns its place; default to none for steppers and plain actions. Related: [[tooltip-no-movement]], [[no-hint-lines]].
