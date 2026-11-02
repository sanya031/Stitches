// Segmented pill motion: the selected fill is one element (.c-seg__thumb) that travels between options,
// driven from JS so every variation can be tuned live with DialKit. Interrupting keeps going from where it is.
//
//   squash   the pill's animation: slides while flattening and lengthening with its speed
//   slide    both edges follow one spring
//   stretch  the leading edge goes first and the trailing edge catches up, so the pill stretches and contracts
//   liquid   the old pill flows into the new one: two blobs pulled together by a goo filter
//   grow     no travel: the old pill shrinks and fades as the new one grows in place
//   bead     shrinks to a bead, travels, opens out again
import { stepper } from './zoom-motion.js';

// Squash starts from the pill motion saved in tokens.css
const token = (name, fallback) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--motion-pill-${name}`)); return Number.isNaN(v) ? fallback : v; };
const spring = (visualDuration, bounce) => ({ type: 'spring', visualDuration, bounce });
const label = [120, 0, 400, 10];
const replay = { type: 'action', label: 'Play' };

export const SEG_MOTIONS = {
  squash: { title: 'Squash', about: 'The pill\'s animation: it flattens and lengthens with its speed, then settles round again.', dials: { curve: spring(token('duration', 0.38), token('bounce', 0.2)), squash: [token('squash', 0.35), 0, 0.8, 0.01], stretch: [token('stretch', 0.12), 0, 0.5, 0.01], labelFade: [token('label-fade', 120), 0, 400, 10], replay } },
  slide: { title: 'Slide', about: 'The eased spring: the whole pill travels to the next option as one piece.', dials: { curve: spring(0.32, 0.12), labelFade: label, replay } },
  stretch: { title: 'Stretch', about: 'Morphs through a long pill: the front edge leaves first, the back edge catches up.', dials: { front: spring(0.22, 0.08), back: spring(0.42, 0.04), backDelay: [0, 0, 200, 5], labelFade: label, replay } },
  liquid: { title: 'Liquid', about: 'Morphs into the next pill: the old one flows over and merges with the new one, like two drops.', dials: { curve: spring(0.55, 0.06), reach: [0.75, 0, 1, 0.01], blur: [4, 0, 10, 0.5], sharpness: [14, 4, 30, 1], labelFade: label, replay } },
  grow: { title: 'Grow', about: 'No travel: the old pill shrinks away as the new one grows in place.', dials: { curve: spring(0.3, 0.1), startSize: [0.6, 0.1, 1, 0.01], fade: [1, 0, 1, 0.01], labelFade: label, replay } },
  bead: { title: 'Bead', about: 'Morphs through a small bead: it shrinks, travels across and opens out again.', dials: { curve: spring(0.5, 0.06), beadSize: [10, 4, 28, 1], labelFade: label, replay } }
};

/** Starting values of a dial config, for when DialKit isn't loaded. */
export function dialDefaults(dials) {
  const out = {};
  for (const [k, v] of Object.entries(dials)) { if (v.type === 'action') continue; out[k] = Array.isArray(v) ? v[0] : v; }
  return out;
}

/** One animated number: a spring (keeps its speed when retargeted) or a tween from the same DialKit config. */
class Value {
  constructor(x) { this.x = x; this.v = 0; this.target = x; this.moving = false; this.wait = 0; }
  go(target, config, delay = 0) {
    const s = stepper(config);
    if (s.tween) { this.from = this.x; this.t = 0; }
    this.s = s; this.target = target; this.wait = delay; this.moving = true;
  }
  jump(x) { this.x = this.target = x; this.v = 0; this.moving = false; this.wait = 0; }
  step(dt) {
    if (!this.moving) return;
    if (this.wait > 0) { this.wait -= dt; return; }
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
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
let gooCount = 0;

function makeGoo() {
  const id = `seg-goo-${gooCount++}`, holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.setAttribute('width', 0); holder.setAttribute('height', 0); holder.setAttribute('aria-hidden', 'true'); holder.style.position = 'absolute';
  holder.innerHTML = `<filter id="${id}" x="-30%" y="-60%" width="160%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="4"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 14 -6"/><feComposite in="SourceGraphic" operator="atop"/></filter>`;
  document.body.append(holder);
  return { id, blur: holder.querySelector('feGaussianBlur'), matrix: holder.querySelector('feColorMatrix') };
}

/** Make a .c-seg travel. getValues() returns the variation's current dial values. */
export function createSegMotion(root, kind, getValues) {
  const opts = [...root.querySelectorAll('.c-seg__opt')];
  root.classList.add('c-seg--motion');
  const layer = document.createElement('span'); layer.className = 'c-seg__layer'; layer.setAttribute('aria-hidden', 'true');
  const a = document.createElement('span'), b = document.createElement('span');
  a.className = b.className = 'c-seg__thumb'; b.hidden = true;
  layer.append(a, b); root.prepend(layer);
  const goo = kind === 'liquid' ? makeGoo() : null;

  let index = Math.max(0, opts.findIndex((o) => o.getAttribute('aria-pressed') === 'true')), raf = 0, last = 0, from = null;
  const left = new Value(0), right = new Value(0), p = new Value(1);
  const rect = (i) => { const o = opts[i]; return { x: o.offsetLeft, w: o.offsetWidth, y: o.offsetTop, h: o.offsetHeight }; };
  const paint = (el, x, y, w, h, opacity = 1) => { el.style.cssText = `transform:translate(${x}px,${y}px);width:${Math.max(0, w)}px;height:${Math.max(0, h)}px;opacity:${opacity}`; };
  const central = (el, cx, cy, w, h, opacity) => paint(el, cx - w / 2, cy - h / 2, w, h, opacity);

  function place() { const r = rect(index); left.jump(r.x); right.jump(r.x + r.w); p.jump(1); from = null; draw(); }

  function draw() {
    const v = getValues(), to = rect(index), t = p.x, f = from || to;
    b.hidden = !(kind === 'liquid' || kind === 'grow') || t >= 1 || !from;
    if (goo) {
      const active = from && t < 1;
      layer.style.filter = active ? `url(#${goo.id})` : '';
      goo.blur.setAttribute('stdDeviation', v.blur);
      goo.matrix.setAttribute('values', `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${v.sharpness} ${-v.sharpness * 0.42}`);
    }
    if (kind === 'slide' || kind === 'stretch') return paint(a, left.x, to.y, right.x - left.x, to.h);
    if (kind === 'squash') {
      const w = right.x - left.x, speed = clamp01(Math.abs(left.v) / 1400), h = to.h * (1 - v.squash * speed);
      return paint(a, left.x - w * v.stretch * speed * 0.5, to.y + (to.h - h) / 2, w * (1 + v.stretch * speed), h);
    }
    const q = clamp01(t), fc = f.x + f.w / 2, tc = to.x + to.w / 2, cy = to.y + to.h / 2;
    if (kind === 'liquid') {
      if (!from || t >= 1) return paint(a, to.x, to.y, to.w, to.h);
      const gap = (tc - fc) * v.reach;
      central(a, fc + gap * q, cy, f.w * (1 - q), f.h * (1 - q * 0.6));
      return central(b, tc - gap * (1 - q), cy, to.w * q, to.h * (0.4 + 0.6 * q));
    }
    if (kind === 'grow') {
      if (!from || t >= 1) return paint(a, to.x, to.y, to.w, to.h);
      const out = lerp(1, v.startSize, q);
      central(a, fc, cy, f.w * out, f.h * out, 1 - v.fade * q);
      const s = lerp(v.startSize, 1, t);
      return central(b, tc, cy, to.w * s, to.h * s, 1 - v.fade * (1 - q));
    }
    // bead: full size at both ends, smallest halfway across
    const e = Math.sin(Math.PI * q);
    return central(a, lerp(fc, tc, t), cy, lerp(lerp(f.w, to.w, q), v.beadSize, e), lerp(to.h, v.beadSize, e));
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - last) / 1000) || 0.016; last = now;
    left.step(dt); right.step(dt); p.step(dt);
    draw();
    if (left.moving || right.moving || p.moving) raf = requestAnimationFrame(frame);
    else { raf = 0; from = null; draw(); }
  }

  function select(i) {
    if (i === index) return;
    const v = getValues(), going = i > index;
    // where the pill is drawn right now, so an interrupted move carries on from there
    const box = a.getBoundingClientRect(), base = root.getBoundingClientRect();
    from = { x: box.left - base.left - root.clientLeft, w: box.width, y: box.top - base.top - root.clientTop, h: box.height };
    index = i;
    opts.forEach((o, n) => o.setAttribute('aria-pressed', String(n === i)));
    root.style.setProperty('--seg-label-fade', `${v.labelFade}ms`);
    if (reduced.matches) return place();
    const to = rect(i);
    if (kind === 'stretch') {
      const leadEdge = going ? right : left, tailEdge = going ? left : right, leadTo = going ? to.x + to.w : to.x, tailTo = going ? to.x : to.x + to.w;
      leadEdge.go(leadTo, v.front); tailEdge.go(tailTo, v.back, v.backDelay / 1000);
    } else if (kind === 'slide' || kind === 'squash') {
      left.go(to.x, v.curve); right.go(to.x + to.w, v.curve);
    } else {
      p.jump(0); p.go(1, v.curve);
    }
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
