---
name: pill-motion-squash
description: Any pill whose selected fill travels uses the Squash motion, saved as --motion-pill-* in design/tokens.css
metadata:
  type: feedback
---

Use the Squash motion (its Flat version, chosen 2026-11-02: flatten 0.6, lengthen 0.02) for every current and future pill where the selection moves between options; don't propose a new one per pill.

**Why:** the user chose it from six variations: "use the squash motion as well for any future pill motion. Save that under motion" (2026-11-02).

**How to apply:** build on `createSegMotion(root, getValues)` from `design/seg-motion.js`, which starts from the `--motion-pill-*` tokens. Related: [[icons-design-page-only]].
