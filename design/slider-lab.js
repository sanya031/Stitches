// The slider lab: the stage slider on its own, to iterate on how it feels. Each iteration is a version in
// VERSIONS; the version pill switches between them so they can be compared. The Slider panel (DialKit) tunes
// the version shown live, and copies its values; values that win become STAGE_TUNING in stage-slider.js.
import { createStageSlider, STAGE_TUNING, STAGE_SETTINGS } from './stage-slider.js';
import { SEG_MOTIONS, createSegMotion, dialDefaults } from './seg-motion.js';
import { hexOf } from './colour-field.js';

// Each version: what changed, and the tuning it starts from. Newest last.
const VERSIONS = {
  v1: { note: 'v1, as in the system now: a native range input. Dragging previews in-between values in the bubble; letting go jumps to the nearest stop.', tuning: { ...STAGE_TUNING } },
  v2: { note: 'v2: no label. The box holds only the slider; under it, on the left, just the number, changing as you drag.', layout: 'number', tuning: { ...STAGE_TUNING } },
  v3: { note: 'v3: the label above the box. Inside, the slider and on the right just the number: one decimal while you drag (the value under the thumb), the stop once you let go.', layout: 'live', tuning: { ...STAGE_TUNING } },
  v4: { note: 'v4: the whole box is the slider. It fills from the left up to the handle, a vertical bar you pull; press or drag anywhere in the box. Label above, number inside on the right.', layout: 'bar', tuning: { ...STAGE_TUNING } },
  v5: { note: 'v5: as v4 with a longer handle and markers at every whole number (every 10 for density). Near a marker, dragging pulls the handle onto it; letting go lands on the nearest whole number.', layout: 'bar', tuning: { ...STAGE_TUNING, handle: 24, markers: true, magnet: 0.15 } },
  v6: { note: 'v6: as v5, with the markers through the middle of the box and longer; the marker for the most used value (2 strands, 50% density) is bolder.', layout: 'bar', tuning: { ...STAGE_TUNING, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre' } },
  v7: { note: 'v7: as v6, with the markers faint until one is in use: the marker the handle is on (pulled onto it while dragging, or landed on) shows at full strength.', layout: 'bar', tuning: { ...STAGE_TUNING, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35 } },
  v8: { note: 'v8: as v7, but untouched you see only the fill. Hover (or drag, or tab to it) and the handle and markers fade in.', layout: 'bar', tuning: { ...STAGE_TUNING, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true } },
  v9: { note: 'v9: as v8, and the number is a field. Hover it and a fill hugs the number; press it and an underline shows you are typing; type a value or use the up and down arrows (shift for ten), Enter to keep it, Escape to undo. Typed values land on the nearest stop.', layout: 'bar', editable: true, tuning: { ...STAGE_TUNING, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true } },
  v10: { note: 'v10: as v9, with a quieter bubble: the stitch as a line primitive (the same drawing as the stitch tiles) in the text colour on a plain square, smaller, instead of the thread on red cloth. Thickness and spacing still follow the value as you drag.', layout: 'bar', editable: true, style: 'prim', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true } },
  v11: { note: 'v11: as v10, with a choice of motion for the bubble number. It starts plain, as in v10 (the default); pick another in the Slider panel (Number): Roll turns each digit like a combination lock, passing the digits between (going up, the new one comes down from above); Slide drops in only the digits that changed; Blur cross-fades them through a blur. Duration, ease, stagger (each place waits for the one to its right), slide distance, blur and edge fade tune it.', layout: 'bar', editable: true, style: 'prim', dials: 'v11-2', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true, numberMotion: 'none' } },
  v12: { note: 'v12: as v11, and it feels like it is in your hand. Drag from where the value is: pressing never jumps it (a press and let go without moving still goes there). The box grows a little while you hold it. Pull past either end and it stretches, harder the further you go, then springs back. Move the pointer above or below the box while dragging to slow it down for fine values (a quarter of the speed 80px away; the readout shows the speed). Letting go springs onto the stop with the pill motion\'s spring; press again to catch it mid-way. On touch, only a sideways drag moves it, so the panel still scrolls.', layout: 'bar', editable: true, style: 'prim', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true, numberMotion: 'none', hand: true, relative: true, tapJump: true, grow: 2, rubber: 16, fine: 80, release: 'spring' } },
  v13: { note: 'v13: as v12, but the number only ever shows a value you can pick: while dragging it shows the stop the handle will land on (2, then 3 strands; 62%, not 62.4%), never a decimal. The drawing in the bubble still changes smoothly as you drag.', layout: 'bar', editable: true, style: 'prim', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true, numberMotion: 'none', hand: true, relative: true, tapJump: true, grow: 2, rubber: 16, fine: 80, release: 'spring', decimals: false } },
  v14: { note: 'v14: as v13, without the bubble: the drawing sits in the box, small, just left of the number, and changes as you drag. Nothing floats over the panel.', layout: 'bar', editable: true, style: 'prim', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true, numberMotion: 'none', hand: true, relative: true, tapJump: true, grow: 2, rubber: 16, fine: 80, release: 'spring', decimals: false, display: 'inline' } },
  v15: { note: 'v15: as v13, without the bubble: the fill itself is drawn as laid thread. For strands its lines get thicker; for density they pack closer. You see the value in the slider at rest too.', layout: 'bar', editable: true, style: 'prim', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true, numberMotion: 'none', hand: true, relative: true, tapJump: true, grow: 2, rubber: 16, fine: 80, release: 'spring', decimals: false, display: 'fill' } },
  v16: { note: 'v16: as v13, with a strip instead of the bubble: while you drag, a row over the box shows the drawing of every stop (every quarter for density), each over its place, and the one you will land on is selected. You see all the choices at once, not just this one.', layout: 'bar', editable: true, style: 'prim', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true, numberMotion: 'none', hand: true, relative: true, tapJump: true, grow: 2, rubber: 16, fine: 80, release: 'spring', decimals: false, display: 'strip' } },
  v17: { note: 'v17: as v13, with a patch instead of the bubble: a 4 × 4 patch of cloth over the start of the box, with the value in words under it. It stays put while the handle moves, and shows how the setting looks over an area, not one square.', layout: 'bar', editable: true, style: 'prim', tuning: { ...STAGE_TUNING, bubbleSize: 64, handle: 24, markers: true, magnet: 0.15, markAlign: 'centre', markOpacity: 0.35, reveal: true, numberMotion: 'none', hand: true, relative: true, tapJump: true, grow: 2, rubber: 16, fine: 80, release: 'spring', decimals: false, display: 'patch' } },
};
const SETTINGS = ['strands', 'density'];

const $ = (id) => document.getElementById(id);
let version = Object.keys(VERSIONS).at(-1);
const tuning = { ...VERSIONS[version].tuning }; // shared by every slider on the page, changed live by the dials

// ─── the sliders, each with a readout ─────────────────────────────────────────
function render() {
  $('version-note').textContent = VERSIONS[version].note;
  $('cases').innerHTML = SETTINGS.map((s) => `<section class="sl-case"><h2>${STAGE_SETTINGS[s].label}</h2>
    <div class="sl-big" data-host="${s}"></div>
    <div class="sl-panel" data-host="${s}" data-panel></div>
    <dl class="sl-read" data-read="${s}"><dt>State</dt><dd data-k="state">rest</dd><dt>Position</dt><dd data-k="pos">–</dd><dt>Nearest stop</dt><dd data-k="stop">–</dd><dt>Speed</dt><dd data-k="speed">–</dd><dt>Scrub speed</dt><dd data-k="gain">full</dd><dt>Value</dt><dd data-k="value">–</dd></dl></section>`).join('');
  document.querySelectorAll('[data-host]').forEach((host) => {
    const s = host.dataset.host, def = STAGE_SETTINGS[s], read = document.querySelector(`[data-read="${s}"]`);
    const put = (k, v) => { read.querySelector(`[data-k="${k}"]`).textContent = v; };
    let last = null;
    createStageSlider(host, {
      setting: s, style: VERSIONS[version].style || 'thread', colour: hexOf('--terracotta-500'), labelOutside: 'panel' in host.dataset, tuning, layout: VERSIONS[version].layout || 'inline', editable: !!VERSIONS[version].editable,
      onMove: (pos, state, info) => {
        if (info) put('gain', info.gain >= 0.99 ? 'full' : `${Math.round(info.gain * 100)}%`);
        const now = performance.now();
        if (last && state === 'dragging') put('speed', `${(Math.abs(pos - last.pos) / Math.max(1, now - last.t) * 1000).toFixed(1)} stops/s`);
        last = { pos, t: now };
        put('state', state); put('pos', pos.toFixed(2)); put('stop', def.say(def.stops[Math.round(pos)]));
      },
      onChange: (v) => put('value', def.say(v)),
    });
  });
}

// ─── version pill ─────────────────────────────────────────────────────────────
$('versions').innerHTML = `<div class="c-seg" role="group" aria-label="Version">${Object.keys(VERSIONS).map((v) => `<button class="c-reset c-seg__opt c-focus" aria-pressed="${v === version}" data-label="${v}" data-v="${v}">${v}</button>`).join('')}</div>`;
const pill = $('versions').firstElementChild;
const pillValues = dialDefaults(SEG_MOTIONS.squash.dials);
createSegMotion(pill, () => pillValues);
pill.addEventListener('click', (e) => {
  const b = e.target.closest('[data-v]'); if (!b || b.dataset.v === version) return;
  version = b.dataset.v;
  Object.assign(tuning, VERSIONS[version].tuning);
  render();
});

// ─── theme ────────────────────────────────────────────────────────────────────
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('#theme button').forEach((b) => b.classList.toggle('is-selected', b.dataset.themePick === t));
  try { localStorage.setItem('selvedge-controls-theme', t); } catch {}
}
let saved = null;
try { saved = localStorage.getItem('selvedge-controls-theme'); } catch {}
setTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('theme').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setTheme(b.dataset.themePick); render(); } });

render();

// ─── tuning dials ─────────────────────────────────────────────────────────────
import('https://cdn.jsdelivr.net/npm/dialkit@2.0.0/dist/vanilla/index.js').then(({ createDialKit, createDialRoot }) => {
  createDialRoot({ position: 'top-right', theme: document.documentElement.dataset.theme });
  const t = VERSIONS[version].tuning;
  const kit = createDialKit(`Slider ${version}`, {
    display: { type: 'select', options: [{ value: 'bubble', label: 'Bubble' }, { value: 'inline', label: 'In the box' }, { value: 'fill', label: 'Thread fill' }, { value: 'strip', label: 'Strip of stops' }, { value: 'patch', label: 'Patch' }, { value: 'none', label: 'Number only' }], default: t.display },
    bubbleSize: [t.bubbleSize, 64, 160, 4],
    bubbleGap: [t.bubbleGap, 0, 12, 1],
    linger: [t.linger, 0, 2000, 10],
    keyLinger: [t.keyLinger, 0, 2000, 10],
    inBetween: t.inBetween,
    decimals: t.decimals,
    release: { type: 'select', options: [{ value: 'jump', label: 'Jump to stop' }, { value: 'glide', label: 'Glide to stop' }, { value: 'spring', label: 'Spring to stop' }], default: t.release },
    springDuration: [t.springDuration, 0.1, 1, 0.01],
    springBounce: [t.springBounce, 0, 0.6, 0.01],
    glide: [t.glide, 40, 600, 10],
    handle: [t.handle, 8, 36, 1],
    markers: t.markers,
    markOpacity: [t.markOpacity, 0, 1, 0.05],
    reveal: t.reveal,
    markAlign: { type: 'select', options: [{ value: 'bottom', label: 'Bottom' }, { value: 'centre', label: 'Centre' }], default: t.markAlign },
    magnet: [t.magnet, 0, 0.5, 0.01],
    feel: {
      hand: t.hand,
      relative: t.relative,
      tapJump: t.tapJump,
      grow: [t.grow, 0, 6, 0.5],
      rubber: [t.rubber, 0, 32, 1],
      fine: [t.fine, 0, 200, 5],
    },
    number: {
      numberMotion: { type: 'select', options: [{ value: 'none', label: 'None' }, { value: 'roll', label: 'Roll (lock)' }, { value: 'slide', label: 'Slide' }, { value: 'blur', label: 'Blur' }], default: t.numberMotion },
      numberEase: { type: 'select', options: [{ value: 'smooth', label: 'Smooth' }, { value: 'spring', label: 'Spring' }, { value: 'linear', label: 'Linear' }], default: t.numberEase },
      numberDuration: [t.numberDuration, 40, 800, 10],
      numberStagger: [t.numberStagger, 0, 80, 2],
      numberDistance: [t.numberDistance, 0, 1.5, 0.05],
      numberBlur: [t.numberBlur, 0, 8, 0.5],
      numberFade: [t.numberFade, 0, 1, 0.05],
    },
    copy: { type: 'action', label: 'Copy values' },
  }, {
    id: `selvedge-slider-lab-${VERSIONS[version].dials || version}`, persist: true, // dials: a new key when a version's starting values change
    onAction: () => navigator.clipboard?.writeText(JSON.stringify(Object.fromEntries(Object.entries(kit.getValues()).filter(([k]) => k !== 'copy')), null, 2)),
  });
  const apply = (v) => { v = { ...v, ...v.number, ...v.feel }; for (const k of Object.keys(STAGE_TUNING)) if (k in v) tuning[k] = v[k]; }; // the Number folder's values sit under number
  apply(kit.getValues());
  kit.subscribe(apply);
}).catch(() => {});
