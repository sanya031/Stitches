// Selvedge line icons: the single source of truth. `build.mjs` writes svg/*.svg, sprite.svg and icons.css from it.
// (Stitches and fills have their own sets: thread.js and primitives.js.)
//
// Rules — every icon follows all of them, so any two can sit side by side:
// - 24 × 24 viewBox; ink lives in the 3..21 live area (2 px padding plus 1 for the stroke's half width)
// - keylines: a square icon spans 4..20 (16), a round one is r 8.5, a tall one 5..19 × 3..21, a wide one 3..21 × 5..19;
//   every icon reaches its keyline on at least one axis, so they read as one size
// - stroke only: 1.75, round caps and joins, currentColor; never a fill, never a second tone or opacity
// - a dot is a zero-length stroke (`M x y h0`), so it is the stroke's own round cap, 1.75 across
// - parts that move on hover carry classes a1, a2, …; their motion is in `motion` (see KEYFRAMES below)

const DOT = (x, y) => `M${x} ${y}h0`;
const EASE = 'cubic-bezier(.4,0,.2,1)';

/** name → { group, label, body, motion? } — motion: [[part, keyframes, duration (s), timing, origin 'x y', delay (s)?], …] */
export const ICONS = {
  // ---- tools ----
  // a needle drawing a thread through: on hover the needle dips into the cloth and the thread pulls through again
  'tool-stitch': {
    group: 'Tools', label: 'Stitch',
    body: '<g class="a1"><path d="M4 20L14.4 9.6"/><rect x="15.2" y="3" width="3" height="7.6" rx="1.5" transform="rotate(45 16.7 6.8)"/></g>'
      + '<path class="a2" pathLength="1" d="M17.4 6.6c2.4 1.3 3.2 4.1 1.6 6.4-1.4 2-1.1 4.9 1 7"/>',
    motion: [['.a1', 'si-dip', 0.7, EASE, '12 12'], ['.a2', 'si-redraw', 0.9, EASE, '12 12']],
  },
  // a leaf laid with satin stitches across it: on hover the stitches lay in, one after another
  'tool-fill': {
    group: 'Tools', label: 'Fill',
    body: '<path d="M4 20C4 10.5 10.5 4 20 4c0 9.5-6.5 16-16 16z"/>'
      + '<path class="a1" pathLength="1" d="M7 14l3 3"/><path class="a2" pathLength="1" d="M10 10.5l3.5 3.5"/><path class="a3" pathLength="1" d="M13.5 7.5l3 3"/>',
    motion: [['.a1', 'si-redraw', 0.5, 'ease-out', '12 12'], ['.a2', 'si-redraw', 0.5, 'ease-out', '12 12', 0.1], ['.a3', 'si-redraw', 0.5, 'ease-out', '12 12', 0.2]],
  },
  // a chart being planned: two squares marked; on hover the other two get their crosses
  'tool-pattern': {
    group: 'Tools', label: 'Pattern',
    body: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M12 3.5v17M3.5 12h17"/>'
      + '<path d="M6.5 6.5l3 3M9.5 6.5l-3 3M14.5 14.5l3 3M17.5 14.5l-3 3"/>'
      + '<path class="a1" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="M14.5 6.5l3 3M17.5 6.5l-3 3"/>'
      + '<path class="a2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="M6.5 14.5l3 3M9.5 14.5l-3 3"/>',
    motion: [['.a1', 'si-draw', 0.35, 'ease-out', '12 12', 0.05], ['.a2', 'si-draw', 0.35, 'ease-out', '12 12', 0.25]],
  },
  // a dotted marquee with the pointer that drew it: on hover the dots march and the pointer nudges in
  'tool-select': {
    group: 'Tools', label: 'Select',
    body: '<path class="a1" stroke-dasharray="0 3" d="M10 17H6a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 6 3.5h8.5A2.5 2.5 0 0 1 17 6v4"/>'
      + '<path class="a2" d="M12.5 12.5L20.5 15.5L17.2 17.2L15.5 20.5Z"/>',
    motion: [['.a1', 'si-march', 0.6, 'linear', '12 12'], ['.a2', 'si-nudge', 0.6, EASE, '12 12']],
  },
  'tool-wand': {
    group: 'Tools', label: 'Select colour',
    body: '<path d="M4 20L14.5 9.5M13 8l3 3"/><path class="a1" d="M18 3v3M16.5 4.5h3"/><path class="a2" d="M20 9v2M19 10h2"/><path class="a3" d="M10 3.5v2M9 4.5h2"/>',
    motion: [['.a1', 'si-twinkle', 0.6, 'ease-out', '18 4.5'], ['.a2', 'si-twinkle', 0.6, 'ease-out', '20 10', 0.12], ['.a3', 'si-twinkle', 0.6, 'ease-out', '10 4.5', 0.24]],
  },
  // an eraser rubbing out a line of stitches: on hover it rubs and the line under it goes, then comes back
  'tool-erase': {
    group: 'Tools', label: 'Erase',
    body: '<g class="a1"><path d="M3.9 13.6l8.2-8.2a1.9 1.9 0 0 1 2.7 0l4.3 4.3a1.9 1.9 0 0 1 0 2.7l-6.6 6.6a1.9 1.9 0 0 1-1.3.5H8.8a1.9 1.9 0 0 1-1.3-.5l-3.6-3.6a1.3 1.3 0 0 1 0-1.8z"/><path d="M8.2 9.3l6.5 6.5"/></g>'
      + '<path class="a2" pathLength="1" d="M20.5 20.5h-6"/>',
    motion: [['.a1', 'si-rub', 0.8, 'ease-in-out', '12 12'], ['.a2', 'si-erase', 0.8, 'ease-in-out', '12 12']],
  },
  // a grabbing hand, fingers curled over: on hover it closes a little tighter and drags
  'tool-pan': {
    group: 'Tools', label: 'Pan',
    body: '<g class="a1"><path d="M6.5 12V9a1.5 1.5 0 0 1 3 0v1.5M9.5 10.5V7.5a1.5 1.5 0 0 1 3 0v3M12.5 10.5V8a1.5 1.5 0 0 1 3 0v2.5'
      + 'M15.5 11V9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5.4-3.4l-1.8-3.8a1.4 1.4 0 0 1 2.5-1.3L8 14.5"/></g>',
    motion: [['.a1', 'si-grab', 0.8, EASE, '12 14']],
  },

  // ---- actions ----
  'undo': { group: 'Actions', label: 'Undo', body: '<g class="a1"><path d="M9 5L4 10l5 5"/><path d="M4 10h10.5a5.5 5.5 0 0 1 0 11H12"/></g>', motion: [['.a1', 'si-back', 0.5, EASE, '12 12']] },
  'redo': { group: 'Actions', label: 'Redo', body: '<g class="a1"><path d="M15 5l5 5-5 5"/><path d="M20 10H9.5a5.5 5.5 0 0 0 0 11H12"/></g>', motion: [['.a1', 'si-forward', 0.5, EASE, '12 12']] },
  'clear': { group: 'Actions', label: 'Clear', body: '<g class="a1"><path d="M15.5 3.5L12 11.5"/><path d="M7.2 11.5h9.6l1.7 8.5H5.5z"/><path d="M9.5 15v5M13.5 15v5"/></g>', motion: [['.a1', 'si-sweep', 0.7, 'ease-in-out', '12 20']] },
  'picture': { group: 'Actions', label: 'Picture', body: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle class="a1" cx="8.5" cy="10" r="1.75"/><path d="M21 15.5l-4.8-4.8L7.5 19"/>', motion: [['.a1', 'si-rise', 0.6, EASE, '8.5 10']] },
  'upload': { group: 'Actions', label: 'Upload', body: '<path class="a1" d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', motion: [['.a1', 'si-up', 0.6, EASE, '12 12']] },
  'download': { group: 'Actions', label: 'Download', body: '<path class="a1" d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', motion: [['.a1', 'si-down', 0.6, EASE, '12 12']] },
  'share': { group: 'Actions', label: 'Share', body: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path class="a1" pathLength="1" d="M8.7 10.7l6.6-3.9M8.7 13.3l6.6 3.9"/>', motion: [['.a1', 'si-redraw', 0.6, 'ease-out', '12 12']] },
  'recolour': { group: 'Actions', label: 'Recolour', body: '<path class="a1" d="M4 8h16M17 5l3 3-3 3"/><path class="a2" d="M20 16H4M7 13l-3 3 3 3"/>', motion: [['.a1', 'si-right', 0.5, EASE, '12 12'], ['.a2', 'si-left', 0.5, EASE, '12 12']] },
  'rotate': { group: 'Actions', label: 'Rotate', body: '<g class="a1"><path d="M19.6 8.6A8 8 0 1 0 20 12"/><path d="M20 4.5v4.3h-4.3"/></g>', motion: [['.a1', 'si-spin', 0.7, EASE, '12 12']] },
  'play': { group: 'Actions', label: 'Stitch it', body: '<path class="a1" d="M7 4v16l12.5-8z"/>', motion: [['.a1', 'si-right', 0.5, EASE, '12 12']] },
  'check': { group: 'Actions', label: 'Done', body: '<path class="a1" pathLength="1" d="M4 12.5l5.5 5.5L20 6.5"/>', motion: [['.a1', 'si-redraw', 0.5, 'ease-out', '12 12']] },
  'close': { group: 'Actions', label: 'Close', body: '<path class="a1" d="M5 5l14 14M19 5L5 19"/>', motion: [['.a1', 'si-quarter', 0.5, EASE, '12 12']] },
  'plus': { group: 'Actions', label: 'Add', body: '<path class="a1" d="M12 4v16M4 12h16"/>', motion: [['.a1', 'si-quarter', 0.5, EASE, '12 12']] },
  'minus': { group: 'Actions', label: 'Remove', body: '<path class="a1" d="M4 12h16"/>', motion: [['.a1', 'si-squeeze', 0.5, EASE, '12 12']] },

  // ---- view ----
  'zoom-in': { group: 'View', label: 'Zoom in', body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20"/><path class="a1" d="M10.5 7.75v5.5M7.75 10.5h5.5"/>', motion: [['.a1', 'si-pulse', 0.5, EASE, '10.5 10.5']] },
  'zoom-out': { group: 'View', label: 'Zoom out', body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20"/><path class="a1" d="M7.75 10.5h5.5"/>', motion: [['.a1', 'si-squeeze', 0.5, EASE, '10.5 10.5']] },
  'fit': { group: 'View', label: 'Fit', body: '<path class="a1" d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>', motion: [['.a1', 'si-breathe', 0.6, EASE, '12 12']] },
  'eye': { group: 'View', label: 'Show', body: '<path d="M3 12S6.5 5.5 12 5.5 21 12 21 12 17.5 18.5 12 18.5 3 12 3 12z"/><circle class="a1" cx="12" cy="12" r="2.75"/>', motion: [['.a1', 'si-look', 0.8, 'ease-in-out', '12 12']] },
  'eye-off': { group: 'View', label: 'Hide', body: '<path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c5.5 0 9 6.5 9 6.5a16 16 0 0 1-2.6 3.4M6.4 7.3A16 16 0 0 0 3 12s3.5 6.5 9 6.5a9 9 0 0 0 4.6-1.3"/><path d="M10 10.1a2.75 2.75 0 0 0 3.9 3.9"/><path class="a1" pathLength="1" d="M4 4l16 16"/>', motion: [['.a1', 'si-redraw', 0.5, 'ease-out', '12 12']] },
  'chevron-down': { group: 'View', label: 'Expand', body: '<path class="a1" d="M4 8l8 8 8-8"/>', motion: [['.a1', 'si-down', 0.5, EASE, '12 12']] },
  'chevron-right': { group: 'View', label: 'Open', body: '<path class="a1" d="M8 4l8 8-8 8"/>', motion: [['.a1', 'si-right', 0.5, EASE, '12 12']] },
  'sliders': { group: 'View', label: 'Settings', body: '<path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20"/><circle class="a1" cx="15" cy="7" r="2.5"/><circle class="a2" cx="9" cy="17" r="2.5"/>', motion: [['.a1', 'si-left', 0.6, EASE, '15 7'], ['.a2', 'si-right', 0.6, EASE, '9 17']] },
  'info': { group: 'View', label: 'Info', body: `<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path class="a1" d="${DOT(12, 7.75)}"/>`, motion: [['.a1', 'si-hop', 0.5, EASE, '12 8']] },

  // ---- thread ----
  // a spool: two flanges and thread wound between them
  'thread': { group: 'Thread', label: 'Thread', body: '<path d="M5.5 3.5h13M5.5 20.5h13M7.5 3.5v17M16.5 3.5v17"/><path class="a1" d="M7.5 7.5l9 2M7.5 11l9 2M7.5 14.5l9 2"/>', motion: [['.a1', 'si-wind', 0.7, 'ease-in-out', '12 12']] },
  'strands': { group: 'Thread', label: 'Strands', body: '<path class="a1" d="M3.5 7c4.2-2 12.8 2 17 0M3.5 12c4.2-2 12.8 2 17 0M3.5 17c4.2-2 12.8 2 17 0"/>', motion: [['.a1', 'si-sway', 0.8, 'ease-in-out', '12 12']] },
  'needle': { group: 'Thread', label: 'Needle', body: '<g class="a1"><path d="M4 20L14.4 9.6"/><rect x="15.2" y="3" width="3" height="7.6" rx="1.5" transform="rotate(45 16.7 6.8)"/></g>', motion: [['.a1', 'si-dip', 0.7, EASE, '12 12']] },
  'scissors': { group: 'Thread', label: 'Scissors', body: '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path class="a1" d="M8.3 15.7L18 4"/><path class="a2" d="M15.7 15.7L6 4"/>', motion: [['.a1', 'si-snip-a', 0.5, 'ease-in-out', '12 12.5'], ['.a2', 'si-snip-b', 0.5, 'ease-in-out', '12 12.5']] },
  'hoop': { group: 'Thread', label: 'Hoop', body: '<circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="5"/><path class="a1" d="M10 3.5h4M12 3.5V5"/>', motion: [['.a1', 'si-hop', 0.5, EASE, '12 4']] },
  'twist': { group: 'Thread', label: 'Twist', body: '<path class="a1" d="M3 8c2.6 0 2.6 8 5.25 8s2.6-8 5.25-8 2.6 8 5.25 8"/><path class="a2" d="M3 16c2.6 0 2.6-8 5.25-8s2.6 8 5.25 8 2.6-8 5.25-8"/>', motion: [['.a1', 'si-sway', 0.8, 'ease-in-out', '12 12'], ['.a2', 'si-sway', 0.8, 'ease-in-out', '12 12', 0.1]] },
  'sheen': { group: 'Thread', label: 'Sheen', body: '<path class="a1" d="M10.5 3.5c.6 4 2.6 6 6.5 6.5-3.9.5-5.9 2.5-6.5 6.5-.6-4-2.6-6-6.5-6.5 3.9-.5 5.9-2.5 6.5-6.5z"/><path class="a2" d="M18 14.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3z"/>', motion: [['.a1', 'si-twinkle', 0.6, 'ease-out', '10.5 10'], ['.a2', 'si-twinkle', 0.6, 'ease-out', '18 17.5', 0.15]] },
  // a thread end fraying into loose fibres
  'fuzz': { group: 'Thread', label: 'Fuzz', body: '<path d="M3 12h8"/><path class="a1" d="M11 12c3.2 0 5.5-4.5 10-6M11 12c3.4 0 5.6-2 10-2M11 12c3.4 0 5.6 2 10 2.4M11 12c3 0 5.5 4 9.5 6"/>', motion: [['.a1', 'si-sway', 0.8, 'ease-in-out', '11 12']] },
  'light': {
    group: 'Thread', label: 'Light',
    body: '<circle cx="12" cy="12" r="3.5"/><path class="a1" d="' + Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), f = (v) => +v.toFixed(2);
      return `M${f(12 + c * 6.5)} ${f(12 + s * 6.5)}L${f(12 + c * 8.5)} ${f(12 + s * 8.5)}`;
    }).join('') + '"/>',
    motion: [['.a1', 'si-spin-eighth', 0.7, EASE, '12 12']],
  },

  // ---- canvas ----
  'canvas-dots': { group: 'Canvas', label: 'Dot grid', body: `<path class="a1" d="${[4, 9.33, 14.67, 20].flatMap((y) => [4, 9.33, 14.67, 20].map((x) => DOT(x, y))).join('')}"/>`, motion: [['.a1', 'si-breathe', 0.6, EASE, '12 12']] },
  // Aida: a block weave, squares with holes at the corners
  'canvas-aida': { group: 'Canvas', label: 'Aida', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16"/>' },
  // cloth swatches share a frame; linen's threads are slubby and uneven
  'canvas-linen': { group: 'Canvas', label: 'Linen', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4.5 9c2.3-.7 4 .7 7.5 0s5.2.6 7.5 0M4.5 12.5c2.5.6 4.6-.7 7.5 0s4.8-.7 7.5 0M4.5 16c2.3-.6 4.3.7 7.5 0s5-.6 7.5 0"/>' },
  'canvas-denim': { group: 'Canvas', label: 'Denim', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4.6 9.4l4.8-4.8M4.6 15.4L15.4 4.6M7.6 19.4l11.8-11.8M13.6 19.4l5.8-5.8"/>' },
  // a sheet with its width and height marked
  'canvas-size': { group: 'Canvas', label: 'Canvas size', body: '<rect x="3.5" y="8" width="13.5" height="12.5" rx="2"/><path d="M3.5 4.5H17M3.5 3.5v2M17 3.5v2M20 8v12.5M19 8h2M19 20.5h2"/>' },
  // one square of the grid, with its size pulled out
  'cell-size': { group: 'Canvas', label: 'Cell size', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16M4 12h16"/><path class="a1" d="M6.5 9.5v-3h3M6.5 6.5l3 3"/>', motion: [['.a1', 'si-out', 0.5, EASE, '8 8']] },

  // ---- product ----
  'library': { group: 'Product', label: 'Library', body: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect class="a1" x="13" y="13" width="7" height="7" rx="1.5"/>', motion: [['.a1', 'si-hop', 0.5, EASE, '16.5 16.5']] },
  'letters': { group: 'Product', label: 'Letters', body: '<path d="M5 20L12 4l7 16M8.2 14h7.6"/>' },
  'embed': { group: 'Product', label: 'Embed', body: '<path class="a1" d="M8.5 7l-5 5 5 5"/><path class="a2" d="M15.5 7l5 5-5 5"/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3"/>', motion: [['.a1', 'si-left', 0.5, EASE, '6 12'], ['.a2', 'si-right', 0.5, EASE, '18 12']] },
  'mend': { group: 'Product', label: 'Mend', body: '<rect class="a1" x="4" y="4" width="16" height="16" rx="2.5" stroke-dasharray="0 3"/><path d="M12 9v6M9 12h6"/>', motion: [['.a1', 'si-march', 0.6, 'linear', '12 12']] },
  'wear': { group: 'Product', label: 'Wear', body: '<path d="M3 12h6.5M14.5 12H21"/><path class="a1" d="M9.5 12c1.3 0 1.8 1.2 1.2 2.4M14.5 12c-1.3 0-1.8-1.2-1.2-2.4"/>', motion: [['.a1', 'si-sway', 0.8, 'ease-in-out', '12 12']] },
};

export const GROUPS = [...new Set(Object.values(ICONS).map((i) => i.group))];

// ---------- motion ----------
// One small vocabulary of moves; each icon picks the ones that say what it does. Every move ends where it
// started, plays once per hover (marching dots loop while hovered), and stays still for reduced motion.
const KEYFRAMES = {
  'si-dip': '0%,100%{transform:none}35%{transform:translate(-1.75px,1.75px)}65%{transform:translate(.4px,-.4px)}',
  'si-redraw': '0%{stroke-dasharray:1;stroke-dashoffset:0}35%{stroke-dasharray:1;stroke-dashoffset:1}100%{stroke-dasharray:1;stroke-dashoffset:0}',
  'si-draw': 'from{stroke-dashoffset:1}to{stroke-dashoffset:0}',
  'si-march': 'to{stroke-dashoffset:-6}',
  'si-nudge': '0%,100%{transform:none}45%{transform:translate(-1.5px,-1.5px)}',
  'si-twinkle': '0%,100%{transform:none}40%{transform:scale(1.35) rotate(15deg)}',
  'si-rub': '0%,100%{transform:none}20%{transform:translate(-1.5px,0)}45%{transform:translate(1.25px,0)}70%{transform:translate(-1px,0)}',
  'si-erase': '0%{stroke-dasharray:1;stroke-dashoffset:0}60%{stroke-dasharray:1;stroke-dashoffset:1}100%{stroke-dasharray:1;stroke-dashoffset:0}',
  'si-grab': '0%,100%{transform:none}30%{transform:scale(.92)}65%{transform:translate(-1.5px,.5px) scale(.92)}',
  'si-back': '0%,100%{transform:none}45%{transform:rotate(-14deg)}',
  'si-forward': '0%,100%{transform:none}45%{transform:rotate(14deg)}',
  'si-sweep': '0%,100%{transform:none}30%{transform:rotate(-10deg)}65%{transform:rotate(8deg)}',
  'si-rise': '0%,100%{transform:none}50%{transform:translate(0,-2px)}',
  'si-up': '0%,100%{transform:none}45%{transform:translate(0,-2px)}',
  'si-down': '0%,100%{transform:none}45%{transform:translate(0,2px)}',
  'si-right': '0%,100%{transform:none}45%{transform:translate(2px,0)}',
  'si-left': '0%,100%{transform:none}45%{transform:translate(-2px,0)}',
  'si-spin': 'from{transform:none}to{transform:rotate(360deg)}',
  'si-spin-eighth': 'from{transform:none}to{transform:rotate(45deg)}',
  'si-quarter': 'from{transform:none}to{transform:rotate(90deg)}',
  'si-squeeze': '0%,100%{transform:none}45%{transform:scaleX(.6)}',
  'si-pulse': '0%,100%{transform:none}45%{transform:scale(1.3)}',
  'si-breathe': '0%,100%{transform:none}45%{transform:scale(.88)}',
  'si-look': '0%,100%{transform:none}30%{transform:translate(-1.5px,0)}65%{transform:translate(1.5px,0)}',
  'si-hop': '0%,100%{transform:none}40%{transform:translate(0,-1.75px)}',
  'si-wind': '0%,100%{transform:none}50%{transform:translate(0,1.5px)}',
  'si-sway': '0%,100%{transform:none}30%{transform:skewY(-4deg)}65%{transform:skewY(3deg)}',
  'si-snip-a': '0%,100%{transform:none}45%{transform:rotate(9deg)}',
  'si-snip-b': '0%,100%{transform:none}45%{transform:rotate(-9deg)}',
  'si-out': '0%,100%{transform:none}45%{transform:translate(-1.5px,-1.5px)}',
};

/** The stylesheet for icon motion: plays when the icon, or an ancestor with class si-host, is hovered or focused. */
export function iconCss() {
  const rules = [];
  for (const [name, { motion }] of Object.entries(ICONS)) for (const [part, kf, dur, ease, origin, delay = 0] of motion || []) {
    const [ox, oy] = origin.split(' ');
    rules.push(`.si-${name} ${part}{transform-box:view-box;transform-origin:${ox}px ${oy}px}`);
    rules.push(`:is(.si-${name}:hover,.si-host:hover .si-${name},.si-host:focus-visible .si-${name}) ${part}`
      + `{animation:${kf} ${dur}s ${ease} ${delay}s ${kf === 'si-march' ? 'infinite' : '1 both'}}`);
  }
  return '/* Selvedge line icon motion: generated by build.mjs from icons.js */\n'
    + Object.entries(KEYFRAMES).map(([k, v]) => `@keyframes ${k}{${v}}`).join('\n')
    + `\n@media (prefers-reduced-motion: no-preference){\n${rules.join('\n')}\n}\n`;
}

/** Full <svg> markup for one icon. */
export function svg(name, { size = 24, stroke = 1.75, title } = {}) {
  const icon = ICONS[name];
  if (!icon) throw new Error(`Unknown icon: ${name}`);
  const label = title ? `<title>${title}</title>` : '';
  const aria = title ? 'role="img"' : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="si si-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${aria}>${label}${icon.body}</svg>`;
}
