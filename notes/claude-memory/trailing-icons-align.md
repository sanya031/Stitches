---
name: trailing-icons-align
description: A trailing icon button's drawing (not its box) aligns to the right edge of the widest element above it
metadata:
  type: feedback
---

When icons sit at the right end of a row (eye, bin, etc. after a field), the icon's drawing should touch the imaginary guide line set by the longest element above it (usually the full-width fields), not sit inset by the button's equal padding. Done in controls.css on 2026-11-12 for `.c-row--field > .c-iconbtn:last-child` with a negative right margin (half the box around the icon plus the icon's own ~2/24 margin).

**Why:** equal padding inside the icon button makes the column look optically misaligned.
**How to apply:** for any new row with trailing icon buttons, hang the last one the same way; check alignment by measuring the glyph's right edge against the field's.
