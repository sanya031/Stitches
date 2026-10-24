// Thread renderer prototype: builds the strawberry as cross-stitch legs, then handles zoom, pan and light.
import { createRenderer } from './renderer.js';
import { STRAWBERRY } from '../js/thread.js';

const FABRIC_COUNT = 14;
const LINEN = [0xEC / 255, 0xE5 / 255, 0xD6 / 255];
const THREAD_WIDTH = 0.34;            // two strands on Aida 14, in fabric squares
const COLOURS = {                      // three floss colours; the mockup's shade variants fold into these
  R: '#C8343B', D: '#C8343B',
  G: '#4F8A4B', g: '#4F8A4B',
  y: '#F2D06B'
};
const LIFE_SIZE = (25.4 / FABRIC_COUNT) / (25.4 / 96);   // CSS px per stitch at 1:1
const ZOOM_MIN = 2, ZOOM_MAX = 700;
const PRESETS = { far: 4, mid: 26, close: 240 };

// ---------- scene ----------

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const jit = (amt) => (rand() - 0.5) * 2 * amt;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

function buildScene() {
  const rows = STRAWBERRY.length, cols = STRAWBERRY[0].length;
  const under = [], top = [], threadHairs = [];

  const addLeg = (out, ax, ay, bx, by, rgb) => {
    const a = [ax + jit(0.015), ay + jit(0.015)], b = [bx + jit(0.015), by + jit(0.015)];
    const bow = jit(0.014), width = 1 + jit(0.06);
    out.push(a[0], a[1], b[0], b[1], ...rgb.map((c) => c * (1 + jit(0.03))), rand(), bow, width);
    addLegHairs(a, b, rgb);
  };

  const addLegHairs = (a, b, rgb) => {
    const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d);
    const A = [d[0] / L, d[1] / L], N = [-A[1], A[0]];
    const at = (u, side) => [a[0] + d[0] * u + N[0] * side * THREAD_WIDTH * 0.4, a[1] + d[1] * u + N[1] * side * THREAD_WIDTH * 0.4];
    const light = rgb.map((c) => Math.min(1, c * 1.12 + 0.03));
    for (let k = 0; k < 7; k++) {
      const u = 0.12 + rand() * 0.76, side = rand() < 0.5 ? -1 : 1;
      const p0 = at(u, side), out = [N[0] * side, N[1] * side];
      const loop = rand() < 0.4;
      let p1, p2;
      if (loop) {
        const r = 0.03 + rand() * 0.05;
        p1 = [p0[0] + out[0] * r + A[0] * 0.04, p0[1] + out[1] * r + A[1] * 0.04];
        p2 = at(Math.min(0.92, u + 0.05 + rand() * 0.07), side);
      } else {
        const r1 = 0.03 + rand() * 0.05, r2 = 0.05 + rand() * 0.12, along = jit(0.1);
        p1 = [p0[0] + out[0] * r1 + A[0] * along * 0.5, p0[1] + out[1] * r1 + A[1] * along * 0.5];
        p2 = [p0[0] + out[0] * r2 + A[0] * along + jit(0.03), p0[1] + out[1] * r2 + A[1] * along + jit(0.03)];
      }
      threadHairs.push(...p0, ...p1, ...p2, 0.004 + rand() * 0.004, 0.55 + rand() * 0.3, ...light, loop ? 1 : 0);
    }
  };

  STRAWBERRY.forEach((row, y) => row.split('').forEach((ch, x) => {
    if (!COLOURS[ch]) return;
    const rgb = hex(COLOURS[ch]);
    addLeg(under, x, y + 1, x + 1, y, rgb);   // under leg: /  (bottom-left to top-right)
    addLeg(top, x, y, x + 1, y + 1, rgb);     // top leg:   \  (top-left to bottom-right), same on every stitch
  }));

  const margin = 8;
  const fabricRect = [-margin, -margin, cols + margin, rows + margin];
  const fabricHairs = [];
  for (let i = 0; i < 700; i++) {
    const p0 = [fabricRect[0] + rand() * (fabricRect[2] - fabricRect[0]), fabricRect[1] + rand() * (fabricRect[3] - fabricRect[1])];
    const ang = rand() * Math.PI * 2, len = 0.06 + rand() * 0.22, curl = jit(0.08);
    const dir = [Math.cos(ang), Math.sin(ang)];
    const p2 = [p0[0] + dir[0] * len, p0[1] + dir[1] * len];
    const p1 = [(p0[0] + p2[0]) / 2 - dir[1] * curl, (p0[1] + p2[1]) / 2 + dir[0] * curl];
    const tone = 0.97 + rand() * 0.05;
    fabricHairs.push(...p0, ...p1, ...p2, 0.004 + rand() * 0.003, 0.35 + rand() * 0.3, ...LINEN.map((c) => Math.min(1, c * tone)), 0);
  }

  return {
    fabricRect, linen: LINEN, threadWidth: THREAD_WIDTH,
    under: new Float32Array(under), top: new Float32Array(top),
    threadHairs: new Float32Array(threadHairs), fabricHairs: new Float32Array(fabricHairs),
    size: [cols, rows]
  };
}

// ---------- app ----------

const canvas = document.getElementById('gl');
const renderer = createRenderer(canvas);
if (!renderer) {
  canvas.hidden = true;
  document.getElementById('fallback').style.display = 'grid';
  throw new Error('WebGL2 unavailable');
}

const scene = buildScene();
renderer.setScene(scene);
const [cols, rows] = scene.size;
document.getElementById('size').textContent = `${cols}×${rows} · ${Math.round(cols / FABRIC_COUNT * 25.4)} mm`;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULT_LIGHT = norm([-0.45, -0.55, 0.7]);
const cam = { x: cols / 2, y: rows / 2, z: 1 };   // z: CSS px per stitch
let light = DEFAULT_LIGHT, followLight = false;
let anim = null, dirty = true;

function norm(v) { const l = Math.hypot(...v); return v.map((c) => c / l); }
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const fitZoom = () => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(innerWidth, innerHeight) * 0.6 / Math.max(cols, rows)));
let fitted = false;

function resize() {
  canvas.width = Math.max(1, Math.round(innerWidth * dpr()));
  canvas.height = Math.max(1, Math.round(innerHeight * dpr()));
  // a page opened in a hidden or zero-size frame gets its first real size later
  if (!fitted && innerWidth > 0 && innerHeight > 0) { cam.z = fitZoom(); fitted = true; }
  dirty = true;
}

function zoomAt(sx, sy, factor) {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.z * factor));
  const wx = cam.x + (sx - innerWidth / 2) / cam.z, wy = cam.y + (sy - innerHeight / 2) / cam.z;
  cam.z = z;
  cam.x = wx - (sx - innerWidth / 2) / z;
  cam.y = wy - (sy - innerHeight / 2) / z;
  anim = null; dirty = true;
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

function reset() { flyTo({ x: cols / 2, y: rows / 2, z: fitZoom() }); }

// wheel and trackpad pinch (ctrlKey) zoom around the cursor
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
  zoomAt(e.clientX, e.clientY, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });

// drag to pan, two pointers to pinch
const pointers = new Map();
let pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.classList.add('dragging');
  anim = null;
});
canvas.addEventListener('pointermove', (e) => {
  if (followLight) {
    light = norm([(e.clientX / innerWidth - 0.5) * 2.2, (e.clientY / innerHeight - 0.5) * 2.2, 0.75]);
    dirty = true;
  }
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const prev = { x: p.x, y: p.y };
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) {
    cam.x -= (p.x - prev.x) / cam.z;
    cam.y -= (p.y - prev.y) / cam.z;
    dirty = true;
  } else if (pointers.size === 2) {
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
  pointers.delete(e.pointerId);
  pinch = null;
  if (!pointers.size) canvas.classList.remove('dragging');
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', (e) => {
  if (e.target.closest('button')) return;
  const cx = innerWidth / 2, cy = innerHeight / 2, step = 60 / cam.z;
  const keys = {
    '+': () => zoomAt(cx, cy, 1.25), '=': () => zoomAt(cx, cy, 1.25), '-': () => zoomAt(cx, cy, 0.8), '0': reset,
    ArrowLeft: () => { cam.x -= step; }, ArrowRight: () => { cam.x += step; },
    ArrowUp: () => { cam.y -= step; }, ArrowDown: () => { cam.y += step; }
  };
  if (keys[e.key]) { keys[e.key](); dirty = true; e.preventDefault(); }
});

document.querySelectorAll('[data-preset]').forEach((btn) => btn.addEventListener('click', () => {
  const z = PRESETS[btn.dataset.preset];
  // zooming in from far lands on the motif; otherwise keep looking where we are
  const centre = cam.z < 8 ? { x: cols / 2, y: rows / 2 } : { x: cam.x, y: cam.y };
  flyTo({ ...centre, z });
}));
document.getElementById('reset').addEventListener('click', () => { light = DEFAULT_LIGHT; reset(); });
const lightBtn = document.getElementById('light');
lightBtn.addEventListener('click', () => {
  followLight = !followLight;
  lightBtn.setAttribute('aria-pressed', String(followLight));
  if (!followLight) { light = DEFAULT_LIGHT; dirty = true; }
});

// ---------- HUD + frame loop ----------

const lodEl = document.getElementById('lod'), zoomEl = document.getElementById('zoom');
let lastHud = '';
function hud() {
  const z = cam.z;
  const lod = z < 8 ? 'far' : z < 60 ? 'mid' : 'close';
  const text = `${z.toFixed(z < 10 ? 1 : 0)} px/stitch · ×${(z / LIFE_SIZE).toFixed(1)}`;
  if (text === lastHud) return;
  lastHud = text;
  lodEl.textContent = { far: 'Far · colour blobs', mid: 'Mid · stitch shapes', close: 'Close · plies and fibres' }[lod];
  zoomEl.textContent = text;
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === lod)));
}

function frame(now) {
  if (anim) { anim(now); dirty = true; }
  if (dirty) {
    renderer.draw({ x: cam.x, y: cam.y, scale: cam.z * dpr(), cssScale: cam.z, light });
    hud();
    dirty = false;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
if (!fitted) cam.z = fitZoom();
requestAnimationFrame(frame);
