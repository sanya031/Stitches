---
name: no-hint-lines
description: No explanatory hint lines (c-hint captions) under panel controls; words go in tooltips
metadata:
  node_type: memory
  type: feedback
  originSessionId: d1c7cf26-e033-426f-8dd4-724c3155fc48
  modified: 2026-11-12T19:26:48.729Z
---

Don't put explanatory caption lines under controls in the panel (e.g. "Placing #B84216 with the Pattern tool. Click the chip to change it." or "Opacity for #447C5D only…"). The user removed them from the Pattern sketch on 2026-11-12, and earlier removed the stitch name line under the grid ("we already have the tooltips").

**Why:** the panel stays clean; explanations belong in tooltips, and short ones.
**How to apply:** when designing panel sections or states, convey meaning with labels, field states and short tooltips, not `.c-hint` lines. Keep tooltip copy short (e.g. "Pattern tool" + shortcut, not a sentence). Related: [[use-design-system-parts]].
