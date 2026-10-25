// Shared thread drawing helpers.
// These are SVG approximations used by the mockup screens. The real renderer
// (WebGL, instanced stitches, spring physics, per-stitch wear) replaces them —
// see CLAUDE.md "Build order".

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * One counted cross stitch, drawn in a size×size cell.
 * Under leg (/) first in the darker shade, top leg (\) on top — the way
 * stitchers keep every top leg running the same direction.
 */
export function crossSVG(size, { base, dark, light, half = false, worn = false, sheen } = {}) {
  const k = size / 22;
  const a = 3.5 * k, b = size - 3.5 * k;
  const w = 4.4 * k, sw = 5 * k;
  const dash = worn ? `${3 * k} ${1.2 * k} ${5 * k} ${1 * k}` : 'none';
  const sh = sheen ?? (worn ? 0.15 : 0.85);
  const shadow = `translate(${0.8 * k} ${1.2 * k})`;
  let s = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`;
  s += `<line x1="${a}" y1="${b}" x2="${b}" y2="${a}" stroke="rgba(40,24,10,.28)" stroke-width="${sw}" stroke-linecap="round" transform="${shadow}"/>`;
  s += `<line x1="${a}" y1="${b}" x2="${b}" y2="${a}" stroke="${half ? base : dark}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${dash}"/>`;
  if (!half) {
    s += `<line x1="${a}" y1="${a}" x2="${b}" y2="${b}" stroke="rgba(40,24,10,.3)" stroke-width="${sw}" stroke-linecap="round" transform="${shadow}"/>`;
    s += `<line x1="${a}" y1="${a}" x2="${b}" y2="${b}" stroke="${base}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${dash}"/>`;
    s += `<line x1="${a + 1.1 * k}" y1="${a - 0.1 * k}" x2="${b - 0.3 * k}" y2="${b - 1.5 * k}" stroke="${light}" stroke-width="${1.1 * k}" stroke-linecap="round" stroke-dasharray="${1.6 * k} ${2.2 * k}" opacity="${sh}"/>`;
  } else {
    s += `<line x1="${a + 1.1 * k}" y1="${b - 0.1 * k}" x2="${b - 0.3 * k}" y2="${a + 1.5 * k}" stroke="${light}" stroke-width="${1.1 * k}" stroke-linecap="round" stroke-dasharray="${1.6 * k} ${2.2 * k}" opacity="${sh * 0.6}"/>`;
  }
  if (worn) {
    s += `<path d="M${14 * k} ${8 * k}l${4 * k} ${-3 * k}M${16 * k} ${12 * k}l${5 * k} ${1 * k}M${7 * k} ${15 * k}l${-4 * k} ${3 * k}" stroke="${base}" stroke-width="${0.8 * k}" stroke-linecap="round" opacity=".8" fill="none"/>`;
  }
  return s + '</svg>';
}

/** Lay out a list of {x, y, ...colours} cells as absolutely positioned stitches. */
export function cellsHTML(cells, size) {
  let out = '';
  for (const c of cells) {
    out += `<div class="cell" style="left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px">${crossSVG(size, c)}</div>`;
  }
  return out;
}

/** The strawberry motif used across the screens (12×12). */
export const STRAWBERRY = [
  '....GG.G....',
  '...GgGGG....',
  '..RRGgGRR...',
  '.RRRRRRRRR..',
  '.RRyRRRyRRR.',
  'RRRRRRRRRRR.',
  'RRyRRRRyRRR.',
  '.RRRRyRRRR..',
  '.RDRRRRRRR..',
  '..RRyRRDR...',
  '...RDRRR....',
  '....RRR.....'
];
export const STRAWBERRY_PALETTE = {
  R: ['#C8343B', '#8E1D24', '#F08A8E'],
  D: ['#8E1D24', '#5E1016', '#C4545A'],
  G: ['#4F8A4B', '#2F5A35', '#A6D49A'],
  g: ['#2F5A35', '#1E3B23', '#6FA36A'],
  y: ['#F2D06B', '#C9A13A', '#FFF3C4']
};

export function gridToCells(grid, palette, size, wornSet = {}) {
  const cells = [];
  grid.forEach((row, r) => row.split('').forEach((ch, c) => {
    if (ch === '.') return;
    const p = palette[ch];
    cells.push({ x: c * size, y: r * size, base: p[0], dark: p[1], light: p[2], worn: !!wornSet[`${r}-${c}`] });
  }));
  return cells;
}

// ---------- close-up: magnified two-strand stitch with wear stages ----------

const rnd = (seed) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };
const WEAR_COL = { base: '#C8343B', dark: '#8E1D24', light: '#F7A3A6', dullBase: '#B3474C', dullDark: '#84302F' };

/**
 * Stages: 0 fresh · 1 dulled · 2 fuzzed · 3 split · 4 snapped.
 * Returns SVG markup (no wrapper) for one cross stitch at (ox, oy).
 */
export function wornStitchSVG(ox, oy, size, stage, seed) {
  const k = size / 100;
  const pad = 12 * k;
  const legs = [
    [ox + pad, oy + size - pad, ox + size - pad, oy + pad, true],
    [ox + pad, oy + pad, ox + size - pad, oy + size - pad, false]
  ];
  const dull = stage >= 1;
  const base = dull ? WEAR_COL.dullBase : WEAR_COL.base;
  const dark = dull ? WEAR_COL.dullDark : WEAR_COL.dark;
  const sheen = stage === 0 ? 0.95 : (stage === 1 ? 0.35 : 0.2);
  const spread = (stage >= 3 ? 7.5 : 2.8) * k;
  let s = '';
  const line = (x1, y1, x2, y2, c, w, dash = 'none', off = 0, op = 1) =>
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w.toFixed(2)}" stroke-linecap="round" stroke-dasharray="${dash}" stroke-dashoffset="${off}" opacity="${op}"/>`;
  const path = (d, c, w, op = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w.toFixed(2)}" stroke-linecap="round" opacity="${op}"/>`;
  const hairs = [];

  legs.forEach(([x1, y1, x2, y2, under], li) => {
    const dx = x2 - x1, dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    const px = -dy / L, py = dx / L;
    [-1, 1].forEach((sgn, si) => {
      const ox2 = px * sgn * spread, oy2 = py * sgn * spread;
      const segs = (stage === 4 && !under && si === 1) ? [[0, 0.38], [0.62, 1]] : [[0, 1]];
      for (const [a, b] of segs) {
        const ax = x1 + dx * a + ox2, ay = y1 + dy * a + oy2, bx = x1 + dx * b + ox2, by = y1 + dy * b + oy2;
        s += line(ax + 1.2 * k, ay + 2 * k, bx + 1.2 * k, by + 2 * k, 'rgba(40,24,10,.28)', 6.4 * k);
        s += line(ax, ay, bx, by, under ? dark : base, (stage >= 3 ? 4.6 : 5.6) * k);
        s += line(ax, ay, bx, by, WEAR_COL.light, 1.5 * k, `${3.2 * k} ${4.2 * k}`, 0, under ? sheen * 0.5 : sheen);
        s += line(ax, ay, bx, by, 'rgba(60,10,14,.55)', 1.2 * k, `${2.2 * k} ${5.2 * k}`, 3.6 * k);
      }
      if (stage >= 2) {
        const n = stage === 2 ? 5 : 9;
        for (let h = 0; h < n; h++) {
          const t = 0.12 + 0.76 * rnd(seed + li * 31 + si * 7 + h);
          const hx = x1 + dx * t + ox2, hy = y1 + dy * t + oy2;
          const dir = rnd(seed + h * 3 + li) > 0.5 ? 1 : -1;
          const len = (4 + 7 * rnd(seed + h * 5 + si)) * k;
          const bend = (rnd(seed + h * 11) - 0.5) * 6 * k;
          hairs.push(path(`M${hx.toFixed(1)} ${hy.toFixed(1)} q ${(px * dir * len * 0.5 + bend).toFixed(1)} ${(py * dir * len * 0.5 - bend).toFixed(1)} ${(px * dir * len).toFixed(1)} ${(py * dir * len).toFixed(1)}`, base, 0.8 * k, 0.85));
        }
      }
      if (stage === 4 && !under && si === 1) {
        const m1x = x1 + dx * 0.38 + ox2, m1y = y1 + dy * 0.38 + oy2;
        const m2x = x1 + dx * 0.62 + ox2, m2y = y1 + dy * 0.62 + oy2;
        hairs.push(path(`M${m1x.toFixed(1)} ${m1y.toFixed(1)} c ${6 * k} ${2 * k} ${10 * k} ${10 * k} ${5 * k} ${16 * k}`, base, 2.6 * k));
        hairs.push(path(`M${m2x.toFixed(1)} ${m2y.toFixed(1)} c ${-7 * k} ${-1 * k} ${-12 * k} ${-9 * k} ${-7 * k} ${-15 * k}`, base, 2.6 * k));
      }
    });
  });
  return s + hairs.join('');
}

// ---------- stitch picker icons ----------
export const COUNTED = [
  ['full', 'Full cross', 'M6 6L18 18M18 6L6 18'],
  ['half', 'Half', 'M6 18L18 6'],
  ['quarter', 'Quarter', 'M6 18L12 12'],
  ['tq', '¾ cross', 'M6 18L18 6M6 6L12 12'],
  ['back', 'Backstitch', 'M3 12h5.5M9.5 12h5M15.5 12h5.5'],
  ['knot', 'French knot', 'M12 8.5a3.5 3.5 0 1 0 0.01 0M12 12h.01']
];
export const FREEFORM = [
  ['running', 'Running', 'M2 12h3.5M8.5 12h3.5M15 12h3.5'],
  ['stem', 'Stem', 'M4 17l5-3M8 15l5-3M12 13l5-3M16 11l4-2.5'],
  ['split', 'Split', 'M3 13c3-2 5-2 8 0s5 2 8 0M7 10v6M15 10v6'],
  ['chain', 'Chain', 'M3 12c2-4 6-4 6 0s-4 4-6 0M9 12c2-4 6-4 6 0s-4 4-6 0M15 12c2-4 6-4 6 0'],
  ['satin', 'Satin', 'M5 9l6-5M5 14l10-9M6 19l13-11M11 20l8-7'],
  ['daisy', 'Lazy daisy', 'M12 21C6 15 8 6 12 3C16 6 18 15 12 21Z']
];
export const icon = (d, size = 20, sw = 1.8) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
