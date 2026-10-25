// Region fills: long stitches laid across a shape of squares, not one stitch per square.
// Each generator returns legs { a, b, layer, ea, eb, tone }: ea/eb say whether that end
// goes into the fabric (pinched) or carries on as the same thread; tone scales the colour.

export const REGION_FILLS = {
  rows: ['Rows', 'Long horizontal stitches laid side by side. Turn density up for solid satin.'],
  columns: ['Columns', 'Long vertical stitches laid side by side.'],
  hatch: ['Hatch /', 'Long diagonal stitches, all leaning the same way.'],
  weave3: ['Weave 3×3', 'Threads woven over and under each other, open.'],
  weave5: ['Weave 5×5', 'A tighter over-and-under weave.'],
  diamond: ['Weave ◇', 'Diagonal threads woven over and under.'],
  blocks: ['Blocks', 'Satin blocks of 2×2 squares that alternate direction.'],
  fern: ['Fern', 'Columns of V-shaped stitches, like the leaves in a fern.'],
  seed: ['Seed', 'Short stitches scattered at random angles.'],
  knots: ['Knots', 'French knots dotted through the shape.'],
  burst: ['Burst', 'Straight stitches radiating from the centre of the shape.']
};

const has = (mask, x, y) => mask.has(`${Math.floor(x)},${Math.floor(y)}`);

function bounds(mask) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of mask) {
    const [x, y] = k.split(',').map(Number);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  return { x0, y0, x1, y1 };
}

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A family of parallel lines at angle θ, `s` apart, clipped to the mask.
 * Returns { j, segs: [[u0, u1]] } in the rotated frame where a point is dA*u + nA*v.
 */
function family(mask, bb, theta, s, phase = 0.5) {
  const dA = [Math.cos(theta), Math.sin(theta)], nA = [-dA[1], dA[0]];
  const corners = [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x0, bb.y1], [bb.x1, bb.y1]];
  const us = corners.map((p) => p[0] * dA[0] + p[1] * dA[1]), vs = corners.map((p) => p[0] * nA[0] + p[1] * nA[1]);
  const u0 = Math.min(...us), u1 = Math.max(...us), step = 0.03;
  const lines = [];
  for (let j = Math.ceil(Math.min(...vs) / s - phase); (j + phase) * s < Math.max(...vs); j++) {
    const v = (j + phase) * s, segs = [];
    let start = null;
    for (let u = u0; u <= u1 + step; u += step) {
      const inside = u <= u1 && has(mask, dA[0] * u + nA[0] * v, dA[1] * u + nA[1] * v);
      if (inside && start === null) start = u;
      if (!inside && start !== null) { if (u - step - start > 0.15) segs.push([start, u - step]); start = null; }
    }
    if (segs.length) lines.push({ j, v, segs });
  }
  return { dA, nA, lines };
}
const pt = (f, u, v) => [f.dA[0] * u + f.nA[0] * v, f.dA[1] * u + f.nA[1] * v];

/** Satin-style lines: one stitch per segment, both ends into the fabric. */
function laid(mask, theta, s, layer = 0) {
  const f = family(mask, bounds(mask), theta, s);
  const legs = [];
  for (const line of f.lines) for (const [u0, u1] of line.segs) legs.push({ a: pt(f, u0, line.v), b: pt(f, u1, line.v), layer, ea: 1, eb: 1 });
  return legs;
}

/**
 * Woven: two families at right angles. Each thread is split at the midpoints between
 * crossings so every piece holds one crossing; parity decides whether it passes over or under.
 */
function woven(mask, theta, s) {
  const bb = bounds(mask), legs = [];
  const A = family(mask, bb, theta, s), B = family(mask, bb, theta + Math.PI / 2, s);
  const weaveFamily = (f, other, flip) => {
    for (const line of f.lines) {
      for (const [u0, u1] of line.segs) {
        // the other family's lines cross this one at u = their v (sign depends on orientation)
        const cross = other.lines.map((o) => ({ u: flip ? -o.v : o.v, j: o.j })).filter((c) => c.u > u0 && c.u < u1).sort((a, b) => a.u - b.u);
        if (!cross.length) { legs.push({ a: pt(f, u0, line.v), b: pt(f, u1, line.v), layer: 0, ea: 1, eb: 1 }); continue; }
        cross.forEach((c, k) => {
          const from = k === 0 ? u0 : (cross[k - 1].u + c.u) / 2, to = k === cross.length - 1 ? u1 : (c.u + cross[k + 1].u) / 2;
          const over = ((line.j + c.j) % 2 + 2) % 2 === (flip ? 1 : 0);
          legs.push({ a: pt(f, from, line.v), b: pt(f, to, line.v), layer: over ? 1 : 0, ea: k === 0 ? 1 : 0, eb: k === cross.length - 1 ? 1 : 0 });
        });
      }
    }
  };
  // In A's frame, B's lines sit at u = -v_B; in B's frame, A's lines sit at u = v_A.
  weaveFamily(A, B, true);
  weaveFamily(B, A, false);
  return legs;
}

/** All legs for a region. W is the thread width in squares; density 0 (open) … 1 (solid). */
export function regionLegs(kind, mask, density, seed, W) {
  const r = rng(seed), mix = (a, b) => a + (b - a) * density;
  const area = mask.size;
  switch (kind) {
    case 'rows': return laid(mask, 0, mix(0.6, W * 0.85));
    case 'columns': return laid(mask, Math.PI / 2, mix(0.6, W * 0.85));
    case 'hatch': return laid(mask, -Math.PI / 4, mix(0.6, W * 0.85));
    case 'weave3': return woven(mask, 0, mix(1.4, 0.75));
    case 'weave5': return woven(mask, 0, mix(0.9, 0.42));
    case 'diamond': return woven(mask, Math.PI / 4, mix(1.1, 0.55));
    case 'blocks': {
      const legs = [], blocks = new Map();
      for (const k of mask) {
        const [x, y] = k.split(',').map(Number), bk = `${Math.floor(x / 2)},${Math.floor(y / 2)}`;
        if (!blocks.has(bk)) blocks.set(bk, new Set());
        blocks.get(bk).add(k);
      }
      for (const [bk, cells] of blocks) {
        const [bx, by] = bk.split(',').map(Number);
        legs.push(...laid(cells, (bx + by) % 2 ? Math.PI / 2 : 0, mix(0.5, W * 0.85)));
      }
      return legs;
    }
    case 'fern': {
      const bb = bounds(mask), s = mix(1.0, 0.5), w = s * 0.45, step = mix(0.45, 0.28), legs = [];
      for (let x = bb.x0 + s / 2; x < bb.x1; x += s) {
        for (let y = bb.y0 + 0.1; y < bb.y1; y += step) {
          const tip = [x, y + w * 0.9];
          for (const side of [-1, 1]) {
            const a = [x + side * w, y];
            if (has(mask, ...a) && has(mask, ...tip)) legs.push({ a, b: tip, layer: side > 0 ? 1 : 0, ea: 1, eb: 1 });
          }
        }
      }
      return legs;
    }
    case 'seed': {
      const cells = [...mask], legs = [], n = Math.round(area * mix(1.2, 5));
      for (let i = 0; i < n; i++) {
        const [cx, cy] = cells[Math.floor(r() * cells.length)].split(',').map(Number);
        const c = [cx + r(), cy + r()], ang = r() * Math.PI, len = 0.28 + r() * 0.22;
        const a = [c[0] - Math.cos(ang) * len / 2, c[1] - Math.sin(ang) * len / 2], b = [c[0] + Math.cos(ang) * len / 2, c[1] + Math.sin(ang) * len / 2];
        if (has(mask, ...a) && has(mask, ...b)) legs.push({ a, b, layer: i % 2, ea: 1, eb: 1, tone: 0.85 + r() * 0.3 });
      }
      return legs;
    }
    case 'knots': {
      // A French knot reads as a tight coil: a five-point star of very short wraps.
      const cells = [...mask], legs = [], n = Math.round(area * mix(0.4, 1.8)), rad = W * 0.6;
      for (let i = 0; i < n; i++) {
        const [cx, cy] = cells[Math.floor(r() * cells.length)].split(',').map(Number);
        const c = [cx + 0.15 + r() * 0.7, cy + 0.15 + r() * 0.7], rot = r() * Math.PI * 2;
        const ring = Array.from({ length: 5 }, (_, k) => [c[0] + Math.cos(rot + k * 1.2566) * rad, c[1] + Math.sin(rot + k * 1.2566) * rad]);
        ring.forEach((p, k) => legs.push({ a: p, b: ring[(k + 2) % 5], layer: 1, ea: 1, eb: 1, tone: 0.92 + r() * 0.16 }));
      }
      return legs;
    }
    case 'burst': {
      const bb = bounds(mask), c = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2];
      const R = Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 * 0.96, n = Math.round(mix(14, 48)), legs = [];
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + r() * 0.08, len = R * (0.82 + r() * 0.18);
        const a = [c[0] + Math.cos(ang) * len, c[1] + Math.sin(ang) * len], b = [c[0] + Math.cos(ang) * 0.06, c[1] + Math.sin(ang) * 0.06];
        if (has(mask, ...a)) legs.push({ a, b, layer: k % 2, ea: 1, eb: 1 });
      }
      return legs;
    }
    default: return [];
  }
}
