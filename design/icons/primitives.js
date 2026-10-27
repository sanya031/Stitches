// Primitive icons: every stitch and fill from the thread set, reduced to clean lines on one square.
// Same names as thread.js. `build.mjs` writes primitive/*.svg and adds them to sprite.svg as p-<name>;
// primitive-patch/*.svg (the zoomed-out patch) and primitive-zoom/*.svg (the hover animation between them).
//
// Grid rules (as the line icons, plus)
// - one square: its four holes are dots at 5 and 19 (r 1.25), the square spans 5..19; holes sit in the
//   background (faint), they are the cloth, not the stitch
// - stitches use the full stroke, legs stop 1.5 short of a hole, like thread entering it
// - fills use a finer stroke (0.7×), the way fills use a finer thread
// - over and under: the thread that passes under has a gap where the other crosses it
//
// One drawing for both frames: everything is drawn in square units on an n × n patch, then scaled into
// the 5..19 square. The single icon is n = 1; the patch is the same thing with more squares, so its first
// square is exactly the single icon at 1/n size: lines, strokes and holes all shrink together, as in a
// real zoom out. Laid and woven fills run on across squares as one thread, the way they are stitched.
import { THREAD_ICONS, ZOOM, zoomStyle, zoomAt } from './thread.js';

/** name → { group, label }, in the thread set's order */
export const PRIMITIVES = Object.fromEntries(Object.entries(THREAD_ICONS).map(([name, i]) => [name, { ...i }]));

const I = 1.5 / 14;        // hole clearance, in squares
const GAP = 1.6 / 14;      // half the gap an over thread cuts in an under thread
const f3 = (v) => +v.toFixed(3);
const seg = ([a, b]) => `M${f3(a[0])} ${f3(a[1])}L${f3(b[0])} ${f3(b[1])}`;

// ---------- geometry, in squares ----------

const COUNTED = {
  up: [[I, 1 - I], [1 - I, I]], down: [[I, I], [1 - I, 1 - I]],
  tl: [[I, I], [0.5, 0.5]], tr: [[1 - I, I], [0.5, 0.5]], bl: [[I, 1 - I], [0.5, 0.5]], br: [[1 - I, 1 - I], [0.5, 0.5]]
};
const shift = ([a, b], x, y) => [[a[0] + x, a[1] + y], [b[0] + x, b[1] + y]];
const each = (n, legs) => { const out = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const l of legs) out.push(shift(l, x, y)); return out; };

/** A line through p along d, clipped to the box [lo, hi]²; null when it misses. */
function clip(p, d, lo, hi) {
  let t0 = -1e9, t1 = 1e9;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (p[k] < lo || p[k] > hi) return null; continue; }
    const a = (lo - p[k]) / d[k], b = (hi - p[k]) / d[k];
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
  }
  return t1 - t0 > 0.12 ? [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]] : null;
}

/** Cut a gap in each under segment wherever an over segment crosses it (not at its ends). */
function weave(under, over) {
  const out = [];
  for (const [a, b] of under) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), cuts = [];
    for (const [c, d] of over) {
      const ex = d[0] - c[0], ey = d[1] - c[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den, u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den;
      if (t * L > GAP && (1 - t) * L > GAP && u > 1e-6 && u < 1 - 1e-6) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    let from = 0;
    for (const t of [...cuts, null]) {
      const to = t == null ? 1 : t - GAP / L;
      if (to - from > 1e-3) out.push([[a[0] + dx * from, a[1] + dy * from], [a[0] + dx * to, a[1] + dy * to]]);
      if (t != null) from = t + GAP / L;
    }
  }
  return out;
}

/** Laid lines across a box: horizontal (rows) or vertical, four to a square, evenly spaced across squares. */
function laid(x0, y0, x1, y1, across) {
  const out = [], from = across ? y0 : x0, to = across ? y1 : x1;
  for (let v = Math.floor(from) + 0.125; v < to; v += 0.25) {
    if (v < from || v > to) continue;
    out.push(across ? [[x0 + I, v], [x1 - I, v]] : [[v, y0 + I], [v, y1 - I]]);
  }
  return out;
}

// a small motif turned a quarter (or mirrored) per square, so scattered fills don't repeat like wallpaper
const turn = (legs, x, y) => {
  const k = (x * 7 + y * 13 + x * y * 3) % 4;
  const rot = ([u, v]) => [[u, v], [1 - v, u], [1 - u, 1 - v], [v, 1 - u]][k];
  return legs.map(([a, b]) => shift([rot(a), rot(b)], x, y));
};
const SEED = [[[0.821, 0.107], [0.714, 0.357]], [[0.393, 0.643], [0.179, 0.893]]];
const KNOTS = [[0.693, 0.307], [0.7, 0.671]];

/**
 * Everything one primitive draws on an n × n patch, in squares:
 * { stitch: [legs at full stroke], fine: [legs at fine stroke], faint: [legs at full stroke, faded], rings: [[x, y, r]], curls: [d strings] }
 */
function art(name, n) {
  const a = { stitch: [], fine: [], faint: [], rings: [], fineRings: [], curls: [] };
  let m;
  if (name === 'stitch-full' || name === 'fill-cross') a.stitch = each(n, [COUNTED.up, COUNTED.down]);
  else if (name === 'fill-tweed') { a.faint = each(n, [COUNTED.up]); a.stitch = each(n, [COUNTED.down]); }   // two shades: the under leg darker
  else if (name === 'stitch-half') a.stitch = each(n, [COUNTED.up]);
  else if ((m = name.match(/^stitch-quarter-(\w\w)$/))) a.stitch = each(n, [COUNTED[m[1]]]);
  // the long leg goes the way the quarter does not
  else if ((m = name.match(/^stitch-three-quarter-(\w\w)$/))) a.stitch = each(n, [m[1] === 'tl' || m[1] === 'br' ? COUNTED.up : COUNTED.down, COUNTED[m[1]]]);
  else if (name === 'stitch-back') {
    // an outline turning a corner; on a patch, a stepped outline down the diagonal
    for (let k = 0; k < n; k++) a.stitch.push([[k, k + I], [k, k + 1 - I]], [[k + I, k + 1], [k + 1 - I, k + 1]]);
  } else if (name === 'stitch-knot') {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      a.rings.push([x + 0.5, y + 0.5, 3.25 / 14]);
      a.curls.push(`M${f3(x + 0.5)} ${f3(y + 0.386)}a.114 .114 0 1 1-.114 .114`);
    }
  } else if (name === 'fill-rows' || name === 'fill-columns') a.fine = laid(0, 0, n, n, name === 'fill-rows');
  else if (name === 'fill-hatch') {
    // one direction of diagonals, three to a square
    for (let c = 1 / 3; c < 2 * n; c += 1 / 3) { const s = clip([c, 0], [-1, 1], I, n - I); if (s) a.fine.push(s); }
  } else if (name === 'fill-weave-3' || name === 'fill-weave-5') {
    // one (or two) threads each way per square, over and under in a checker, the across thread on top first
    const at = name === 'fill-weave-3' ? [0.5] : [0.25, 0.75], H = [], V = [];
    for (let k = 0; k < n; k++) at.forEach((f, j) => {
      H.push({ i: k * at.length + j, s: [[I, k + f], [n - I, k + f]] });
      V.push({ i: k * at.length + j, s: [[k + f, I], [k + f, n - I]] });
    });
    // split every thread at the crossings, then each piece is over or under by the checker
    const pieces = (lines, others, across) => lines.flatMap(({ i, s }) => {
      const stops = [s[0][across ? 0 : 1], ...others.map((o) => o.s[0][across ? 0 : 1]), s[1][across ? 0 : 1]];
      return others.map((o, k) => {
        const lo = (stops[k] + stops[k + 1]) / 2, hi = (stops[k + 1] + stops[k + 2]) / 2;
        const ends = [k === 0 ? stops[0] : lo, k === others.length - 1 ? stops.at(-1) : hi];
        const fixed = s[0][across ? 1 : 0];
        return { over: ((i + o.i) % 2 === 0) === across, s: across ? [[ends[0], fixed], [ends[1], fixed]] : [[fixed, ends[0]], [fixed, ends[1]]] };
      });
    });
    const all = [...pieces(H, V, true), ...pieces(V, H, false)];
    const over = all.filter((p) => p.over).map((p) => p.s);
    a.fine = [...over, ...weave(all.filter((p) => !p.over).map((p) => p.s), over)];
  } else if (name === 'fill-weave-diamond') {
    // two families of diagonals through the middles of the square's sides: a diamond in every square
    const A = [], B = [];
    for (let k = 0; k < 2 * n; k++) { const s = clip([k + 0.5, 0], [-1, 1], 0, n); if (s) A.push({ i: k, s }); }
    for (let k = -n; k < n; k++) { const s = clip([k + 0.5, 0], [1, 1], 0, n); if (s) B.push({ i: k + n, s }); }
    // A runs over B where (i + j) is even; each thread splits at its crossings into over and under pieces
    const lines = [...A.map((l) => ({ ...l, fam: 0 })), ...B.map((l) => ({ ...l, fam: 1 }))], over = [], under = [];
    for (const l of lines) {
      const others = lines.filter((o) => o.fam !== l.fam);
      const [p, q] = l.s, d = [q[0] - p[0], q[1] - p[1]];
      const ts = others.map((o) => {
        const [c, e] = o.s, ex = e[0] - c[0], ey = e[1] - c[1], den = d[0] * ey - d[1] * ex;
        const t = ((c[0] - p[0]) * ey - (c[1] - p[1]) * ex) / den, u = ((c[0] - p[0]) * d[1] - (c[1] - p[1]) * d[0]) / den;
        return t > 1e-6 && t < 1 - 1e-6 && u > -1e-6 && u < 1 + 1e-6 ? { t, o } : null;
      }).filter(Boolean).sort((x, y) => x.t - y.t);
      if (!ts.length) { over.push(l.s); continue; }
      ts.forEach(({ t, o }, k) => {
        const t0 = k === 0 ? 0 : (ts[k - 1].t + t) / 2, t1 = k === ts.length - 1 ? 1 : (t + ts[k + 1].t) / 2;
        const piece = [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]];
        const aOver = (l.fam === 0 ? l.i + o.i : o.i + l.i) % 2 === 0;
        ((l.fam === 0) === aOver ? over : under).push(piece);
      });
    }
    a.fine = [...over, ...weave(under, over)];
  } else if (name === 'fill-blocks') {
    // satin blocks of 2 × 2 squares, rows and columns in turn; one square of it is rows
    for (let by = 0; by < n; by += 2) for (let bx = 0; bx < n; bx += 2) {
      const x1 = Math.min(n, bx + 2), y1 = Math.min(n, by + 2);
      a.fine.push(...laid(bx, by, x1, y1, ((bx + by) / 2) % 2 === 0));
    }
  } else if (name === 'fill-fern') {
    // a column of Vs in every square
    const vs = [0.179, 0.429, 0.679].flatMap((y) => [[[0.143, y], [0.5, y + 0.214]], [[0.857, y], [0.5, y + 0.214]]]);
    a.fine = each(n, vs);
  } else if (name === 'fill-seed') {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) a.fine.push(...turn(SEED, x, y));
  } else if (name === 'fill-knots') {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const [[u, v]] of turn(KNOTS.map((p) => [p, p]), x, y)) a.fineRings.push([u, v, 1.4 / 14]);
  } else if (name === 'fill-burst') {
    // a small burst stitched in every square
    const sp = Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      return [[0.5 + c * 0.125, 0.5 + s * 0.125], [0.5 + c * 0.393, 0.5 + s * 0.393]];
    });
    a.fine = each(n, sp);
  } else throw new Error(`No primitive for ${name}`);
  return a;
}

/** The drawing of an n × n patch in the 5..19 square (n = 1: the single icon). */
function body(name, n, stroke, holes) {
  const a = art(name, n), k = 14 / n, S = f3(stroke / 14), F = f3((stroke * 0.7) / 14);
  let out = '';
  if (holes > 0) {
    let d = '';
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) d += `<circle cx="${x}" cy="${y}" r="${f3(1.25 / 14)}"/>`;
    out += `<g fill="currentColor" stroke="none" fill-opacity="${holes}">${d}</g>`;
  }
  if (a.faint.length) out += `<path d="${a.faint.map(seg).join('')}" stroke-width="${S}" stroke-opacity=".45"/>`;
  if (a.stitch.length) out += `<path d="${a.stitch.map(seg).join('')}" stroke-width="${S}"/>`;
  if (a.fine.length) out += `<path d="${a.fine.map(seg).join('')}" stroke-width="${F}"/>`;
  for (const [x, y, r] of a.rings) out += `<circle cx="${f3(x)}" cy="${f3(y)}" r="${f3(r)}" stroke-width="${S}"/>`;
  for (const [x, y, r] of a.fineRings) out += `<circle cx="${f3(x)}" cy="${f3(y)}" r="${f3(r)}" stroke-width="${F}"/>`;
  if (a.curls.length) out += `<path d="${a.curls.join('')}" stroke-width="${S}"/>`;
  return `<g transform="translate(5 5) scale(${f3(k)})">${out}</g>`;
}

/**
 * Full <svg> markup for one primitive. Fills draw at 0.7× the stroke.
 * frame: 'square' (the single square, default), 'patch' (the zoomed-out n × n patch, same square on the grid),
 * or 'zoom' (both, animated on hover: the square zooms out into the patch). id: unique per page for 'zoom'.
 * holes: opacity of the fabric holes (0 hides them). animate: false leaves out the CSS animation, for a page
 * that drives .tz-one/.tz-many itself.
 */
export function primitiveSvg(name, { size = 24, stroke = 1.75, title, frame = 'square', id = `p-${name}`, n = ZOOM, animate = true, holes = 0.3 } = {}) {
  if (!PRIMITIVES[name]) throw new Error(`Unknown primitive: ${name}`);
  const label = title ? `<title>${title}</title>` : '';
  const aria = title ? 'role="img"' : 'aria-hidden="true"';
  let inner;
  if (frame === 'square') inner = body(name, 1, stroke, holes);
  else if (frame === 'patch') inner = body(name, n, stroke, holes);
  else inner = (animate ? zoomStyle(id, zoomAt(5, 14, n), n) : '') + `<g class="tz-many">${body(name, n, stroke, holes)}</g><g class="tz-one">${body(name, 1, stroke, holes)}</g>`;
  const svgId = frame === 'zoom' ? ` id="${id}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${svgId} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${aria}>${label}${inner}</svg>`;
}
