// The thread editor: the lab's engine on its own, with no panel. It owns the piece (stitches, backstitch, fills,
// pattern), the WebGL2 renderer, the camera, the tools under the pointer, the picture pipeline and the selection;
// a page builds its own panel on top and talks to it through the returned API (the studio does; lab/main.js still
// carries its own copy, to be moved onto this).
// createEditor({ stage, canvas, overlay, onChange(kind), onView(view), onImage(file), ground() (the bench's colour, sRGB 0..1), sheet: { w, h, cell }, accent (the selection's and cursor's colour) }) → API, or null without WebGL2.
//   onChange kinds: 'state' (a setting), 'selection', 'picture', 'piece' (stitches or pattern changed)
import { createRenderer, LAYERS } from './renderer.js';
import { REGION_FILLS, regionLegs } from './fills.js';
import { TONE_STITCHES, samplePicture, convertPicture } from './picture.js';
import { drawCallaLilies } from './starter.js';
import { FLOSS, outlineShade, lightness } from './floss.js';

// The canvas is a sheet of a set size; the cell size decides how many squares fit on it.
export const CANVAS_PRESETS = { square: ['Square', 900, 900], landscape: ['Landscape', 1200, 900], wide: ['Wide', 1600, 900], portrait: ['Portrait', 900, 1200] };
const CANVAS_MIN = 200, CANVAS_MAX = 2400, CELL_MIN = 8, CELL_MAX = 48;
const ZOOM_MIN = 2, ZOOM_MAX = 700;
const PRESETS = { far: 4, mid: 26, close: 200 };
const STRAND_MM = 0.27;   // visible width of one strand of stranded cotton, lying flat
// Fills are laid in their own thread: a fine split strand by default, like silk shading.
export const FILL_THREADS = { fine: ['Fine', 0.6], medium: ['Medium', 1], bold: ['Bold', 2] };

export const THREADS = [
  ['Strawberry', '#C8343B'], ['Garnet', '#8E1D24'], ['Coral', '#E8735A'], ['Blush', '#F2A7A0'], ['Rust', '#B5562B'], ['Tobacco', '#7A4A2A'],
  ['Butter', '#F2D06B'], ['Mustard', '#D9A23A'], ['Lime', '#A8C64A'], ['Moss', '#8DAA3C'], ['Leaf', '#4F8A4B'], ['Pine', '#2F5A35'],
  ['Teal', '#2E8C8A'], ['Sky', '#6FA8DC'], ['Navy', '#24345C'], ['Lavender', '#9C88C9'], ['Plum', '#6B2F5E'], ['Ecru', '#EADFC8'],
  ['Pearl grey', '#B9B6AE'], ['Charcoal', '#3A3836']
];
export const SURFACES = {
  dots: { id: 0, name: 'Dot grid', color: '#F2EEE6' },
  aida: { id: 1, name: 'Aida', color: '#F4F2EC' },
  linen: { id: 2, name: 'Linen', color: '#D9CCB2' },
  denim: { id: 3, name: 'Denim', color: '#3C5A86' }
};
export const STITCH_TYPES = {
  full: ['Full cross', 'An X over one square. The everyday stitch.'],
  half: ['Half stitch', 'One diagonal. Lighter, for shading and backgrounds.'],
  quarter: ['Quarter', 'Corner to centre. Click near the corner you want.'],
  threeq: ['Three-quarter', 'Half plus a quarter, for smooth curved edges. Click near the corner.'],
  back: ['Backstitch', 'A straight line from hole to hole, for outlines. Drag to draw.']
};
// Cross and Tweed put one cross in every square; the rest lay long stitches across the shape.
const CELL_FILLS = {
  'f-cross': ['Cross', 'A cross in every square.'],
  'f-tweed': ['Tweed', 'Crosses in mixed light and dark tones of the thread.']
};
export const FILLS = { ...CELL_FILLS, ...REGION_FILLS };

export function createEditor({ stage, canvas, overlay, onChange = () => {}, onView = () => {}, onImage = null, ground = null, sheet = { w: 1600, h: 1200, cell: 12 }, accent = '#B84216' } = {}) {
  const canvasSpec = { preset: 'custom', ...sheet };
  const gridOf = () => [Math.max(4, Math.round(canvasSpec.w / canvasSpec.cell)), Math.max(4, Math.round(canvasSpec.h / canvasSpec.cell))];
  let [COLS, ROWS] = gridOf();   // canvas size in squares
  const state = {
    canvasPreset: 'landscape', picMode: 'stitched', tool: 'stitch', stitch: 'full', fill: 'columns', density: 0.85, fillThread: 'fine', picOutlineColour: 'shade', eraseWhat: 'stitches', eraseSize: 1, color: '#C8343B', strands: 2, count: 14,
    surface: 'dots', twist: 0.6, sheen: 0.35, fuzz: 0.6, guide: true, paletteOpen: false
  };
  let recents = ['#C8343B', '#8E1D24', '#4F8A4B', '#2F5A35', '#F2D06B'];

  // ---------- piece data ----------

  let stitches = new Map();   // "x,y" -> { type, color, q }
  let backs = [];             // { a: [x, y], b: [x, y], color }
  let blocks = new Map();     // "x,y" -> colour: the pattern you plan to stitch
  let regions = [];           // { kind, color, cells: Set of "x,y", density, thread, seed }: long-stitch fills
  const regionCache = new WeakMap();   // region -> legs; regions are replaced, never mutated
  const history = [];

  function snapshot() {
    history.push({ stitches: new Map(stitches), backs: backs.slice(), blocks: new Map(blocks), regions: regions.slice() });
    if (history.length > 100) history.shift();
  }
  function undo() {
    const prev = history.pop();
    if (!prev) return;
    ({ stitches, backs, blocks, regions } = prev);
    recolourFrom = null;
    notify('selection');
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
  const fillWidth = (thread) => FILL_THREADS[thread][1] * STRAND_MM * state.count / 25.4;
  const threadName = (c) => {
    const lc = c.toLowerCase(), t = THREADS.find(([, h]) => h.toLowerCase() === lc);
    if (t) return t[0];
    const f = FLOSS.find((x) => x.hex.toLowerCase() === lc);
    return f ? f.name : 'Custom';
  };

  /** Legs for one square: [from, to, layer]. Layer 0 is under, 1 is top, 2 is backstitch. */
  function legsOf(x, y, st) {
    const TL = [x, y], TR = [x + 1, y], BL = [x, y + 1], BR = [x + 1, y + 1], C = [x + 0.5, y + 0.5];
    const corner = [TL, TR, BL, BR][st.q || 0];
    switch (st.type) {
      case 'full': case 'f-cross': case 'f-tweed': return [[BL, TR, 0], [TL, BR, 1]];   // every top leg runs the same way: \
      case 'half': return [[BL, TR, 0]];
      case 'quarter': return [[corner, C, 1]];
      case 'threeq': return [st.q === 0 || st.q === 3 ? [BL, TR, 0] : [TL, BR, 0], [corner, C, 1]];
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

    const addLeg = (layer, a0, b0, rgb, r, ea = 1, eb = 1, wmul = 1) => {
      const j = (amt) => (r() - 0.5) * 2 * amt;
      // ends that carry on as the same thread (woven fills) stay put so the pieces line up
      // hand tension: holes are hit a little off-centre, legs bow and vary in thickness and dye
      const a = ea ? [a0[0] + j(0.028), a0[1] + j(0.028)] : a0, b = eb ? [b0[0] + j(0.028), b0[1] + j(0.028)] : b0;
      const tone = 1 + j(0.05);
      layers[layer].push(a[0], a[1], b[0], b[1], ...rgb.map((c) => c * tone), r(), ea && eb ? j(0.035) * wmul : 0, wmul * (1 + j(0.12)), ea, eb);

      const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]);
      const A = [d[0] / L, d[1] / L], N = [-A[1], A[0]];
      const at = (u, side) => [a[0] + d[0] * u + N[0] * side * W * 0.4, a[1] + d[1] * u + N[1] * side * W * 0.4];
      const light = rgb.map((c) => Math.min(1, c * 1.1 + 0.04));
      const count = Math.round(5 * L * wmul);
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

    const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
    for (const [key, st] of stitches) {
      const [x, y] = key.split(',').map(Number);
      if (!inside(x, y) || st.hidden || hiddenColours.has(st.color.toUpperCase())) continue;   // work outside a shrunk canvas is kept, just not shown
      const r = rng(hashStr(key + st.type + st.q));
      const rgb = hex(st.color);
      for (const [a, b, layer] of legsOf(x, y, st)) addLeg(layer, a, b, st.type === 'f-tweed' ? tweedTone(rgb, r) : rgb, r);
    }
    const holeIn = ([x, y]) => x >= 0 && y >= 0 && x <= COLS && y <= ROWS;
    for (const bk of backs) if (holeIn(bk.a) && holeIn(bk.b) && !bk.hidden && !hiddenColours.has(bk.color.toUpperCase())) addLeg(2, bk.a, bk.b, hex(bk.color), rng(hashStr(`b${bk.a}${bk.b}`)), 1, 1, bk.w || 1);
    for (const rg of regions) {
      if (rg.hidden || hiddenColours.has(rg.color.toUpperCase())) continue;
      const fw = fillWidth(rg.thread);
      let cached = regionCache.get(rg);
      if (!cached || cached.cols !== COLS || cached.rows !== ROWS) {
        const cells = new Set([...rg.cells].filter((k) => { const [x, y] = k.split(',').map(Number); return inside(x, y); }));
        cached = { cols: COLS, rows: ROWS, legs: cells.size ? regionLegs(rg.kind, cells, rg.density, rg.seed, fw, rg.angle) : [] };   // a fill wholly off a smaller sheet draws nothing
        regionCache.set(rg, cached);
      }
      const rgb = hex(rg.color), r = rng(rg.seed);
      for (const l of cached.legs) addLeg(l.layer, l.a, l.b, l.tone ? rgb.map((c) => c * l.tone) : rgb, r, l.ea, l.eb, fw / W);
    }

    // the outline (setOutline): backstitch along the edges of what's stitched, worked out again with every change
    // match: each side in a darker shade of the colour it borders (the darker of two), as the picture's outline is
    for (const o of outlineSpecs) for (const [a, b, c] of outlineEdges(o)) {
      const rgb = hex(o.match ? outlineShade(c) : o.color);
      outlineLegs(o.kind, a, b).forEach(([p, q, ea, eb, wm]) => addLeg(2, p, q, rgb, rng(hashStr(`o${p}${q}`)), ea, eb, o.w * wm));
    }

    renderer.setStitches(layers.map((l) => new Float32Array(l)), new Float32Array(hairs));
  }

  /** One step of an outline stitch along the side of a square, a → b: [from, to, enters at from, enters at to, width ×].
   * back, running: one stitch hole to hole. stem: a slanted stitch starting half a step back, so each lies beside the
   * last like a twisted rope. split: comes up through the middle of the last stitch, so they overlap end to end. chain:
   * a loop, out to one side and back, held at its far end where the next loop comes up. whipped: backstitch, with a
   * second pass of thread wrapped over it on the slant, never entering the cloth. */
  function outlineLegs(kind, a, b) {
    const d = [b[0] - a[0], b[1] - a[1]], n = [-d[1], d[0]];
    const at = (u, v = 0) => [a[0] + d[0] * u + n[0] * v, a[1] + d[1] * u + n[1] * v];
    if (kind === 'stem') return [[at(-0.45, 0.1), at(1, -0.1), 1, 1, 1]];
    if (kind === 'split') return [[at(-0.3), at(1), 1, 1, 1]];
    if (kind === 'chain') { const l = at(0.5, 0.2), r = at(0.5, -0.2), tip = at(1.05); return [[a, l, 1, 0, 0.85], [l, tip, 0, 0, 0.85], [tip, r, 0, 0, 0.85], [r, a, 0, 1, 0.85]]; }
    if (kind === 'whipped') return [[a, b, 1, 1, 1], [at(0.2, -0.13), at(0.55, 0.13), 0, 0, 0.7], [at(0.7, -0.13), at(1.05, 0.13), 0, 0, 0.7]];
    return [[a, b, 1, 1, 1]];
  }

  /** The outline's edges, [[a, b] holes, colour it borders (the darker of two)]: every side of a stitched square (a counted stitch or a fill square, not
   * hidden) that faces unstitched cloth, and with edges 'all' also every side between two colours. kind 'running'
   * keeps every other one along each line (over one, under one); each is then stitched by outlineLegs. */
  function outlineEdges({ edges = 'all', kind = 'back', area = null }) {
    const col = new Map();
    for (const [k, st] of stitches) if (!st.hidden && !hiddenColours.has(st.color.toUpperCase())) col.set(k, st.color.toUpperCase());
    for (const rg of regions) if (!rg.hidden && !hiddenColours.has(rg.color.toUpperCase())) for (const k of rg.cells) col.set(k, rg.color.toUpperCase());
    if (area) for (const k of [...col.keys()]) if (!area.has(k)) col.delete(k);   // an area's outline: what's outside it is bare cloth
    const out = [], keep = (x, y, horiz) => kind !== 'running' || ((horiz ? x : y) % 2 === 0);
    for (const [k, c] of col) {
      const [x, y] = k.split(',').map(Number);
      // [neighbour, edge from, edge to, horizontal]; a side shared by two colours is added once, from the left or top square
      for (const [nx, ny, a, b, h, first] of [[x, y - 1, [x, y], [x + 1, y], true, false], [x, y + 1, [x, y + 1], [x + 1, y + 1], true, true], [x - 1, y, [x, y], [x, y + 1], false, false], [x + 1, y, [x + 1, y], [x + 1, y + 1], false, true]]) {
        const n = col.get(`${nx},${ny}`);
        const edge = n === undefined || (edges === 'all' && n !== c && first);
        if (edge && keep(a[0], a[1], h)) out.push([a, b, n === undefined || lightness(c) <= lightness(n) ? c : n]);
      }
    }
    return out;
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
      const op = hiddenPattern.has(color.toUpperCase()) ? 0 : patternOpacity.get(color.toUpperCase()) ?? 1;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS || !op) continue;
      const i = (y * COLS + x) * 4;
      hex(color).forEach((v, k) => { data[i + k] = Math.round(v * 255); });
      data[i + 3] = Math.round(op * 255);
    }
    renderer.setGuide(COLS, ROWS, data);
  }

  let outlineSpecs = [];   // [{ color, match, w, edges, kind, area }]: the live outlines (setOutlines)

  // ---------- setup ----------

  const octx = overlay.getContext('2d');
  const renderer = createRenderer(canvas);
  if (!renderer) return null;

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

  /** The squares the eraser covers with the pointer at (wx, wy): eraseSize a side, centred on the pointer (an even
   * size on the hole nearest it), clipped to the cloth → { x0, y0, x1, y1 } (inclusive) or null */
  function eraserBox(wx, wy) {
    const n = Math.max(1, Math.round(state.eraseSize || 1));
    const x0 = Math.round(wx - n / 2), y0 = Math.round(wy - n / 2);
    const b = { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(COLS - 1, x0 + n - 1), y1: Math.min(ROWS - 1, y0 + n - 1) };
    return b.x0 > b.x1 || b.y0 > b.y1 ? null : b;
  }
  function eraseBox(b) {
    const inBox = (x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    const keyIn = (k) => { const [x, y] = k.split(',').map(Number); return inBox(x, y); };
    // eraseWhat: 'stitches' (the default), 'pattern' (the pattern squares only) or 'both'
    if (state.eraseWhat !== 'stitches') for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (blocks.delete(`${x},${y}`)) guideDirty = true;
    if (state.eraseWhat === 'pattern') return;
    let had = false;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (stitches.delete(`${x},${y}`)) had = true;
    if (regions.some((rg) => [...rg.cells].some(keyIn))) {
      regions = regions.map((rg) => ({ ...rg, cells: new Set([...rg.cells].filter((k) => !keyIn(k))) })).filter((rg) => rg.cells.size);
      had = true;
    }
    const before = backs.length;
    backs = backs.filter((bk) => !inBox(Math.floor((bk.a[0] + bk.b[0]) / 2), Math.floor((bk.a[1] + bk.b[1]) / 2)));
    if (had || backs.length !== before) sceneDirty = true;
  }

  function applyAt(wx, wy) {
    if (state.tool === 'erase') { const b = eraserBox(wx, wy); if (b) eraseBox(b); return; }
    const c = cellAt(wx, wy);
    if (!c) return;
    const key = `${c.x},${c.y}`;
    if (state.tool === 'pattern') {
      if (blocks.get(key) !== state.color) { blocks.set(key, state.color); guideDirty = true; }
      return;
    }
    const prev = stitches.get(key);
    const next = { type: state.stitch, color: state.color, q: c.q };
    if (prev && prev.type === next.type && prev.color === next.color && prev.q === next.q) return;
    stitches.set(key, next);
    removeFromRegions(new Set([key]));
    sceneDirty = true;
  }

  /** New work in a square replaces any long-stitch fill there. */
  function removeFromRegions(keys) {
    if (!regions.some((rg) => [...keys].some((k) => rg.cells.has(k)))) return;
    regions = regions.map((rg) => ({ ...rg, cells: new Set([...rg.cells].filter((k) => !keys.has(k))) })).filter((rg) => rg.cells.size);
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
    const cells = new Set();
    let colour = state.color;
    if (ca.x === cb.x && ca.y === cb.y && blocks.has(startKey)) {
      colour = blocks.get(startKey);
      const queue = [[ca.x, ca.y]];
      cells.add(startKey);
      while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${y + dy}`;
          if (!cells.has(k) && blocks.get(k) === colour) { cells.add(k); queue.push([x + dx, y + dy]); }
        }
      }
    } else {
      for (let y = Math.min(ca.y, cb.y); y <= Math.max(ca.y, cb.y); y++) {
        for (let x = Math.min(ca.x, cb.x); x <= Math.max(ca.x, cb.x); x++) cells.add(`${x},${y}`);
      }
    }
    removeFromRegions(cells);
    for (const k of cells) stitches.delete(k);
    if (CELL_FILLS[state.fill]) {
      for (const k of cells) stitches.set(k, { type: state.fill, color: colour, q: 0 });
    } else {
      regions.push({ kind: state.fill, color: colour, cells, density: state.density, thread: state.fillThread, seed: hashStr(`${startKey}${Date.now()}`) });
    }
    sceneDirty = true;
  }

  // ---------- input ----------

  const pointers = new Map();
  let mode = null;           // 'paint' | 'pan' | 'pinch' | 'back' | 'fill'
  let lastWorld = null, pinch = null, spaceHeld = false;

  function panMode() { return state.tool === 'pan' || spaceHeld; }
  function updateCursor() {
    canvas.classList.toggle('pan', panMode());
    canvas.style.cursor = !panMode() && state.tool === 'select' && hover && selection.has(cellKey(hover.wx, hover.wy)) ? 'move' : '';
  }

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
    } else if (state.tool === 'select' && !e.shiftKey && selection.has(cellKey(...w))) {
      mode = 'move';
      drag = { a: w };
      beginMove(e.altKey);
    } else if (state.tool === 'select') {
      mode = 'select';
      drag = { a: w, add: e.shiftKey };
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
    if (state.tool === 'select' && !pointers.size) updateCursor();
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
    } else if (mode === 'move' && drag) {
      moveTo(Math.round(w[0] - drag.a[0]), Math.round(w[1] - drag.a[1]));
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
    if (drag && mode === 'select') selectFrom(drag.a, [hover.wx, hover.wy], drag.add);
    if (mode === 'move') endMove();
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
    if (mode === 'paint' || mode === 'back' || mode === 'fill') pieceChanged();   // the page's lists catch up once the stroke ends
    pointers.delete(e.pointerId);
    if (!pointers.size) { mode = null; drag = null; pinch = null; canvas.classList.remove('dragging'); }
    overlayDirty = true;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (!pointers.size) { hover = null; overlayDirty = true; } });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' && peekKey && selection.size) { selPeek = true; e.preventDefault(); }   // hold Alt: the dim and fill go, the line stays
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); return; }
    if (e.key === 'Escape' && selection.size) { clearSelection(); return; }
    if (e.key === ' ' && !e.target.closest('button')) { spaceHeld = true; updateCursor(); e.preventDefault(); return; }
    const cmd = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (cmd && k === 'c' && selection.size) { copySelection(); e.preventDefault(); return; }
    if (cmd && k === 'v' && clipboard) { paste(); e.preventDefault(); return; }
    if (cmd && k === 'd' && selection.size) { duplicateSelection(); e.preventDefault(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size && !e.target.closest('button')) { deleteInSelection(null); e.preventDefault(); return; }
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (nudge && selection.size && state.tool === 'select' && !e.target.closest('button')) { const n = e.shiftKey ? 10 : 1; nudgeSelection(nudge[0] * n, nudge[1] * n); e.preventDefault(); return; }
    if (e.target.closest('button')) return;
    const cx = view.w / 2, cy = view.h / 2, step = 60 / cam.z;
    const keys = {
      '+': () => zoomAt(cx, cy, 1.25), '=': () => zoomAt(cx, cy, 1.25), '-': () => zoomAt(cx, cy, 0.8), '0': fit,
      ArrowLeft: () => { cam.x -= step; }, ArrowRight: () => { cam.x += step; },
      ArrowUp: () => { cam.y -= step; }, ArrowDown: () => { cam.y += step; },
      s: () => set('tool', 'stitch'), f: () => set('tool', 'fill'), p: () => set('tool', 'pattern'),
      e: () => set('tool', 'erase'), h: () => set('tool', 'pan'), v: () => set('tool', 'select')
    };
    if (keys[e.key]) { keys[e.key](); dirty = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceHeld = false; updateCursor(); } if (e.key === 'Alt') selPeek = false; });
  window.addEventListener('blur', () => { selPeek = false; });

  function fit() { flyTo({ x: COLS / 2, y: ROWS / 2, z: fitZoom() }); }

  /** Apply canvasSpec: recompute the grid; a picture on the canvas re-fits to it. */
  function applyCanvas() {
    const [cols, rows] = gridOf();
    notify('state');
    if (cols === COLS && rows === ROWS) return;
    // keep the work centred on the sheet; shifting by whole squares is exactly reversible
    const dx = Math.floor(cols / 2) - Math.floor(COLS / 2), dy = Math.floor(rows / 2) - Math.floor(ROWS / 2);
    if ((dx || dy) && !picture?.img) {   // a picture the page placed (no img here) moves with the rest; the page places it again
      const shift = (k) => { const [x, y] = k.split(',').map(Number); return `${x + dx},${y + dy}`; };
      stitches = new Map([...stitches].map(([k, v]) => [shift(k), v]));
      blocks = new Map([...blocks].map(([k, v]) => [shift(k), v]));
      regions = regions.map((rg) => ({ ...rg, cells: new Set([...rg.cells].map(shift)) }));
      backs = backs.map((b) => ({ ...b, a: [b.a[0] + dx, b.a[1] + dy], b: [b.b[0] + dx, b.b[1] + dy] }));
    }
    COLS = cols; ROWS = rows;
    buildFabricHairs();
    guideDirty = sceneDirty = true;
    fit();
    notify('state');
    schedulePicture();
  }

  // ---------- picture → thread ----------

  const pic = {
    mode: 'stitched',   // 'stitched': the photo becomes stitching; 'pattern': only the pattern squares, to stitch over yourself
    size: 0.85, colours: 8, removeBg: true, bgTolerance: 14, dither: false,
    light: 'half', mid: 'full', dark: 'satin', lightShare: 0.3, darkShare: 0.3,
    outline: true, outlineStrength: 0.5, outlineColour: 'shade'
  };
  let picture = null;        // { img, url, name, sample, palette }
  let picTimer = null;

  function loadPicture(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      if (picture) URL.revokeObjectURL(picture.url);
      picture = { img, url, name: file.name || 'Pasted image' };
      snapshot();
      applyPicture();
    };
    img.src = url;
  }

  /** Rebuild the whole piece from the picture with the current settings. */
  function applyPicture() {
    if (!picture) return;
    // the picture fits inside the canvas at the chosen share of it, centred
    const maxC = Math.max(4, Math.round(COLS * pic.size)), maxR = Math.max(4, Math.round(ROWS * pic.size));
    const iw = picture.img.naturalWidth || picture.img.width, ih = picture.img.naturalHeight || picture.img.height;
    const cols = Math.max(1, Math.min(maxC, Math.round(maxR * iw / ih)));
    const sampleKey = `${cols}x${maxR}`;
    if (!picture.sample || picture.sample.key !== sampleKey) picture.sample = { key: sampleKey, ...samplePicture(picture.img, cols, maxR) };
    const res = convertPicture(picture.sample, pic);
    const dx = Math.floor((COLS - res.cols) / 2), dy = Math.floor((ROWS - res.rows) / 2);
    const shift = (k) => { const [x, y] = k.split(',').map(Number); return `${x + dx},${y + dy}`; };
    blocks = new Map([...res.blocks].map(([k, v]) => [shift(k), v]));
    picture.palette = res.palette;
    picture.size = [res.cols, res.rows];
    if (pic.mode === 'pattern') {
      // pattern only: your stitches stay exactly as they are
      guideDirty = true;
      notify('picture');
      return;
    }
    stitches = new Map([...res.stitches].map(([k, v]) => [shift(k), v]));
    regions = res.regions.map((rg, i) => ({ ...rg, cells: new Set([...rg.cells].map(shift)), density: state.density, thread: state.fillThread, seed: hashStr(`pic${i}${rg.color}`) }));
    const darkest = res.palette.filter((p) => !p.outline).sort((a, b) => a.L - b.L)[0];
    const fixed = pic.outlineColour === 'thread' ? state.color : pic.outlineColour === 'darkest' && darkest ? darkest.hex : null;
    backs = res.backs.map((b) => ({ a: [b.a[0] + dx, b.a[1] + dy], b: [b.b[0] + dx, b.b[1] + dy], color: fixed || b.color, w: 0.6 }));   // outlines in a single strand
    sceneDirty = guideDirty = true;
    notify('picture');
  }

  /** Settings changes rebuild live; one undo step covers a whole burst of slider moves. */
  function schedulePicture() {
    if (!picture?.img) return;   // only a picture the lab's own pipeline holds rebuilds here
    if (!picTimer) snapshot(); else clearTimeout(picTimer);
    picTimer = setTimeout(() => { picTimer = null; applyPicture(); }, 120);
  }

  stage.addEventListener('dragover', (e) => { e.preventDefault(); });
  // a picture dropped or pasted goes to the page when it handles pictures itself (onImage), else through the lab's own settings
  const takeImage = (file) => (onImage ? onImage(file) : loadPicture(file));
  stage.addEventListener('drop', (e) => { e.preventDefault(); takeImage(e.dataTransfer.files[0]); });
  window.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((it) => it.type.startsWith('image/'));
    if (item) { takeImage(item.getAsFile()); e.preventDefault(); }
  });

  // ---------- selection and recolouring ----------

  let selection = new Set();   // "x,y" squares
  let selEdges = [];           // outline segments of the selection, for the overlay
  let selBox = null;           // the selection's bounds in squares, and how many stitches it holds, for the label
  let selLoops = [];           // the outline joined into closed loops of hole points, so dashes and corners run on
  let selShape = new Set();    // the squares the outline goes round
  /** How the selection shows over the thread (SELECTION_LOOKS): halo-dim, thick-fill, ants-dim, halo-fill */
  let selLook = 'thick-fill';
  /** When the fill (the tint over the selected squares) shows (SELECTION_FILLS): 'always'; 'edit', gone while the
   * selection is being changed (setSelectionEditing), so its stitches show their true colours; 'fade', for a moment
   * after selecting, then only the line */
  let selFillMode = 'edit-dim';   // 'edit-dim': as 'edit', and the cloth outside the selection dims slightly while editing
  let selEditing = false, selAt = 0, selPeek = false, peekKey = true;
  let selFill = 1, selShow = 1, selDim = 0;   // how much of the fill, the whole selection and the editing dim show now (eased)
  let recolourFrom = null;     // the colour in the selection being replaced
  let recolourPattern = true;  // also recolour the pattern squares underneath

  /** What colour shows in each square: stitches over fills over pattern. */
  function cellColours() {
    const m = new Map(blocks);
    for (const rg of regions) for (const k of rg.cells) m.set(k, rg.color);
    for (const [k, st] of stitches) m.set(k, st.color);
    return m;
  }

  /** Squares with thread in them: stitches, fills and backstitch. */
  function stitchedCells() {
    const m = new Set(stitches.keys());
    for (const rg of regions) for (const k of rg.cells) m.add(k);
    for (const bk of backs) m.add(backCell(bk));
    return m;
  }

  /** Drag: the stitches inside a rectangle (the pattern squares when it holds no stitches). Click: the connected patch
   * of the colour clicked. Shift adds. */
  function selectFrom(a, b, add) {
    const ca = clampCell(...a), cb = clampCell(...b), picked = new Set();
    if (ca.x === cb.x && ca.y === cb.y) {
      const colours = cellColours(), start = `${ca.x},${ca.y}`, target = colours.get(start);
      if (target) {
        const queue = [[ca.x, ca.y]];
        picked.add(start);
        while (queue.length) {
          const [x, y] = queue.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${x + dx},${y + dy}`;
            if (!picked.has(k) && colours.get(k) === target) { picked.add(k); queue.push([x + dx, y + dy]); }
          }
        }
      }
    } else {
      const x0 = Math.min(ca.x, cb.x), x1 = Math.max(ca.x, cb.x), y0 = Math.min(ca.y, cb.y), y1 = Math.max(ca.y, cb.y);
      const inside = (k) => { const [x, y] = k.split(',').map(Number); return x >= x0 && x <= x1 && y >= y0 && y <= y1; };
      for (const k of stitchedCells()) if (inside(k)) picked.add(k);
      if (!picked.size) for (const k of blocks.keys()) if (inside(k)) picked.add(k);
    }
    selection = add ? new Set([...selection, ...picked]) : picked;
    recolourFrom = null;
    updateSelection();
  }

  function clearSelection() { selection = new Set(); recolourFrom = null; updateSelection(); }

  function updateSelection() {
    selEdges = [];
    selBox = null;
    // the outline goes round squares with stitches, fills or pattern in them; a square that only holds part of a
    // backstitch (often the one just outside a shape's edge) is selected but doesn't widen the outline
    const filled = (k) => stitches.has(k) || blocks.has(k) || regions.some((rg) => rg.cells.has(k));
    let shape = new Set([...selection].filter(filled));
    if (!shape.size) shape = selection;
    for (const k of shape) {
      const [x, y] = k.split(',').map(Number);
      if (!selBox) selBox = { x0: x, y0: y, x1: x, y1: y, n: 0 };
      selBox.x0 = Math.min(selBox.x0, x); selBox.y0 = Math.min(selBox.y0, y);
      selBox.x1 = Math.max(selBox.x1, x); selBox.y1 = Math.max(selBox.y1, y);
      if (!shape.has(`${x - 1},${y}`)) selEdges.push([x, y, x, y + 1]);
      if (!shape.has(`${x + 1},${y}`)) selEdges.push([x + 1, y, x + 1, y + 1]);
      if (!shape.has(`${x},${y - 1}`)) selEdges.push([x, y, x + 1, y]);
      if (!shape.has(`${x},${y + 1}`)) selEdges.push([x, y + 1, x + 1, y + 1]);
    }
    if (selBox) selBox.n = selectionStitches();
    selAt = performance.now();
    selShape = shape;
    selLoops = joinEdges(selEdges);
    overlayDirty = true;
    notify('selection');
  }

  /** Unit edges → closed loops of points (a corner where two squares only touch is passed straight through). */
  function joinEdges(edges) {
    const at = new Map(), key = (x, y) => `${x},${y}`, used = new Set();
    edges.forEach((e, i) => { for (const k of [key(e[0], e[1]), key(e[2], e[3])]) (at.get(k) || at.set(k, []).get(k)).push(i); });
    const loops = [];
    edges.forEach((e, i) => {
      if (used.has(i)) return;
      used.add(i);
      const loop = [[e[0], e[1]], [e[2], e[3]]];
      for (;;) {
        const [x, y] = loop[loop.length - 1], next = (at.get(key(x, y)) || []).find((j) => !used.has(j));
        if (next === undefined) break;
        used.add(next);
        const n = edges[next];
        loop.push(n[0] === x && n[1] === y ? [n[2], n[3]] : [n[0], n[1]]);
      }
      loops.push(loop);
    });
    return loops;
  }

  /** Stitches in the selection: each stitched square (a cross, a part stitch, a fill's square) and each backstitch;
   * pattern squares when nothing in it is stitched. */
  function selectionStitches() {
    let n = 0;
    for (const k of selection) if (stitches.has(k) || regions.some((rg) => rg.cells.has(k))) n++;
    for (const bk of backs) if (selection.has(backCell(bk))) n++;
    return n || [...selection].filter((k) => blocks.has(k)).length;
  }

  const backCell = (bk) => `${Math.floor((bk.a[0] + bk.b[0]) / 2 - (bk.a[0] === bk.b[0] ? 0.5 : 0))},${Math.floor((bk.a[1] + bk.b[1]) / 2 - (bk.a[1] === bk.b[1] ? 0.5 : 0))}`;

  /** Colours used inside the selection, most squares first. Backstitch counts separately. */
  function selectionColours() {
    const counts = new Map(), bump = (c, k, hid) => {
      const e = counts.get(c) || { squares: 0, backs: 0, hidden: true }; e[k]++; e.hidden = e.hidden && !!hid; counts.set(c, e);
    };
    for (const k of selection) {
      const st = stitches.get(k);
      if (st) { bump(st.color, 'squares', st.hidden); continue; }
      const rg = regions.find((r) => r.cells.has(k));
      if (rg) bump(rg.color, 'squares', rg.hidden);
    }
    for (const bk of backs) if (selection.has(backCell(bk))) bump(bk.color, 'backs', bk.hidden);
    return [...counts].sort((a, b) => (b[1].squares + b[1].backs) - (a[1].squares + a[1].backs));
  }

  /** The selection's stitches grouped by kind and colour together ([kind, colour, how many]), most first */
  function selectionGroups() {
    const n = new Map(), bump = (kind, c) => { const key = `${kind}|${c.toUpperCase()}`; n.set(key, (n.get(key) || 0) + 1); };
    for (const k of selection) { const st = stitches.get(k); if (st) { bump(st.type, st.color); continue; } const rg = regions.find((r) => r.cells.has(k)); if (rg) bump(rg.kind, rg.color); }
    for (const b of backs) if (selection.has(backCell(b))) bump('back', b.color);
    return [...n].sort((a, b) => b[1] - a[1]).map(([key, c]) => [...key.split('|'), c]);
  }

  /** The stitches in the selection by kind ('full', 'half', … fill kinds, 'back') with how many, most first */
  function selectionKinds() {
    const n = new Map(), bump = (k) => n.set(k, (n.get(k) || 0) + 1);
    for (const k of selection) { const st = stitches.get(k); if (st) { bump(st.type); continue; } const rg = regions.find((r) => r.cells.has(k)); if (rg) bump(rg.kind); }
    for (const b of backs) if (selection.has(backCell(b))) bump('back');
    return [...n].sort((a, b) => b[1] - a[1]);
  }

  /** Swap one colour for another, only inside the selection. Fills that cross its edge are split. */
  function recolour(from, to, pattern = recolourPattern, history = true) {
    if (!selection.size || from === to) return;
    if (history) snapshot();
    for (const k of selection) {
      const st = stitches.get(k);
      if (st && st.color === from) stitches.set(k, { ...st, color: to });
      if (pattern && blocks.get(k) === from) blocks.set(k, to);
    }
    backs = backs.map((bk) => (bk.color === from && selection.has(backCell(bk)) ? { ...bk, color: to } : bk));
    regions = regions.flatMap((rg) => {
      if (rg.color !== from) return [rg];
      const inside = new Set([...rg.cells].filter((k) => selection.has(k)));
      if (!inside.size) return [rg];
      if (inside.size === rg.cells.size) return [{ ...rg, color: to }];
      const outside = new Set([...rg.cells].filter((k) => !inside.has(k)));
      return [{ ...rg, cells: outside }, { ...rg, cells: inside, color: to }];
    });
    // a picture still open would rebuild over this edit, so the piece is yours from here
    if (picture) { picture = null; notify('picture'); }
    recolourFrom = to;
    sceneDirty = guideDirty = true;
    notify('selection');
  }

  /** Change the selected stitches themselves: their colour (every selected stitch, fill square and backstitch takes it)
   * or their stitch (a counted stitch or a fill; fill squares that change to a counted stitch leave their fill, and a
   * change to a long-stitch fill makes one fill per colour). history: false skips the undo step (a colour being dragged). */
  function restyleSelection({ color = null, kind = null, only = null, onlyColour = null } = {}, { history = true } = {}) {
    if (!selection.size || (kind === 'back')) return;
    // only: change just the selected stitches of that kind
    const kindAt = (k) => stitches.get(k)?.type || regions.find((rg) => rg.cells.has(k))?.kind;
    const colourAt = (k) => stitches.get(k)?.color || regions.find((rg) => rg.cells.has(k))?.color;
    const cells = [...selection].filter((k) => (stitches.has(k) || regions.some((rg) => rg.cells.has(k))) && (!only || kindAt(k) === only) && (!onlyColour || same(colourAt(k), onlyColour)));
    if (!cells.length && !(color && backs.some((bk) => selection.has(backCell(bk))))) return;
    if (history) snapshot();
    if (kind == null) {
      for (const k of cells) { const st = stitches.get(k); if (st) stitches.set(k, { ...st, color }); }
      backs = backs.map((bk) => (selection.has(backCell(bk)) ? { ...bk, color } : bk));
      regions = regions.flatMap((rg) => {
        const inside = new Set([...rg.cells].filter((k) => selection.has(k)));
        if (!inside.size) return [rg];
        if (inside.size === rg.cells.size) return [{ ...rg, color }];
        return [{ ...rg, cells: new Set([...rg.cells].filter((k) => !inside.has(k))) }, { ...rg, cells: inside, color }];
      });
    } else {
      // what each selected square is now: its colour and corner
      const was = new Map(cells.map((k) => {
        const st = stitches.get(k);
        return [k, st || { color: regions.find((rg) => rg.cells.has(k)).color, q: 0 }];
      }));
      removeFromRegions(new Set(cells));
      if (!FILLS[kind] || CELL_FILLS[kind]) {
        for (const k of cells) stitches.set(k, { type: kind, color: color || was.get(k).color, q: was.get(k).q || 0 });
      } else {
        const byColour = new Map();
        for (const k of cells) { stitches.delete(k); const c = color || was.get(k).color; (byColour.get(c) || byColour.set(c, new Set()).get(c)).add(k); }
        for (const [c, set] of byColour) regions.push({ kind, color: c, cells: set, density: state.density, thread: state.fillThread, seed: hashStr(`${c}${Date.now()}`) });
      }
    }
    // a picture still open would rebuild over this edit, so the piece is yours from here
    if (picture) { picture = null; notify('picture'); }
    sceneDirty = guideDirty = true;
    notify('piece');
    notify('selection');
  }

  // ---------- moving, copying, flipping and outlining the selection ----------

  const cellKey = (wx, wy) => `${Math.floor(wx)},${Math.floor(wy)}`;
  let clipboard = null, pasteN = 0, moving = null;

  /** The squares a backstitch lies along: both sides of an edge, or the square a diagonal crosses */
  function backCells(bk) {
    const [ax, ay] = bk.a, [bx, by] = bk.b;
    if (ay === by && Math.abs(ax - bx) === 1) { const x = Math.min(ax, bx); return [`${x},${ay - 1}`, `${x},${ay}`]; }
    if (ax === bx && Math.abs(ay - by) === 1) { const y = Math.min(ay, by); return [`${ax - 1},${y}`, `${ax},${y}`]; }
    return [backCell(bk)];
  }
  const backTouches = (bk, keys) => backCells(bk).some((k) => keys.has(k));

  /** What's in the selection, lifted: its stitches, the parts of fills inside it, the backstitch along it, and its
   * pattern squares when nothing in it is stitched */
  function liftOf(keys = selection) {
    const st = [...stitches].filter(([k]) => keys.has(k)).map(([k, v]) => [k, { ...v }]);
    const rg = regions.map((r) => ({ ...r, cells: new Set([...r.cells].filter((k) => keys.has(k))) })).filter((r) => r.cells.size);
    const bk = backs.filter((b) => backTouches(b, keys)).map((b) => ({ ...b }));
    const bl = st.length || rg.length || bk.length ? [] : [...blocks].filter(([k]) => keys.has(k));
    return { stitches: st, regions: rg, backs: bk, blocks: bl, cells: new Set(keys) };
  }
  /** Take a lift's things out of the piece */
  function removeLift(lift) {
    for (const [k] of lift.stitches) stitches.delete(k);
    removeFromRegions(lift.cells);
    backs = backs.filter((b) => !backTouches(b, lift.cells));
    for (const [k] of lift.blocks) blocks.delete(k);
  }
  /** Put a lift down through a map of squares and holes (x, y → [x, y]); stitches already where it lands are replaced.
   * flip: [fx, fy] mirrors the corner of quarter stitches. Returns the squares it covers. */
  function placeLift(lift, cellMap, holeMap, flip = [false, false]) {
    const to = (k) => cellMap(...k.split(',').map(Number)).join(',');
    const keys = new Set([...lift.cells].map(to));
    // whatever is stitched where the lift's stitches and fills land gives way to them
    const landing = new Set([...lift.regions.flatMap((r) => [...r.cells]), ...lift.stitches.map(([k]) => k)].map(to));
    for (const k of landing) stitches.delete(k);
    removeFromRegions(landing);
    const q = (v) => (v || 0) ^ (flip[0] ? 1 : 0) ^ (flip[1] ? 2 : 0);
    for (const [k, st] of lift.stitches) stitches.set(to(k), { ...st, q: st.type === 'quarter' || st.type === 'threeq' ? q(st.q) : st.q });
    for (const r of lift.regions) regions.push({ ...r, cells: new Set([...r.cells].map(to)) });
    for (const b of lift.backs) backs.push({ ...b, a: holeMap(...b.a), b: holeMap(...b.b) });
    for (const [k, c] of lift.blocks) blocks.set(to(k), c);
    if (lift.blocks.length) guideDirty = true;
    sceneDirty = true;
    return keys;
  }
  const yours = () => { if (picture) { picture = null; notify('picture'); } };

  /** Start moving the selection (copy: leave the original where it is). moveTo(dx, dy) then puts it that many squares
   * away, as many times as the pointer moves; endMove() finishes. One undo step. */
  function beginMove(copy = false) {
    if (!selection.size) return;
    snapshot(); yours();
    const lift = liftOf();
    if (!copy) removeLift(lift);
    moving = { lift, base: { stitches: new Map(stitches), regions: regions.slice(), backs: backs.slice(), blocks: new Map(blocks) }, dx: 0, dy: 0 };
    moveTo(0, 0, true);
  }
  function moveTo(dx, dy, force = false) {
    if (!moving || (!force && dx === moving.dx && dy === moving.dy)) return;
    ({ stitches, regions, backs } = { stitches: new Map(moving.base.stitches), regions: moving.base.regions.slice(), backs: moving.base.backs.slice() });
    blocks = new Map(moving.base.blocks);
    selection = placeLift(moving.lift, (x, y) => [x + dx, y + dy], (x, y) => [x + dx, y + dy]);
    moving.dx = dx; moving.dy = dy;
    guideDirty = true;
    updateSelection();
  }
  function endMove() { if (!moving) return; moving = null; notify('piece'); }
  function nudgeSelection(dx, dy) { beginMove(false); moveTo(dx, dy); endMove(); }
  /** A copy two squares down and right of it, selected */
  function duplicateSelection() { beginMove(true); moveTo(2, 2); endMove(); }
  function copySelection() { clipboard = liftOf(); pasteN = 0; }
  /** The copy, a little further down and right each time, selected */
  function paste() {
    if (!clipboard) return;
    snapshot(); yours();
    const d = 2 * ++pasteN;
    if (state.tool !== 'select') set('tool', 'select');
    selection = placeLift(clipboard, (x, y) => [x + d, y + d], (x, y) => [x + d, y + d]);
    updateSelection(); notify('piece');
  }
  /** Mirror the selection in place, left to right (horizontal) or top to bottom */
  function flipSelection(horizontal = true) {
    if (!selBox) return;
    snapshot(); yours();
    const { x0, x1, y0, y1 } = selBox, lift = liftOf();
    removeLift(lift);
    selection = horizontal
      ? placeLift(lift, (x, y) => [x0 + x1 - x, y], (x, y) => [x0 + x1 + 1 - x, y], [true, false])
      : placeLift(lift, (x, y) => [x, y0 + y1 - y], (x, y) => [x, y0 + y1 + 1 - y], [false, true]);
    updateSelection(); notify('piece');
  }
  /** Select every stitched square that isn't selected, and let go of the rest */
  function invertSelection() {
    const all = stitchedCells();
    selection = new Set([...all].filter((k) => !selection.has(k)));
    updateSelection();
  }
  /** Unpick the selection into pattern squares in its colours: the plan stays, the thread goes */
  function selectionToPattern() {
    if (!selection.size) return;
    snapshot(); yours();
    const colours = cellColours();
    for (const k of selection) { const st = stitches.get(k), rg = regions.find((r) => r.cells.has(k)); if (st || rg) blocks.set(k, colours.get(k)); }
    removeLift(liftOf());
    sceneDirty = guideDirty = true;
    updateSelection(); notify('piece');
  }
  /** The selection's outline: backstitch along every edge of its shape, a shade darker than its main colour */
  const edgeBack = (e, b) => (b.a[0] === e[0] && b.a[1] === e[1] && b.b[0] === e[2] && b.b[1] === e[3]) || (b.a[0] === e[2] && b.a[1] === e[3] && b.b[0] === e[0] && b.b[1] === e[1]);
  function hasOutline() { return selEdges.length > 0 && selEdges.every((e) => backs.some((b) => edgeBack(e, b))); }
  function toggleOutline(color = null) {
    if (!selEdges.length) return;
    snapshot(); yours();
    if (hasOutline()) backs = backs.filter((b) => !selEdges.some((e) => edgeBack(e, b)));
    else {
      const main = selectionColours()[0]?.[0] || state.color;
      const c = color || '#' + hex(main).map((v) => Math.round(v * 255 * 0.62).toString(16).padStart(2, '0')).join('');
      for (const e of selEdges) if (!backs.some((b) => edgeBack(e, b))) backs.push({ a: [e[0], e[1]], b: [e[2], e[3]], color: c.toUpperCase(), w: 1.2 });
    }
    sceneDirty = true;
    updateSelection(); notify('piece');
  }
  /** Where the selection is on screen ({ left, top, right, bottom } in px of the stage), for things that float by it */
  function selectionRect() {
    if (!selBox) return null;
    const [l, t] = toScreen(selBox.x0, selBox.y0), [r, b] = toScreen(selBox.x1 + 1, selBox.y1 + 1);
    return { left: l, top: t, right: r, bottom: b };
  }

  /** Take hold of one colour, to change it again and again while a colour picker is dragged: everything in it (its
   * stitches, fills, backstitch and pattern squares; within: only inside the selection, fills split at its edge) is
   * remembered once, so set(hex) recolours exactly those, never a colour it passes through on the way, and fills keep
   * their drawn shape (only the colour changes). One undo step for the whole hold. → { set(hex) } */
  function grabColour(c, { within = false, pattern = true, kind = null } = {}) {
    const inSel = (k) => !within || selection.has(k);
    const ofKind = (t) => !kind || t === kind;
    if (kind) pattern = false;
    snapshot();
    const held = [];
    for (const [k, st] of [...stitches]) if (same(st.color, c) && inSel(k) && ofKind(st.type)) { const o = { ...st }; stitches.set(k, o); held.push(o); }
    backs = backs.map((bk) => { if (!same(bk.color, c) || !inSel(backCell(bk)) || !ofKind('back')) return bk; const o = { ...bk }; held.push(o); return o; });
    regions = regions.flatMap((rg) => {
      if (!same(rg.color, c) || !ofKind(rg.kind)) return [rg];
      const inside = within ? new Set([...rg.cells].filter((k) => selection.has(k))) : rg.cells;
      if (!inside.size) return [rg];
      if (inside.size === rg.cells.size) { const o = { ...rg }; if (regionCache.has(rg)) regionCache.set(o, regionCache.get(rg)); held.push(o); return [o]; }
      const o = { ...rg, cells: inside }; held.push(o);
      return [{ ...rg, cells: new Set([...rg.cells].filter((k) => !inside.has(k))) }, o];
    });
    const squares = pattern ? [...blocks].filter(([k, v]) => same(v, c) && inSel(k)).map(([k]) => k) : [];
    if (picture) { picture = null; notify('picture'); }
    return {
      set(hex) {
        for (const o of held) o.color = hex;
        for (const k of squares) blocks.set(k, hex);
        sceneDirty = true; if (squares.length) guideDirty = true;
        notify('piece');
        if (within) notify('selection');
      },
    };
  }

  /** Hide or show the stitches of one colour inside the selection (every colour when c is null). A fill crossing the
   * selection's edge is split so only its part inside hides. */
  function hideInSelection(c, on) {
    if (!selection.size) return;
    const match = (col) => c == null || same(col, c);
    for (const k of selection) { const st = stitches.get(k); if (st && match(st.color)) stitches.set(k, { ...st, hidden: on }); }
    backs = backs.map((bk) => (match(bk.color) && selection.has(backCell(bk)) ? { ...bk, hidden: on } : bk));
    regions = regions.flatMap((rg) => {
      if (!match(rg.color)) return [rg];
      const inside = new Set([...rg.cells].filter((k) => selection.has(k)));
      if (!inside.size) return [rg];
      if (inside.size === rg.cells.size) return [{ ...rg, hidden: on }];
      return [{ ...rg, cells: new Set([...rg.cells].filter((k) => !inside.has(k))) }, { ...rg, cells: inside, hidden: on }];
    });
    sceneDirty = true;
    notify('selection');
  }

  /** Take out the stitches of one colour inside the selection (every colour when c is null) */
  function deleteInSelection(c) {
    if (!selection.size) return;
    snapshot();
    const match = (col) => c == null || same(col, c);
    for (const k of selection) { const st = stitches.get(k); if (st && match(st.color)) stitches.delete(k); }
    backs = backs.filter((bk) => !(match(bk.color) && selection.has(backCell(bk))));
    regions = regions.map((rg) => (match(rg.color) ? { ...rg, cells: new Set([...rg.cells].filter((k) => !selection.has(k))) } : rg)).filter((rg) => rg.cells.size);
    if (picture) { picture = null; notify('picture'); }
    sceneDirty = true;
    if (c == null) { selection = new Set(); recolourFrom = null; }   // nothing is left to select
    updateSelection();
    notify('piece');
  }

  // ---------- overlay: cursor preview ----------

  function drawOverlay() {
    const d = dpr();
    octx.setTransform(d, 0, 0, d, 0, 0);
    octx.clearRect(0, 0, view.w, view.h);
    // a 1px line on the pixel grid, so it stays crisp
    const px = (v) => Math.round(v * d) / d + 0.5 / d;
    if (selEdges.length) drawSelection(px);
    if (!hover || mode === 'pan' || mode === 'pinch' || panMode()) return;
    octx.lineWidth = 1.5;
    octx.strokeStyle = accent;
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
    if ((state.tool === 'fill' || state.tool === 'select') && drag) {
      const a = clampCell(...drag.a), b = clampCell(hover.wx, hover.wy);
      const [x0, y0] = toScreen(Math.min(a.x, b.x), Math.min(a.y, b.y));
      const [x1, y1] = toScreen(Math.max(a.x, b.x) + 1, Math.max(a.y, b.y) + 1);
      if (state.tool === 'select') {
        // the rectangle being dragged: a 1px line, no fill
        octx.lineWidth = 1;
        octx.strokeRect(px(x0), px(y0), px(x1 - 1) - px(x0), px(y1 - 1) - px(y0));
        return;
      }
      octx.save(); octx.globalAlpha = 0.12; octx.fillStyle = accent; octx.fillRect(x0, y0, x1 - x0, y1 - y0); octx.restore();
      octx.strokeRect(x0 + 0.75, y0 + 0.75, x1 - x0 - 1.5, y1 - y0 - 1.5);
      return;
    }
    if (state.tool === 'erase') { drawEraser(eraserBox(hover.wx, hover.wy)); return; }
    const c = cellAt(hover.wx, hover.wy);
    if (!c) return;
    const [x, y] = toScreen(c.x, c.y);
    if (state.tool === 'pattern') {
      octx.save(); octx.globalAlpha = 0.45; octx.fillStyle = state.color; octx.fillRect(x, y, cam.z, cam.z); octx.restore();
    }
    octx.strokeRect(x + 0.75, y + 0.75, cam.z - 1.5, cam.z - 1.5);
    if (state.tool === 'stitch' && (state.stitch === 'quarter' || state.stitch === 'threeq')) {
      const [cx, cy] = [[c.x, c.y], [c.x + 1, c.y], [c.x, c.y + 1], [c.x + 1, c.y + 1]][c.q];
      const [px, py] = toScreen(cx, cy);
      octx.fillStyle = accent;
      octx.beginPath(); octx.arc(px, py, Math.max(3, cam.z * 0.1), 0, Math.PI * 2); octx.fill();
    }
  }

  /** The eraser under the pointer, kept quiet: every square it covers, a faint wash with faint lines between them,
   * then a thin soft edge */
  function drawEraser(b) {
    if (!b) return;
    const [x0, y0] = toScreen(b.x0, b.y0), [x1, y1] = toScreen(b.x1 + 1, b.y1 + 1), r = (v) => Math.round(v) + 0.5;
    octx.save();
    octx.fillStyle = 'rgba(255,255,255,0.14)'; octx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (cam.z >= 6 && (b.x1 > b.x0 || b.y1 > b.y0)) {
      octx.beginPath();
      for (let x = b.x0 + 1; x <= b.x1; x++) { const sx = r(toScreen(x, 0)[0]); octx.moveTo(sx, y0); octx.lineTo(sx, y1); }
      for (let y = b.y0 + 1; y <= b.y1; y++) { const sy = r(toScreen(0, y)[1]); octx.moveTo(x0, sy); octx.lineTo(x1, sy); }
      octx.strokeStyle = 'rgba(20,18,16,0.1)'; octx.lineWidth = 1; octx.stroke();
    }
    octx.lineWidth = 1; octx.strokeStyle = 'rgba(20,18,16,0.32)'; octx.strokeRect(r(x0), r(y0), Math.round(x1 - x0) - 1, Math.round(y1 - y0) - 1);
    octx.restore();
  }

  /** The selection in its look: dim what's outside or tint what's inside, then the outline (a line with a white halo,
   * a 2px line, or marching ants), then the count. */
  function drawSelection(px) {
    const outline = () => {
      octx.beginPath();
      for (const loop of selLoops) loop.forEach(([x, y], i) => { const [sx, sy] = toScreen(x, y); octx[i ? 'lineTo' : 'moveTo'](px(sx), px(sy)); });
    };
    const squares = () => {
      octx.beginPath();
      for (const k of selShape) { const [x, y] = k.split(',').map(Number), [sx, sy] = toScreen(x, y); octx.rect(sx, sy, cam.z, cam.z); }
    };
    if (selShow < 0.01) return;
    octx.save();
    octx.globalAlpha = selShow;
    // a veil over everything but the selected squares: always in the dim looks, while editing in edit-dim
    const veil = selLook.endsWith('dim') ? (selPeek ? 0 : 0.32) : 0.22 * selDim;
    if (veil > 0.005) {
      octx.fillStyle = `rgba(18, 20, 24, ${veil})`;
      octx.fillRect(0, 0, view.w, view.h);
      // cut the selected squares out of it completely (destination-out takes away as much as the fill's own alpha)
      octx.globalCompositeOperation = 'destination-out';
      octx.fillStyle = '#000';
      squares(); octx.fill();
      octx.globalCompositeOperation = 'source-over';
    }
    if (selLook.endsWith('fill') && selFill > 0.01) { octx.globalAlpha = 0.18 * selFill * selShow; octx.fillStyle = accent; squares(); octx.fill(); }
    octx.globalAlpha = selShow;
    octx.lineJoin = 'miter'; octx.lineCap = 'butt';
    if (selLook.startsWith('halo')) {
      outline();
      octx.lineWidth = 3; octx.strokeStyle = '#FFFFFF'; octx.stroke();
      octx.lineWidth = 1; octx.strokeStyle = accent; octx.stroke();
    } else if (selLook.startsWith('thick')) {
      octx.beginPath();
      for (const loop of selLoops) loop.forEach(([x, y], i) => { const [sx, sy] = toScreen(x, y); octx[i ? 'lineTo' : 'moveTo'](Math.round(sx), Math.round(sy)); });
      octx.lineWidth = 2; octx.strokeStyle = accent; octx.stroke();
    } else if (selLook.startsWith('ants')) {
      outline();
      octx.lineWidth = 1; octx.strokeStyle = '#121418'; octx.stroke();
      octx.setLineDash([4, 4]); octx.lineDashOffset = -(performance.now() / 60) % 8;
      octx.strokeStyle = '#FFFFFF'; octx.stroke();
    }
    octx.restore();
    if (selBox && !(drag && mode === 'select')) { octx.save(); octx.globalAlpha = selShow; selectionLabel(selBox); octx.restore(); }
  }

  /** Ease the fill and the whole selection toward what they should show now; true while they're still moving. */
  function easeSelection(now) {
    if (!selEdges.length) return false;
    const editMode = selFillMode.startsWith('edit');
    // holding Alt takes the dim and the fill away and leaves the line, to see the work around the selection as it is
    const fillTo = selPeek ? 0 : editMode ? (selEditing ? 0 : 1) : selFillMode === 'fade' ? (now - selAt < 900 ? 1 : 0) : 1;
    const dimTo = !selPeek && selFillMode === 'edit-dim' && selEditing ? 1 : 0;
    const showTo = 1, k = 0.2;
    const ease = (v, to) => { const n = v + (to - v) * k; return Math.abs(to - n) < 0.005 ? to : n; };
    selFill = ease(selFill, fillTo); selShow = ease(selShow, showTo); selDim = ease(selDim, dimTo);
    return selFill !== fillTo || selShow !== showTo || selDim !== dimTo || (selFillMode === 'fade' && now - selAt < 1000);
  }

  /** How many stitches are selected, in a tight label under the selection (above it near the window's bottom). */
  function selectionLabel(b) {
    const text = `${b.n} ${b.n === 1 ? 'stitch' : 'stitches'}`;
    octx.font = '500 11px "Golos Text", system-ui, sans-serif';
    const w = Math.ceil(octx.measureText(text).width) + 8, h = 16, gap = 6;
    const [l, t] = toScreen(b.x0, b.y0), [r, bt] = toScreen(b.x1 + 1, b.y1 + 1);
    let x = Math.round((l + r) / 2 - w / 2), y = Math.round(bt + gap);
    if (y + h > view.h - 8) y = Math.round(t - gap - h);
    x = Math.max(8, Math.min(view.w - w - 8, x));
    octx.fillStyle = accent;
    octx.beginPath(); octx.roundRect(x, y, w, h, 2); octx.fill();
    octx.fillStyle = '#FFFFFF'; octx.textBaseline = 'middle'; octx.textAlign = 'center';
    octx.fillText(text, x + w / 2, y + h / 2 + 0.5);
    octx.textAlign = 'start'; octx.textBaseline = 'alphabetic';
  }

  // ---------- HUD + frame loop ----------

  let lastHud = '';
  function hud() {
    const z = cam.z, lod = z < 8 ? 'far' : z < 60 ? 'mid' : 'close', key = `${z.toFixed(2)}`;
    if (key === lastHud) return;
    lastHud = key;
    onView({ z, lod, life: z / lifeSize(), fit: z / fitZoom() });
  }

  function frame(now) {
    requestAnimationFrame(frame);   // first, so one bad frame can't stop the drawing for good
    if (anim) { anim(now); dirty = overlayDirty = true; }
    if (sceneDirty) { buildScene(); sceneDirty = false; dirty = true; }
    if (guideDirty) { buildGuide(); guideDirty = false; dirty = true; }
    if (dirty) {
      renderer.draw(
        { x: cam.x, y: cam.y, scale: cam.z * dpr(), cssScale: cam.z, light: LIGHT },
        {
          fabricRect: [0, 0, COLS, ROWS], surface: SURFACES[state.surface].id, cloth: hex(SURFACES[state.surface].color),
          threadWidth: threadWidth(), strands: state.strands, twist: state.twist, sheen: state.sheen, fuzz: state.fuzz, guide: state.guide, ground: ground?.()
        }
      );
      hud();
      dirty = false;
    }
    if (selLook.startsWith('ants') && selEdges.length) overlayDirty = true;   // the ants march
    if (easeSelection(now)) overlayDirty = true;
    if (overlayDirty) { drawOverlay(); overlayDirty = false; }
  }

  // ---------- what a page can see and do ----------

  const hiddenColours = new Set(), hiddenPattern = new Set(), patternOpacity = new Map();
  let changeTimer = 0;
  function notify(kind) {
    onChange(kind);
    if (kind === 'piece') return;
    clearTimeout(changeTimer); changeTimer = setTimeout(() => onChange('piece'), 60);
  }
  // the piece changed under a tool: tell the page once the stroke settles
  const pieceChanged = () => { clearTimeout(changeTimer); changeTimer = setTimeout(() => onChange('piece'), 120); };

  function set(key, val) {
    state[key] = val;
    if (key === 'tool') {
      updateCursor();
      if (val !== 'select' && selection.size) clearSelection();   // a selection belongs to the Select tool
    }
    if (key === 'strands' || key === 'count') { regions = regions.map((rg) => ({ ...rg })); sceneDirty = true; }
    if (key === 'surface') buildFabricHairs();
    if (key === 'guide') guideDirty = true;
    if (key === 'eraseSize' || key === 'tool') overlayDirty = true;
    if (key === 'density' || key === 'fillThread') schedulePicture();
    notify('state');
    dirty = overlayDirty = true;
  }

  /** Every colour on the cloth with how much of it there is: squares (stitches and fills) and backstitches */
  function threadColours() {
    const m = new Map(), bump = (c, k) => { c = c.toUpperCase(); const e = m.get(c) || { squares: 0, backs: 0 }; e[k]++; m.set(c, e); };
    for (const st of stitches.values()) bump(st.color, 'squares');
    for (const rg of regions) for (let i = 0; i < rg.cells.size; i++) bump(rg.color, 'squares');
    for (const bk of backs) bump(bk.color, 'backs');
    return [...m].sort((a, b) => (b[1].squares + b[1].backs) - (a[1].squares + a[1].backs));
  }
  /** The pattern's colours with their square counts */
  function patternColours() {
    const m = new Map();
    for (const c of blocks.values()) { const k = c.toUpperCase(); m.set(k, (m.get(k) || 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1]);
  }
  /** Every stitch on the cloth by kind: [kind, count], most first ('back' counts backstitches) */
  function stitchKinds() {
    const m = new Map(), bump = (k, n = 1) => m.set(k, (m.get(k) || 0) + n);
    for (const st of stitches.values()) bump(st.type);
    for (const rg of regions) bump(rg.kind, rg.cells.size);
    if (backs.length) bump('back', backs.length);
    return [...m].sort((a, b) => b[1] - a[1]);
  }
  const same = (a, b) => a.toUpperCase() === b.toUpperCase();
  /** Change one colour to another everywhere it's stitched (and in the pattern) */
  /** Change a colour everywhere: in the stitches and the pattern squares, or only one of them; history: false skips the
   * undo step (a colour being dragged in the picker) */
  function recolourAll(from, to, { stitches: inStitches = true, pattern = true, history = true } = {}) {
    if (history) snapshot();
    if (inStitches) {
      for (const [k, st] of stitches) if (same(st.color, from)) stitches.set(k, { ...st, color: to });
      backs = backs.map((bk) => (same(bk.color, from) ? { ...bk, color: to } : bk));
      regions = regions.map((rg) => (same(rg.color, from) ? { ...rg, color: to } : rg));
    }
    if (pattern) for (const [k, c] of blocks) if (same(c, from)) blocks.set(k, to);
    sceneDirty = guideDirty = true; notify('piece');
  }
  /** Take out every stitch in a colour (pattern: its squares instead) */
  function deleteColour(c, { pattern = false } = {}) {
    snapshot();
    if (pattern) { for (const [k, v] of [...blocks]) if (same(v, c)) blocks.delete(k); guideDirty = true; }
    else {
      for (const [k, st] of [...stitches]) if (same(st.color, c)) stitches.delete(k);
      backs = backs.filter((bk) => !same(bk.color, c)); regions = regions.filter((rg) => !same(rg.color, c));
      sceneDirty = true;
    }
    notify('piece');
  }
  /** Take out every pattern square, one undo step */
  function clearPattern() { snapshot(); blocks = new Map(); guideDirty = true; notify('piece'); }
  /** Take out every stitch of a kind */
  function deleteKind(kind, { within = false } = {}) {
    snapshot();
    const inSel = (k) => !within || selection.has(k);
    if (kind === 'back') backs = backs.filter((b) => !inSel(backCell(b)));
    for (const [k, st] of [...stitches]) if (st.type === kind && inSel(k)) stitches.delete(k);
    regions = regions.map((rg) => (rg.kind === kind ? { ...rg, cells: new Set([...rg.cells].filter((k) => !inSel(k))) } : rg)).filter((rg) => rg.cells.size);
    if (within) { if (picture) { picture = null; notify('picture'); } updateSelection(); }
    sceneDirty = true; notify('piece');
  }
  /** Select every square in a colour (Select tool) */
  function selectColour(c, { within = false } = {}) {
    const keep = within ? selection : null;
    set('tool', 'select');
    selection = new Set([...cellColours()].filter(([k, v]) => same(v, c) && (!keep || keep.has(k))).map(([k]) => k));
    recolourFrom = c; updateSelection();
  }
  function selectKind(kind, { within = false } = {}) {
    const keep = within ? selection : null;
    set('tool', 'select');
    selection = new Set([...[...stitches].filter(([, st]) => st.type === kind).map(([k]) => k), ...regions.filter((rg) => rg.kind === kind).flatMap((rg) => [...rg.cells]), ...(kind === 'back' ? backs.map(backCell) : [])].filter((k) => !keep || keep.has(k)));
    updateSelection();
  }
  /** Place a converted picture (picture.js's result) in the middle of the canvas: stitched, or its pattern only */
  function placePicture(res, { stitched = true, name = 'Picture' } = {}) {
    snapshot();
    const dx = Math.floor((COLS - res.cols) / 2), dy = Math.floor((ROWS - res.rows) / 2);
    const shift = (k) => { const [x, y] = k.split(',').map(Number); return `${x + dx},${y + dy}`; };
    blocks = new Map([...res.blocks].map(([k, v]) => [shift(k), v]));
    stitches = new Map(stitched ? [...res.stitches].map(([k, v]) => [shift(k), v]) : []);
    regions = stitched ? res.regions.map((rg, i) => ({ ...rg, cells: new Set([...rg.cells].map(shift)), density: state.density, thread: state.fillThread, seed: hashStr(`pic${i}${rg.color}`) })) : [];
    backs = stitched ? (res.backs || []).map((bk) => ({ a: [bk.a[0] + dx, bk.a[1] + dy], b: [bk.b[0] + dx, bk.b[1] + dy], color: bk.color, w: bk.w || 0.6 })) : [];
    picture = { name, at: [dx, dy, res.cols, res.rows] };
    sceneDirty = guideDirty = true; notify('piece');
  }
  function clearPicture() { snapshot(); stitches = new Map(); regions = []; backs = []; blocks = new Map(); picture = null; sceneDirty = guideDirty = true; notify('piece'); }

  new ResizeObserver(resize).observe(stage);
  resize();
  if (!fitted) cam.z = fitZoom();
  buildFabricHairs();
  updateCursor();
  requestAnimationFrame(frame);

  return {
    state, set, undo: () => { undo(); notify('piece'); },
    threadColours, patternColours, stitchKinds, recolourAll, deleteColour, clearPattern, deleteKind, selectColour, selectKind, clearSelection,
    placePicture, clearPicture, hasPicture: () => !!picture,
    /** Where the picture sits on screen ([left, top, width, height] in px of the stage), for comparing it with the stitching */
    pictureRect() { if (!picture?.at) return null; const [dx, dy, c, r] = picture.at, [x0, y0] = toScreen(dx, dy), [x1, y1] = toScreen(dx + c, dy + r); return [x0, y0, x1 - x0, y1 - y0]; },
    redraw: () => { dirty = true; },
    /** Copy the cloth as it is now into a 2D canvas (drawn now, in this task, so the GL buffer is still there): laid over
     * the cloth and faded out after a change, the old stitches fade into the new */
    snapshot(to) {
      if (sceneDirty) { buildScene(); sceneDirty = false; }
      if (guideDirty) { buildGuide(); guideDirty = false; }
      renderer.draw({ x: cam.x, y: cam.y, scale: cam.z * dpr(), cssScale: cam.z, light: LIGHT },
        { fabricRect: [0, 0, COLS, ROWS], surface: SURFACES[state.surface].id, cloth: hex(SURFACES[state.surface].color),
          threadWidth: threadWidth(), strands: state.strands, twist: state.twist, sheen: state.sheen, fuzz: state.fuzz, guide: state.guide, ground: ground?.() });
      to.width = canvas.width; to.height = canvas.height;
      to.getContext('2d').drawImage(canvas, 0, 0);
      dirty = true;
    },
    /** Move the view (gliding) so the selection sits inside box ({ left, top, right, bottom }, px of the stage), zooming
     * out only as far as it needs to fit; for a pop-up that would otherwise cover it */
    showSelectionIn(box) {
      if (!selBox) return;
      const w = selBox.x1 + 1 - selBox.x0, h = selBox.y1 + 1 - selBox.y0, bw = box.right - box.left, bh = box.bottom - box.top;
      const z = Math.max(ZOOM_MIN, Math.min(cam.z, bw / w, bh / h));
      const cx = (selBox.x0 + selBox.x1 + 1) / 2, cy = (selBox.y0 + selBox.y1 + 1) / 2;
      flyTo({ z, x: cx - ((box.left + box.right) / 2 - view.w / 2) / z, y: cy - ((box.top + box.bottom) / 2 - view.h / 2) / z });
    },
    /** The selection's and cursor's colour */
    setAccent(c) { accent = c; overlayDirty = true; },
    restyleSelection,
    /** How the selection shows: 'halo-dim', 'thick-fill', 'ants-dim' or 'halo-fill' */
    setSelectionLook(look) { selLook = look; overlayDirty = true; },
    /** When the fill shows: 'always', 'edit' (gone while editing) or 'fade' (a moment after selecting); peek: hold Alt to hide the selection */
    setSelectionFill(mode, peek = true) { selFillMode = mode; peekKey = peek; if (mode === 'fade') selAt = performance.now(); overlayDirty = true; },
    /** The selection is being changed (the colour picker is open, the pointer is on the panel): the fill clears */
    setSelectionEditing(on) { selEditing = !!on; },
    /** Select with the Select tool's rectangle, from square [x0, y0] to [x1, y1] */
    selectArea(x0, y0, x1, y1) { set('tool', 'select'); selectFrom([x0 + 0.5, y0 + 0.5], [x1 + 0.5, y1 + 0.5], false); },
    stats: () => ({ stitches: stitches.size + backs.length + regions.reduce((n, rg) => n + rg.cells.size, 0), squares: blocks.size }),
    /** Restyle the backstitch outline: its colour (null keeps each line's own) and thickness (strands, 1 = one strand) */
    /** An outline round everything stitched, that follows the stitching as it changes: { color, strands, edges ('all' |
     * 'outside'), kind ('back' | 'running' | 'stem' | 'split' | 'chain' | 'whipped') }, or null for none. Not part of the piece's
     * undo history: it's worked out from the stitches each time. */
    /** The live outlines, each round what's stitched on the whole cloth (area null) or inside its area (a Set of "x,y") */
    setOutlines(list) { outlineSpecs = (list || []).map((o) => ({ color: o.color, match: !!o.match, w: (o.strands || 1) * 0.6, edges: o.edges || 'all', kind: o.kind || 'back', area: o.area || null })); sceneDirty = true; },
    selectionKeys: () => new Set(selection),
    selectCells(keys) { set('tool', 'select'); selection = new Set(keys); recolourFrom = null; updateSelection(); },
    styleOutline({ color = null, strands = 1 } = {}) { backs = backs.map((bk) => ({ ...bk, color: color || bk.color0 || bk.color, color0: bk.color0 || bk.color, w: strands * 0.6 })); sceneDirty = true; notify('piece'); },
    hideColour(c, hidden) { (hidden ? hiddenColours.add(c.toUpperCase()) : hiddenColours.delete(c.toUpperCase())); sceneDirty = true; },
    hidePattern(c, hidden) { (hidden ? hiddenPattern.add(c.toUpperCase()) : hiddenPattern.delete(c.toUpperCase())); guideDirty = true; },
    setPatternOpacity(c, v) { patternOpacity.set(c.toUpperCase(), v); guideDirty = true; },
    selection: () => ({ size: selection.size, stitches: selBox?.n || 0, colours: selectionColours(), kinds: selectionKinds().map(([k]) => k), kindCounts: selectionKinds(), groups: selectionGroups() }),
    /** Swap one colour for another inside the selection (pattern: also the pattern squares under it) */
    recolourSelection: (from, to, { pattern = recolourPattern, history = true } = {}) => recolour(from, to, pattern, history),
    hideInSelection, deleteInSelection, grabColour,
    selectionRect, hasOutline, toggleOutline, flipSelection, invertSelection, selectionToPattern, duplicateSelection, copySelection, paste,
    nudgeSelection, isMoving: () => !!moving || mode === 'select',
    zoomBy: (f) => zoomAt(view.w / 2, view.h / 2, f), fit, zoomTo: (z) => flyTo({ x: cam.x, y: cam.y, z }),
    grid: () => [COLS, ROWS],
    canvasSize(w, h, cell = canvasSpec.cell) { Object.assign(canvasSpec, { w, h, cell }); applyCanvas(); },
    sheet: () => ({ ...canvasSpec }),
    starter() {
      const img = drawCallaLilies(450, 800), sample = samplePicture(img, Math.round(ROWS * 0.94 * 450 / 800), Math.round(ROWS * 0.94));
      placePicture(convertPicture(sample, { ...pic, size: 0.94, colours: 12, saturation: 1.3, removeBg: false, light: 'satin', mid: 'satin', dark: 'full', lightShare: 0.35, darkShare: 0.25, outline: true, outlineStrength: 0.35 }), { name: 'Calla lilies' });
      history.length = 0;
    },
  };
}
