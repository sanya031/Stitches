// Stage slider: a control for a thread setting someone may never have heard of (strands, count, density).
// Like the brush-size preview in Procreate, dragging shows a bubble over the thumb with one square of cloth
// and the thread on it, redrawn live as the value changes: the thread thickens, the square shrinks, the lines
// pack closer. Release and the value settles on the nearest real stop; the bubble lingers, then fades.
//
// Stops are real values (1–6 strands; 11–18 count). Between stops the preview draws the in-between
// value, so the change reads as continuous under the finger; the readout and the result are always a stop.
import { threadSvg } from './icons/thread.js';
import { primitiveSvg } from './icons/primitives.js';
import { createNumberMotion, NUMBER_MOTION } from './number-motion.js';
import { stepper } from './zoom-motion.js';

const lerp = (a, b, t) => a + (b - a) * t;
// the pill motion's spring (--motion-pill-*), so a slider settles like a pill moves
const pillToken = (name, fallback) => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--motion-pill-${name}`));
  return Number.isFinite(v) ? v : fallback;
};

/** What each setting draws, in either style. v is the (possibly in-between) value. say: the value in words; tip: what the bubble shows, when not that. marks: a marker every n stops (bar layout); common: values whose marker is bolder. */
export const STAGE_SETTINGS = {
  strands: {
    label: 'Strands', stops: [1, 2, 3, 4, 5, 6], initial: 2, marks: 1, common: [2],
    say: (v) => `${v} strand${v > 1 ? 's' : ''}`,
    tip: (v) => String(v), // the bubble shows just the number
    thread: (v, o) => threadSvg('stitch-full', { ...o, strands: v }),
    prim: (v, o) => primitiveSvg('stitch-full', { ...o, strands: v })
  },
  count: {
    label: 'Count', stops: [11, 14, 16, 18], initial: 14, marks: 1,
    say: (v) => `${v} per inch`,
    // the square shrinks as the count rises; the thread stays the same real width, so it fills more of it
    thread: (v, o) => threadSvg('stitch-full', { ...o, count: v, scale: 11 / v }),
    prim: (v, o) => primitiveSvg('stitch-full', { ...o, scale: 11 / v })
  },
  density: {
    label: 'Density', stops: Array.from({ length: 101 }, (_, i) => i), initial: 85, marks: 10, common: [50],
    say: (v) => `${v}%`,
    thread: (v, o) => threadSvg('fill-columns', { ...o, density: v / 100 }),
    prim: (v, o) => primitiveSvg('fill-columns', { ...o, density: v / 100 })
  }
};

/** How the slider behaves; the slider lab (slider-lab.html) tunes these live. The defaults are the system's. */
export const STAGE_TUNING = {
  bubbleSize: 104,     // px, the preview square
  bubbleGap: 4,        // px between the bubble and the box (bar layout)
  linger: 450,         // ms the bubble stays after release
  keyLinger: 900,      // ms it stays after an arrow key
  inBetween: true,     // while dragging, the preview draws in-between values (false: only stops)
  release: 'jump',     // 'jump': the thumb lands on the nearest stop at once; 'glide': it slides there; 'spring': it springs there (catch it mid-way)
  glide: 160,          // ms, the glide to the stop
  springDuration: pillToken('duration', 0.38), // s, the spring's visual duration (the pill's Squash spring)
  springBounce: pillToken('bounce', 0.18),     // 0 … 1
  // hand feel (bar layout): the box handles the pointer itself
  hand: false,         // on: the features below; off: the native range input
  relative: true,      // dragging moves the value by how far you move, from where it is; pressing doesn't jump it
  tapJump: true,       // with relative: a press and let go without moving jumps to that point
  grow: 0,             // px the box grows on every side while held (0: off)
  rubber: 0,           // px it can stretch past either end, with resistance, springing back on release (0: off)
  fine: 0,             // px above or below the box at which dragging is at quarter speed (0: off)
  handle: 16,          // px, the bar handle's height (bar layout)
  markers: false,      // bar layout: markers on the box at every mark
  markAlign: 'bottom', // where the markers sit: 'bottom' of the box or 'centre'
  markOpacity: 1,      // markers' opacity when not in use; the one the handle is on is always full
  reveal: false,       // bar layout: the handle and markers show only on hover, drag or keyboard focus; untouched, just the fill
  magnet: 0,           // 0 … 0.5 of the gap between marks: within it, dragging pulls the handle onto the mark
  // the bubble's number as it changes (number-motion.js): motion 'none' | 'roll' | 'slide' | 'blur', and its feel
  numberMotion: NUMBER_MOTION.motion, numberDuration: NUMBER_MOTION.duration, numberStagger: NUMBER_MOTION.stagger,
  numberDistance: NUMBER_MOTION.distance, numberBlur: NUMBER_MOTION.blur, numberFade: NUMBER_MOTION.fade, numberEase: NUMBER_MOTION.ease,
};

/**
 * Build a stage slider in `host`. options: setting (a STAGE_SETTINGS key), style ('thread' | 'prim'),
 * colour (thread colour), onChange(value), labelOutside (the label sits above the box, the slider fills it),
 * tuning (overrides of STAGE_TUNING, read on every use so it can change live), onMove(position, state) for a readout.
 * layout: 'inline' (label, slider, value in one box) or 'number' (the box holds only the slider; below it, on the
 * left, just the number, following the thumb as it moves).
 * 'live': the label above the box; inside, the slider and on the right just the number, with one decimal while it
 * moves (the in-between value under the thumb), then the stop it lands on.
 * 'bar': as 'live', but the whole box is the slider: it fills from the left up to a handle, a vertical bar you
 * pull; press or drag anywhere in the box.
 * editable (bar layout): the number is a field. Press it and it fills to show it's selected; type a value (it lands
 * on the nearest stop) or step with the up and down arrows (shift for ten), Enter or leaving keeps it, Escape undoes.
 * Returns { el, value, setStyle(style), setColour(hex) }.
 */
export function createStageSlider(host, { setting, style = 'thread', colour = '#C8343B', onChange, labelOutside = false, tuning = {}, onMove, layout = 'inline', editable = false } = {}) {
  const def = STAGE_SETTINGS[setting], last = def.stops.length - 1, uid = `ss-${setting}-${Math.random().toString(36).slice(2, 7)}`;
  const tune = (k) => (k in tuning ? tuning[k] : STAGE_TUNING[k]);
  let glideRaf = 0, scrubGain = 1;
  let index = def.stops.indexOf(def.initial), hideTimer = 0;

  const marks = def.marks || 1;
  // markers at every mark, inside the ends
  const markHtml = () => Array.from({ length: Math.floor(last / marks) - 1 }, (_, i) => {
    const at = (i + 1) * marks, common = def.common?.includes(def.stops[at]);
    return `<span class="ss-mark${common ? ' ss-mark--common' : ''}" data-at="${at}" style="left:${(at / last) * 100}%"></span>`;
  }).join('');
  const el = document.createElement('div');
  const numberBelow = layout === 'number', bar = layout === 'bar', live = layout === 'live' || bar;
  if (live) labelOutside = true;
  if (live) el.style.setProperty('--ss-chars', def.stops.at(-1).toFixed(1).length); // the widest number it can show
  el.className = numberBelow ? 'ss ss--bare' : bar ? 'ss ss--live ss--bar' : live ? 'ss ss--label-out ss--live' : labelOutside ? 'ss ss--label-out' : 'ss';
  const label = `<label class="${labelOutside ? 'c-label' : 'ss-label'}" for="${uid}">${def.label}</label>`;
  if (labelOutside && !numberBelow) { host.classList.add('c-labelled'); host.insertAdjacentHTML('beforeend', label); }
  el.innerHTML = `${labelOutside || numberBelow ? '' : label}
    <div class="ss-track">${bar ? `<span class="ss-clip"><span class="ss-fill"></span>${markHtml()}</span><span class="ss-handle"></span>` : ''}
      <input id="${uid}" type="range" min="0" max="${last}" step="${last > 10 && !live ? 1 : 0.01}" value="${index}" aria-valuetext="${def.say(def.stops[index])}">
      <div class="ss-bubble" aria-hidden="true"><div class="ss-art"></div><div class="ss-value mono"></div></div>
    </div>
    ${numberBelow ? '' : bar && editable ? `<input class="ss-out ss-edit" inputmode="decimal" spellcheck="false" aria-label="${def.label}, type a value">` : `<output class="ss-out mono" for="${uid}"></output>`}`;
  host.append(el);
  // number layout: the number sits under the box and moves with the thumb
  if (numberBelow) {
    host.classList.add('c-labelled');
    host.insertAdjacentHTML('beforeend', `<output class="ss-num" for="${uid}"></output>`);
    el.querySelector('input').setAttribute('aria-label', def.label);
  }
  const input = el.querySelector('input'), bubble = el.querySelector('.ss-bubble'), art = el.querySelector('.ss-art');
  const valueEl = el.querySelector('.ss-value'), edit = el.querySelector('.ss-edit');
  const number = createNumberMotion(valueEl);
  const outEl = el.querySelector('output') || host.querySelector('.ss-num');
  // the number: shown in an output, or, when editable, in its field (left alone while someone is typing in it)
  const out = { set textContent(t) { if (edit) { if (document.activeElement !== edit) edit.value = t; } else outEl.textContent = t; } };

  // the value at a slider position: a stop, or in between two while dragging
  const at = (pos) => {
    const i = Math.min(last - 1, Math.floor(pos)), t = pos - i;
    return last === 0 ? def.stops[0] : lerp(def.stops[i], def.stops[i + 1], t);
  };
  const draw = (pos, state = 'rest') => {
    const v = tune('inBetween') ? at(pos) : def.stops[Math.round(pos)], shown = def.stops[Math.round(pos)];
    onMove?.(pos, state, { gain: scrubGain });
    const opts = { size: tune('bubbleSize'), id: `${uid}-art`, holes: style === 'thread' ? 0.7 : 0.2, colour, paper: style === 'thread' };
    art.innerHTML = style === 'thread' ? def.thread(v, opts) : def.prim(v, opts);
    art.dataset.style = style;
    const moving = (state === 'dragging' || state === 'gliding') && !Number.isInteger(pos); // on a stop (or pulled onto a mark) it reads as the whole number
    el.classList.toggle('ss--moving', moving);
    const tip = def.tip || def.say;
    number.set(live && moving ? tip(Number(at(pos).toFixed(1))) : tip(shown), {
      motion: tune('numberMotion'), duration: tune('numberDuration'), stagger: tune('numberStagger'),
      distance: tune('numberDistance'), blur: tune('numberBlur'), fade: tune('numberFade'), ease: tune('numberEase'),
    });
    out.textContent = live ? (moving ? at(pos).toFixed(1) : String(state === 'dragging' || state === 'gliding' ? shown : def.stops[index]))
      : numberBelow ? String(shown) : def.say(def.stops[index]);
    // the bubble rides the thumb (in the bar, the handle at the fill's edge)
    el.style.setProperty('--p', last ? pos / last : 0);
    el.style.setProperty('--ss-bubble-gap', `${tune('bubbleGap')}px`);
    el.style.setProperty('--ss-handle', `${tune('handle')}px`);
    el.classList.toggle('ss--marked', !!tune('markers'));
    el.classList.toggle('ss--marks-centre', tune('markAlign') === 'centre');
    // the marker in use (the handle is on it, snapped or settled) shows at full strength; the rest are faint
    el.style.setProperty('--ss-mark-opacity', tune('markOpacity'));
    el.classList.toggle('ss--reveal', !!tune('reveal'));
    if (bar) el.classList.toggle('ss--hand', !!tune('hand'));
    el.querySelectorAll('.ss-mark').forEach((m) => m.classList.toggle('is-active', Number(m.dataset.at) === pos));
    const r = input.getBoundingClientRect(), thumb = bar ? 0 : 22, x = thumb / 2 + (pos / last) * (r.width - thumb);
    bubble.style.left = `${x}px`;
  };
  const show = () => { clearTimeout(hideTimer); el.classList.add('ss-on'); };
  const hide = (after = tune('linger')) => { clearTimeout(hideTimer); hideTimer = setTimeout(() => el.classList.remove('ss-on'), after); };
  // land on the stop nearest target, moving from where the handle is now
  const settle = (from = Number(input.value), target = from) => {
    index = Math.round(target);
    input.setAttribute('aria-valuetext', def.say(def.stops[index]));
    onChange?.(def.stops[index]);
    cancelAnimationFrame(glideRaf);
    if (tune('release') === 'spring' && from !== index) { springPos(from, index); return; }
    if (tune('release') !== 'glide' || from === index) { input.value = index; draw(index, 'settled'); return; }
    // glide: ease the thumb from where it was let go to the stop
    const t0 = performance.now(), d = Math.max(1, tune('glide'));
    const step = (now) => {
      const t = Math.min(1, (now - t0) / d), e = 1 - (1 - t) ** 3, p = from + (index - from) * e;
      input.value = p; draw(p, t < 1 ? 'gliding' : 'settled');
      if (t < 1) glideRaf = requestAnimationFrame(step);
    };
    glideRaf = requestAnimationFrame(step);
  };

  input.addEventListener('pointerdown', () => { cancelAnimationFrame(glideRaf); show(); draw(Number(input.value), 'dragging'); });
  // magnet: near a mark, the handle is pulled onto it
  const pull = (pos) => {
    const m = tune('magnet') * marks, near = Math.round(pos / marks) * marks;
    return m > 0 && Math.abs(pos - near) <= m ? near : pos;
  };
  input.addEventListener('input', () => { show(); const p = pull(Number(input.value)); if (p !== Number(input.value)) input.value = p; draw(p, 'dragging'); });
  input.addEventListener('change', () => { settle(); if (!input.matches(':active')) hide(); });
  addEventListener('pointerup', () => { if (!handOn() && el.classList.contains('ss-on') && document.activeElement === input) { settle(); hide(); } });

  // ─── hand feel (bar layout, tuning.hand) ───────────────────────────────────
  // The box takes the pointer itself: a drag moves the value from where it is (relative), so grabbing never
  // jumps it; the box grows a little while held; past either end it stretches with resistance and springs back;
  // moving the pointer above or below the box slows the drag down (fine scrubbing); letting go springs onto the
  // stop, and pressing again catches it mid-way. Touch drags start only once they are clearly sideways, so the
  // panel still scrolls.
  const handOn = () => bar && !!tune('hand');
  const springs = { pos: { x: 0, v: 0, to: 0, on: false }, grow: { x: 0, v: 0, to: 0, on: false }, stretch: { x: 0, v: 0, to: 0, on: false } };
  let springRaf = 0, lastT = 0, drag = null;
  const params = () => stepper({ visualDuration: tune('springDuration'), bounce: tune('springBounce') });
  const shape = () => { // grow and stretch move only the box's surface and fill, never the number
    const g = springs.grow.x * tune('grow'), o = springs.stretch.x;
    el.style.setProperty('--ss-grow', `${g.toFixed(2)}px`);
    el.style.setProperty('--ss-stretch-l', `${Math.max(0, -o).toFixed(2)}px`);
    el.style.setProperty('--ss-stretch-r', `${Math.max(0, o).toFixed(2)}px`);
    el.style.setProperty('--ss-thin', `${Math.min(3, Math.abs(o) * 0.12).toFixed(2)}px`); // stretched, it thins a touch
  };
  const tick = (now) => {
    const dt = Math.min(1 / 30, (now - lastT) / 1000 || 1 / 60); lastT = now;
    const P = params();
    let live = false;
    for (const [k, sp] of Object.entries(springs)) {
      if (!sp.on) continue;
      for (let i = 0; i < 4; i++) { const f = -P.k * (sp.x - sp.to) - P.c * sp.v; sp.v += (f / P.m) * (dt / 4); sp.x += sp.v * (dt / 4); }
      const tol = k === 'pos' ? 0.002 : 0.02;
      if (Math.abs(sp.x - sp.to) < tol && Math.abs(sp.v) < tol * 10) { sp.x = sp.to; sp.v = 0; sp.on = false; } else live = true;
      if (k === 'pos') { const p = Math.max(0, Math.min(last, sp.x)); input.value = p; draw(sp.on ? p : sp.to, sp.on ? 'gliding' : 'settled'); }
    }
    shape();
    springRaf = live ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!springRaf) { lastT = performance.now(); springRaf = requestAnimationFrame(tick); } };
  const springTo = (k, to, from) => { const sp = springs[k]; if (from != null) { sp.x = from; sp.v = 0; } sp.to = to; sp.on = true; kick(); };
  function springPos(from, to) { cancelAnimationFrame(glideRaf); springTo('pos', to, springs.pos.on ? undefined : from); }
  // past the end: the further you pull, the less it gives
  const rubber = (px) => { const L = tune('rubber'); return L > 0 ? Math.sign(px) * L * (1 - 1 / (Math.abs(px) * 0.55 / L + 1)) : 0; };
  const posAt = (x) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(last, ((x - r.left) / r.width) * last)); };

  el.addEventListener('pointerdown', (e) => {
    if (!handOn() || e.button > 0 || e.target === edit) return;
    e.preventDefault(); el.classList.add('ss--pointer'); input.focus({ preventScroll: true }); // focused by a press: no focus ring (a key brings it back)
    cancelAnimationFrame(glideRaf);
    const now = springs.pos.on ? Math.max(0, Math.min(last, springs.pos.x)) : Number(input.value); // catch a settling handle where it is
    springs.pos.on = false;
    try { el.setPointerCapture(e.pointerId); } catch {}
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, raw: tune('relative') ? now : posAt(e.clientX), moved: false, decided: e.pointerType !== 'touch' };
    if (drag.decided) { show(); springTo('grow', 1); input.value = pull(drag.raw); draw(Number(input.value), 'dragging'); }
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const tx = e.clientX - drag.x0, ty = e.clientY - drag.y0;
    if (!drag.decided) { // touch: wait to see which way it goes
      if (Math.abs(ty) > 6 && Math.abs(ty) > Math.abs(tx)) { end(e, true); return; }
      if (Math.abs(tx) <= 6) return;
      drag.decided = true; show(); springTo('grow', 1);
    }
    if (Math.abs(tx) > 3) drag.moved = true;
    const r = el.getBoundingClientRect(), w = el.offsetWidth || 1;
    const away = Math.max(0, r.top - e.clientY, e.clientY - r.bottom), fine = tune('fine');
    scrubGain = fine > 0 ? Math.max(0.1, 1 / (1 + (3 * away) / fine)) : 1; // a quarter of the speed at fine px away
    if (tune('relative')) drag.raw += ((e.clientX - drag.lastX) / w) * last * scrubGain;
    else drag.raw = ((e.clientX - r.left) / r.width) * last;
    drag.lastX = e.clientX;
    const over = drag.raw < 0 ? drag.raw : drag.raw > last ? drag.raw - last : 0;
    springs.stretch.on = false; springs.stretch.x = rubber((over / last) * w); springs.stretch.v = 0;
    const p = pull(Math.max(0, Math.min(last, drag.raw)));
    input.value = p; draw(p, 'dragging'); shape();
    if (!springRaf && springs.grow.on) kick();
  });
  function end(e, cancelled = false) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; scrubGain = 1;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    springTo('grow', 0); springTo('stretch', 0);
    if (!d.decided) return; // a scroll, not a drag
    if (!cancelled && !d.moved && tune('relative') && tune('tapJump')) settle(Number(input.value), posAt(e.clientX)); // a tap: go there
    else settle();
    hide();
  }
  el.addEventListener('pointerup', (e) => end(e));
  el.addEventListener('pointercancel', (e) => end(e, true));

  // keys move a whole stop at a time, with the bubble up long enough to see it
  // editable number: commit lands on the nearest stop; arrows step stops
  if (edit) {
    const nearest = (v) => def.stops.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(def.stops[b] - v) ? i : b), 0);
    const goTo = (i) => { settle(Number(input.value), Math.max(0, Math.min(last, i))); edit.value = String(def.stops[index]); };
    // the field fits the widest number it can hold, so its fill has the same padding on both sides; while
    // dragging it widens for the decimal (no fill shows then)
    const probe = Object.assign(document.createElement('span'), { className: 'ss-edit-probe' });
    el.append(probe);
    const widest = (texts) => Math.max(...texts.map((t) => { probe.textContent = t; return probe.getBoundingClientRect().width; }));
    const fit = () => {
      el.style.setProperty('--ss-edit-w', `${Math.ceil(widest(def.stops.map(String)))}px`);
      el.style.setProperty('--ss-edit-w-moving', `${Math.ceil(widest(def.stops.map((v) => v.toFixed(1))))}px`);
    };
    fit(); document.fonts?.ready.then(fit);
    let before = '';
    edit.addEventListener('focus', () => { before = edit.value; edit.select(); });
    edit.addEventListener('pointerdown', (e) => e.stopPropagation());
    edit.addEventListener('keydown', (e) => {
      const step = { ArrowUp: 1, ArrowDown: -1 }[e.key];
      if (step) { e.preventDefault(); goTo(index + step * (e.shiftKey ? 10 : 1)); edit.select(); return; }
      if (e.key === 'Enter') { e.preventDefault(); edit.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); edit.value = before; edit.blur(); }
    });
    edit.addEventListener('blur', () => {
      const v = parseFloat(edit.value.replace(',', '.'));
      if (Number.isFinite(v)) goTo(nearest(v)); else edit.value = String(def.stops[index]);
    });
  }
  input.addEventListener('keydown', (e) => {
    el.classList.remove('ss--pointer');
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, Home: -last, End: last, PageDown: -10, PageUp: 10 }[e.key];
    if (step == null) return;
    e.preventDefault();
    show(); settle(Number(input.value), Math.max(0, Math.min(last, index + step))); hide(tune('keyLinger'));
  });
  input.addEventListener('blur', () => { hide(0); el.classList.remove('ss--pointer'); });

  draw(index);
  return {
    el,
    get value() { return def.stops[index]; },
    setStyle(s) { style = s; draw(index); },
    setColour(c) { colour = c; draw(index); }
  };
}
