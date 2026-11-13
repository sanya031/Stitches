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

/** { name, hex, d (ΔE), close (words), exact } for the thread nearest to hex. */
export function nearestThread(hex) {
  const a = lab(hex);
  let best = null, d = Infinity;
  for (const t of THREADS) { const e = Math.hypot(a[0] - t.lab[0], a[1] - t.lab[1], a[2] - t.lab[2]); if (e < d) { d = e; best = t; } }
  return { name: best.name, hex: best.hex, d, close: CLOSENESS.find(([k]) => d < k)[1], exact: d < 1 };
}

/** Threads whose name starts with or contains the query, best first. */
export function findThreads(q, max = 4) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  return THREADS.filter((t) => t.name.toLowerCase().includes(q)).sort((x, y) => x.name.toLowerCase().indexOf(q) - y.name.toLowerCase().indexOf(q)).slice(0, max);
}
