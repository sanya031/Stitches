// Stage slider: a control for a thread setting someone may never have heard of (strands, count, density).
// Like the brush-size preview in Procreate, dragging shows a bubble over the thumb with one square of cloth
// and the thread on it, redrawn live as the value changes: the thread thickens, the square shrinks, the lines
// pack closer. Release and the value settles on the nearest real stop; the bubble lingers, then fades.
//
// Stops are real values (1, 2, 3, 4, 6 strands; 11–18 count). Between stops the preview draws the in-between
// value, so the change reads as continuous under the finger; the readout and the result are always a stop.
import { threadSvg } from './icons/thread.js';
import { primitiveSvg } from './icons/primitives.js';

const lerp = (a, b, t) => a + (b - a) * t;

/** What each setting draws, in either style. v is the (possibly in-between) value. */
export const STAGE_SETTINGS = {
  strands: {
    label: 'Strands', stops: [1, 2, 3, 4, 6], initial: 2,
    say: (v) => `${v} strand${v > 1 ? 's' : ''}`,
    thread: (v, o) => threadSvg('stitch-full', { ...o, strands: v }),
    prim: (v, o) => primitiveSvg('stitch-full', { ...o, strands: v })
  },
  count: {
    label: 'Count', stops: [11, 14, 16, 18], initial: 14,
    say: (v) => `${v} per inch`,
    // the square shrinks as the count rises; the thread stays the same real width, so it fills more of it
    thread: (v, o) => threadSvg('stitch-full', { ...o, count: v, scale: 11 / v }),
    prim: (v, o) => primitiveSvg('stitch-full', { ...o, scale: 11 / v })
  },
  density: {
    label: 'Density', stops: Array.from({ length: 101 }, (_, i) => i), initial: 85,
    say: (v) => `${v}%`,
    thread: (v, o) => threadSvg('fill-columns', { ...o, density: v / 100 }),
    prim: (v, o) => primitiveSvg('fill-columns', { ...o, density: v / 100 })
  }
};

/**
 * Build a stage slider in `host`. options: setting (a STAGE_SETTINGS key), style ('thread' | 'prim'),
 * colour (thread colour), onChange(value). Returns { el, value, setStyle(style), setColour(hex) }.
 */
export function createStageSlider(host, { setting, style = 'thread', colour = '#C8343B', onChange } = {}) {
  const def = STAGE_SETTINGS[setting], last = def.stops.length - 1, uid = `ss-${setting}-${Math.random().toString(36).slice(2, 7)}`;
  let index = def.stops.indexOf(def.initial), hideTimer = 0;

  const el = document.createElement('div');
  el.className = 'ss';
  el.innerHTML = `<label class="ss-label" for="${uid}">${def.label}</label>
    <div class="ss-track">
      <input id="${uid}" type="range" min="0" max="${last}" step="${last > 10 ? 1 : 0.01}" value="${index}" aria-valuetext="${def.say(def.stops[index])}">
      <div class="ss-bubble" aria-hidden="true"><div class="ss-art"></div><div class="ss-value mono"></div></div>
    </div>
    <output class="ss-out mono" for="${uid}"></output>`;
  host.append(el);
  const input = el.querySelector('input'), bubble = el.querySelector('.ss-bubble'), art = el.querySelector('.ss-art');
  const valueEl = el.querySelector('.ss-value'), out = el.querySelector('output');

  // the value at a slider position: a stop, or in between two while dragging
  const at = (pos) => {
    const i = Math.min(last - 1, Math.floor(pos)), t = pos - i;
    return last === 0 ? def.stops[0] : lerp(def.stops[i], def.stops[i + 1], t);
  };
  const draw = (pos) => {
    const v = at(pos), shown = def.stops[Math.round(pos)];
    const opts = { size: 104, id: `${uid}-art`, holes: style === 'thread' ? 0.7 : 0.45, colour, paper: style === 'thread' };
    art.innerHTML = style === 'thread' ? def.thread(v, opts) : def.prim(v, opts);
    art.dataset.style = style;
    valueEl.textContent = def.say(shown);
    out.textContent = def.say(def.stops[index]);
    // the bubble rides the thumb
    const r = input.getBoundingClientRect(), thumb = 22, x = thumb / 2 + (pos / last) * (r.width - thumb);
    bubble.style.left = `${x}px`;
  };
  const show = () => { clearTimeout(hideTimer); el.classList.add('ss-on'); };
  const hide = (after = 450) => { clearTimeout(hideTimer); hideTimer = setTimeout(() => el.classList.remove('ss-on'), after); };
  const settle = () => {
    index = Math.round(Number(input.value));
    input.value = index;
    input.setAttribute('aria-valuetext', def.say(def.stops[index]));
    draw(index);
    onChange?.(def.stops[index]);
  };

  input.addEventListener('pointerdown', () => { show(); draw(Number(input.value)); });
  input.addEventListener('input', () => { show(); draw(Number(input.value)); });
  input.addEventListener('change', () => { settle(); if (!input.matches(':active')) hide(); });
  addEventListener('pointerup', () => { if (el.classList.contains('ss-on') && document.activeElement === input) { settle(); hide(); } });
  // keys move a whole stop at a time, with the bubble up long enough to see it
  input.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, Home: -last, End: last, PageDown: -10, PageUp: 10 }[e.key];
    if (step == null) return;
    e.preventDefault();
    input.value = Math.max(0, Math.min(last, index + step));
    show(); settle(); hide(900);
  });
  input.addEventListener('blur', () => hide(0));

  draw(index);
  return {
    el,
    get value() { return def.stops[index]; },
    setStyle(s) { style = s; draw(index); },
    setColour(c) { colour = c; draw(index); }
  };
}
