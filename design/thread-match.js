// The nearest thread to any colour: a colour picked freely (a hex, the field, an image) can only be stitched
// in a real thread, so the picker always says which one is closest and how close. Distance is ΔE (CIE76) in
// Lab, which follows how different two colours look better than distance in RGB. Threads are lab/floss.js.
import { FLOSS } from '../lab/floss.js';

function lab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047), y = f(r * 0.2126 + g * 0.7152 + b * 0.0722), z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const THREADS = FLOSS.map((t) => ({ ...t, hex: t.hex.toUpperCase(), lab: lab(t.hex) }));
export const threads = () => THREADS;

// how close, in words: under about 2 the eye can't tell them apart
const CLOSENESS = [[1, 'Exact'], [4, 'Very close'], [9, 'Close'], [16, 'Near'], [Infinity, 'Far off']];

/** { dmc, anchor, name, hex, d (ΔE), close (words), exact } for the thread nearest to hex. */
export function nearestThread(hex) {
  const a = lab(hex);
  let best = null, d = Infinity;
  for (const t of THREADS) { const e = Math.hypot(a[0] - t.lab[0], a[1] - t.lab[1], a[2] - t.lab[2]); if (e < d) { d = e; best = t; } }
  return { dmc: best.dmc, anchor: best.anchor, name: best.name, hex: best.hex, d, close: CLOSENESS.find(([k]) => d < k)[1], exact: d < 1 };
}

/** Threads matching the query, best first: by number (an exact number first, then numbers starting with it), then by
 * name (names starting with it, then containing it). brand: 'dmc' (DMC numbers) or 'anchor' (each thread's Anchor
 * equivalent; one Anchor number can stand for more than one DMC thread, and each is listed). */
export function findThreads(q, max = 4, brand = 'dmc') {
  q = q.trim().toLowerCase().replace(/^(dmc|anchor)\s*/, '');
  if (!q) return [];
  const score = (t) => {
    const n = String(t[brand] ?? '').toLowerCase(), name = t.name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1 + n.length / 10 + (parseInt(n, 10) || 0) / 1e6;   // shorter, then lower numbers first
    const i = name.indexOf(q);
    return i === 0 ? 3 : i > 0 ? 4 + i / 100 : Infinity;
  };
  return THREADS.map((t) => [score(t), t]).filter(([sc]) => sc < Infinity).sort((a, b) => a[0] - b[0]).slice(0, max).map(([, t]) => t);
}
/** The thread with this DMC number, or null */
export const threadByDmc = (n) => THREADS.find((t) => t.dmc.toLowerCase() === String(n).trim().toLowerCase().replace(/^dmc\s*/, '')) || null;
