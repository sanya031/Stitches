// Outline stitches: the stitches an outline can be worked in, each as a line primitive drawn like the set's
// backstitch (primitives.js): in square units with the four holes at its corners, along the square's left side and
// bottom, one 0.125 stroke, currentColor. Backstitch is the set's own; the rest are drawn here from a pattern in
// (t along a side, 0..1; n across it). Used by the panel's Outline section.
import { primitiveSvg } from './icons/primitives.js';

const SIDES = [(t, n) => [n, t], (t, n) => [t, 1 + n]];
const f = (v) => +v.toFixed(3);
const seg = (pts) => SIDES.map((m) => `M${pts.map(([t, n]) => m(t, n).map(f).join(' ')).join('L')}`).join('');
// a loop from t0 to t1, h across: a chain's link
const loop = (t0, t1, h) => SIDES.map((m) => `M${Array.from({ length: 17 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return m((t0 + t1) / 2 + Math.cos(a) * (t1 - t0) / 2, Math.sin(a) * h).map(f).join(' ');
}).join('L')}`).join('');
const PATTERNS = {
  running: () => seg([[0.107, 0], [0.36, 0]]) + seg([[0.64, 0], [0.893, 0]]),                      // stitch, gap, stitch
  stem: () => [0.08, 0.32, 0.56].map((t) => seg([[t, 0.07], [t + 0.36, -0.07]])).join(''),          // slanted, overlapping like a rope
  split: () => seg([[0.107, 0], [0.52, 0]]) + seg([[0.44, 0.05], [0.893, 0.05]]),                   // each comes up through the one before
  chain: () => loop(0.1, 0.5, 0.11) + loop(0.5, 0.9, 0.11),                                         // linked loops
  whipped: () => seg([[0.107, 0], [0.893, 0]]) + [0.22, 0.47, 0.72].map((t) => seg([[t - 0.07, -0.09], [t + 0.07, 0.09]])).join(''), // a line, wrapped
};
const HOLES = '<g fill="currentColor" stroke="none" fill-opacity="0.3"><circle cx="0" cy="0" r="0.089"/><circle cx="1" cy="0" r="0.089"/><circle cx="0" cy="1" r="0.089"/><circle cx="1" cy="1" r="0.089"/></g>';
const lineSvg = (name, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="translate(5 5) scale(14)">${HOLES}<path d="${PATTERNS[name]()}" stroke-width="0.125"/></g></svg>`;

let uid = 0;
/** [key, name] for each outline stitch, in picker order */
export const OUTLINE_STITCHES = [['back', 'Backstitch'], ['running', 'Running stitch'], ['stem', 'Stem stitch'], ['split', 'Split stitch'], ['chain', 'Chain stitch'], ['whipped', 'Whipped backstitch']];
/** The drawing of one outline stitch */
export const outlineSvg = (key, { size = 24 } = {}) => (key === 'back'
  ? primitiveSvg('stitch-back', { size, frame: 'square', animate: false, id: `ol-${uid++}` })
  : lineSvg(key, size));
