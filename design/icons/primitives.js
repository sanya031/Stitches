// Primitive icons: every stitch and fill from the thread set, reduced to clean lines on one square.
// Same names as thread.js. `build.mjs` writes primitive/*.svg and adds them to sprite.svg as p-<name>;
// primitive-patch/*.svg (the zoomed-out 4 × 4 patch) and primitive-zoom/*.svg (the hover animation between them).
//
// Grid rules (as the line icons, plus)
// - one square: its four holes are dots at 5 and 19 (r 1.25), the square spans 5..19
// - stitches use the full stroke, legs stop 1.5 short of a hole, like thread entering it
// - fills use a finer stroke (0.7×), the way fills use a finer thread, and stay inside 6.5..17.5
// - each fill keeps the shape one square of it has on the canvas, with fewer lines
// - over and under: the thread that passes under has a gap where the other crosses it
import { THREAD_ICONS, ZOOM, zoomStyle } from './thread.js';
import { regionLegs } from '../../lab/fills.js';

const dot = (x, y, r = 1.25) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const holes = dot(5, 5) + dot(19, 5) + dot(5, 19) + dot(19, 19);
const fine = (d) => `<path d="${d}" stroke-width="var(--fine)"/>`;

// counted legs, holes inset by 1.5; quarters run from a corner into the centre
const DIAG_UP = 'M6.5 17.5L17.5 6.5', DIAG_DOWN = 'M6.5 6.5L17.5 17.5';
const QUARTER = { tl: 'M6.5 6.5L12 12', tr: 'M17.5 6.5L12 12', bl: 'M6.5 17.5L12 12', br: 'M17.5 17.5L12 12' };

const spokes = (n, r0, r1) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), f = (v) => +v.toFixed(2);
  return `M${f(12 + c * r0)} ${f(12 + s * r0)}L${f(12 + c * r1)} ${f(12 + s * r1)}`;
}).join('');

const lines = (at, horizontal) => at.map((v) => horizontal ? `M6.5 ${v}H17.5` : `M${v} 6.5V17.5`).join('');

const BODIES = {
  'stitch-full': `<path d="${DIAG_UP}${DIAG_DOWN}"/>`,
  'stitch-half': `<path d="${DIAG_UP}"/>`,
  ...Object.fromEntries(Object.entries(QUARTER).map(([k, d]) => [`stitch-quarter-${k}`, `<path d="${d}"/>`])),
  // the long leg goes the way the quarter does not
  ...Object.fromEntries(Object.entries(QUARTER).map(([k, d]) => [`stitch-three-quarter-${k}`,
    `<path d="${k === 'tl' || k === 'br' ? DIAG_UP : DIAG_DOWN}${d}"/>`])),
  // an outline turning a corner: down the left side, along the bottom
  'stitch-back': '<path d="M5 6.5V17.5M6.5 19H17.5"/>',
  'stitch-knot': '<circle cx="12" cy="12" r="3.25"/><path d="M12 10.4a1.6 1.6 0 1 1-1.6 1.6"/>',

  'fill-cross': `<path d="${DIAG_UP}${DIAG_DOWN}"/>`,
  // two shades of one colour: the under leg darker
  'fill-tweed': `<path d="${DIAG_UP}" stroke-opacity=".45"/><path d="${DIAG_DOWN}"/>`,
  'fill-rows': fine(lines([7.5, 10.5, 13.5, 16.5], true)),
  'fill-columns': fine(lines([7.5, 10.5, 13.5, 16.5], false)),
  'fill-hatch': fine('M6.5 11.5L11.5 6.5M6.5 14.5L14.5 6.5M6.5 17.5L17.5 6.5M9.5 17.5L17.5 9.5M12.5 17.5L17.5 12.5'),
  // one thread each way, the across thread on top
  'fill-weave-3': fine('M6.5 12H17.5M12 6.5V10M12 14V17.5'),
  // two each way, over and under in a checker
  'fill-weave-5': fine('M6.5 9H13.4M16.6 9H17.5M6.5 15H7.4M10.6 15H17.5M9 6.5V7.4M9 10.6V17.5M15 6.5V13.4M15 16.6V17.5'),
  'fill-weave-diamond': fine('M12 6.5L17.5 12L12 17.5L6.5 12Z'),
  // one square of blocks is satin rows; the next square turns to columns
  'fill-blocks': fine(lines([7.5, 10.5, 13.5, 16.5], true)),
  'fill-fern': fine('M7 7.5L12 10.5L17 7.5M7 11L12 14L17 11M7 14.5L12 17.5L17 14.5'),
  'fill-seed': fine('M16.5 6.5L15 10M10.5 14L7.5 17.5'),
  'fill-knots': '<circle cx="14.7" cy="9.3" r="1.4" stroke-width="var(--fine)"/><circle cx="14.8" cy="14.4" r="1.4" stroke-width="var(--fine)"/>',
  'fill-burst': fine(spokes(12, 1.75, 5.5))
};

/** name → { group, label, body }, in the thread set's order */
export const PRIMITIVES = Object.fromEntries(Object.entries(THREAD_ICONS).map(([name, i]) => {
  if (!BODIES[name]) throw new Error(`No primitive for ${name}`);
  return [name, { ...i, body: holes + BODIES[name] }];
}));

// ---------- the 4 × 4 patch ----------
// The patch fills the same square (5..19), so each of its squares is 3.5 wide. Counted stitches repeat
// per square with the single icon's proportions; fills come from the canvas generator over the whole patch,
// with a thicker nominal thread so there are fewer, cleaner lines. Thread passing under is cut by a mask.

const PATCH_CELL = 14 / ZOOM, PATCH_W = 0.25, PATCH_DENSITY = 0.6;   // more open than the canvas, so lines stay apart at 24 px
const P = (u) => +(5 + u * PATCH_CELL).toFixed(2);
const seg = (a, b) => `M${P(a[0])} ${P(a[1])}L${P(b[0])} ${P(b[1])}`;
const inset = 1.5 / 14;   // the single icon's hole clearance, in squares
const COUNTED = {
  up: [[inset, 1 - inset], [1 - inset, inset]], down: [[inset, inset], [1 - inset, 1 - inset]],
  tl: [[inset, inset], [0.5, 0.5]], tr: [[1 - inset, inset], [0.5, 0.5]], bl: [[inset, 1 - inset], [0.5, 0.5]], br: [[1 - inset, 1 - inset], [0.5, 0.5]]
};
const tile = (legs) => {
  let d = '';
  for (let y = 0; y < ZOOM; y++) for (let x = 0; x < ZOOM; x++) for (const [a, b] of legs) d += seg([a[0] + x, a[1] + y], [b[0] + x, b[1] + y]);
  return d;
};
const FILL_KIND = {
  'fill-rows': 'rows', 'fill-columns': 'columns', 'fill-hatch': 'hatch', 'fill-weave-3': 'weave3', 'fill-weave-5': 'weave5',
  'fill-weave-diamond': 'diamond', 'fill-blocks': 'blocks', 'fill-fern': 'fern', 'fill-seed': 'seed', 'fill-knots': 'knots', 'fill-burst': 'burst'
};

function patchBody(name, id) {
  const ph = Array.from({ length: (ZOOM + 1) ** 2 }, (_, i) => dot(P(i % (ZOOM + 1)), P(Math.floor(i / (ZOOM + 1))), 0.55)).join('');
  const stroke = (d, w = 'var(--patch)', extra = '') => `<path d="${d}" stroke-width="${w}"${extra}/>`;
  let m;
  if (name === 'stitch-full' || name === 'fill-cross') return ph + stroke(tile([COUNTED.up, COUNTED.down]));
  if (name === 'fill-tweed') return ph + stroke(tile([COUNTED.up]), 'var(--patch)', ' stroke-opacity=".45"') + stroke(tile([COUNTED.down]));
  if (name === 'stitch-half') return ph + stroke(tile([COUNTED.up]));
  if ((m = name.match(/^stitch-quarter-(\w\w)$/))) return ph + stroke(tile([COUNTED[m[1]]]));
  if ((m = name.match(/^stitch-three-quarter-(\w\w)$/))) return ph + stroke(tile([m[1] === 'tl' || m[1] === 'br' ? COUNTED.up : COUNTED.down, COUNTED[m[1]]]));
  if (name === 'stitch-back') {
    // a stepped outline down the diagonal, each stitch stopping short of its holes
    let d = '';
    for (let k = 0; k < ZOOM; k++) d += seg([k, k + inset], [k, k + 1 - inset]) + seg([k + inset, k + 1], [k + 1 - inset, k + 1]);
    return ph + stroke(d);
  }
  if (name === 'stitch-knot') {
    let c = '';
    for (let y = 0; y < ZOOM; y++) for (let x = 0; x < ZOOM; x++) c += `<circle cx="${P(x + 0.5)}" cy="${P(y + 0.5)}" r="${(PATCH_CELL * 0.24).toFixed(2)}" stroke-width="var(--patch-fine)"/>`;
    return ph + c;
  }
  const mask = new Set();
  for (let y = 0; y < ZOOM; y++) for (let x = 0; x < ZOOM; x++) mask.add(`${x},${y}`);
  const kind = FILL_KIND[name];
  let legs = regionLegs(kind, mask, PATCH_DENSITY, 5, PATCH_W);
  if (kind === 'seed') legs = legs.filter((_, i) => i % 3 === 0);   // scattered, not speckled
  if (kind === 'knots') return ph + legs.filter((_, i) => i % 10 === 0).map((l, i) => {
    // each knot is five legs round a centre; draw every other one as a small ring
    const ring = legs.slice(i * 10, i * 10 + 5), cx = ring.reduce((t, x) => t + x.a[0], 0) / 5, cy = ring.reduce((t, x) => t + x.a[1], 0) / 5;
    return `<circle cx="${P(cx)}" cy="${P(cy)}" r="${(PATCH_CELL * 0.2).toFixed(2)}" stroke-width="var(--patch-fine)"/>`;
  }).join('');
  const under = legs.filter((l) => l.layer === 0).map((l) => seg(l.a, l.b)).join('');
  const over = legs.filter((l) => l.layer === 1).map((l) => seg(l.a, l.b)).join('');
  if (!kind.startsWith('weave') && kind !== 'diamond') return ph + stroke(under + over, 'var(--patch-fine)');
  // woven: the over thread cuts a gap in the under thread where they cross
  return ph + `<mask id="${id}-under" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>`
    + `<path d="${over}" stroke="#000" stroke-width="var(--patch-gap)" stroke-linecap="butt"/></mask>`
    + `<g mask="url(#${id}-under)">${stroke(under, 'var(--patch-fine)')}</g>` + stroke(over, 'var(--patch-fine)');
}

/**
 * Full <svg> markup for one primitive. Fills draw at 0.7× the stroke.
 * frame: 'square' (the single square, default), 'patch' (the zoomed-out 4 × 4 patch, same square on the grid),
 * or 'zoom' (both, animated on hover: the square zooms out into the patch). id: unique per page for 'patch' and 'zoom'.
 */
export function primitiveSvg(name, { size = 24, stroke = 1.75, title, frame = 'square', id = `p-${name}` } = {}) {
  const icon = PRIMITIVES[name];
  if (!icon) throw new Error(`Unknown primitive: ${name}`);
  const label = title ? `<title>${title}</title>` : '';
  const aria = title ? 'role="img"' : 'aria-hidden="true"';
  const vars = { fine: stroke * 0.7, patch: stroke * 0.5, 'patch-fine': stroke * 0.35, 'patch-gap': stroke * 0.35 * 3 };
  const fill = (body) => body.replace(/var\(--([\w-]+)\)/g, (_, k) => String(+vars[k].toFixed(2)));
  let body;
  if (frame === 'square') body = fill(icon.body);
  else if (frame === 'patch') body = fill(patchBody(name, id));
  else body = zoomStyle(id, ZOOM_AT_24) + `<g class="tz-many">${fill(patchBody(name, id))}</g><g class="tz-one">${fill(icon.body)}</g>`;
  const svgId = frame === 'square' ? '' : ` id="${id}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg"${svgId} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${aria}>${label}${body}</svg>`;
}

// the patch's square (1, 1) sits exactly where the single square is drawn ×1/4; this point stays put
const ZOOM_AT_24 = +(5 + 14 / 3).toFixed(3);
