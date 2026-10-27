// Primitive icons: every stitch and fill from the thread set, reduced to clean lines on one square.
// Same names as thread.js. `build.mjs` writes primitive/*.svg and adds them to sprite.svg as p-<name>.
//
// Grid rules (as the line icons, plus)
// - one square: its four holes are dots at 5 and 19 (r 1.25), the square spans 5..19
// - stitches use the full stroke, legs stop 1.5 short of a hole, like thread entering it
// - fills use a finer stroke (0.7×), the way fills use a finer thread, and stay inside 6.5..17.5
// - each fill keeps the shape one square of it has on the canvas, with fewer lines
// - over and under: the thread that passes under has a gap where the other crosses it
import { THREAD_ICONS } from './thread.js';

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

/** Full <svg> markup for one primitive. Fills draw at 0.7× the stroke. */
export function primitiveSvg(name, { size = 24, stroke = 1.75, title } = {}) {
  const icon = PRIMITIVES[name];
  if (!icon) throw new Error(`Unknown primitive: ${name}`);
  const label = title ? `<title>${title}</title>` : '';
  const aria = title ? 'role="img"' : 'aria-hidden="true"';
  const body = icon.body.replaceAll('var(--fine)', String(+(stroke * 0.7).toFixed(2)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${aria}>${label}${body}</svg>`;
}
