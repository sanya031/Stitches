// Thread lab: a small cross-stitch editor on top of the WebGL2 thread renderer.
import { createRenderer, LAYERS } from './renderer.js';

// The strawberry starter pattern, same motif as the mockup screens (12×12).
const STRAWBERRY = [
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
const CHART_COLOURS = { R: '#C8343B', D: '#8E1D24', G: '#4F8A4B', g: '#2F5A35', y: '#F2D06B' };

const COLS = 40, ROWS = 30;
const ZOOM_MIN = 2, ZOOM_MAX = 700;
const PRESETS = { far: 4, mid: 26, close: 200 };
const STRAND_MM = 0.27;   // visible width of one strand of stranded cotton, lying flat

const THREADS = [
  ['Strawberry', '#C8343B'], ['Garnet', '#8E1D24'], ['Coral', '#E8735A'], ['Blush', '#F2A7A0'], ['Rust', '#B5562B'], ['Tobacco', '#7A4A2A'],
  ['Butter', '#F2D06B'], ['Mustard', '#D9A23A'], ['Lime', '#A8C64A'], ['Moss', '#8DAA3C'], ['Leaf', '#4F8A4B'], ['Pine', '#2F5A35'],
  ['Teal', '#2E8C8A'], ['Sky', '#6FA8DC'], ['Navy', '#24345C'], ['Lavender', '#9C88C9'], ['Plum', '#6B2F5E'], ['Ecru', '#EADFC8'],
  ['Pearl grey', '#B9B6AE'], ['Charcoal', '#3A3836']
];
const SURFACES = {
  dots: { id: 0, name: 'Dot grid', color: '#F2EEE6' },
  aida: { id: 1, name: 'Aida', color: '#F4F2EC' },
  linen: { id: 2, name: 'Linen', color: '#D9CCB2' },
  denim: { id: 3, name: 'Denim', color: '#3C5A86' }
};
const STITCH_TYPES = {
  full: ['Full cross', 'An X over one square. The everyday stitch.'],
  half: ['Half stitch', 'One diagonal. Lighter, for shading and backgrounds.'],
  quarter: ['Quarter', 'Corner to centre. Click near the corner you want.'],
  threeq: ['Three-quarter', 'Half plus a quarter, for smooth curved edges. Click near the corner.'],
  back: ['Backstitch', 'A straight line from hole to hole, for outlines. Drag to draw.']
};
const FILLS = {
  'f-cross': ['Cross', 'Solid crosses.'],
  'f-hatch': ['Hatch', 'Parallel diagonals.'],
  'f-rows': ['Rows', 'Horizontal bars, row by row.'],
  'f-columns': ['Columns', 'Vertical bars, column by column.'],
  'f-weave': ['Weave', 'Basketweave: blocks of bars that alternate direction.'],
  'f-tweed': ['Tweed', 'Crosses in mixed light and dark tones of the thread.']
};

const state = {
  tool: 'stitch', stitch: 'full', fill: 'f-weave', eraseWhat: 'stitches', color: '#C8343B', strands: 2, count: 14,
  surface: 'dots', twist: 0.2, sheen: 0.3, fuzz: 0.5, guide: true, paletteOpen: false
};
let recents = ['#C8343B', '#8E1D24', '#4F8A4B', '#2F5A35', '#F2D06B'];

// ---------- piece data ----------

let stitches = new Map();   // "x,y" -> { type, color, q }
let backs = [];             // { a: [x, y], b: [x, y], color }
let blocks = new Map();     // "x,y" -> colour: the pattern you plan to stitch
const history = [];

const ox = 14, oy = 9;
STRAWBERRY.forEach((row, y) => row.split('').forEach((ch, x) => {
  if (CHART_COLOURS[ch]) blocks.set(`${x + ox},${y + oy}`, CHART_COLOURS[ch]);
}));
// Start half-stitched, like a kit in progress: top rows done, the rest still to stitch.
for (const [key, color] of blocks) if (Number(key.split(',')[1]) < oy + 6) stitches.set(key, { type: 'full', color, q: 0 });

function snapshot() {
  history.push({ stitches: new Map(stitches), backs: backs.slice(), blocks: new Map(blocks) });
  if (history.length > 100) history.shift();
}
function undo() {
  const prev = history.pop();
  if (!prev) return;
  ({ stitches, backs, blocks } = prev);
  sceneDirty = guideDirty = true;
}

// ---------- seeded randomness, so a stitch looks the same every time it is rebuilt ----------

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (rgb) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
const threadWidth = () => state.strands * STRAND_MM * state.count / 25.4;
const threadName = (c) => (THREADS.find(([, h]) => h.toLowerCase() === c.toLowerCase()) || ['Custom'])[0];

/** Legs for one square: [from, to, layer]. Layer 0 is under, 1 is top, 2 is backstitch. */
function legsOf(x, y, st) {
  const TL = [x, y], TR = [x + 1, y], BL = [x, y + 1], BR = [x + 1, y + 1], C = [x + 0.5, y + 0.5];
  const corner = [TL, TR, BL, BR][st.q || 0];
  switch (st.type) {
    case 'full': case 'f-cross': case 'f-tweed': return [[BL, TR, 0], [TL, BR, 1]];   // every top leg runs the same way: \
    case 'half': case 'f-hatch': return [[BL, TR, 0]];
    case 'quarter': return [[corner, C, 1]];
    case 'threeq': return [st.q === 0 || st.q === 3 ? [BL, TR, 0] : [TL, BR, 0], [corner, C, 1]];
    case 'f-rows': return [[[x, y + 0.5], [x + 1, y + 0.5], 0]];
    case 'f-columns': return [[[x + 0.5, y], [x + 0.5, y + 1], 0]];
    case 'f-weave': return (x + y) % 2 === 0
      ? [[[x, y + 0.28], [x + 1, y + 0.28], 0], [[x, y + 0.72], [x + 1, y + 0.72], 0]]
      : [[[x + 0.28, y], [x + 0.28, y + 1], 0], [[x + 0.72, y], [x + 0.72, y + 1], 0]];
    default: return [];
  }
}

/** Tweed: each leg picks a lighter, darker or true tone of the thread. */
function tweedTone(rgb, r) {
  const k = r();
  return k < 0.33 ? rgb.map((c) => c * 0.7) : k < 0.66 ? rgb.map((c) => c + (1 - c) * 0.38) : rgb;
}

function buildScene() {
  const layers = Array.from({ length: LAYERS }, () => []);
  const hairs = [];
  const W = threadWidth();

  const addLeg = (layer, a0, b0, rgb, r) => {
    const j = (amt) => (r() - 0.5) * 2 * amt;
    const a = [a0[0] + j(0.015), a0[1] + j(0.015)], b = [b0[0] + j(0.015), b0[1] + j(0.015)];
    layers[layer].push(a[0], a[1], b[0], b[1], ...rgb.map((c) => c * (1 + j(0.03))), r(), j(0.014), 1 + j(0.06));

    const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]);
    const A = [d[0] / L, d[1] / L], N = [-A[1], A[0]];
    const at = (u, side) => [a[0] + d[0] * u + N[0] * side * W * 0.4, a[1] + d[1] * u + N[1] * side * W * 0.4];
    const light = rgb.map((c) => Math.min(1, c * 1.1 + 0.04));
    const count = Math.round(5 * L);
    for (let k = 0; k < count; k++) {
      const u = 0.12 + r() * 0.76, side = r() < 0.5 ? -1 : 1;
      const p0 = at(u, side), out = [N[0] * side, N[1] * side];
      const loop = r() < 0.4;
      let p1, p2;
      if (loop) {
        const h = 0.02 + r() * 0.04;
        p1 = [p0[0] + out[0] * h + A[0] * 0.04, p0[1] + out[1] * h + A[1] * 0.04];
        p2 = at(Math.min(0.92, u + (0.05 + r() * 0.07) / L), side);
      } else {
        const r1 = 0.03 + r() * 0.05, r2 = 0.05 + r() * 0.12, along = j(0.1);
        p1 = [p0[0] + out[0] * r1 + A[0] * along * 0.5, p0[1] + out[1] * r1 + A[1] * along * 0.5];
        p2 = [p0[0] + out[0] * r2 + A[0] * along + j(0.03), p0[1] + out[1] * r2 + A[1] * along + j(0.03)];
      }
      hairs.push(...p0, ...p1, ...p2, 0.004 + r() * 0.004, 0.45 + r() * 0.3, ...light, loop ? 1 : 0);
    }
  };

  for (const [key, st] of stitches) {
    const [x, y] = key.split(',').map(Number);
    const r = rng(hashStr(key + st.type + st.q));
    const rgb = hex(st.color);
    for (const [a, b, layer] of legsOf(x, y, st)) addLeg(layer, a, b, st.type === 'f-tweed' ? tweedTone(rgb, r) : rgb, r);
  }
  for (const bk of backs) addLeg(2, bk.a, bk.b, hex(bk.color), rng(hashStr(`b${bk.a}${bk.b}`)));

  renderer.setStitches(layers.map((l) => new Float32Array(l)), new Float32Array(hairs));
}

function buildFabricHairs() {
  const r = rng(99), hairs = [];
  const cloth = state.surface === 'denim' ? [0.82, 0.84, 0.88] : hex(SURFACES[state.surface].color);
  for (let i = 0; i < 1400; i++) {
    const p0 = [r() * COLS, r() * ROWS];
    const ang = r() * Math.PI * 2, len = 0.06 + r() * 0.22, curl = (r() - 0.5) * 0.16;
    const dir = [Math.cos(ang), Math.sin(ang)];
    const p2 = [p0[0] + dir[0] * len, p0[1] + dir[1] * len];
    const p1 = [(p0[0] + p2[0]) / 2 - dir[1] * curl, (p0[1] + p2[1]) / 2 + dir[0] * curl];
    const tone = 0.97 + r() * 0.05;
    hairs.push(...p0, ...p1, ...p2, 0.004 + r() * 0.003, 0.35 + r() * 0.3, ...cloth.map((c) => Math.min(1, c * tone)), 0);
  }
  renderer.setFabricHairs(new Float32Array(hairs));
}

function buildGuide() {
  const data = new Uint8Array(COLS * ROWS * 4);
  for (const [key, color] of blocks) {
    const [x, y] = key.split(',').map(Number);
    const i = (y * COLS + x) * 4;
    hex(color).forEach((v, k) => { data[i + k] = Math.round(v * 255); });
    data[i + 3] = 255;
  }
  renderer.setGuide(COLS, ROWS, data);
}

// ---------- setup ----------

const stage = document.querySelector('.stage');
const canvas = document.getElementById('gl');
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');
const renderer = createRenderer(canvas);
if (!renderer) {
  canvas.hidden = true;
  document.getElementById('fallback').style.display = 'grid';
  throw new Error('WebGL2 unavailable');
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LIGHT = norm([-0.45, -0.55, 0.7]);
const cam = { x: COLS / 2, y: ROWS / 2, z: 1 };   // z: CSS px per stitch
let anim = null, dirty = true, sceneDirty = true, guideDirty = true, overlayDirty = true;
let view = { w: 1, h: 1 };
let hover = null;          // { wx, wy } under the pointer
let drag = null;           // { a: start point } while dragging a backstitch or fill rectangle

function norm(v) { const l = Math.hypot(...v); return v.map((c) => c / l); }
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const fitZoom = () => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(view.w / (COLS + 4), view.h / (ROWS + 4))));
const lifeSize = () => (25.4 / state.count) / (25.4 / 96);   // CSS px per stitch at 1:1
let fitted = false;

function resize() {
  const r = stage.getBoundingClientRect();
  view = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  for (const c of [canvas, overlay]) {
    c.width = Math.max(1, Math.round(view.w * dpr()));
    c.height = Math.max(1, Math.round(view.h * dpr()));
  }
  // a page opened in a hidden or zero-size frame gets its first real size later
  if (!fitted && r.width > 0 && r.height > 0) { cam.z = fitZoom(); fitted = true; }
  dirty = overlayDirty = true;
}

const toWorld = (sx, sy) => [cam.x + (sx - view.w / 2) / cam.z, cam.y + (sy - view.h / 2) / cam.z];
const toScreen = (wx, wy) => [(wx - cam.x) * cam.z + view.w / 2, (wy - cam.y) * cam.z + view.h / 2];
const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

function zoomAt(sx, sy, factor) {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.z * factor));
  const [wx, wy] = toWorld(sx, sy);
  cam.z = z;
  cam.x = wx - (sx - view.w / 2) / z;
  cam.y = wy - (sy - view.h / 2) / z;
  anim = null; dirty = overlayDirty = true;
}

function flyTo(target) {
  const from = { ...cam }, t0 = performance.now(), dur = reduceMotion ? 0 : 450;
  anim = (now) => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
    cam.z = Math.exp(Math.log(from.z) + (Math.log(target.z) - Math.log(from.z)) * e);
    cam.x = from.x + (target.x - from.x) * e;
    cam.y = from.y + (target.y - from.y) * e;
    if (k >= 1) anim = null;
  };
}

// ---------- editing ----------

function cellAt(wx, wy) {
  const x = Math.floor(wx), y = Math.floor(wy);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return { x, y, q: (wx - x > 0.5 ? 1 : 0) + (wy - y > 0.5 ? 2 : 0) };
}
const clampCell = (wx, wy) => ({ x: Math.min(COLS - 1, Math.max(0, Math.floor(wx))), y: Math.min(ROWS - 1, Math.max(0, Math.floor(wy))) });
const holeAt = (wx, wy) => [Math.min(COLS, Math.max(0, Math.round(wx))), Math.min(ROWS, Math.max(0, Math.round(wy)))];

function applyAt(wx, wy) {
  const c = cellAt(wx, wy);
  if (!c) return;
  const key = `${c.x},${c.y}`;
  if (state.tool === 'erase') {
    if (state.eraseWhat === 'pattern') { if (blocks.delete(key)) guideDirty = true; return; }
    const had = stitches.delete(key);
    const before = backs.length;
    backs = backs.filter((b) => Math.floor((b.a[0] + b.b[0]) / 2) !== c.x || Math.floor((b.a[1] + b.b[1]) / 2) !== c.y);
    if (had || backs.length !== before) sceneDirty = true;
    return;
  }
  if (state.tool === 'pattern') {
    if (blocks.get(key) !== state.color) { blocks.set(key, state.color); guideDirty = true; }
    return;
  }
  const prev = stitches.get(key);
  const next = { type: state.stitch, color: state.color, q: c.q };
  if (prev && prev.type === next.type && prev.color === next.color && prev.q === next.q) return;
  stitches.set(key, next);
  sceneDirty = true;
}

/** Paint every square along a drag segment so fast strokes leave no gaps. */
function strokeTo(from, to) {
  const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.25));
  for (let i = 1; i <= n; i++) applyAt(from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n);
}

/** Fill tool: a click on a pattern shape fills that shape in its colours; a drag fills the rectangle. */
function fillFrom(a, b) {
  const ca = clampCell(...a), cb = clampCell(...b);
  const startKey = `${ca.x},${ca.y}`;
  if (ca.x === cb.x && ca.y === cb.y && blocks.has(startKey)) {
    const colour = blocks.get(startKey), seen = new Set([startKey]), queue = [[ca.x, ca.y]];
    while (queue.length) {
      const [x, y] = queue.pop();
      stitches.set(`${x},${y}`, { type: state.fill, color: colour, q: 0 });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (!seen.has(k) && blocks.get(k) === colour) { seen.add(k); queue.push([x + dx, y + dy]); }
      }
    }
  } else {
    for (let y = Math.min(ca.y, cb.y); y <= Math.max(ca.y, cb.y); y++) {
      for (let x = Math.min(ca.x, cb.x); x <= Math.max(ca.x, cb.x); x++) stitches.set(`${x},${y}`, { type: state.fill, color: state.color, q: 0 });
    }
  }
  sceneDirty = true;
}

// ---------- input ----------

const pointers = new Map();
let mode = null;           // 'paint' | 'pan' | 'pinch' | 'back' | 'fill'
let lastWorld = null, pinch = null, spaceHeld = false;

function panMode() { return state.tool === 'pan' || spaceHeld; }
function updateCursor() { canvas.classList.toggle('pan', panMode()); }

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
  const [sx, sy] = local(e);
  zoomAt(sx, sy, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const [sx, sy] = local(e);
  pointers.set(e.pointerId, { x: sx, y: sy });
  anim = null;
  if (state.paletteOpen) { state.paletteOpen = false; syncUI(); }
  if (pointers.size === 2) { mode = 'pinch'; pinch = null; drag = null; overlayDirty = true; return; }
  if (pointers.size > 2) return;
  const w = toWorld(sx, sy);
  if (e.button === 1 || e.button === 2 || panMode()) {
    mode = 'pan';
    canvas.classList.add('dragging');
  } else if (state.tool === 'stitch' && state.stitch === 'back') {
    mode = 'back';
    drag = { a: holeAt(...w) };
  } else if (state.tool === 'fill') {
    mode = 'fill';
    drag = { a: w };
  } else {
    mode = 'paint';
    snapshot();
    applyAt(...w);
    lastWorld = w;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const [sx, sy] = local(e);
  const w = toWorld(sx, sy);
  hover = { wx: w[0], wy: w[1] };
  overlayDirty = true;
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const prev = { x: p.x, y: p.y };
  p.x = sx; p.y = sy;
  if (mode === 'pan') {
    cam.x -= (sx - prev.x) / cam.z;
    cam.y -= (sy - prev.y) / cam.z;
    dirty = true;
  } else if (mode === 'paint') {
    strokeTo(lastWorld, w);
    lastWorld = w;
  } else if (mode === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) {
      cam.x -= (mid.x - pinch.mid.x) / cam.z;
      cam.y -= (mid.y - pinch.mid.y) / cam.z;
      zoomAt(mid.x, mid.y, dist / pinch.dist);
    }
    pinch = { mid, dist };
  }
});

const endPointer = (e) => {
  // a click with no movement never sent a pointermove, so take the position from this event
  const w = toWorld(...local(e));
  hover = { wx: w[0], wy: w[1] };
  if (drag && (mode === 'back' || mode === 'fill')) {
    if (mode === 'back') {
      const b = holeAt(hover.wx, hover.wy);
      if (b[0] !== drag.a[0] || b[1] !== drag.a[1]) {
        snapshot();
        backs.push({ a: drag.a, b, color: state.color });
        sceneDirty = true;
      }
    } else {
      snapshot();
      fillFrom(drag.a, [hover.wx, hover.wy]);
    }
  }
  pointers.delete(e.pointerId);
  if (!pointers.size) { mode = null; drag = null; pinch = null; canvas.classList.remove('dragging'); }
  overlayDirty = true;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!pointers.size) { hover = null; overlayDirty = true; } });

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); return; }
  if (e.key === 'Escape' && state.paletteOpen) { set('paletteOpen', false); return; }
  if (e.key === ' ' && !e.target.closest('button')) { spaceHeld = true; updateCursor(); e.preventDefault(); return; }
  if (e.target.closest('button')) return;
  const cx = view.w / 2, cy = view.h / 2, step = 60 / cam.z;
  const keys = {
    '+': () => zoomAt(cx, cy, 1.25), '=': () => zoomAt(cx, cy, 1.25), '-': () => zoomAt(cx, cy, 0.8), '0': fit,
    ArrowLeft: () => { cam.x -= step; }, ArrowRight: () => { cam.x += step; },
    ArrowUp: () => { cam.y -= step; }, ArrowDown: () => { cam.y += step; },
    s: () => set('tool', 'stitch'), f: () => set('tool', 'fill'), p: () => set('tool', 'pattern'),
    e: () => set('tool', 'erase'), h: () => set('tool', 'pan')
  };
  if (keys[e.key]) { keys[e.key](); dirty = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceHeld = false; updateCursor(); } });

function fit() { flyTo({ x: COLS / 2, y: ROWS / 2, z: fitZoom() }); }

// ---------- panel ----------

const panel = document.getElementById('panel');

/** Card art: the stitch drawn the way it sits on the grid, using the same legs the renderer gets. */
function previewSVG(kind, color) {
  const fill = kind.startsWith('f-');
  const cols = fill ? 3 : 2, rows = fill ? 2 : 1, S = 22, pad = 8;
  const w = cols * S + pad * 2, h = rows * S + pad * 2;
  const P = ([x, y]) => `${(pad + x * S).toFixed(1)} ${(pad + y * S).toFixed(1)}`;
  let legs = [];
  if (kind === 'back') legs = [[[0, 1], [1, 0], 2], [[1, 0], [2, 1], 2]];
  else for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) legs.push(...legsOf(x, y, { type: kind, q: 2 }));
  const rgb = hex(color), r = rng(7);
  const draw = legs.sort((a, b) => a[2] - b[2]).map(([a, b, layer]) => {
    const c = kind === 'f-tweed' ? toHex(tweedTone(rgb, r)) : toHex(rgb.map((v) => v * (layer === 0 ? 0.86 : 1)));
    return `<path d="M${P(a)}L${P(b)}" stroke="${c}" stroke-width="5.5"/><path d="M${P(a)}L${P(b)}" stroke="#fff" stroke-opacity=".22" stroke-width="1.6"/>`;
  }).join('');
  let dots = '';
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) dots += `<circle cx="${pad + x * S}" cy="${pad + y * S}" r="1.6"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><rect width="${w}" height="${h}" rx="6" fill="#F2EEE6"/>`
    + `<g fill="#8F8A80">${dots}</g><g fill="none" stroke-linecap="round">${draw}</g></svg>`;
}
const skein = (color) => `<svg width="40" height="26" viewBox="0 0 40 26" aria-hidden="true">
  <rect x="2" y="5" width="36" height="16" rx="8" fill="${color}"/>
  <path d="M6 9.5H34M5 13H35M6 16.5H34" stroke="#000" stroke-opacity=".16" stroke-width="1"/>
  <rect x="15" y="3" width="10" height="20" rx="2" fill="#EEE9E0"/>
  <rect x="17" y="7" width="6" height="2" fill="${color}"/></svg>`;
const pill = (key, options, label) => `<div class="pill" role="group" aria-label="${label}">${options.map(([val, text]) =>
  `<button data-set="${key}" data-val="${val}">${text}</button>`).join('')}</div>`;
const slider = (key, label) => `<div class="slider"><label for="r-${key}">${label}</label>
  <input id="r-${key}" type="range" min="0" max="100" data-range="${key}"><output class="mono" id="o-${key}"></output></div>`;
const cards = (key, defs) => `<div class="cards">${Object.entries(defs).map(([id, [name]]) =>
  `<button class="card" data-set="${key}" data-val="${id}"><span class="art" data-art="${id}"></span><span class="card-name">${name}</span></button>`).join('')}</div>`;

const TOOL_HINTS = {
  stitch: 'Click or drag on the grid to place the stitch below.',
  fill: 'Drag a rectangle to fill it. Or click a pattern shape to fill the whole shape in its own colours.',
  pattern: 'Paint squares in the current thread colour to plan your own design, then stitch or fill over it.',
  erase: 'Drag over squares to remove what is there.',
  pan: 'Drag to move around. Space, right-drag or middle-drag also pan with any tool.'
};

panel.innerHTML = `
  <section>
    <h2>Tool</h2>
    ${pill('tool', [['stitch', 'Stitch'], ['fill', 'Fill'], ['pattern', 'Pattern'], ['erase', 'Erase'], ['pan', 'Pan']], 'Tool')}
    <p class="hint" id="tool-hint"></p>
    <div id="erase-what" hidden>${pill('eraseWhat', [['stitches', 'Stitches'], ['pattern', 'Pattern']], 'Erase')}</div>
    <div class="row">
      <button data-act="undo">Undo</button>
      <button data-act="clear-stitches">Clear stitches</button>
      <button data-act="clear-pattern">Clear pattern</button>
    </div>
  </section>
  <section>
    <h2>Stitches</h2>
    ${cards('stitch', STITCH_TYPES)}
    <p class="hint" id="stitch-desc"></p>
  </section>
  <section>
    <h2>Fills</h2>
    ${cards('fill', FILLS)}
    <p class="hint" id="fill-desc"></p>
  </section>
  <section>
    <h2>Thread</h2>
    <button class="thread-current" data-act="palette" aria-expanded="false" aria-controls="palette">
      <span id="current-skein"></span><span class="thread-label"><span id="current-name"></span><span class="mono" id="current-hex"></span></span><span class="change">Change</span>
    </button>
    <div class="palette" id="palette" hidden>
      <div class="skeins">${THREADS.map(([name, c]) =>
        `<button data-set="color" data-val="${c}" aria-label="${name}" title="${name}">${skein(c)}</button>`).join('')}</div>
      <label class="custom"><input type="color" id="custom-color" value="#C8343B"> Custom colour</label>
    </div>
    <div class="recents" id="recents" aria-label="Recent threads"></div>
  </section>
  <section>
    <h2>Strands</h2>
    ${pill('strands', [['1', '1'], ['2', '2'], ['3', '3']], 'Strands')}
    <p class="hint">Embroidery floss is six thin strands; you stitch with a few at a time. More strands make thicker thread that covers more of the canvas.</p>
  </section>
  <section>
    <h2>Canvas</h2>
    ${pill('surface', Object.entries(SURFACES).map(([k, s]) => [k, s.name]), 'Surface')}
    <div class="count-row">
      <span class="sub">Count</span>
      ${pill('count', [['11', '11'], ['14', '14'], ['16', '16'], ['18', '18']], 'Squares per inch')}
    </div>
    <p class="hint" id="count-hint"></p>
    <button class="switch" role="switch" data-act="guide" id="guide-switch"><span class="track"><span class="knob"></span></span>Show pattern</button>
  </section>
  <section>
    <h2>Thread look</h2>
    ${slider('twist', 'Twist')}
    ${slider('sheen', 'Sheen')}
    ${slider('fuzz', 'Fuzz')}
  </section>
  <p class="hint">Scroll or pinch to zoom. Cmd/Ctrl+Z undoes. Keys: S stitch, F fill, P pattern, E erase, H pan.</p>
`;
panel.querySelectorAll('[data-art]').forEach((el) => { el.dataset.color = ''; });

function set(key, val) {
  state[key] = val;
  if (key === 'tool') updateCursor();
  if (key === 'strands' || key === 'count') sceneDirty = true;   // thread width changes
  if (key === 'surface') buildFabricHairs();
  if (key === 'color') recents = [val, ...recents.filter((c) => c !== val)].slice(0, 6);
  syncUI();
  dirty = overlayDirty = true;
}

panel.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.set) {
    const k = b.dataset.set, v = b.dataset.val;
    set(k, k === 'strands' || k === 'count' ? Number(v) : v);
    if (k === 'stitch') set('tool', 'stitch');
    if (k === 'fill') set('tool', 'fill');
    if (k === 'color' && b.closest('.palette')) set('paletteOpen', false);
    if (k === 'color' && state.tool === 'erase') set('tool', 'stitch');
    return;
  }
  const act = b.dataset.act;
  if (act === 'undo') undo();
  else if (act === 'clear-stitches') { snapshot(); stitches = new Map(); backs = []; sceneDirty = true; }
  else if (act === 'clear-pattern') { snapshot(); blocks = new Map(); guideDirty = true; }
  else if (act === 'guide') set('guide', !state.guide);
  else if (act === 'palette') set('paletteOpen', !state.paletteOpen);
});
panel.addEventListener('input', (e) => {
  if (e.target.dataset.range) set(e.target.dataset.range, e.target.value / 100);
  if (e.target.id === 'custom-color') set('color', e.target.value);
});

function syncUI() {
  panel.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(String(state[b.dataset.set]) === b.dataset.val)));
  for (const k of ['twist', 'sheen', 'fuzz']) {
    const input = panel.querySelector(`[data-range="${k}"]`);
    if (document.activeElement !== input) input.value = Math.round(state[k] * 100);
    panel.querySelector(`#o-${k}`).textContent = Math.round(state[k] * 100);
  }
  // card art follows the current thread colour
  panel.querySelectorAll('[data-art]').forEach((el) => {
    if (el.dataset.color !== state.color) { el.innerHTML = previewSVG(el.dataset.art, state.color); el.dataset.color = state.color; }
  });
  document.getElementById('tool-hint').textContent = TOOL_HINTS[state.tool];
  document.getElementById('erase-what').hidden = state.tool !== 'erase';
  document.getElementById('stitch-desc').textContent = STITCH_TYPES[state.stitch][1];
  document.getElementById('fill-desc').textContent = FILLS[state.fill][1];
  document.getElementById('current-skein').innerHTML = skein(state.color);
  document.getElementById('current-name').textContent = threadName(state.color);
  document.getElementById('current-hex').textContent = state.color.toUpperCase();
  document.querySelector('[data-act="palette"]').setAttribute('aria-expanded', String(state.paletteOpen));
  document.getElementById('palette').hidden = !state.paletteOpen;
  document.getElementById('recents').innerHTML = recents.map((c) =>
    `<button data-set="color" data-val="${c}" aria-pressed="${c === state.color}" aria-label="${threadName(c)} ${c}" title="${threadName(c)}">${skein(c)}</button>`).join('');
  document.getElementById('guide-switch').setAttribute('aria-checked', String(state.guide));
  const cmW = COLS / state.count * 2.54, cmH = ROWS / state.count * 2.54;
  document.getElementById('count-hint').textContent =
    `Squares per inch. At ${state.count}, this ${COLS}×${ROWS} canvas stitches out to ${cmW.toFixed(1)} × ${cmH.toFixed(1)} cm. Higher counts mean smaller stitches and finer detail.`;
  document.getElementById('size').textContent = `${SURFACES[state.surface].name} · count ${state.count} · ${state.strands} strand${state.strands > 1 ? 's' : ''} · ${cmW.toFixed(1)} × ${cmH.toFixed(1)} cm`;
  lastHud = '';
}

// ---------- overlay: cursor preview ----------

function drawOverlay() {
  const d = dpr();
  octx.setTransform(d, 0, 0, d, 0, 0);
  octx.clearRect(0, 0, view.w, view.h);
  if (!hover || mode === 'pan' || mode === 'pinch' || panMode()) return;
  octx.lineWidth = 1.5;
  octx.strokeStyle = '#E9B949';
  if (state.tool === 'stitch' && state.stitch === 'back') {
    const h = holeAt(hover.wx, hover.wy);
    if (drag) {
      const [ax, ay] = toScreen(...drag.a), [bx, by] = toScreen(...h);
      octx.save();
      octx.strokeStyle = state.color; octx.globalAlpha = 0.85; octx.lineWidth = Math.max(2, threadWidth() * cam.z); octx.lineCap = 'round';
      octx.beginPath(); octx.moveTo(ax, ay); octx.lineTo(bx, by); octx.stroke();
      octx.restore();
    }
    const [hx, hy] = toScreen(...h);
    octx.beginPath(); octx.arc(hx, hy, Math.max(3, cam.z * 0.12), 0, Math.PI * 2); octx.stroke();
    return;
  }
  if (state.tool === 'fill' && drag) {
    const a = clampCell(...drag.a), b = clampCell(hover.wx, hover.wy);
    const [x0, y0] = toScreen(Math.min(a.x, b.x), Math.min(a.y, b.y));
    const [x1, y1] = toScreen(Math.max(a.x, b.x) + 1, Math.max(a.y, b.y) + 1);
    octx.fillStyle = 'rgba(233, 185, 73, 0.12)';
    octx.fillRect(x0, y0, x1 - x0, y1 - y0);
    octx.strokeRect(x0 + 0.75, y0 + 0.75, x1 - x0 - 1.5, y1 - y0 - 1.5);
    return;
  }
  const c = cellAt(hover.wx, hover.wy);
  if (!c) return;
  const [x, y] = toScreen(c.x, c.y);
  if (state.tool === 'pattern') {
    octx.save(); octx.globalAlpha = 0.45; octx.fillStyle = state.color; octx.fillRect(x, y, cam.z, cam.z); octx.restore();
  }
  if (state.tool === 'erase') octx.strokeStyle = '#EEE9E0';
  octx.strokeRect(x + 0.75, y + 0.75, cam.z - 1.5, cam.z - 1.5);
  if (state.tool === 'stitch' && (state.stitch === 'quarter' || state.stitch === 'threeq')) {
    const [cx, cy] = [[c.x, c.y], [c.x + 1, c.y], [c.x, c.y + 1], [c.x + 1, c.y + 1]][c.q];
    const [px, py] = toScreen(cx, cy);
    octx.fillStyle = '#E9B949';
    octx.beginPath(); octx.arc(px, py, Math.max(3, cam.z * 0.1), 0, Math.PI * 2); octx.fill();
  }
}

// ---------- HUD + frame loop ----------

const lodEl = document.getElementById('lod'), zoomEl = document.getElementById('zoom');
let lastHud = '';
function hud() {
  const z = cam.z;
  const lod = z < 8 ? 'far' : z < 60 ? 'mid' : 'close';
  const text = `${z.toFixed(z < 10 ? 1 : 0)} px/stitch · ×${(z / lifeSize()).toFixed(1)}`;
  if (text === lastHud) return;
  lastHud = text;
  lodEl.textContent = { far: 'Far · colour blobs', mid: 'Mid · stitch shapes', close: 'Close · strands and fibres' }[lod];
  zoomEl.textContent = text;
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === lod)));
}

document.querySelectorAll('[data-preset]').forEach((btn) => btn.addEventListener('click', () => {
  const z = PRESETS[btn.dataset.preset];
  // zooming in from far lands on the starter motif; otherwise keep looking where we are
  const centre = cam.z < 8 ? { x: ox + 6, y: oy + 6 } : { x: cam.x, y: cam.y };
  flyTo({ ...centre, z });
}));
document.getElementById('reset').addEventListener('click', fit);

function frame(now) {
  if (anim) { anim(now); dirty = overlayDirty = true; }
  if (sceneDirty) { buildScene(); sceneDirty = false; dirty = true; }
  if (guideDirty) { buildGuide(); guideDirty = false; dirty = true; }
  if (dirty) {
    renderer.draw(
      { x: cam.x, y: cam.y, scale: cam.z * dpr(), cssScale: cam.z, light: LIGHT },
      {
        fabricRect: [0, 0, COLS, ROWS], surface: SURFACES[state.surface].id, cloth: hex(SURFACES[state.surface].color),
        threadWidth: threadWidth(), strands: state.strands, twist: state.twist, sheen: state.sheen, fuzz: state.fuzz, guide: state.guide
      }
    );
    hud();
    dirty = false;
  }
  if (overlayDirty) { drawOverlay(); overlayDirty = false; }
  requestAnimationFrame(frame);
}

new ResizeObserver(resize).observe(stage);
resize();
if (!fitted) cam.z = fitZoom();
buildFabricHairs();
syncUI();
updateCursor();
requestAnimationFrame(frame);
