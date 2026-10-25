// Picture → thread: turns a photo into a piece of stitches, fills and backstitch.
// Pipeline: sample to the grid → remove background → reduce colours (k-means in Lab)
// → snap to floss → split tones into light / mid / dark → stitch each band its own way → outline.
import { FLOSS, darkerShade } from './floss.js';

/** What each tone band can become. Cell kinds go one per square; the rest are long-stitch fills. */
export const TONE_STITCHES = {
  none: 'Leave as pattern',
  full: 'Cross',
  half: 'Half stitch',
  'f-tweed': 'Tweed',
  satin: 'Satin, follows picture',
  rows: 'Rows',
  columns: 'Columns',
  hatch: 'Hatch /',
  weave3: 'Weave 3×3',
  weave5: 'Weave 5×5',
  diamond: 'Weave ◇',
  blocks: 'Blocks',
  fern: 'Fern',
  seed: 'Seed',
  knots: 'Knots'
};
const CELL_KINDS = new Set(['full', 'half', 'f-tweed']);

// ---------- colour ----------

function srgbToLab(r, g, b) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const hexToLab = (h) => srgbToLab(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const FLOSS_LAB = FLOSS.map((f) => hexToLab(f.hex));

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- sampling ----------

/** Downscale an image to `cols` squares wide, halving in steps so detail averages instead of aliasing. */
export function samplePicture(img, cols, maxRows = 120) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  let rows = Math.max(1, Math.round(cols * ih / iw));
  if (rows > maxRows) { rows = maxRows; cols = Math.max(1, Math.round(rows * iw / ih)); }
  let src = img, w = iw, h = ih;
  while (w / 2 > cols * 2 && h / 2 > rows * 2) {
    const c = document.createElement('canvas');
    c.width = Math.round(w / 2); c.height = Math.round(h / 2);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    src = c; w = c.width; h = c.height;
  }
  const out = document.createElement('canvas');
  out.width = cols; out.height = rows;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cols, rows);
  return { cols, rows, rgba: ctx.getImageData(0, 0, cols, rows).data };
}

// ---------- k-means in Lab ----------

function kmeans(points, k, seed) {
  if (!points.length) return [];
  k = Math.min(k, points.length);
  const r = rng(seed), cents = [points[Math.floor(r() * points.length)].slice()];
  const d = new Float64Array(points.length).fill(Infinity);
  while (cents.length < k) {   // k-means++: spread the starting colours out
    let sum = 0;
    points.forEach((p, i) => { d[i] = Math.min(d[i], dist2(p, cents[cents.length - 1])); sum += d[i]; });
    let t = r() * sum, i = 0;
    while (i < points.length - 1 && (t -= d[i]) > 0) i++;
    cents.push(points[i].slice());
  }
  const assign = new Int32Array(points.length);
  for (let iter = 0; iter < 12; iter++) {
    points.forEach((p, i) => {
      let best = 0, bd = Infinity;
      cents.forEach((c, j) => { const dd = dist2(p, c); if (dd < bd) { bd = dd; best = j; } });
      assign[i] = best;
    });
    const sums = cents.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => { const s = sums[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sums.forEach((s, j) => { if (s[3]) cents[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  return cents;
}

// ---------- conversion ----------

/**
 * o: { colours, removeBg, bgTolerance, dither, light, mid, dark (TONE_STITCHES keys),
 *      lightShare, darkShare (0..1 of the picture), outline, outlineStrength (0..1) }
 * Returns plain data: { cols, rows, palette, blocks, stitches, regions, backs }.
 */
export function convertPicture({ cols, rows, rgba }, o) {
  const n = cols * rows, idx = (x, y) => y * cols + x;
  const lab = new Array(n), bg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    lab[i] = srgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (rgba[i * 4 + 3] < 128) bg[i] = 1;
  }

  // Background: the colour around the border, flooded inward only where it stays close,
  // so a white highlight inside the subject survives.
  if (o.removeBg) {
    const border = [];
    for (let x = 0; x < cols; x++) border.push(idx(x, 0), idx(x, rows - 1));
    for (let y = 0; y < rows; y++) border.push(idx(0, y), idx(cols - 1, y));
    const med = [0, 1, 2].map((c) => { const v = border.map((i) => lab[i][c]).sort((a, b) => a - b); return v[v.length >> 1]; });
    const tol2 = o.bgTolerance ** 2, stack = border.filter((i) => dist2(lab[i], med) < tol2);
    stack.forEach((i) => { bg[i] = 1; });
    while (stack.length) {
      const i = stack.pop(), x = i % cols, y = (i / cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = idx(nx, ny);
        if (!bg[j] && dist2(lab[j], med) < tol2) { bg[j] = 1; stack.push(j); }
      }
    }
  }
  const fg = [];
  for (let i = 0; i < n; i++) if (!bg[i]) fg.push(i);
  if (!fg.length) return { cols, rows, palette: [], blocks: new Map(), stitches: new Map(), regions: [], backs: [] };

  // Colours: k-means, then snap each centre to the nearest floss; centres that land on the same floss merge.
  const cents = kmeans(fg.map((i) => lab[i]), o.colours, 7);
  const chosen = [...new Set(cents.map((c) => {
    let best = 0, bd = Infinity;
    FLOSS_LAB.forEach((f, j) => { const d = dist2(c, f); if (d < bd) { bd = d; best = j; } });
    return best;
  }))];
  const palLab = chosen.map((j) => FLOSS_LAB[j]);
  const nearest = (p) => { let best = 0, bd = Infinity; palLab.forEach((c, j) => { const d = dist2(p, c); if (d < bd) { bd = d; best = j; } }); return best; };

  const assign = new Int32Array(n).fill(-1);
  if (o.dither) {
    // Floyd–Steinberg in Lab, serpentine, spreading error only into the subject
    const work = lab.map((p) => p.slice());
    for (let y = 0; y < rows; y++) {
      const ltr = y % 2 === 0;
      for (let k = 0; k < cols; k++) {
        const x = ltr ? k : cols - 1 - k, i = idx(x, y);
        if (bg[i]) continue;
        const a = nearest(work[i]);
        assign[i] = a;
        const err = [0, 1, 2].map((c) => work[i][c] - palLab[a][c]);
        const dir = ltr ? 1 : -1;
        for (const [dx, dy, w] of [[dir, 0, 7 / 16], [-dir, 1, 3 / 16], [0, 1, 5 / 16], [dir, 1, 1 / 16]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || bg[idx(nx, ny)]) continue;
          const t = work[idx(nx, ny)];
          for (let c = 0; c < 3; c++) t[c] += err[c] * w;
        }
      }
    }
  } else {
    for (const i of fg) assign[i] = nearest(lab[i]);
  }

  // Tones from the picture's own lightness, split by share of the subject.
  const Ls = fg.map((i) => lab[i][0]).sort((a, b) => a - b);
  const q = (t) => Ls[Math.min(Ls.length - 1, Math.max(0, Math.floor(t * Ls.length)))];
  const darkCut = o.darkShare > 0 ? q(o.darkShare) : -Infinity;
  const lightCut = o.lightShare > 0 ? q(1 - o.lightShare) : Infinity;
  const band = new Int8Array(n).fill(-1);   // 0 light, 1 mid, 2 dark
  for (const i of fg) band[i] = lab[i][0] >= lightCut ? 0 : lab[i][0] <= darkCut ? 2 : 1;
  const kinds = [o.light, o.mid, o.dark];

  const hexOf = (a) => FLOSS[chosen[a]].hex;
  const blocks = new Map(), stitches = new Map(), counts = new Array(chosen.length).fill(0);
  for (const i of fg) {
    const key = `${i % cols},${(i / cols) | 0}`, kind = kinds[band[i]];
    blocks.set(key, hexOf(assign[i]));
    counts[assign[i]]++;
    if (CELL_KINDS.has(kind)) stitches.set(key, { type: kind, color: hexOf(assign[i]), q: 0 });
  }

  // Fills: one region per connected patch of the same floss in the same band.
  const L = (x, y) => lab[idx(Math.min(cols - 1, Math.max(0, x)), Math.min(rows - 1, Math.max(0, y)))][0];
  const regions = [], seen = new Uint8Array(n);
  for (const start of fg) {
    const kind = kinds[band[start]];
    if (seen[start] || kind === 'none' || CELL_KINDS.has(kind)) continue;
    const cells = new Set(), stack = [start];
    let jxx = 0, jyy = 0, jxy = 0;
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % cols, y = (i / cols) | 0;
      cells.add(`${x},${y}`);
      // structure tensor of the picture's lightness: which way do its edges run here?
      const gx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1));
      const gy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1));
      jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = idx(nx, ny);
        if (!seen[j] && !bg[j] && assign[j] === assign[start] && band[j] === band[start]) { seen[j] = 1; stack.push(j); }
      }
    }
    // a fill needs room to read; specks of a few squares become crosses instead
    if (cells.size < 4) {
      for (const key of cells) stitches.set(key, { type: 'full', color: hexOf(assign[start]), q: 0 });
      continue;
    }
    // satin runs along the edges, at right angles to the strongest change in lightness
    const angle = jxx + jyy > 1e-3 ? 0.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2 : 0;
    regions.push({ kind, color: hexOf(assign[start]), cells, angle });
  }

  // Outline: backstitch along square edges where the subject meets the background,
  // and between colours that differ enough (a lower strength only keeps the strongest edges).
  // Edges come from the undithered colours, so dither speckle doesn't get boxed in.
  const backs = [];
  if (o.outline) {
    const flat = new Int32Array(n).fill(-1);
    for (const i of fg) flat[i] = nearest(lab[i]);
    const minDiff2 = (60 - 50 * o.outlineStrength) ** 2;
    const edge = (i, j) => {
      if (bg[i] && bg[j]) return -1;
      if (bg[i] || bg[j]) return bg[i] ? flat[j] : flat[i];
      if (flat[i] === flat[j] || dist2(palLab[flat[i]], palLab[flat[j]]) <= minDiff2) return -1;
      return palLab[flat[i]][0] < palLab[flat[j]][0] ? flat[i] : flat[j];   // stitched in the darker side's colour
    };
    const add = (a, b, side) => { if (side >= 0) backs.push({ a, b, color: FLOSS[darkerShade(chosen[side])].hex }); };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y);
        if (x + 1 < cols) add([x + 1, y], [x + 1, y + 1], edge(i, idx(x + 1, y)));
        if (y + 1 < rows) add([x, y + 1], [x + 1, y + 1], edge(i, idx(x, y + 1)));
      }
    }
  }

  const palette = chosen.map((j, a) => ({ name: FLOSS[j].name, hex: FLOSS[j].hex, count: counts[a], L: palLab[a][0] }))
    .filter((p) => p.count).sort((a, b) => b.count - a.count);
  // outline threads go on the shopping list too, counted in backstitches
  const outlines = new Map();
  for (const b of backs) outlines.set(b.color, (outlines.get(b.color) || 0) + 1);
  for (const [hex, count] of outlines) {
    const f = FLOSS.find((x) => x.hex === hex);
    palette.push({ name: f.name, hex, count, L: hexToLab(hex)[0], outline: true });
  }
  return { cols, rows, palette, blocks, stitches, regions, backs };
}
