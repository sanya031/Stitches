// Selvedge line icons: the single source of truth. `build.mjs` writes svg/*.svg, sprite.svg and icons.css from it.
// (Stitches and fills have their own sets: thread.js and primitives.js.)
//
// Rules — every icon follows all of them, so any two can sit side by side:
// - 24 × 24 viewBox; ink lives in the 3..21 live area (2 px padding plus 1 for the stroke's half width)
// - keylines: a square icon spans 4..20 (16), a round one is r 8.5, a tall one 5..19 × 3..21, a wide one 3..21 × 5..19;
//   every icon reaches its keyline on at least one axis, so they read as one size
// - stroke only: 1.75, round caps and joins, currentColor; never a fill, never a second tone or opacity
// - a dot is a zero-length stroke (`M x y h0`), so it is the stroke's own round cap, 1.75 across
// - icons stay put on hover; only the part that does the work moves (classes a1, a2, …; see `hover` and MOTION below)

const DOT = (x, y) => `M${x} ${y}h0`;
const EASE = 'cubic-bezier(.4,0,.2,1)';

/** name → { group, label, body, hover? } */
export const ICONS = {
  // ---- tools ----
  // a needle with thread through its eye: on hover the thread is pulled along its own path through the eye,
  // its tail coming out on the left; on leave it slides back
  'tool-stitch': {
    group: 'Tools', label: 'Stitch',
    body: '<path d="M4 20L14.4 9.6"/><rect x="15.2" y="3" width="3" height="7.6" rx="1.5" transform="rotate(45 16.7 6.8)"/>'
      + '<path class="a1" stroke-dasharray="15.2 30" d="M20 20C17.9 17.9 17.6 15 19 13C20.6 10.7 19.8 7.9 17.4 6.6C15.6 5.6 12.4 4.6 9.5 4.8"/>',
    hover: [['.a1', 'stroke-dashoffset:0', 'stroke-dashoffset:-6', 0.6, EASE]],
  },
  'tool-fill': {
    group: 'Tools', label: 'Fill',
    body: '<path d="M4 20C4 10.5 10.5 4 20 4c0 9.5-6.5 16-16 16z"/><path d="M7 14l3 3M10 10.5l3.5 3.5M13.5 7.5l3 3"/>',
  },
  // a chart being planned: two squares marked; on hover the other two crosses fade in, one after the other
  'tool-pattern': {
    group: 'Tools', label: 'Pattern',
    body: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M12 3.5v17M3.5 12h17"/>'
      + '<path d="M6.5 6.5l3 3M9.5 6.5l-3 3M14.5 14.5l3 3M17.5 14.5l-3 3"/>'
      + '<path class="a1" opacity="0" d="M14.5 6.5l3 3M17.5 6.5l-3 3"/><path class="a2" opacity="0" d="M6.5 14.5l3 3M9.5 14.5l-3 3"/>',
    hover: [['.a1', 'opacity:0', 'opacity:1', 0.3, 'ease-out', null, 0.05], ['.a2', 'opacity:0', 'opacity:1', 0.3, 'ease-out', null, 0.3]],
  },
  // a marquee: corners whole, sides broken by small gaps; on hover the pointer moves in and stays
  'tool-select': {
    group: 'Tools', label: 'Select',
    body: '<path d="M3.5 6.25V6A2.5 2.5 0 0 1 6 3.5h.25M12.25 3.5h.25A2.5 2.5 0 0 1 15 6v.25M15 12.25v.25a2.5 2.5 0 0 1-2.5 2.5h-.25M6.25 15H6a2.5 2.5 0 0 1-2.5-2.5v-.25'
      + 'M9 3.5h.5M15 9v.5M9 15h.5M3.5 9v.5"/>'
      + '<path class="a1" d="M16 16L21 17.9L18.6 18.6L17.9 21Z"/>',
    hover: [['.a1', 'transform:none', 'transform:translate(-4px,-4px)', 0.45, EASE]],
  },
  'tool-wand': {
    group: 'Tools', label: 'Select colour',
    body: '<path d="M4 20L14.5 9.5M13 8l3 3"/><path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M10 3.5v2M9 4.5h2"/>',
  },
  // an eraser over a line: on hover it slides back over the line and the line goes; on leave it comes back
  'tool-erase': {
    group: 'Tools', label: 'Erase',
    body: '<path class="a1" d="M3.9 13.6l8.2-8.2a1.9 1.9 0 0 1 2.7 0l4.3 4.3a1.9 1.9 0 0 1 0 2.7l-6.6 6.6a1.9 1.9 0 0 1-1.3.5H8.8a1.9 1.9 0 0 1-1.3-.5l-3.6-3.6a1.3 1.3 0 0 1 0-1.8zM8.2 9.3l6.5 6.5"/>'
      + '<path class="a2" pathLength="1" stroke-dasharray="1 1" d="M14.5 20.5h6"/>',
    hover: [['.a1', 'transform:none', 'transform:translate(2.5px,0)', 0.45, EASE], ['.a2', 'stroke-dashoffset:0', 'stroke-dashoffset:-1', 0.45, EASE]],
  },
  // a grabbing hand: on hover the fist closes tighter, the fingers curling down into the palm
  'tool-pan': {
    group: 'Tools', label: 'Pan',
    body: '<path class="a1" vector-effect="non-scaling-stroke" d="M6.5 12V9a1.5 1.5 0 0 1 3 0v1.5M9.5 10.5V7.5a1.5 1.5 0 0 1 3 0v3M12.5 10.5V8a1.5 1.5 0 0 1 3 0v2.5"/>'
      + '<path d="M15.5 11V9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5.4-3.4l-1.8-3.8a1.4 1.4 0 0 1 2.5-1.3L8 14.5"/>',
    hover: [['.a1', 'transform:none', 'transform:scaleY(.72)', 0.4, EASE, '12 11.5']],
  },

  // ---- actions ----
  'undo': { group: 'Actions', label: 'Undo', body: '<g><path d="M9 5L4 10l5 5"/><path d="M4 10h10.5a5.5 5.5 0 0 1 0 11H12"/></g>' },
  'redo': { group: 'Actions', label: 'Redo', body: '<g><path d="M15 5l5 5-5 5"/><path d="M20 10H9.5a5.5 5.5 0 0 0 0 11H12"/></g>' },
  'clear': { group: 'Actions', label: 'Clear', body: '<g><path d="M15.5 3.5L12 11.5"/><path d="M7.2 11.5h9.6l1.7 8.5H5.5z"/><path d="M9.5 15v5M13.5 15v5"/></g>' },
  'picture': { group: 'Actions', label: 'Picture', body: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.75"/><path d="M21 15.5l-4.8-4.8L7.5 19"/>' },
  'upload': { group: 'Actions', label: 'Upload', body: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>' },
  'download': { group: 'Actions', label: 'Download', body: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>' },
  'share': { group: 'Actions', label: 'Share', body: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.7l6.6-3.9M8.7 13.3l6.6 3.9"/>' },
  'recolour': { group: 'Actions', label: 'Recolour', body: '<path d="M4 8h16M17 5l3 3-3 3"/><path d="M20 16H4M7 13l-3 3 3 3"/>' },
  'rotate': { group: 'Actions', label: 'Rotate', body: '<g><path d="M19.6 8.6A8 8 0 1 0 20 12"/><path d="M20 4.5v4.3h-4.3"/></g>' },
  'play': { group: 'Actions', label: 'Stitch it', body: '<path d="M7 4v16l12.5-8z"/>' },
  'check': { group: 'Actions', label: 'Done', body: '<path d="M4 12.5l5.5 5.5L20 6.5"/>' },
  'close': { group: 'Actions', label: 'Close', body: '<path d="M5 5l14 14M19 5L5 19"/>' },
  'plus': { group: 'Actions', label: 'Add', body: '<path d="M12 4v16M4 12h16"/>' },
  'minus': { group: 'Actions', label: 'Remove', body: '<path d="M4 12h16"/>' },

  // ---- view ----
  'zoom-in': { group: 'View', label: 'Zoom in', body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20"/><path d="M10.5 7.75v5.5M7.75 10.5h5.5"/>' },
  'zoom-out': { group: 'View', label: 'Zoom out', body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20"/><path d="M7.75 10.5h5.5"/>' },
  'fit': { group: 'View', label: 'Fit', body: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>' },
  'eye': { group: 'View', label: 'Show', body: '<path d="M3 12S6.5 5.5 12 5.5 21 12 21 12 17.5 18.5 12 18.5 3 12 3 12z"/><circle cx="12" cy="12" r="2.75"/>' },
  'eye-off': { group: 'View', label: 'Hide', body: '<path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c5.5 0 9 6.5 9 6.5a16 16 0 0 1-2.6 3.4M6.4 7.3A16 16 0 0 0 3 12s3.5 6.5 9 6.5a9 9 0 0 0 4.6-1.3"/><path d="M10 10.1a2.75 2.75 0 0 0 3.9 3.9"/><path d="M4 4l16 16"/>' },
  'chevron-down': { group: 'View', label: 'Expand', body: '<path d="M4 8l8 8 8-8"/>' },
  'chevron-right': { group: 'View', label: 'Open', body: '<path d="M8 4l8 8-8 8"/>' },
  'sliders': { group: 'View', label: 'Settings', body: '<path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20"/><circle cx="15" cy="7" r="2.5"/><circle cx="9" cy="17" r="2.5"/>' },
  'info': { group: 'View', label: 'Info', body: `<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="${DOT(12, 7.75)}"/>` },

  // ---- thread ----
  // a spool: two flanges and thread wound between them
  'thread': { group: 'Thread', label: 'Thread', body: '<path d="M5.5 3.5h13M5.5 20.5h13M7.5 3.5v17M16.5 3.5v17"/><path d="M7.5 7.5l9 2M7.5 11l9 2M7.5 14.5l9 2"/>' },
  'strands': { group: 'Thread', label: 'Strands', body: '<path d="M3.5 7c4.2-2 12.8 2 17 0M3.5 12c4.2-2 12.8 2 17 0M3.5 17c4.2-2 12.8 2 17 0"/>' },
  'needle': { group: 'Thread', label: 'Needle', body: '<g><path d="M4 20L14.4 9.6"/><rect x="15.2" y="3" width="3" height="7.6" rx="1.5" transform="rotate(45 16.7 6.8)"/></g>' },
  'scissors': { group: 'Thread', label: 'Scissors', body: '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.3 15.7L18 4"/><path d="M15.7 15.7L6 4"/>' },
  'hoop': { group: 'Thread', label: 'Hoop', body: '<circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="5"/><path d="M10 3.5h4M12 3.5V5"/>' },
  'twist': { group: 'Thread', label: 'Twist', body: '<path d="M3 8c2.6 0 2.6 8 5.25 8s2.6-8 5.25-8 2.6 8 5.25 8"/><path d="M3 16c2.6 0 2.6-8 5.25-8s2.6 8 5.25 8 2.6-8 5.25-8"/>' },
  'sheen': { group: 'Thread', label: 'Sheen', body: '<path d="M10.5 3.5c.6 4 2.6 6 6.5 6.5-3.9.5-5.9 2.5-6.5 6.5-.6-4-2.6-6-6.5-6.5 3.9-.5 5.9-2.5 6.5-6.5z"/><path d="M18 14.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3z"/>' },
  // a thread end fraying into loose fibres
  'fuzz': { group: 'Thread', label: 'Fuzz', body: '<path d="M3 12h8"/><path d="M11 12c3.2 0 5.5-4.5 10-6M11 12c3.4 0 5.6-2 10-2M11 12c3.4 0 5.6 2 10 2.4M11 12c3 0 5.5 4 9.5 6"/>' },
  'light': {
    group: 'Thread', label: 'Light',
    body: '<circle cx="12" cy="12" r="3.5"/><path d="' + Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), f = (v) => +v.toFixed(2);
      return `M${f(12 + c * 6.5)} ${f(12 + s * 6.5)}L${f(12 + c * 8.5)} ${f(12 + s * 8.5)}`;
    }).join('') + '"/>' },

  // ---- canvas ----
  'canvas-dots': { group: 'Canvas', label: 'Dot grid', body: `<path d="${[4, 9.33, 14.67, 20].flatMap((y) => [4, 9.33, 14.67, 20].map((x) => DOT(x, y))).join('')}"/>` },
  // Aida: a block weave, squares with holes at the corners
  'canvas-aida': { group: 'Canvas', label: 'Aida', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16"/>' },
  // cloth swatches share a frame; linen's threads are slubby and uneven
  'canvas-linen': { group: 'Canvas', label: 'Linen', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4.5 9c2.3-.7 4 .7 7.5 0s5.2.6 7.5 0M4.5 12.5c2.5.6 4.6-.7 7.5 0s4.8-.7 7.5 0M4.5 16c2.3-.6 4.3.7 7.5 0s5-.6 7.5 0"/>' },
  'canvas-denim': { group: 'Canvas', label: 'Denim', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4.6 9.4l4.8-4.8M4.6 15.4L15.4 4.6M7.6 19.4l11.8-11.8M13.6 19.4l5.8-5.8"/>' },
  // a sheet with its width and height marked
  'canvas-size': { group: 'Canvas', label: 'Canvas size', body: '<rect x="3.5" y="8" width="13.5" height="12.5" rx="2"/><path d="M3.5 4.5H17M3.5 3.5v2M17 3.5v2M20 8v12.5M19 8h2M19 20.5h2"/>' },
  // one square of the grid, with its size pulled out
  'cell-size': { group: 'Canvas', label: 'Cell size', body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16M4 12h16"/><path d="M6.5 9.5v-3h3M6.5 6.5l3 3"/>' },

  // ---- product ----
  'library': { group: 'Product', label: 'Library', body: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>' },
  'letters': { group: 'Product', label: 'Letters', body: '<path d="M5 20L12 4l7 16M8.2 14h7.6"/>' },
  'embed': { group: 'Product', label: 'Embed', body: '<path d="M8.5 7l-5 5 5 5"/><path d="M15.5 7l5 5-5 5"/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3"/>' },
  'mend': { group: 'Product', label: 'Mend', body: '<rect x="4" y="4" width="16" height="16" rx="2.5" stroke-dasharray="0 3"/><path d="M12 9v6M9 12h6"/>' },
  'wear': { group: 'Product', label: 'Wear', body: '<path d="M3 12h6.5M14.5 12H21"/><path d="M9.5 12c1.3 0 1.8 1.2 1.2 2.4M14.5 12c-1.3 0-1.8-1.2-1.2-2.4"/>' },
};

export const GROUPS = [...new Set(Object.values(ICONS).map((i) => i.group))];

// ---------- motion ----------
// Icons stay where they are; only the part that does the work moves. Each move is a hover state, not a
// one-shot animation: it eases in when the pointer arrives, holds while it stays, and eases back on leave.
// hover: [[part, rest, hover, duration (s), timing, origin 'x y' (or null), delay in (s)?], …]

/** The stylesheet for icon motion: the icon, or an ancestor with class si-host, hovered or focused. */
export function iconCss() {
  const rules = [];
  for (const [name, { hover }] of Object.entries(ICONS)) for (const [part, rest, on, dur, ease, origin, delay = 0] of hover || []) {
    const props = [...new Set([...rest.split(';'), ...on.split(';')].map((d) => d.split(':')[0].trim()).filter(Boolean))];
    const o = origin ? `transform-box:view-box;transform-origin:${origin.split(' ').map((v) => v + 'px').join(' ')};` : '';
    rules.push(`.si-${name} ${part}{${o}${rest};transition:${props.map((p) => `${p} ${dur}s ${ease}`).join(',')}}`);
    rules.push(`:is(.si-${name}:hover,.si-host:hover .si-${name},.si-host:focus-visible .si-${name}) ${part}{${on};transition-delay:${delay}s}`);
  }
  return '/* Selvedge line icon motion: generated by build.mjs from icons.js */\n'
    + `@media (prefers-reduced-motion: no-preference){\n${rules.join('\n')}\n}\n`
    + '@media (prefers-reduced-motion: reduce){' + Object.entries(ICONS).filter(([, i]) => i.hover).map(([n, i]) => i.hover.map(([part, rest]) => `.si-${n} ${part}{${rest}}`).join('')).join('') + '}\n';
}

/** Full <svg> markup for one icon. */
export function svg(name, { size = 24, stroke = 1.75, title } = {}) {
  const icon = ICONS[name];
  if (!icon) throw new Error(`Unknown icon: ${name}`);
  const label = title ? `<title>${title}</title>` : '';
  const aria = title ? 'role="img"' : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="si si-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${aria}>${label}${icon.body}</svg>`;
}
