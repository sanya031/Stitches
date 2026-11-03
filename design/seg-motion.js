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

/** Make a .c-seg travel. getValues() returns the current dial values. */
export function createSegMotion(root, getValues) {
  const opts = [...root.querySelectorAll('.c-seg__opt')];
  root.classList.add('c-seg--motion');
  const layer = document.createElement('span'); layer.className = 'c-seg__layer'; layer.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('span'); thumb.className = 'c-seg__thumb';
  const mark = document.createElement('span'); mark.className = 'c-seg__mark'; thumb.append(mark); // the bar, for the underline style
  layer.append(thumb); root.prepend(layer);

  let index = Math.max(0, opts.findIndex((o) => o.getAttribute('aria-pressed') === 'true')), raf = 0, last = 0, amount = 0;
  const left = new Value(0), right = new Value(0);
  const rect = (i) => { const o = opts[i]; return { x: o.offsetLeft, w: o.offsetWidth, y: o.offsetTop, h: o.offsetHeight }; };

  function place() { const r = rect(index); left.jump(r.x); right.jump(r.x + r.w); amount = 0; draw(); }

  function draw() {
    const v = getValues(), to = rect(index), w = right.x - left.x, h = to.h * (1 - v.squash * amount), extra = w * v.stretch * amount;
    // lean 0 grows both ways; lean 1 grows only towards where it is going
    const ahead = v.lean, behind = left.v < 0 ? 0.5 * (1 - ahead) + ahead : 0.5 * (1 - ahead);
    thumb.style.cssText = `transform:translate(${left.x - extra * behind}px,${to.y + (to.h - h) / 2}px);width:${Math.max(0, w + extra)}px;height:${Math.max(0, h)}px`;
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - last) / 1000) || 0.016; last = now;
    const before = left.v;
    left.step(dt); right.step(dt);
    if (getValues().react === 'landing') {
      const accel = (left.v - before) / dt, braking = accel * left.v < 0 ? clamp01(Math.abs(accel) / FULL_BRAKING) : 0;
      amount += (braking - amount) * Math.min(1, dt * 18);
    } else amount = clamp01(Math.abs(left.v) / FULL_SPEED);
    draw();
    if (left.moving || right.moving || amount > 0.005) raf = requestAnimationFrame(frame);
    else { raf = 0; amount = 0; draw(); }
  }

  function select(i) {
    if (i === index) return;
    const v = getValues();
    index = i;
    opts.forEach((o, n) => o.setAttribute('aria-pressed', String(n === i)));
    root.style.setProperty('--seg-label-fade', `${v.labelFade}ms`);
    if (reduced.matches) return place();
    const to = rect(i);
    left.go(to.x, v.curve); right.go(to.x + to.w, v.curve);
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  root.addEventListener('click', (e) => { const o = e.target.closest('.c-seg__opt'); if (o) select(opts.indexOf(o)); });
  root.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!d) return;
    e.preventDefault(); const n = (index + d + opts.length) % opts.length; opts[n].focus(); select(n);
  });
  new ResizeObserver(() => { if (!raf) place(); }).observe(root);
  document.fonts?.ready.then(() => { if (!raf) place(); });
  place();
  return { select, next: () => select((index + 1) % opts.length) };
}
