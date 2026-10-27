// Thread icons: each stitch or fill as it sits in a single square on the canvas, between its four holes.
// Drawing follows the WebGL renderer: lens-shaped legs pinched into the holes, two strands with a
// groove between them, twist ridges at the helix angle, dark ends, matte round shading, a soft
// contact shadow. Fills come from the app's own generator (lab/fills.js), exactly as one square of them.
import { regionLegs } from '../../lab/fills.js';

const CORNERS = { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' };
const Q = { tl: 0, tr: 1, bl: 2, br: 3 };

export const THREAD_ICONS = {
  'stitch-full': { group: 'Stitches', label: 'Full cross' },
  'stitch-half': { group: 'Stitches', label: 'Half stitch' },
  ...Object.fromEntries(Object.entries(CORNERS).map(([k, n]) => [`stitch-quarter-${k}`, { group: 'Quarter', label: `Quarter, ${n}` }])),
  ...Object.fromEntries(Object.entries(CORNERS).map(([k, n]) => [`stitch-three-quarter-${k}`, { group: 'Three-quarter', label: `Three-quarter, ${n}` }])),
  'stitch-back': { group: 'Stitches', label: 'Backstitch' },
  'stitch-knot': { group: 'Stitches', label: 'French knot' },
  'fill-cross': { group: 'Fills', label: 'Cross' },
  'fill-tweed': { group: 'Fills', label: 'Tweed' },
  'fill-rows': { group: 'Fills', label: 'Rows' },
  'fill-columns': { group: 'Fills', label: 'Columns' },
  'fill-hatch': { group: 'Fills', label: 'Hatch /' },
  'fill-weave-3': { group: 'Fills', label: 'Weave 3×3' },
  'fill-weave-5': { group: 'Fills', label: 'Weave 5×5' },
  'fill-weave-diamond': { group: 'Fills', label: 'Weave ◇' },
  'fill-blocks': { group: 'Fills', label: 'Blocks' },
  'fill-fern': { group: 'Fills', label: 'Fern' },
  'fill-seed': { group: 'Fills', label: 'Seed' },
  'fill-knots': { group: 'Fills', label: 'Knots' },
  'fill-burst': { group: 'Fills', label: 'Burst' }
};

const S = 48, O = 6, C = 36;        // frame, the square's top-left corner and its size, px
// hover preview: a 4 × 4 patch, zooming out from its square (1, 1); the point that stays put is O + C / 3
export const ZOOM = 4;
const ZOOM_AT = O + C / 3;
const HOLE = '#8F8A80';             // fabric holes: mid grey, visible on the dark bench and on cloth
// thread widths in squares, as on the canvas at count 14: two strands for counted stitches, a fine strand for fills
const W_STITCH = 0.3, W_FILL = 0.6 * 0.27 * 14 / 25.4;

// ---------- colour ----------

const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const darker = (h, k) => toHex(toRgb(h).map((v) => v * k));
const lighter = (h, k) => toHex(toRgb(h).map((v) => v + (255 - v) * k));

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- geometry, in square units (0..1) ----------

const TL = [0, 0], TR = [1, 0], BL = [0, 1], BR = [1, 1], CEN = [0.5, 0.5];

/** Counted stitches in the square, as in the app: [from, to, layer]. */
function counted(type, q = 2) {
  const corner = [TL, TR, BL, BR][q];
  switch (type) {
    case 'full': return [[BL, TR, 0], [TL, BR, 1]];
    case 'half': return [[BL, TR, 0]];
    case 'quarter': return [[corner, CEN, 1]];
    case 'threeq': return [q === 0 || q === 3 ? [BL, TR, 0] : [TL, BR, 0], [corner, CEN, 1]];
    default: return [];
  }
}

/** Legs for an icon on an n × n patch of squares (n = 1: the single square): { a, b, layer, w (squares), ea, eb, tone, strands }. */
function layout(name, n = 1) {
  const legs = [];
  const add = (list, w, strands, tone = () => 1) => list.forEach(([a, b, layer, ea = 1, eb = 1, t]) =>
    legs.push({ a, b, layer, w, ea, eb, strands, tone: t ?? tone() }));
  const r = rng(name.length * 131 + 7);
  // a counted stitch repeats in every square, as the canvas lays a row of them
  const each = (list) => {
    const out = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const [a, b, ...rest] of list) out.push([[a[0] + x, a[1] + y], [b[0] + x, b[1] + y], ...rest]);
    return out;
  };

  let m;
  if (name === 'stitch-full' || name === 'fill-cross') add(each(counted('full')), W_STITCH, 2);
  else if (name === 'fill-tweed') add(each(counted('full').map((l, i) => [...l, 1, 1, i ? 1.4 : 0.68])), W_STITCH, 2);
  else if (name === 'stitch-half') add(each(counted('half')), W_STITCH, 2);
  else if ((m = name.match(/^stitch-quarter-(\w\w)$/))) add(each(counted('quarter', Q[m[1]])), W_STITCH, 2);
  else if ((m = name.match(/^stitch-three-quarter-(\w\w)$/))) add(each(counted('threeq', Q[m[1]])), W_STITCH, 2);
  else if (name === 'stitch-back') {
    // an outline turning a corner; on a patch, a stepped outline down the diagonal
    const steps = [];
    for (let k = 0; k < n; k++) steps.push([[k, k], [k, k + 1], 2], [[k, k + 1], [k + 1, k + 1], 2]);
    add(steps, W_STITCH * 0.8, 2);
  } else if (name === 'stitch-knot') {
    // thread wrapped into a tight coil: a five-point star of short wraps
    const ring = Array.from({ length: 5 }, (_, k) => [0.5 + Math.cos(-Math.PI / 2 + k * 1.2566) * 0.2, 0.5 + Math.sin(-Math.PI / 2 + k * 1.2566) * 0.2]);
    add(each(ring.map((p, k) => [p, ring[(k + 2) % 5], 1])), 0.2, 2, () => 0.92 + r() * 0.16);
  } else {
    // every fill exactly as the canvas lays it over these squares: same generator, same thread, same density
    const kind = {
      'fill-rows': 'rows', 'fill-columns': 'columns', 'fill-hatch': 'hatch', 'fill-weave-3': 'weave3', 'fill-weave-5': 'weave5',
      'fill-weave-diamond': 'diamond', 'fill-blocks': 'blocks', 'fill-fern': 'fern', 'fill-seed': 'seed', 'fill-knots': 'knots', 'fill-burst': 'burst'
    }[name];
    const mask = new Set();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) mask.add(`${x},${y}`);
    add(regionLegs(kind, mask, 0.85, 5, W_FILL).map((l) => [l.a, l.b, l.layer, l.ea, l.eb, l.tone]), W_FILL, 1);
  }
  return legs;
}

// ---------- drawing ----------

const f1 = (v) => (Math.round(v * 10) / 10).toString();

/**
 * A leg's outline in its own frame: along +x from 0 to L, centred on y = 0.
 * Ends that enter the fabric pinch to 40% width; ends that carry on (woven) stay full.
 */
function ribbonLocal(L, w, ea, eb) {
  const h = w / 2, h0a = ea ? h * 0.4 : h, h0b = eb ? h * 0.4 : h;
  const ramp = Math.min(L * 0.42, w * 1.5);
  if (L < ramp * 2.4) {
    const h1 = (h - 0.125 * (h0a + h0b)) / 0.75;
    return `M0 ${f1(-h0a)}C${f1(L * 0.25)} ${f1(-h1)} ${f1(L * 0.75)} ${f1(-h1)} ${f1(L)} ${f1(-h0b)}`
      + `L${f1(L)} ${f1(h0b)}C${f1(L * 0.75)} ${f1(h1)} ${f1(L * 0.25)} ${f1(h1)} 0 ${f1(h0a)}Z`;
  }
  const ra = ea ? ramp : 0, rb = eb ? ramp : 0;
  return `M0 ${f1(-h0a)}Q${f1(ra * 0.25)} ${f1(-h)} ${f1(ra)} ${f1(-h)}L${f1(L - rb)} ${f1(-h)}Q${f1(L - rb * 0.25)} ${f1(-h)} ${f1(L)} ${f1(-h0b)}`
    + `L${f1(L)} ${f1(h0b)}Q${f1(L - rb * 0.25)} ${f1(h)} ${f1(L - rb)} ${f1(h)}L${f1(ra)} ${f1(h)}Q${f1(ra * 0.25)} ${f1(h)} 0 ${f1(h0a)}Z`;
}

/**
 * Full SVG markup for a thread icon.
 * options: colour (thread, hex), size (px), paper (linen tile behind), id (prefix for defs, unique per page),
 * frame: 'square' (the single square, default), 'patch' (a ZOOM × ZOOM patch of the same stitch or fill, as the canvas
 * lays it, in the same square of the frame) or 'zoom' (both, animated on hover: the square zooms out into the patch)
 */
export function threadSvg(name, { colour = '#C8343B', size = 48, paper = false, id = name, frame = 'square' } = {}) {
  if (!THREAD_ICONS[name]) throw new Error(`Unknown thread icon: ${name}`);
  const r = rng(name.length * 97 + 3);
  const defs = new Map(), body = [];
  defs.set('blur', `<filter id="${id}-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.8"/></filter>`);

  // Round shading across the thread, like the canvas: dark tucked-under sides, the lit side brighter.
  // Two strands get a groove down the middle and their own roundness. Shared by every leg of one tone.
  const shading = (base, litTop, strands) => {
    const key = `g${base.slice(1)}${litTop ? 't' : 'b'}${strands}`;
    if (!defs.has(key)) {
      // the canvas lights thread so its crown sits a little above the dye colour
      const dk = darker(base, 0.66), lt = lighter(base, 0.2), md = lighter(base, 0.06), vl = darker(base, 0.8);
      const stops = strands > 1
        ? [[0, dk], [0.17, lt], [0.38, md], [0.5, vl], [0.62, md], [0.8, base], [1, dk]]
        : [[0, dk], [0.3, lt], [0.62, md], [1, dk]];
      defs.set(key, `<linearGradient id="${id}-${key}" x1="0" y1="${litTop ? 0 : 1}" x2="0" y2="${litTop ? 1 : 0}">`
        + stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + '</linearGradient>');
    }
    return `${id}-${key}`;
  };
  // Twist: soft grooves at the helix angle (about 35° to the thread), one ply apart.
  const twist = (wpx, strands) => {
    if (!defs.has('groove')) defs.set('groove', `<linearGradient id="${id}-groove"><stop offset="0" stop-opacity="0"/><stop offset=".5" stop-opacity=".32"/><stop offset="1" stop-opacity="0"/></linearGradient>`);
    const sp = Math.max(1.6, Math.round((wpx / strands) * 0.5 * 4) / 4), key = `t${String(sp).replace('.', '_')}`;
    if (!defs.has(key)) defs.set(key, `<pattern id="${id}-${key}" patternUnits="userSpaceOnUse" width="${sp}" height="${sp}" patternTransform="rotate(-55)">`
      + `<rect width="${sp}" height="${sp}" fill="url(#${id}-groove)"/></pattern>`);
    return `${id}-${key}`;
  };
  // Dark where the thread dives into a hole.
  const ends = (ea, eb) => {
    const key = `e${ea}${eb}`;
    if (!defs.has(key)) {
      const s = [[0, ea ? 0.5 : 0], [0.16, 0], [0.84, 0], [1, eb ? 0.5 : 0]];
      defs.set(key, `<linearGradient id="${id}-${key}">` + s.map(([o, a]) => `<stop offset="${o}" stop-opacity="${a}"/>`).join('') + '</linearGradient>');
    }
    return `${id}-${key}`;
  };

  // One patch of n × n squares inside the frame: holes, then under legs, top legs, backstitch,
  // each layer's shadows falling on what is already drawn. Everything scales with the square.
  const draw = (legs, n) => {
    const cell = C / n, k = cell / C, out = [];
    const hole = n === 1 ? 1.7 : 0.9;
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) out.push(`<circle cx="${f1(O + x * cell)}" cy="${f1(O + y * cell)}" r="${hole}" fill="${HOLE}"/>`);
    const layers = [...new Set(legs.map((l) => l.layer))].sort();
    for (const layer of layers) {
      const shadows = [], threads = [];
      for (const l of legs.filter((x) => x.layer === layer)) {
        const j = (amt) => (r() - 0.5) * 2 * amt;   // hand tension: off-centre holes, uneven thickness
        const px = (p) => [O + p[0] * cell, O + p[1] * cell];
        const a = l.ea ? px(l.a).map((v) => v + j(0.45 * k)) : px(l.a), b = l.eb ? px(l.b).map((v) => v + j(0.45 * k)) : px(l.b);
        const w = l.w * cell * 1.08 * (1 + j(0.07));   // the canvas lets thread puff a little past its nominal width
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), deg = Math.atan2(dy, dx) * 180 / Math.PI;
        if (L < 0.5 * k) continue;
        const d = ribbonLocal(L, w, l.ea, l.eb);
        const base = l.tone > 1 ? lighter(colour, (l.tone - 1) * 0.6) : darker(colour, l.tone);
        const litTop = (dy - dx) < 0;   // the light is top-left; does it reach this leg's -y side?
        const frame = `translate(${f1(a[0])} ${f1(a[1])}) rotate(${f1(deg)})`;
        shadows.push(`<path transform="${frame}" d="${d}"/>`);
        threads.push(`<g transform="${frame}"><path d="${d}" fill="url(#${shading(base, litTop, l.strands)})"/>`
          + (n === 1 ? `<path d="${d}" fill="url(#${twist(w, l.strands)})"/>` : '')   // ridges are lost at patch scale
          + (l.ea || l.eb ? `<path d="${d}" fill="url(#${ends(l.ea, l.eb)})"/>` : '') + '</g>');
      }
      out.push(`<g transform="translate(${f1(0.6 * Math.sqrt(k))} ${f1(Math.sqrt(k))})" fill="#000" fill-opacity=".34" filter="url(#${id}-blur${n === 1 ? '' : 'n'})">${shadows.join('')}</g>`, ...threads);
    }
    return out.join('');
  };

  if (paper) body.push(`<rect width="${S}" height="${S}" rx="8" fill="#F2EEE6"/>`);
  // blur for the patch's finer shadows
  if (frame !== 'square') defs.set('blurn', `<filter id="${id}-blurn" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.35"/></filter>`);
  const one = frame === 'patch' ? '' : draw(layout(name), 1);   // drawn first so its hand jitter matches the plain icon
  if (frame === 'square') body.push(one);
  else if (frame === 'patch') body.push(draw(layout(name, ZOOM), ZOOM));
  else body.push(zoomStyle(id, ZOOM_AT), `<g class="tz-many">${draw(layout(name, ZOOM), ZOOM)}</g>`, `<g class="tz-one">${one}</g>`);

  const svgId = frame === 'square' ? '' : ` id="${id}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg"${svgId} width="${size}" height="${size}" viewBox="0 0 ${S} ${S}" aria-hidden="true"><defs>${[...defs.values()].join('')}</defs>${body.join('')}</svg>`;
}

/**
 * The hover zoom between the frames, as a <style> scoped to one svg (#id). The patch starts magnified ZOOM×
 * about `at` (in viewBox units), so its square (1, 1) fills the frame exactly where the single square sits; on
 * hover the single square shrinks into that spot as the patch settles to 1×: one continuous zoom out.
 * Plays on hovering the svg or any ancestor with class tz-host. Reduced motion gets a crossfade.
 */
export function zoomStyle(id, at) {
  const o = `${at}px ${at}px`, on = (part) => `#${id}:hover .${part},.tz-host:hover #${id} .${part},.tz-host:focus-visible #${id} .${part}`;
  return `<style>#${id} .tz-one,#${id} .tz-many{transform-origin:${o};transition:transform .5s cubic-bezier(.3,0,.2,1),opacity .3s ease}`
    + `#${id} .tz-many{transform:scale(${ZOOM});opacity:0}`
    + `${on('tz-one')}{transform:scale(${1 / ZOOM});opacity:0;transition-delay:0s,.12s}`
    + `${on('tz-many')}{transform:scale(1);opacity:1}`
    + `@media (prefers-reduced-motion:reduce){#${id} .tz-one,#${id} .tz-many{transform:none!important;transition:opacity .2s}}</style>`;
}
