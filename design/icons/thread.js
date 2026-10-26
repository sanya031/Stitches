// Thread icons: stitches and fills drawn as real thread, in SVG.
// Each leg is a lens-shaped ribbon (puffy between holes, pinched where it enters one),
// shaded round with a gradient across it, with twist ridges, a highlight and a soft shadow.
// Fills come from the app's own generators (lab/fills.js), so icons match the canvas.
import { regionLegs } from '../../lab/fills.js';

export const THREAD_ICONS = {
  'stitch-full': { group: 'Stitches', label: 'Full cross' },
  'stitch-half': { group: 'Stitches', label: 'Half stitch' },
  'stitch-quarter': { group: 'Stitches', label: 'Quarter' },
  'stitch-three-quarter': { group: 'Stitches', label: 'Three-quarter' },
  'stitch-back': { group: 'Stitches', label: 'Backstitch' },
  'stitch-long': { group: 'Stitches', label: 'Long stitch' },
  'stitch-knot': { group: 'Stitches', label: 'French knot' },
  'fill-cross': { group: 'Fills', label: 'Cross', kind: 'cross' },
  'fill-tweed': { group: 'Fills', label: 'Tweed', kind: 'tweed' },
  'fill-rows': { group: 'Fills', label: 'Rows', kind: 'rows' },
  'fill-columns': { group: 'Fills', label: 'Columns', kind: 'columns' },
  'fill-hatch': { group: 'Fills', label: 'Hatch /', kind: 'hatch' },
  'fill-weave-3': { group: 'Fills', label: 'Weave 3×3', kind: 'weave3' },
  'fill-weave-5': { group: 'Fills', label: 'Weave 5×5', kind: 'weave5' },
  'fill-weave-diamond': { group: 'Fills', label: 'Weave ◇', kind: 'diamond' },
  'fill-blocks': { group: 'Fills', label: 'Blocks', kind: 'blocks' },
  'fill-fern': { group: 'Fills', label: 'Fern', kind: 'fern' },
  'fill-seed': { group: 'Fills', label: 'Seed', kind: 'seed' },
  'fill-knots': { group: 'Fills', label: 'Knots', kind: 'knots' },
  'fill-burst': { group: 'Fills', label: 'Burst', kind: 'burst' }
};

const S = 48;              // drawing frame; scaled by the size option
const HOLE = '#8F8A80';    // fabric holes: mid grey, visible on the dark bench and on cloth

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

// ---------- geometry ----------

/** Counted-stitch legs in one square, as in the app: [from, to, layer]. q picks the corner (2 = bottom-left). */
function cellLegs(x, y, type, q = 2) {
  const TL = [x, y], TR = [x + 1, y], BL = [x, y + 1], BR = [x + 1, y + 1], C = [x + 0.5, y + 0.5];
  const corner = [TL, TR, BL, BR][q];
  switch (type) {
    case 'full': return [[BL, TR, 0], [TL, BR, 1]];
    case 'half': return [[BL, TR, 0]];
    case 'quarter': return [[corner, C, 1]];
    case 'threeq': return [q === 0 || q === 3 ? [BL, TR, 0] : [TL, BR, 0], [corner, C, 1]];
    default: return [];
  }
}

/** Legs in px with width, colour tone and which ends enter the fabric, plus the holes to draw. */
function layout(name) {
  const legs = [], holes = [];
  const put = (o, C, list, w, extra = {}) => list.forEach(([a, b, layer, ea = 1, eb = 1, tone = 1]) =>
    legs.push({ a: [o[0] + a[0] * C, o[1] + a[1] * C], b: [o[0] + b[0] * C, o[1] + b[1] * C], layer, w, ea, eb, tone, ...extra }));
  const cellHoles = (o, C, cols, rows) => { for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) holes.push([o[0] + x * C, o[1] + y * C]); };

  const one = { 'stitch-full': 'full', 'stitch-half': 'half', 'stitch-quarter': 'quarter', 'stitch-three-quarter': 'threeq' }[name];
  if (one) {
    const o = [9, 9], C = 30;
    cellHoles(o, C, 1, 1);
    if (one === 'quarter' || one === 'threeq') holes.push([24, 24]);
    put(o, C, cellLegs(0, 0, one), 9);
    return { legs, holes };
  }
  if (name === 'stitch-back') {
    const o = [6, 24], C = 18;
    for (let i = 0; i <= 2; i++) holes.push([o[0] + i * C, o[1]]);
    put(o, C, [[[0, 0], [1, 0], 2], [[1, 0], [2, 0], 2]], 7);
    return { legs, holes };
  }
  if (name === 'stitch-long') {
    holes.push([8, 40], [40, 8]);
    put([0, 0], 1, [[[8, 40], [40, 8], 0]], 7.5);
    return { legs, holes };
  }
  if (name === 'stitch-knot') {
    // a French knot: thread wrapped into a tight coil, read as a five-point star of short wraps
    const ring = Array.from({ length: 5 }, (_, k) => [24 + Math.cos(-Math.PI / 2 + k * 1.2566) * 10, 24 + Math.sin(-Math.PI / 2 + k * 1.2566) * 10]);
    put([0, 0], 1, ring.map((p, k) => [p, ring[(k + 2) % 5], 1]), 8.5);
    return { legs, holes };
  }

  // fills: a 3 × 3 patch of squares, 12 px each
  const kind = THREAD_ICONS[name].kind, o = [6, 6], C = 12;
  if (kind === 'cross' || kind === 'tweed') {
    cellHoles(o, C, 3, 3);
    const r = rng(11);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      cellLegs(x, y, 'full').forEach(([a, b, layer]) => {
        const k = r(), tone = kind === 'tweed' ? (k < 0.33 ? 0.7 : k < 0.66 ? 1.35 : 1) : 1;
        put(o, C, [[a, b, layer, 1, 1, tone]], 4.2);
      });
    }
    return { legs, holes };
  }
  // knots and seed: scattered evenly on a jittered grid, which reads better at icon size than pure chance
  if (kind === 'knots' || kind === 'seed') {
    const r = rng(kind === 'knots' ? 23 : 31), n = kind === 'knots' ? 3 : 4, cell = 36 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = [6 + (x + 0.5) * cell + (r() - 0.5) * cell * 0.35, 6 + (y + 0.5) * cell + (r() - 0.5) * cell * 0.35];
      if (kind === 'knots') {
        const rot = r() * Math.PI * 2, rad = 3.6;
        const ring = Array.from({ length: 5 }, (_, k) => [c[0] + Math.cos(rot + k * 1.2566) * rad, c[1] + Math.sin(rot + k * 1.2566) * rad]);
        put([0, 0], 1, ring.map((p, k) => [p, ring[(k + 2) % 5], 1, 1, 1, 0.92 + r() * 0.16]), 3.4);
      } else {
        const ang = r() * Math.PI, len = 4.2 + r() * 1.6, dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
        put([0, 0], 1, [[[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy], 1, 1, 1, 0.88 + r() * 0.24]], 3.2);
      }
    }
    return { legs, holes };
  }
  const mask = new Set();
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) mask.add(`${x},${y}`);
  // fill thread in squares: a little bolder than on the canvas, so it reads at icon size
  const W = 0.24;
  regionLegs(kind, mask, 0.85, 5, W).forEach((l) => put(o, C, [[l.a, l.b, l.layer, l.ea, l.eb, l.tone || 1]], W * C));
  return { legs, holes };
}

// ---------- drawing ----------

const f1 = (v) => (Math.round(v * 10) / 10).toString();

/**
 * A leg's outline in its own frame: along +x from 0 to L, centred on y = 0.
 * Ends that enter the fabric pinch to 40% width; ends that carry on (woven) stay full.
 * Short legs are a single lens; long ones keep full width between short tapers.
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
 * options: colour (thread, hex), size (px), paper (draw a linen tile behind), id (prefix for defs, unique per page)
 */
export function threadSvg(name, { colour = '#C8343B', size = 48, paper = false, id = name } = {}) {
  if (!THREAD_ICONS[name]) throw new Error(`Unknown thread icon: ${name}`);
  const { legs, holes } = layout(name);
  const r = rng(name.length * 97 + 3);
  const defs = new Map(), shadows = [], body = [];
  defs.set('blur', `<filter id="${id}-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7"/></filter>`);

  // Shading across the thread, shared by every leg of one tone. In a leg's own frame the
  // light (top-left) falls on -y or +y depending on which way the leg points, hence two directions.
  const shading = (base, litTop) => {
    const key = `g${base.slice(1)}${litTop ? 't' : 'b'}`;
    if (!defs.has(key)) {
      const stops = [[0, darker(base, 0.72)], [0.28, lighter(base, 0.28)], [0.55, base], [1, darker(base, 0.5)]];
      defs.set(key, `<linearGradient id="${id}-${key}" x1="0" y1="${litTop ? 0 : 1}" x2="0" y2="${litTop ? 1 : 0}">`
        + stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + '</linearGradient>');
    }
    return `${id}-${key}`;
  };
  // twist ridges at the helix angle, spaced to the thread's width (shared by legs of similar width)
  const twist = (w) => {
    const sp = Math.max(1.4, Math.round(w * 0.42 * 4) / 4), key = `t${String(sp).replace('.', '_')}`;
    if (!defs.has(key)) defs.set(key, `<pattern id="${id}-${key}" patternUnits="userSpaceOnUse" width="${sp}" height="${sp}" patternTransform="rotate(55)">`
      + `<rect width="${f1(sp * 0.36)}" height="${sp}" fill="#000" fill-opacity=".2"/></pattern>`);
    return `${id}-${key}`;
  };

  if (paper) body.push(`<rect width="${S}" height="${S}" rx="8" fill="#F2EEE6"/>`);
  holes.forEach(([x, y]) => body.push(`<circle cx="${x}" cy="${y}" r="1.4" fill="${HOLE}"/>`));

  // Under legs, then top legs: each layer's shadows fall on everything already drawn.
  const byLayer = new Map();
  legs.forEach((l) => { if (!byLayer.has(l.layer)) byLayer.set(l.layer, []); byLayer.get(l.layer).push(l); });
  for (const layer of [...byLayer.keys()].sort()) {
    const layerShadows = [], layerBody = [];
    for (const l of byLayer.get(layer)) {
      const j = (amt) => (r() - 0.5) * 2 * amt;   // hand tension: off-centre holes, uneven thickness
      const a = l.ea ? [l.a[0] + j(0.5), l.a[1] + j(0.5)] : l.a, b = l.eb ? [l.b[0] + j(0.5), l.b[1] + j(0.5)] : l.b;
      const w = l.w * (1 + j(0.08));
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), deg = Math.atan2(dy, dx) * 180 / Math.PI;
      const d = ribbonLocal(L, w, l.ea, l.eb);
      const base = l.tone > 1 ? lighter(colour, (l.tone - 1) * 0.6) : darker(colour, l.tone);
      // the leg's +y side faces the top-left light when its normal (-dy, dx) points up-left
      const litTop = (dy - dx) < 0;
      const frame = `translate(${f1(a[0])} ${f1(a[1])}) rotate(${f1(deg)})`;
      layerShadows.push(`<path transform="${frame}" d="${d}"/>`);
      let g = `<g transform="${frame}"><path d="${d}" fill="url(#${shading(base, litTop)})"/><path d="${d}" fill="url(#${twist(w)})"/>`;
      if (L > w * 1.2) {
        const y = f1((litTop ? -1 : 1) * w * 0.18);
        g += `<path d="M${f1(L * 0.25)} ${y}H${f1(L * 0.75)}" stroke="#fff" stroke-opacity=".32" stroke-width="${f1(w * 0.14)}" stroke-linecap="round"/>`;
      }
      layerBody.push(g + '</g>');
    }
    body.push(`<g transform="translate(.7 1.1)" fill="#000" fill-opacity=".3" filter="url(#${id}-blur)">${layerShadows.join('')}</g>`, ...layerBody);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}" aria-hidden="true"><defs>${[...defs.values()].join('')}</defs>${body.join('')}</svg>`;
}
