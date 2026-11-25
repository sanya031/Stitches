---
name: eye-vs-toggle
description: Eye icon for seeing/hiding something that's there; switch only for settings that change the result
metadata:
  type: feedback
---

Use an eye to show or hide something that exists (a colour, a layer, the whole pattern): only the view changes, nothing is made, lost or recalculated; it sits on the item or on its list's label row. Use a switch (Off / On pill) for a setting that changes what's made or how something behaves (Dither, Remove background, Make stitches). Test: if off-then-on gives exactly what you had and only the view changed, it's an eye. Agreed 2026-11-12 when "Show pattern" (a switch under Picture, read as hiding the picture) was removed; a hide-all eye on the Pattern colours label row was tried and the user removed it too: per-colour eyes are enough.

**Why:** a visibility switch next to Picture was ambiguous and duplicated the per-colour eyes.
**How to apply:** never add a "Show X" switch for visibility, and don't add hide-all eyes on label rows; per-item eyes only, switches for settings. Related: [[trailing-icons-align]].
