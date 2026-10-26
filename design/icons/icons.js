// Selvedge icon set: the single source of truth. `build.mjs` writes svg/*.svg and sprite.svg from it.
//
// Grid rules
// - 24 × 24 viewBox, content inside 2..22 (2 px padding)
// - 1.75 stroke, round caps and joins, no fill unless a shape is solid on purpose
// - colour is currentColor; solid marks use fill="currentColor" stroke="none"
// - fabric holes are dots (r 1.25) so stitch icons read as embroidery, not plain lines
// - stitch legs stop 1.5 short of a hole, like thread entering it

const dot = (x, y, r = 1.25) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const holes4 = dot(5, 5) + dot(19, 5) + dot(5, 19) + dot(19, 19);
const solid = (d) => `<path d="${d}" fill="currentColor" stroke="none"/>`;

// burst: spokes from a small ring out to the rim
const burst = (() => {
  let d = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    d += `M${(12 + c * 2.5).toFixed(2)} ${(12 + s * 2.5).toFixed(2)}L${(12 + c * 8.5).toFixed(2)} ${(12 + s * 8.5).toFixed(2)}`;
  }
  return `<path d="${d}"/>`;
})();

// a plain weave: threads alternate over and under (gaps mark where a thread passes under)
const woven3 = '<path d="M4 7h6.5M13.5 7h6.5M4 12h1.5M8.5 12h7M18.5 12h1.5M4 17h6.5M13.5 17h6.5'
  + 'M7 4v1.5M7 8.5v7M7 18.5v1.5M12 4v6.5M12 13.5v6.5M17 4v1.5M17 8.5v7M17 18.5v1.5"/>';

const sun = (() => {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    d += `M${(12 + c * 6.5).toFixed(2)} ${(12 + s * 6.5).toFixed(2)}L${(12 + c * 8.5).toFixed(2)} ${(12 + s * 8.5).toFixed(2)}`;
  }
  return `<circle cx="12" cy="12" r="3.5"/><path d="${d}"/>`;
})();

/** name → { group, label, body } */
export const ICONS = {
  // ---- tools ----
  'tool-stitch': { group: 'Tools', label: 'Stitch', body: '<path d="M4.5 19.5L16.2 7.8"/><path d="M16.2 7.8l1.6-1.6a1.4 1.4 0 0 1 2 2l-1.6 1.6a1.4 1.4 0 0 1-2-2z"/><path d="M18.6 8.6c1.6 2.4-.6 4.6-3.1 6.2-2.2 1.4-3.6 3.2-3.5 5.2"/>' },
  // a leaf laid with satin stitches across it: filling a shape, the classic embroidery fill
  'tool-fill': { group: 'Tools', label: 'Fill', body: '<path d="M4.5 19.5C4.5 10.5 10.5 4.5 19.5 4.5c0 9-6 15-15 15z"/><path d="M7.4 13.6l3 3M10.2 10.2l3.6 3.6M13.6 7.4l3 3"/>' },
  // two of four squares planned in: a chart being drawn
  'tool-pattern': { group: 'Tools', label: 'Pattern', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16M4 12h16"/>' + solid('M7 6.5h2.5A.5.5 0 0 1 10 7v2.5a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5zM14.5 14h2.5a.5.5 0 0 1 .5.5V17a.5.5 0 0 1-.5.5h-2.5a.5.5 0 0 1-.5-.5v-2.5a.5.5 0 0 1 .5-.5z') },
  'tool-select': { group: 'Tools', label: 'Select', body: '<path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7M10.5 4h3M17 4h.5A1.5 1.5 0 0 1 19 5.5V7M4 10.5v3M4 17v.5A1.5 1.5 0 0 0 5.5 19H7M10.5 19h1"/>' + solid('M14 13.2l7 2.7-3 1.3-1.3 3z') },
  'tool-wand': { group: 'Tools', label: 'Select colour', body: '<path d="M4 20L14.5 9.5"/><path d="M13 8l3 3"/><path d="M18 3v3M16.5 4.5h3M20.5 9v2M19.5 10h2M10 3.5v2M9 4.5h2"/>' },
  'tool-erase': { group: 'Tools', label: 'Erase', body: '<path d="M8.5 20H20"/><path d="M3.9 14.4l7.7-7.7a1.6 1.6 0 0 1 2.3 0l4.4 4.4a1.6 1.6 0 0 1 0 2.3L12 19.7a1 1 0 0 1-.7.3H9.2a1 1 0 0 1-.7-.3l-4.6-4.6a.5.5 0 0 1 0-.7z"/><path d="M8.6 9.6l5.8 5.8"/>' },
  'tool-pan': { group: 'Tools', label: 'Pan', body: '<path d="M12 3.5v17M3.5 12h17M9.5 6l2.5-2.5L14.5 6M9.5 18l2.5 2.5 2.5-2.5M6 9.5L3.5 12 6 14.5M18 9.5l2.5 2.5-2.5 2.5"/>' },

  // ---- counted stitches ----
  'stitch-full': { group: 'Stitches', label: 'Full cross', body: holes4 + '<path d="M6.5 17.5l11-11M6.5 6.5l11 11"/>' },
  'stitch-half': { group: 'Stitches', label: 'Half stitch', body: holes4 + '<path d="M6.5 17.5l11-11"/>' },
  'stitch-quarter': { group: 'Stitches', label: 'Quarter', body: holes4 + '<path d="M6.5 17.5L12 12"/>' },
  'stitch-three-quarter': { group: 'Stitches', label: 'Three-quarter', body: holes4 + '<path d="M6.5 17.5l11-11M6.5 6.5L12 12"/>' },
  'stitch-back': { group: 'Stitches', label: 'Backstitch', body: dot(4, 12) + dot(12, 12) + dot(20, 12) + '<path d="M5.5 12h5M13.5 12h5"/>' },
  'stitch-long': { group: 'Stitches', label: 'Long stitch', body: dot(4, 20) + dot(20, 4) + '<path d="M5.2 18.8L18.8 5.2"/>' },
  'stitch-knot': { group: 'Stitches', label: 'French knot', body: '<circle cx="12" cy="12" r="5"/><path d="M12 9.5a2.5 2.5 0 1 1-2.5 2.5"/>' },

  // ---- fills ----
  'fill-cross': { group: 'Fills', label: 'Cross', body: '<path d="M5 5l6 6M11 5l-6 6M13 5l6 6M19 5l-6 6M5 13l6 6M11 13l-6 6M13 13l6 6M19 13l-6 6"/>' },
  'fill-tweed': { group: 'Fills', label: 'Tweed', body: '<path d="M5 5l6 6M11 5l-6 6M13 13l6 6M19 13l-6 6"/><path d="M13 5l6 6M19 5l-6 6M5 13l6 6M11 13l-6 6" stroke-opacity=".45"/>' },
  'fill-rows': { group: 'Fills', label: 'Rows', body: '<path d="M4 5.5h16M4 9.8h16M4 14.2h16M4 18.5h16"/>' },
  'fill-columns': { group: 'Fills', label: 'Columns', body: '<path d="M5.5 4v16M9.8 4v16M14.2 4v16M18.5 4v16"/>' },
  'fill-hatch': { group: 'Fills', label: 'Hatch /', body: '<path d="M4 9l5-5M4 14.5L14.5 4M4 20L20 4M9.5 20L20 9.5M15 20l5-5"/>' },
  'fill-weave-3': { group: 'Fills', label: 'Weave 3×3', body: woven3 },
  'fill-weave-5': { group: 'Fills', label: 'Weave 5×5', body: '<path d="M4 6h16M4 9h16M4 12h16M4 15h16M4 18h16M6 4v16M9 4v16M12 4v16M15 4v16M18 4v16"/>' },
  'fill-weave-diamond': { group: 'Fills', label: 'Weave ◇', body: '<path d="M4 12l8-8M4 20L20 4M12 20l8-8M4 12l8 8M4 4l16 16M12 4l8 8"/>' },
  'fill-blocks': { group: 'Fills', label: 'Blocks', body: '<path d="M4.5 5.5h6M4.5 8h6M4.5 10.5h6M14 4.5v6M16.5 4.5v6M19 4.5v6M5 13.5v6M7.5 13.5v6M10 13.5v6M13.5 14h6M13.5 16.5h6M13.5 19h6"/>' },
  'fill-fern': { group: 'Fills', label: 'Fern', body: '<path d="M6 5l6 4 6-4M6 10.5l6 4 6-4M6 16l6 4 6-4"/>' },
  'fill-seed': { group: 'Fills', label: 'Seed', body: '<path d="M5 6l2.4 1.4M13.6 4.6l-.9 2.6M18.2 8.6l2.3-.9M8.4 11.4l-2.2 1.6M12.2 11.2l2.6.6M17.2 14.6l1 2.4M5.6 18.6l2.6-.5M12.4 18.8l1-2.5"/>' },
  'fill-knots': { group: 'Fills', label: 'Knots', body: '<circle cx="7" cy="7" r="1.8"/><circle cx="14" cy="6" r="1.8"/><circle cx="18.5" cy="11" r="1.8"/><circle cx="10" cy="12.5" r="1.8"/><circle cx="16" cy="17" r="1.8"/><circle cx="7.5" cy="18" r="1.8"/>' },
  'fill-burst': { group: 'Fills', label: 'Burst', body: burst },

  // ---- actions ----
  'undo': { group: 'Actions', label: 'Undo', body: '<path d="M9 5.5L4.5 10 9 14.5"/><path d="M4.5 10h10a5 5 0 0 1 0 10H12"/>' },
  'redo': { group: 'Actions', label: 'Redo', body: '<path d="M15 5.5l4.5 4.5-4.5 4.5"/><path d="M19.5 10h-10a5 5 0 0 0 0 10H12"/>' },
  'clear': { group: 'Actions', label: 'Clear', body: '<path d="M15.5 3.5L12 11.5"/><path d="M7.2 11.5h9.6l1.7 8.5H5.5z"/><path d="M9.5 15v5M13.5 15v5"/>' },
  'picture': { group: 'Actions', label: 'Picture', body: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.75"/><path d="M20.5 15.5l-4.8-4.8L7.5 19"/>' },
  'upload': { group: 'Actions', label: 'Upload', body: '<path d="M12 15V4.5M7.5 9L12 4.5 16.5 9"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>' },
  'download': { group: 'Actions', label: 'Download', body: '<path d="M12 4.5V15M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>' },
  'share': { group: 'Actions', label: 'Share', body: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.7l6.6-3.9M8.7 13.3l6.6 3.9"/>' },
  'recolour': { group: 'Actions', label: 'Recolour', body: '<path d="M6 8h12M15 5l3 3-3 3M18 16H6M9 13l-3 3 3 3"/>' },
  'rotate': { group: 'Actions', label: 'Rotate', body: '<path d="M19.6 8.6A8 8 0 1 0 20 12"/><path d="M20 4.5v4.3h-4.3"/>' },
  'play': { group: 'Actions', label: 'Stitch it', body: '<path d="M8 5.5v13l10-6.5z"/>' },
  'check': { group: 'Actions', label: 'Done', body: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
  'close': { group: 'Actions', label: 'Close', body: '<path d="M7 7l10 10M17 7L7 17"/>' },
  'plus': { group: 'Actions', label: 'Add', body: '<path d="M12 5v14M5 12h14"/>' },
  'minus': { group: 'Actions', label: 'Remove', body: '<path d="M5 12h14"/>' },

  // ---- view ----
  'zoom-in': { group: 'View', label: 'Zoom in', body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20M10.5 7.75v5.5M7.75 10.5h5.5"/>' },
  'zoom-out': { group: 'View', label: 'Zoom out', body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20M7.75 10.5h5.5"/>' },
  'fit': { group: 'View', label: 'Fit', body: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>' },
  'eye': { group: 'View', label: 'Show', body: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.75"/>' },
  'eye-off': { group: 'View', label: 'Hide', body: '<path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.4 7.3A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.6-1.3"/><path d="M10 10.1a2.75 2.75 0 0 0 3.9 3.9M4 4l16 16"/>' },
  'chevron-down': { group: 'View', label: 'Expand', body: '<path d="M6 9l6 6 6-6"/>' },
  'chevron-right': { group: 'View', label: 'Open', body: '<path d="M9 6l6 6-6 6"/>' },
  'sliders': { group: 'View', label: 'Settings', body: '<path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20"/><circle cx="15" cy="7" r="2.5"/><circle cx="9" cy="17" r="2.5"/>' },
  'info': { group: 'View', label: 'Info', body: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/>' + dot(12, 7.8, 1.1) },

  // ---- thread and look ----
  'thread': { group: 'Thread', label: 'Thread', body: '<rect x="3" y="7.5" width="18" height="9" rx="4.5"/><rect x="10" y="5.5" width="4" height="13" rx="1"/>' },
  'strands': { group: 'Thread', label: 'Strands', body: '<path d="M3.5 8c4.2-2 12.8 2 17 0M3.5 12c4.2-2 12.8 2 17 0M3.5 16c4.2-2 12.8 2 17 0"/>' },
  'needle': { group: 'Thread', label: 'Needle', body: '<path d="M4.5 19.5L16.2 7.8"/><path d="M16.2 7.8l1.6-1.6a1.4 1.4 0 0 1 2 2l-1.6 1.6a1.4 1.4 0 0 1-2-2z"/>' },
  'scissors': { group: 'Thread', label: 'Scissors', body: '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.3 15.7L18 4M15.7 15.7L6 4"/>' },
  'hoop': { group: 'Thread', label: 'Hoop', body: '<circle cx="12" cy="13" r="7.5"/><circle cx="12" cy="13" r="5.25"/><path d="M10 4.5h4M12 4.5v1"/>' },
  'twist': { group: 'Thread', label: 'Twist', body: '<path d="M3.5 9c2.8 0 2.8 6 5.6 6s2.8-6 5.7-6 2.8 6 5.7 6"/><path d="M3.5 15c2.8 0 2.8-6 5.6-6s2.8 6 5.7 6 2.8-6 5.7-6"/>' },
  'sheen': { group: 'Thread', label: 'Sheen', body: '<path d="M10.5 3.5c.6 4 2.6 6 6.5 6.5-3.9.5-5.9 2.5-6.5 6.5-.6-4-2.6-6-6.5-6.5 3.9-.5 5.9-2.5 6.5-6.5z"/><path d="M18 14.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3z"/>' },
  // a thread end fraying into loose fibres
  'fuzz': { group: 'Thread', label: 'Fuzz', body: '<path d="M3 12h8"/><path d="M11 12c3.2 0 5-3.5 9-4.5M11 12c3.4 0 5.6-1.4 9.5-1.2M11 12c3.4 0 5.6 1.3 9.5 1.6M11 12c3 0 5 3 8.5 4.6"/>' },
  'light': { group: 'Thread', label: 'Light', body: sun },

  // ---- canvas ----
  'canvas-dots': { group: 'Canvas', label: 'Dot grid', body: [6, 10, 14, 18].flatMap((y) => [6, 10, 14, 18].map((x) => dot(x, y, 1.1))).join('') },
  'canvas-aida': { group: 'Canvas', label: 'Aida', body: [4, 10, 16].flatMap((y) => [4, 10, 16].map((x) => `<rect x="${x}" y="${y}" width="4" height="4" rx="1"/>`)).join('') },
  // cloth swatches share a frame; linen's threads are slubby and uneven
  'canvas-linen': { group: 'Canvas', label: 'Linen', body: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4.5 9c2.3-.7 4 .7 7.5 0s5.2.6 7.5 0M4.5 12.5c2.5.6 4.6-.7 7.5 0s4.8-.7 7.5 0M4.5 16c2.3-.6 4.3.7 7.5 0s5-.6 7.5 0"/>' },
  'canvas-denim': { group: 'Canvas', label: 'Denim', body: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4.6 9.4l4.8-4.8M4.6 15.4L15.4 4.6M7.6 19.4l11.8-11.8M13.6 19.4l5.8-5.8"/>' },
  // a sheet with its width and height marked
  'canvas-size': { group: 'Canvas', label: 'Canvas size', body: '<rect x="3.5" y="8" width="13.5" height="12" rx="1.5"/><path d="M3.5 4.5H17M3.5 3.5v2M17 3.5v2M20.5 8v12M19.5 8h2M19.5 20h2"/>' },
  'cell-size': { group: 'Canvas', label: 'Cell size', body: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>' + solid('M5.5 5.5h5v5h-5z') },

  // ---- product ----
  'library': { group: 'Product', label: 'Library', body: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>' },
  'letters': { group: 'Product', label: 'Letters', body: '<path d="M5 19.5L12 4.5l7 15M8.2 14h7.6"/>' },
  'embed': { group: 'Product', label: 'Embed', body: '<path d="M8.5 7l-5 5 5 5M15.5 7l5 5-5 5M10.5 10.5l3 3M13.5 10.5l-3 3"/>' },
  'mend': { group: 'Product', label: 'Mend', body: '<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="2.5 2.5"/><path d="M12 9v6M9 12h6"/>' },
  'wear': { group: 'Product', label: 'Wear', body: '<path d="M3 12h6.5M14.5 12H21"/><path d="M9.5 12c1.3 0 1.8 1.2 1.2 2.4M14.5 12c-1.3 0-1.8-1.2-1.2-2.4"/>' }
};

export const GROUPS = [...new Set(Object.values(ICONS).map((i) => i.group))];

/** Full <svg> markup for one icon. */
export function svg(name, { size = 24, stroke = 1.75, title } = {}) {
  const icon = ICONS[name];
  if (!icon) throw new Error(`Unknown icon: ${name}`);
  const label = title ? `<title>${title}</title>` : '';
  const aria = title ? 'role="img"' : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${aria}>${label}${icon.body}</svg>`;
}
