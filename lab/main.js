// Thread lab: a small cross-stitch editor on top of the WebGL2 thread renderer.
import { createRenderer, LAYERS } from './renderer.js';

// The strawberry kit chart, same motif as the mockup screens (12×12).
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
const FABRICS = { white: ['White', '#F4F2EC'], linen: ['Linen', '#ECE5D6'], oatmeal: ['Oatmeal', '#D6C9AE'] };
const STITCHES = {
  full: 'Full cross',
  half: 'Half stitch',
  quarter: 'Quarter: click the corner it starts from',
  threeq: 'Three-quarter: click the corner the short leg starts from',
  back: 'Backstitch: drag from hole to hole'
};
const CHART_COLOURS = { R: '#C8343B', D: '#8E1D24', G: '#4F8A4B', g: '#2F5A35', y: '#F2D06B' };

const state = {
  tool: 'stitch', stitch: 'full', color: '#C8343B', strands: 2, count: 14, fabric: 'linen',
  twist: 0.2, sheen: 0.3, fuzz: 0.5, guide: true, followLight: false
};

// ---------- piece data ----------

let stitches = new Map();   // "x,y" -> { type, color, q }
let backs = [];             // { a: [x, y], b: [x, y], color }
const history = [];

const chart = { ox: 14, oy: 9, cells: [] };
STRAWBERRY.forEach((row, y) => row.split('').forEach((ch, x) => {
  if (CHART_COLOURS[ch]) chart.cells.push({ x: x + chart.ox, y: y + chart.oy, color: CHART_COLOURS[ch] });
}));
// Start half-stitched, like a kit in progress: top rows done, the rest still printed.
chart.cells.filter((c) => c.y < chart.oy + 6).forEach((c) => stitches.set(`${c.x},${c.y}`, { type: 'full', color: c.color, q: 0 }));

function snapshot() { history.push({ stitches: new Map(stitches), backs: backs.slice() }); if (history.length > 100) history.shift(); }
function undo() {
  const prev = history.pop();
  if (!prev) return;
  stitches = prev.stitches; backs = prev.backs; sceneDirty = true;
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
const threadWidth = () => state.strands * STRAND_MM * state.count / 25.4;

/** Legs for one stitch: [from, to, layer]. Layer 0 is under, 1 is top, 2 is backstitch. */
function legsOf(x, y, st) {
  const TL = [x, y], TR = [x + 1, y], BL = [x, y + 1], BR = [x + 1, y + 1], C = [x + 0.5, y + 0.5];
  const corner = [TL, TR, BL, BR][st.q];
  switch (st.type) {
    case 'full': return [[BL, TR, 0], [TL, BR, 1]];           // every top leg runs the same way: \
    case 'half': return [[BL, TR, 0]];
    case 'quarter': return [[corner, C, 1]];
    case 'threeq': return [st.q === 0 || st.q === 3 ? [BL, TR, 0] : [TL, BR, 0], [corner, C, 1]];
    default: return [];
  }
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
    for (const [a, b, layer] of legsOf(x, y, st)) addLeg(layer, a, b, rgb, r);
  }
  for (const bk of backs) addLeg(2, bk.a, bk.b, hex(bk.color), rng(hashStr(`b${bk.a}${bk.b}`)));

  renderer.setStitches(layers.map((l) => new Float32Array(l)), new Float32Array(hairs));
}

function buildFabricHairs() {
  const r = rng(99), hairs = [];
  const cloth = hex(FABRICS[state.fabric][1]);
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
  for (const c of chart.cells) {
    const i = (c.y * COLS + c.x) * 4;
    hex(c.color).forEach((v, k) => { data[i + k] = Math.round(v * 255); });
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
const DEFAULT_LIGHT = norm([-0.45, -0.55, 0.7]);
const cam = { x: COLS / 2, y: ROWS / 2, z: 1 };   // z: CSS px per stitch
let light = DEFAULT_LIGHT;
let anim = null, dirty = true, sceneDirty = true, overlayDirty = true;
let view = { w: 1, h: 1 };
let hover = null;          // { wx, wy } under the pointer
let backDrag = null;       // { a: [x, y] } while dragging a backstitch

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
const holeAt = (wx, wy) => [Math.min(COLS, Math.max(0, Math.round(wx))), Math.min(ROWS, Math.max(0, Math.round(wy)))];

function applyAt(wx, wy) {
  const c = cellAt(wx, wy);
  if (!c) return;
  const key = `${c.x},${c.y}`;
  if (state.tool === 'erase') {
    const had = stitches.delete(key);
    const before = backs.length;
    backs = backs.filter((b) => Math.floor((b.a[0] + b.b[0]) / 2) !== c.x || Math.floor((b.a[1] + b.b[1]) / 2) !== c.y);
    if (had || backs.length !== before) sceneDirty = true;
    return;
  }
  const prev = stitches.get(key);
  const next = { type: state.stitch, color: state.color, q: c.q };
  if (prev && prev.type === next.type && prev.color === next.color && prev.q === next.q) return;
  stitches.set(key, next);
  sceneDirty = true;
}

/** Paint every cell along a drag segment so fast strokes leave no gaps. */
function strokeTo(from, to) {
  const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.25));
  for (let i = 1; i <= n; i++) applyAt(from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n);
}

// ---------- input ----------

const pointers = new Map();
let mode = null;           // 'paint' | 'pan' | 'pinch' | 'back'
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
  if (pointers.size === 2) { mode = 'pinch'; pinch = null; backDrag = null; overlayDirty = true; return; }
  if (pointers.size > 2) return;
  const w = toWorld(sx, sy);
  if (e.button === 1 || e.button === 2 || panMode()) {
    mode = 'pan';
    canvas.classList.add('dragging');
  } else if (state.tool === 'stitch' && state.stitch === 'back') {
    mode = 'back';
    backDrag = { a: holeAt(...w) };
  } else {
    mode = 'paint';
    snapshot();
    applyAt(...w);
    lastWorld = w;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const [sx, sy] = local(e);
  if (state.followLight) {
    light = norm([(sx / view.w - 0.5) * 2.2, (sy / view.h - 0.5) * 2.2, 0.75]);
    dirty = true;
  }
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
  if (mode === 'back' && backDrag && hover) {
    const b = holeAt(hover.wx, hover.wy);
    if (b[0] !== backDrag.a[0] || b[1] !== backDrag.a[1]) {
      snapshot();
      backs.push({ a: backDrag.a, b, color: state.color });
      sceneDirty = true;
    }
  }
  pointers.delete(e.pointerId);
  if (!pointers.size) { mode = null; backDrag = null; pinch = null; canvas.classList.remove('dragging'); }
  overlayDirty = true;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!pointers.size) { hover = null; overlayDirty = true; } });

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); return; }
  if (e.key === ' ' && !e.target.closest('button')) { spaceHeld = true; updateCursor(); e.preventDefault(); return; }
  if (e.target.closest('button')) return;
  const cx = view.w / 2, cy = view.h / 2, step = 60 / cam.z;
  const keys = {
    '+': () => zoomAt(cx, cy, 1.25), '=': () => zoomAt(cx, cy, 1.25), '-': () => zoomAt(cx, cy, 0.8), '0': fit,
    ArrowLeft: () => { cam.x -= step; }, ArrowRight: () => { cam.x += step; },
    ArrowUp: () => { cam.y -= step; }, ArrowDown: () => { cam.y += step; },
    s: () => set('tool', 'stitch'), e: () => set('tool', 'erase'), h: () => set('tool', 'pan')
  };
  if (keys[e.key]) { keys[e.key](); dirty = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceHeld = false; updateCursor(); } });

function fit() { flyTo({ x: COLS / 2, y: ROWS / 2, z: fitZoom() }); }

// ---------- panel ----------

const panel = document.getElementById('panel');
const stitchIcon = (type) => {
  const g = {
    full: '<path d="M7 25L25 7M7 7L25 25"/>',
    half: '<path d="M7 25L25 7"/>',
    quarter: '<path d="M7 25L16 16"/>',
    threeq: '<path d="M7 25L25 7M7 7L16 16"/>',
    back: '<path d="M5 25H27"/><circle cx="5" cy="25" r="2" stroke="none"/><circle cx="27" cy="25" r="2" stroke="none"/>'
  }[type];
  return `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="7" width="18" height="18" fill="none" stroke="#3A3F49" stroke-width="1"/>`
    + `<g stroke="currentColor" fill="currentColor" stroke-width="3.2" stroke-linecap="round">${g}</g></svg>`;
};
const skein = (color) => `<svg width="40" height="26" viewBox="0 0 40 26" aria-hidden="true">
  <rect x="2" y="5" width="36" height="16" rx="8" fill="${color}"/>
  <path d="M6 9.5H34M5 13H35M6 16.5H34" stroke="#000" stroke-opacity=".16" stroke-width="1"/>
  <rect x="15" y="3" width="10" height="20" rx="2" fill="#EEE9E0"/>
  <rect x="17" y="7" width="6" height="2" fill="${color}"/></svg>`;
const pill = (key, options, label) => `<div class="pill" role="group" aria-label="${label}">${options.map(([val, text]) =>
  `<button data-set="${key}" data-val="${val}">${text}</button>`).join('')}</div>`;
const slider = (key, label) => `<div class="slider"><label for="r-${key}">${label}</label>
  <input id="r-${key}" type="range" min="0" max="100" data-range="${key}"><output class="mono" id="o-${key}"></output></div>`;

panel.innerHTML = `
  <section>
    <h2>Tool</h2>
    <div class="row">
      ${pill('tool', [['stitch', 'Stitch'], ['erase', 'Erase'], ['pan', 'Pan']], 'Tool')}
    </div>
    <div class="row" style="margin-top:8px">
      <button data-act="undo">Undo</button>
      <button data-act="clear">Clear all</button>
    </div>
  </section>
  <section>
    <h2>Stitch</h2>
    <div class="stitch-grid">${Object.keys(STITCHES).map((t) =>
      `<button data-set="stitch" data-val="${t}" aria-label="${STITCHES[t].split(':')[0]}" title="${STITCHES[t].split(':')[0]}">${stitchIcon(t)}</button>`).join('')}</div>
    <div class="stitch-name" id="stitch-name"></div>
  </section>
  <section>
    <h2>Thread</h2>
    <div class="skeins">${THREADS.map(([name, c]) =>
      `<button data-set="color" data-val="${c}" aria-label="${name}" title="${name}">${skein(c)}</button>`).join('')}</div>
    <label class="custom"><input type="color" id="custom-color" value="#C8343B"> Custom colour</label>
    <div class="thread-name mono" id="thread-name"></div>
  </section>
  <section>
    <h2>Strands</h2>
    ${pill('strands', [['1', '1'], ['2', '2'], ['3', '3']], 'Strands')}
  </section>
  <section>
    <h2>Fabric</h2>
    ${pill('count', [['11', 'Aida 11'], ['14', '14'], ['16', '16'], ['18', '18']], 'Fabric count')}
    <div style="height:8px"></div>
    ${pill('fabric', Object.entries(FABRICS).map(([k, [n]]) => [k, n]), 'Fabric colour')}
    <div class="row" style="margin-top:8px"><button class="toggle" data-act="guide" id="guide-btn">Printed pattern</button></div>
  </section>
  <section>
    <h2>Look</h2>
    ${slider('twist', 'Twist')}
    ${slider('sheen', 'Sheen')}
    ${slider('fuzz', 'Fuzz')}
    <div class="row" style="margin-top:4px"><button class="toggle" data-act="light" id="light-btn">Light follows cursor</button></div>
  </section>
  <p class="hint">Click or drag to stitch. Scroll or pinch to zoom. Right-drag, middle-drag or hold Space to pan. Cmd/Ctrl+Z undoes.</p>
`;

function set(key, val) {
  state[key] = val;
  if (key === 'tool') updateCursor();
  if (key === 'strands' || key === 'count') sceneDirty = true;   // thread width changes
  if (key === 'fabric') buildFabricHairs();
  syncUI();
  dirty = overlayDirty = true;
}

panel.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.set) {
    const k = b.dataset.set, v = b.dataset.val;
    set(k, k === 'strands' || k === 'count' ? Number(v) : v);
    if (k === 'stitch' || k === 'color') set('tool', 'stitch');
  } else if (b.dataset.act === 'undo') undo();
  else if (b.dataset.act === 'clear') { snapshot(); stitches = new Map(); backs = []; sceneDirty = true; }
  else if (b.dataset.act === 'guide') set('guide', !state.guide);
  else if (b.dataset.act === 'light') {
    set('followLight', !state.followLight);
    if (!state.followLight) light = DEFAULT_LIGHT;
  }
});
panel.addEventListener('input', (e) => {
  if (e.target.dataset.range) set(e.target.dataset.range, e.target.value / 100);
  if (e.target.id === 'custom-color') { set('color', e.target.value); set('tool', 'stitch'); }
});

function syncUI() {
  panel.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(String(state[b.dataset.set]) === b.dataset.val)));
  for (const k of ['twist', 'sheen', 'fuzz']) {
    const input = panel.querySelector(`[data-range="${k}"]`);
    if (document.activeElement !== input) input.value = Math.round(state[k] * 100);
    panel.querySelector(`#o-${k}`).textContent = Math.round(state[k] * 100);
  }
  document.getElementById('guide-btn').setAttribute('aria-pressed', String(state.guide));
  document.getElementById('light-btn').setAttribute('aria-pressed', String(state.followLight));
  document.getElementById('stitch-name').textContent = STITCHES[state.stitch];
  const named = THREADS.find(([, c]) => c.toLowerCase() === state.color.toLowerCase());
  document.getElementById('thread-name').textContent = `${named ? named[0] : 'Custom'} · ${state.color.toUpperCase()}`;
  const inch = COLS / state.count;
  document.getElementById('size').textContent = `Aida ${state.count} · ${state.strands} strand${state.strands > 1 ? 's' : ''} · ${COLS}×${ROWS} · ${Math.round(inch * 25.4)} mm wide`;
  lastHud = '';
}

// ---------- overlay: cursor preview ----------

function drawOverlay() {
  const d = dpr();
  octx.setTransform(d, 0, 0, d, 0, 0);
  octx.clearRect(0, 0, view.w, view.h);
  if (!hover || mode === 'pan' || mode === 'pinch' || panMode()) return;
  octx.lineWidth = 1.5;
  if (state.tool === 'stitch' && state.stitch === 'back') {
    const h = holeAt(hover.wx, hover.wy);
    const r = Math.max(3, cam.z * 0.12);
    if (backDrag) {
      const [ax, ay] = toScreen(...backDrag.a), [bx, by] = toScreen(...h);
      octx.strokeStyle = state.color; octx.globalAlpha = 0.85; octx.lineWidth = Math.max(2, threadWidth() * cam.z);
      octx.lineCap = 'round';
      octx.beginPath(); octx.moveTo(ax, ay); octx.lineTo(bx, by); octx.stroke();
      octx.globalAlpha = 1; octx.lineWidth = 1.5;
    }
    const [hx, hy] = toScreen(...h);
    octx.strokeStyle = '#E9B949';
    octx.beginPath(); octx.arc(hx, hy, r, 0, Math.PI * 2); octx.stroke();
    return;
  }
  const c = cellAt(hover.wx, hover.wy);
  if (!c) return;
  const [x, y] = toScreen(c.x, c.y);
  octx.strokeStyle = state.tool === 'erase' ? '#EEE9E0' : '#E9B949';
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
  // zooming in from far lands on the motif; otherwise keep looking where we are
  const centre = cam.z < 8 ? { x: chart.ox + 6, y: chart.oy + 6 } : { x: cam.x, y: cam.y };
  flyTo({ ...centre, z });
}));
document.getElementById('reset').addEventListener('click', () => { light = DEFAULT_LIGHT; fit(); });

function frame(now) {
  if (anim) { anim(now); dirty = overlayDirty = true; }
  if (sceneDirty) { buildScene(); sceneDirty = false; dirty = true; }
  if (dirty) {
    renderer.draw(
      { x: cam.x, y: cam.y, scale: cam.z * dpr(), cssScale: cam.z, light },
      {
        fabricRect: [0, 0, COLS, ROWS], cloth: hex(FABRICS[state.fabric][1]), threadWidth: threadWidth(),
        strands: state.strands, twist: state.twist, sheen: state.sheen, fuzz: state.fuzz, guide: state.guide
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
buildGuide();
buildFabricHairs();
syncUI();
updateCursor();
requestAnimationFrame(frame);
