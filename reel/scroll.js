// The slider's progression on scroll: scrolling down drags Density from 0 to 100, and as it goes the slider
// becomes each version in turn (up goes back through them). Each change is a shared-element morph (morph.js):
// every part moves from where it was to where it is in the next version. On the left, what that version is and
// what it changed; below the slider, a bar per version fills as the drag passes through it. A drawn hand rides
// the handle, pressed while the page moves. The value eases after the scroll, so a wheel's steps read as one drag.
import { createStageSlider } from '../design/stage-slider.js';
import { VERSIONS } from '../design/slider-versions.js';
import { hexOf } from '../design/colour-field.js';
import { makeCursor } from './hands.js';
import { morph } from './morph.js';
import { LOG } from './log.js';

const SHOW = LOG.map(([v]) => v);
const MORPH = 560;      // ms, the morph between versions
const FOLLOW = 0.1;     // how quickly the value catches up with the scroll, each frame (0..1)
const STILL = 260;      // ms without movement before the hand lets go
const colour = hexOf('--terracotta-500');
const $ = (id) => document.getElementById(id);

$('bars').innerHTML = SHOW.map((v) => `<div class="r-bar"><span class="r-track"><i></i></span><span class="r-name">${v}</span></div>`).join('');
const bars = [...$('bars').children];
const cursor = makeCursor();

// ─── left: the entry for a version ───
let entry = null;
function tell(i) {
  const [v, say, add, cut] = LOG[i], next = document.createElement('div');
  next.className = 's-entry is-in';
  next.innerHTML = `<span class="s-v">${v}</span><p class="s-say">${say}</p><div class="s-diff">${add.map((t) => `<span class="s-add">+ ${t}</span>`).join('')}${cut.map((t) => `<span class="s-cut">− ${t}</span>`).join('')}</div>`;
  $('log').append(next);
  if (entry) { const old = entry; old.classList.add('is-out'); setTimeout(() => old.remove(), 360); }
  entry = next; void next.offsetWidth; next.classList.remove('is-in');
}

// ─── right: the slider, one layer per version ───
let layer = null, at = -1, moving = null;
const box = () => layer.querySelector('.ss');
const input = () => layer.querySelector('input[type=range]');
function build(i) {
  const def = VERSIONS[SHOW[i]], el = document.createElement('div'), layout = def.layout || 'inline';
  el.className = `r-layer${layout === 'inline' ? ' r-layer--inline' : ''}`;
  createStageSlider(el, { setting: 'density', colour, style: def.style || 'thread', layout, editable: !!def.editable, tuning: { ...def.tuning } });
  return el;
}
// show value v: as if held there (bubble up, number live) or let go (it settles)
function set(v, held) {
  const r = input();
  r.value = v;
  box().classList.toggle('r-hover', held);
  r.dispatchEvent(new Event(held ? 'input' : 'change', { bubbles: true }));
}
function become(i, v, held) {
  at = i;
  moving?.finish();
  const old = layer, next = build(i);
  $('stage').append(next);
  layer = next;
  set(v, held);
  bars.forEach((b, k) => b.classList.toggle('is-on', k === i));
  tell(i);
  if (!old) return;
  const m = morph(old, next, { duration: MORPH });
  moving = m;
  m.done.then(() => { old.remove(); if (moving === m) moving = null; });
}
// where the handle is now: the native thumb, or the bar's handle
function handle(v) {
  const b = box(), bar = b.classList.contains('ss--bar'), r = (bar ? b : input()).getBoundingClientRect(), thumb = bar ? 0 : 12;
  return { x: r.left + thumb / 2 + (v / Number(input().max)) * (r.width - thumb), y: b.getBoundingClientRect().top + b.offsetHeight / 2 };
}

// ─── scroll → value ───
const target = () => { const max = document.documentElement.scrollHeight - innerHeight; return max > 0 ? Math.min(100, Math.max(0, (scrollY / max) * 100)) : 0; };
const versionAt = (v) => Math.max(0, Math.min(SHOW.length - 1, Math.floor((v / 100) * SHOW.length - 1e-9)));
let v = target(), held = false, lastMove = 0;
become(versionAt(v), v, false);

function tick(now) {
  const goal = target(), going = Math.abs(goal - v) > 0.02;
  if (going) { v += (goal - v) * FOLLOW; lastMove = now; } else v = goal;
  const grab = going || now - lastMove < STILL;
  const k = versionAt(v);
  if (k !== at) become(k, v, grab);
  else if (grab !== held || going) set(v, grab);
  held = grab;
  cursor.classList.toggle('is-down', grab);
  bars.forEach((b, i) => b.style.setProperty('--fill', Math.max(0, Math.min(1, (v / 100) * SHOW.length - i))));
  // the hand rides the handle; mid-morph, the moving handle
  const h = moving?.thumb() || handle(v);
  cursor.style.left = `${h.x}px`; cursor.style.top = `${h.y}px`; cursor.style.opacity = 1;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// for the recorder (record.mjs): scroll from the top to the bottom, steadily, as a hand would
window.reel = {
  async play(ms = 16000) {
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 900));
    const max = document.documentElement.scrollHeight - innerHeight, t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      scrollTo(0, max * t);
      if (t >= 1) break;
      await new Promise(requestAnimationFrame);
    }
    await new Promise((r) => setTimeout(r, 1600));
  },
};
