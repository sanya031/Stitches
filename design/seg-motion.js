// Segmented pill motion: Squash. The selected fill is one element (.c-seg__thumb) that springs between
// options, flattening and lengthening as it goes, driven from JS so it can be tuned live with DialKit.
// Interrupting keeps its speed. SEG_MOTIONS holds the saved motion, from the tokens.
import { stepper } from './zoom-motion.js';

// Squash starts from the pill motion saved in tokens.css
const token = (name, fallback) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--motion-pill-${name}`)); return Number.isNaN(v) ? fallback : v; };
const spring = (visualDuration, bounce) => ({ type: 'spring', visualDuration, bounce });
const reactions = (value) => ({ type: 'select', options: [{ value: 'speed', label: 'While moving' }, { value: 'landing', label: 'On landing' }], default: value });
const dials = (duration, bounce, squash, stretch, lean = 0, react = 'speed', fade = 120) => ({
  curve: spring(duration, bounce),
  squash: [squash, 0, 0.8, 0.01],
  stretch: [stretch, 0, 0.6, 0.01],
  lean: [lean, 0, 1, 0.01],
  react: reactions(react),
  labelFade: [fade, 0, 400, 10],
  replay: { type: 'action', label: 'Play' }
});

export const SEG_MOTIONS = {
  squash: { title: 'Squash', about: 'Flattens a lot with its speed and hardly lengthens, like a thread pulled tight, then settles round.', dials: dials(token('duration', 0.38), token('bounce', 0.18), token('squash', 0.6), token('stretch', 0.02), 0, 'speed', token('label-fade', 120)) },
};

/** Starting values of a dial config, for when DialKit isn't loaded. */
export function dialDefaults(config) {
  const out = {};
  for (const [k, v] of Object.entries(config)) {
    if (v.type === 'action') continue;
    out[k] = Array.isArray(v) ? v[0] : v.type === 'select' ? v.default : v;
  }
  return out;
}

/** One animated number: a spring (keeps its speed when retargeted) or a tween from the same DialKit config. */
class Value {
  constructor(x) { this.x = x; this.v = 0; this.target = x; this.moving = false; }
  go(target, config) {
    const s = stepper(config);
    if (s.tween) { this.from = this.x; this.t = 0; }
    this.s = s; this.target = target; this.moving = true;
  }
  jump(x) { this.x = this.target = x; this.v = 0; this.moving = false; }
  step(dt) {
    if (!this.moving) return;
    const s = this.s;
    if (s.tween) {
      this.t += dt; const p = Math.min(1, this.t / s.duration), prev = this.x;
      this.x = this.from + (this.target - this.from) * s.ease(p); this.v = (this.x - prev) / dt;
      if (p >= 1) this.jump(this.target);
      return;
    }
    const h = dt / 4;
    for (let i = 0; i < 4; i++) { this.v += ((-s.k * (this.x - this.target) - s.c * this.v) / s.m) * h; this.x += this.v * h; }
    if (Math.abs(this.x - this.target) < 0.02 && Math.abs(this.v) < 0.5) this.jump(this.target);
  }
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const FULL_SPEED = 1400, FULL_BRAKING = 9000; // px/s and px/s² that count as "full" squash

/**
 * Make a .c-seg travel. getValues() returns the current dial values. option: what counts as an option
 * (default .c-seg__opt; .c-tile for a stitch grid). In a grid the fill travels in both directions:
 * it flattens across the way it is going and lengthens along it, so a pill moving sideways looks as before.
 */
export function createSegMotion(root, getValues, { option = '.c-seg__opt' } = {}) {
  const opts = [...root.querySelectorAll(option)];
  root.classList.add('c-seg--motion');
  const layer = document.createElement('span'); layer.className = 'c-seg__layer'; layer.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('span'); thumb.className = 'c-seg__thumb';
  const mark = document.createElement('span'); mark.className = 'c-seg__mark'; thumb.append(mark); // the bar, for the underline style
  layer.append(thumb); root.prepend(layer);

  let index = opts.findIndex((o) => o.getAttribute('aria-pressed') === 'true'), raf = 0, last = 0, amount = 0;
  // nothing chosen (a mixed selection): no fill until one is picked, then it appears in place
  thumb.hidden = index < 0;
  const left = new Value(0), right = new Value(0), top = new Value(0), bottom = new Value(0);
  const edges = [left, right, top, bottom];
  // exact (sub-pixel) box of an option inside the root's padding box, so the fill lands right on it
  const rect = (i) => {
    const o = opts[i].getBoundingClientRect(), r = root.getBoundingClientRect();
    return { x: o.left - r.left - root.clientLeft, w: o.width, y: o.top - r.top - root.clientTop, h: o.height };
  };
  let ux = 1, uy = 0; // the way it is going (unit), for which side flattens

  function place() { if (index < 0) return; const r = rect(index); left.jump(r.x); right.jump(r.x + r.w); top.jump(r.y); bottom.jump(r.y + r.h); amount = 0; draw(); }

  function draw() {
    const v = getValues(), w = right.x - left.x, h = bottom.x - top.x;
    // along the way it goes it lengthens by stretch, across it flattens by squash
    const ex = w * (v.stretch * ux - v.squash * uy) * amount, ey = h * (v.stretch * uy - v.squash * ux) * amount;
    // lean 0 grows both ways; lean 1 grows only towards where it is going
    const ahead = v.lean, bx = left.v < 0 ? 0.5 * (1 - ahead) + ahead : 0.5 * (1 - ahead), by = top.v < 0 ? 0.5 * (1 - ahead) + ahead : 0.5 * (1 - ahead);
    const ox = ex > 0 ? ex * bx : ex / 2, oy = ey > 0 ? ey * by : ey / 2;
    thumb.style.cssText = `transform:translate(${left.x - ox}px,${top.x - oy}px);width:${Math.max(0, w + ex)}px;height:${Math.max(0, h + ey)}px`;
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - last) / 1000) || 0.016; last = now;
    const bx = left.v, by = top.v;
    edges.forEach((e) => e.step(dt));
    const speed = Math.hypot(left.v, top.v);
    if (speed > 1) { ux = Math.abs(left.v) / speed; uy = Math.abs(top.v) / speed; }
    if (getValues().react === 'landing') {
      const ax = (left.v - bx) / dt, ay = (top.v - by) / dt, along = ax * left.v + ay * top.v;
      const braking = along < 0 ? clamp01(Math.hypot(ax, ay) / FULL_BRAKING) : 0;
      amount += (braking - amount) * Math.min(1, dt * 18);
    } else amount = clamp01(speed / FULL_SPEED);
    draw();
    if (edges.some((e) => e.moving) || amount > 0.005) raf = requestAnimationFrame(frame);
    else { raf = 0; amount = 0; draw(); }
  }

  function select(i) {
    if (i === index) return;
    const v = getValues(), first = index < 0;
    index = i;
    opts.forEach((o, n) => o.setAttribute('aria-pressed', String(n === i)));
    root.style.setProperty('--seg-label-fade', `${v.labelFade}ms`);
    if (reduced.matches || first) { thumb.hidden = false; return place(); }
    const to = rect(i);
    left.go(to.x, v.curve); right.go(to.x + to.w, v.curve); top.go(to.y, v.curve); bottom.go(to.y + to.h, v.curve);
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  root.addEventListener('click', (e) => { const o = e.target.closest(option); if (o && opts.includes(o)) select(opts.indexOf(o)); });
  root.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!d) return;
    e.preventDefault(); const n = (index + d + opts.length) % opts.length; opts[n].focus(); select(n);
  });
  new ResizeObserver(() => { if (!raf) place(); }).observe(root);
  document.fonts?.ready.then(() => { if (!raf) place(); });
  place();
  return { select, next: () => select((index + 1) % opts.length) };
}
