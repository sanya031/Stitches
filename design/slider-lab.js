// The slider lab: the stage slider on its own, to iterate on how it feels. Each iteration is a version in
// VERSIONS; the version pill switches between them so they can be compared. The Slider panel (DialKit) tunes
// the version shown live, and copies its values; values that win become STAGE_TUNING in stage-slider.js.
import { createStageSlider, STAGE_TUNING, STAGE_SETTINGS } from './stage-slider.js';
import { SEG_MOTIONS, createSegMotion, dialDefaults } from './seg-motion.js';
import { hexOf } from './colour-field.js';

// Each version: what changed, and the tuning it starts from. Newest last.
const VERSIONS = {
  v1: { note: 'v1, as in the system now: a native range input. Dragging previews in-between values in the bubble; letting go jumps to the nearest stop.', tuning: { ...STAGE_TUNING } },
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
    <dl class="sl-read" data-read="${s}"><dt>State</dt><dd data-k="state">rest</dd><dt>Position</dt><dd data-k="pos">–</dd><dt>Nearest stop</dt><dd data-k="stop">–</dd><dt>Speed</dt><dd data-k="speed">–</dd><dt>Value</dt><dd data-k="value">–</dd></dl></section>`).join('');
  document.querySelectorAll('[data-host]').forEach((host) => {
    const s = host.dataset.host, def = STAGE_SETTINGS[s], read = document.querySelector(`[data-read="${s}"]`);
    const put = (k, v) => { read.querySelector(`[data-k="${k}"]`).textContent = v; };
    let last = null;
    createStageSlider(host, {
      setting: s, style: 'thread', colour: hexOf('--terracotta-500'), labelOutside: 'panel' in host.dataset, tuning,
      onMove: (pos, state) => {
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
    bubbleSize: [t.bubbleSize, 64, 160, 4],
    linger: [t.linger, 0, 2000, 10],
    keyLinger: [t.keyLinger, 0, 2000, 10],
    inBetween: t.inBetween,
    release: { type: 'select', options: [{ value: 'jump', label: 'Jump to stop' }, { value: 'glide', label: 'Glide to stop' }], default: t.release },
    glide: [t.glide, 40, 600, 10],
    copy: { type: 'action', label: 'Copy values' },
  }, {
    id: `selvedge-slider-lab-${version}`, persist: true,
    onAction: () => navigator.clipboard?.writeText(JSON.stringify(Object.fromEntries(Object.entries(kit.getValues()).filter(([k]) => k !== 'copy')), null, 2)),
  });
  const apply = (v) => { for (const k of Object.keys(STAGE_TUNING)) if (k in v) tuning[k] = v[k]; };
  apply(kit.getValues());
  kit.subscribe(apply);
}).catch(() => {});
