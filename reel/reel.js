// The slider's progression in one move: a single hand drags Density from 0 to 100, and as it goes the slider
// becomes each version in turn, morphing from one to the next without the drag stopping. A bar per version
// below fills as the drag passes through it. At the end it morphs back to v1 at 0, so the video loops.
// Plays by itself; with ?record it waits for the recorder to call reel.play().
import { createStageSlider } from '../design/stage-slider.js';
import { VERSIONS } from '../design/slider-versions.js';
import { hexOf } from '../design/colour-field.js';
import { makeCursor, sleep } from './hands.js';

const SHOW = ['v1', 'v3', 'v4', 'v6', 'v8', 'v10', 'v14', 'v18.2'];
const T = { hold: 700, approach: 600, hover: 380, press: 160, drag: 12800, release: 900, away: 520, back: 520 }; // ms
const MORPH = 480; // ms, matches .r-layer's transition
const colour = hexOf('--terracotta-500');
const $ = (id) => document.getElementById(id);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const frame = () => new Promise(requestAnimationFrame);

$('bars').innerHTML = SHOW.map((v) => `<div class="r-bar"><span class="r-track"><i></i></span><span class="r-name">${v}</span></div>`).join('');
const bars = [...$('bars').children];
const cursor = makeCursor();

// ─── the slider: one layer per version; while two cross, both follow the value ───
let layers = [], at = -1;
function build(i) {
  const def = VERSIONS[SHOW[i]], el = document.createElement('div'), layout = def.layout || 'inline';
  el.className = `r-layer${layout === 'inline' ? ' r-layer--inline' : ''}`;
  createStageSlider(el, { setting: 'density', colour, style: def.style || 'thread', layout, editable: !!def.editable, tuning: { ...def.tuning } });
  return el;
}
function become(i, { value, held }) {
  at = i;
  const next = build(i);
  next.classList.add('is-in');
  $('stage').append(next);
  layers.forEach((l) => { l.classList.add('is-out'); setTimeout(() => { l.remove(); layers = layers.filter((x) => x !== l); }, MORPH + 60); });
  layers.push(next);
  set(next, value, held);
  void next.offsetWidth;
  next.classList.remove('is-in');
  bars.forEach((b, k) => b.classList.toggle('is-on', k === i));
}
const box = (l) => l.querySelector('.ss');
const input = (l) => l.querySelector('input[type=range]');
// show value v on a layer, as if dragged there (held) or at rest
function set(l, v, held) {
  const b = box(l), r = input(l);
  r.value = v;
  if (held) { b.classList.add('r-hover'); r.dispatchEvent(new Event('input', { bubbles: true })); }
  else r.dispatchEvent(new Event('change', { bubbles: true })); // settles there: the number and drawing at rest
}
// where value v sits on a layer: the handle, or the native thumb
function xOf(l, v) {
  const b = box(l), bar = b.classList.contains('ss--bar'), rr = (bar ? b : input(l)).getBoundingClientRect(), thumb = bar ? 0 : 12;
  return rr.left + thumb / 2 + (v / Number(input(l).max)) * (rr.width - thumb);
}
const yOf = (l) => { const r = box(l).getBoundingClientRect(); return r.top + r.height / 2; };
const current = () => layers.at(-1);

// ─── the hand ───
let cx = 0, cy = 0;
const put = (x, y) => { cx = x; cy = y; cursor.style.left = `${x}px`; cursor.style.top = `${y}px`; cursor.style.opacity = 1; };
async function glide(to, ms) {
  const x0 = cx, y0 = cy, t0 = performance.now();
  for (;;) {
    const t = Math.min(1, (performance.now() - t0) / ms), e = ease(t), [x, y] = to();
    put(x0 + (x - x0) * e, y0 + (y - y0) * e);
    if (t >= 1) return;
    await frame();
  }
}
const restAt = () => { const r = $('stage').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 46]; }; // under the slider, from the stage (which never moves or scales), so the loop ends where it began

window.reel = {
  async play() {
    await sleep(T.hold);
    await glide(() => [xOf(current(), 0) + 18, yOf(current()) + 22], T.approach);
    box(current()).classList.add('r-hover');
    await glide(() => [xOf(current(), 0), yOf(current())], T.hover / 2);
    await sleep(T.hover / 2);
    cursor.classList.add('is-down');
    set(current(), 0, true);
    await sleep(T.press);
    // the drag: 0 → 100, one version per eighth; the hand follows the handle, easing across when the shape changes
    const t0 = performance.now();
    let from = null; // [x the hand left the old shape at, when]
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / T.drag), v = 100 * (t < 0.06 ? (t / 0.06) ** 2 * 0.03 : 0.03 + (t - 0.06) / 0.94 * 0.97); // eases in, then steady
      const k = Math.min(SHOW.length - 1, Math.floor((v / 100) * SHOW.length));
      if (k !== at) { from = [cx, performance.now()]; become(k, { value: v, held: true }); }
      layers.forEach((l) => set(l, v, true));
      bars.forEach((b, i) => b.style.setProperty('--fill', Math.max(0, Math.min(1, (v / 100) * SHOW.length - i))));
      let x = xOf(current(), v);
      if (from) { const m = Math.min(1, (performance.now() - from[1]) / MORPH); x = from[0] + (x - from[0]) * ease(m); if (m >= 1) from = null; } // no jump when the new shape's handle is elsewhere
      put(x, yOf(current()));
      if (t >= 1) break;
      await frame();
    }
    // let go at 100 on the newest version
    cursor.classList.remove('is-down');
    input(current()).dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(T.release);
    box(current()).classList.remove('r-hover');
    await glide(restAt, T.away);
    await sleep(T.hold * 1.4);
    // back to the start, so the loop meets itself
    become(0, { value: 0, held: false });
    bars.forEach((b) => b.style.setProperty('--fill', 0));
    await glide(restAt, MORPH); // to where it rested at the start
    await sleep(T.hold);
  },
};
become(0, { value: 0, held: false });
layers[0].classList.remove('is-in');
put(...restAt());
if (!location.search.includes('record')) (async () => { await document.fonts.ready; for (;;) await reel.play(); })();
