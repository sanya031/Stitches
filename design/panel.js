// The Panel tab: the properties panel assembled from the controls, to see them together. Built with the same
// classes as the Controls tab and the same tokens. The mode switch changes the tab (Stitch, Animate, Export);
// "Showing" changes what the Stitch tab acts on. Every pill moves with the saved pill motion.
import { svg } from './icons/icons.js';
import { PRIMITIVES, primitiveSvg, patchSquares } from './icons/primitives.js';
import { createStageSlider } from './stage-slider.js';
import { skein } from './skein.js';
import { createTooltips } from './tooltip.js';
import { SEG_MOTIONS, createSegMotion, dialDefaults } from './seg-motion.js';
import { createZoomMotion } from './zoom-motion.js';
import { TUNING, motionFrom } from './icons/zoom-css.js';

// stitch tiles use the primitives' hover zoom: hover one and it shrinks to its corner as a patch of cloth sweeps in
const ZOOM_N = patchSquares(24), zoom = createZoomMotion(() => motionFrom(TUNING));

// ─── builders, the same markup as the Controls tab ───────────────────────────
const ic = (n) => `<span class="c-ic">${svg(n)}</span>`;
let uid = 0;
const prim = (n) => primitiveSvg(n, { size: 24, id: `pp-${uid++}`, frame: 'square', animate: false });
const zoomPrim = (n) => primitiveSvg(n, { size: 24, id: `pz-${uid++}`, frame: 'zoom', n: ZOOM_N, animate: false });
const iconbtn = (n, label, cls = '') => `<button class="c-reset c-iconbtn c-focus ${cls}" aria-label="${label}" title="${label}">${ic(n)}</button>`;
const btn = (kind, label, icon = '', cls = '') => `<button class="c-reset c-btn c-btn--${kind} c-focus ${cls}">${icon ? ic(icon) : ''}${label}</button>`;
const seg = (opts, sel = 0, { lg = false, icons = false, id = '' } = {}) => `<div class="c-seg ${lg ? 'c-seg--lg' : ''} ${icons ? 'c-seg--icons' : ''}" role="group" data-pill${id ? ` id="${id}"` : ''}>${opts.map((o, i) => {
  const [value, label] = Array.isArray(o) ? o : [o, o];
  return `<button class="c-reset c-seg__opt c-focus" aria-pressed="${i === sel}" data-value="${value}"${icons ? ` aria-label="${label}" title="${label}"` : ` data-label="${label}"`}>${icons ? ic(value) : label}</button>`;
}).join('')}</div>`;
const sw = (label, on = false, mixed = false) => `<button class="c-reset c-switch c-switch--field c-focus ${mixed ? 'is-mixed' : ''}" role="switch" aria-checked="${on}" data-switch><span class="c-switch__track"><span class="c-switch__thumb"></span></span>${label}</button>`;
const slider = (label, v, { unit = '%', mixed = false } = {}) => `<div class="c-slider ${mixed ? 'is-mixed' : ''}" style="--v:${v}%" data-slider data-unit="${unit}"><span>${label}</span><span class="c-slider__track"><span class="c-slider__fill"></span><span class="c-slider__thumb" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"></span></span><span class="c-slider__value">${mixed ? 'Mixed' : `${v}${unit}`}</span></div>`;
const num = (label, value, unit = '', { mixed = false, steps = true } = {}) => `<label class="c-field c-field--num ${mixed ? 'is-mixed' : ''}"><span class="c-field__label">${label}</span><input inputmode="numeric" value="${mixed ? '' : value}" placeholder="${mixed ? 'Mixed' : ''}" aria-label="${label}"><span class="c-field__unit">${unit}</span>${steps ? `<span class="c-field__steps">${ic('minus')}${ic('plus')}</span>` : ''}</label>`;
const select = (label, value, options, { mixed = false } = {}) => `<button class="c-reset c-select c-focus ${mixed ? 'is-mixed' : ''}" data-select="${options.join('|')}"><span class="c-select__label">${label}</span><span class="c-select__value">${mixed ? 'Mixed' : value}</span>${ic('chevron-down')}</button>`;
const skeinShow = (colour, cls = '') => skein(colour, { tag: 'span', cls });
const skeinBtn = (colour, cls = '', count = '') => skein(colour, { cls, attrs: 'data-skein', extra: count ? `<span class="c-badge c-skein__n">${count}</span>` : '' });
const prop = (label, control) => control; // the label lives inside the control now
const stack = (control) => `<div class="c-prop c-prop--stack">${control}</div>`;
const section = (title, body, { action = '', open = true } = {}) => `<div class="c-panel__section" data-open="${open}"><div class="c-panel__sechead"><button class="c-reset c-section c-focus" aria-expanded="${open}" data-section>${ic(open ? 'chevron-down' : 'chevron-right')}${title}</button>${action}</div>${body}</div>`;
const head = (eyebrow, title, sub, actions = '') => `<div class="c-panel__head"><span class="c-panel__eyebrow">${eyebrow}</span><span class="c-panel__title">${title}</span><span class="c-panel__sub">${sub}</span>${actions ? `<div class="c-panel__actions">${actions}</div>` : ''}</div>`;
const colourRow = (colour, name, code, mixed = false) => `<button class="c-reset c-swatchrow c-focus" data-picker><span class="c-swatchrow__label">Colour</span><span class="c-swatchrow__swatch">${skeinShow(mixed ? '--neutral-500' : colour)}<span>${mixed ? 'Mixed' : name}</span>${mixed ? '' : `<span class="c-swatchrow__code">${code}</span>`}</span>${ic('chevron-down')}</button>`;
const stage = (setting) => `<div data-stage="${setting}"></div>`;

// every stitch and fill in one grid: stitches first, then fills
// one tile per stitch type: quarter and three-quarter show one corner, the panel doesn't pick a direction
const STITCHES = Object.keys(PRIMITIVES).filter((n) => !/-(tr|bl|br)$/.test(n)).sort((x, y) => (x.startsWith('fill') - y.startsWith('fill')));
const stitchName = (n) => PRIMITIVES[n].label.replace(/, top left$/, '');
const tiles = (sel = 0) => `<div class="c-tilegrid" data-tiles>${STITCHES.map((n, i) => `<button class="c-reset c-tile c-focus tz-host" aria-label="${stitchName(n)}" data-tip="${stitchName(n)}" aria-pressed="${i === sel}">${zoomPrim(n)}</button>`).join('')}</div>`;
const PIECE = [['--terracotta-500', 412], ['--leaf-500', 236], ['--ochre-300', 188], ['--periwinkle-400', 97], ['--neutral-950', 64]];
const inPiece = section('In this piece', `<div class="c-piece">${PIECE.map(([c, n], i) => `<div class="c-piece__item">${skeinBtn(c, i === 0 ? 'is-selected' : '')}<span class="c-piece__n">${n}</span></div>`).join('')}</div><span class="c-hint">Click a colour to select every stitch in it</span>`);
const layerRow = (name, cls = '', eye = 'eye') => `<div class="c-layer ${cls}"><span class="c-layer__name">${name}</span><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Show or hide" data-toggle>${ic(eye)}</button><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Lock" data-toggle>${ic('lock')}</button></div>`;
const layers = section('Layers', `<div>${layerRow('Lettering')}${layerRow('Stitches', 'is-selected')}${layerRow('Calla lilies photo', 'is-hidden', 'eye-off')}</div>`, { action: iconbtn('plus', 'Add layer', 'c-iconbtn--sm') });
const thread = (mixed = false) => section('Thread', `${stack(colourRow('--terracotta-500', 'Brick', 'DMC 3830', mixed))}${prop('Type', select('Type', 'Stranded cotton', ['Stranded cotton', 'Perle cotton', 'Silk', 'Metallic', 'Wool'], { mixed }))}${stage('strands')}`);

// ─── the panel for each tab and context ──────────────────────────────────────
const STITCH_TAB = {
  tool: () => head('Tool', 'Stitch', 'Full cross · 2 strands · on 14 count Aida')
    + `<div class="c-panel__body">${section('Stitch', `${tiles(STITCHES.indexOf('stitch-full'))}`)}${thread()}${section('Fill', `${stage('density')}${prop('Angle', num('Angle', 45, '°', { steps: false }))}`, { open: false })}${inPiece}${layers}</div>`,
  selection: () => head('Selection', '142 stitches', '3 colours · 2 stitch types', `${iconbtn('tool-pan', 'Move')}${iconbtn('recolour', 'Recolour')}${iconbtn('rotate', 'Rotate')}${iconbtn('clear', 'Delete')}`)
    + `<div class="c-panel__body">${section('Stitch', `${tiles(-1)}<span class="c-hint">Mixed: pick one to change them all</span>`)}${thread(true)}${section('Fill', `${slider('Density', 0, { mixed: true })}${prop('Angle', num('Angle', '', '°', { mixed: true, steps: false }))}`)}${inPiece}</div>`,
  image: () => head('Image', 'Calla lilies photo', '2400 × 1800 px → 120 × 90 squares', `${iconbtn('picture', 'Replace image')}${iconbtn('clear', 'Remove image')}`)
    + `<div class="c-panel__body">${section('Turn into', `${stack(sw('Pattern', true))}${stack(sw('Stitched', true))}`)}${section('Colours', `${prop('Colours', num('Colours', 11, 'threads'))}${slider('Detail', 70)}${stack(sw('Dither'))}${stack(sw('Remove background', true))}${stack(sw('Outline', true))}`)}${section('Size on fabric', `<div class="c-prop__pair">${num('W', 120, 'sq')}${num('H', 90, 'sq')}</div>${seg(['Squares', 'cm', 'in'])}<span class="c-hint">21.8 × 16.3 cm at 14 count</span>`)}${layers}</div>`,
  text: () => head('Text', '“Hello”', 'Script · stem stitch · 2 strands')
    + `<div class="c-panel__body">${section('Text', `${stack('<label class="c-field"><input value="Hello" aria-label="Text"></label>')}${seg(['Sampler', 'Script'], 1)}${prop('Font', select('Font', 'Pacifico line', ['Pacifico line', 'Sampler 7', 'Sampler 9']))}${prop('Size', num('Size', 18, 'sq'))}${slider('Spacing', 40)}`)}${section('Baseline', `${seg(['Straight', 'Arc'], 1)}${slider('Curve', 30)}`)}${thread()}${layers}</div>`
};
const ANIMATE = () => head('Animate', 'Calla lilies', 'Stitches in, then reacts to touch and wear')
  + `<div class="c-panel__body">${section('Stitch in', `${prop('Order', select('Order', 'By colour', ['By colour', 'By row', 'Like a hand', 'By layer']))}${slider('Speed', 55)}<div class="c-play"><button class="c-reset c-iconbtn c-iconbtn--secondary c-focus" aria-label="Play">${ic('play')}</button><span class="c-slider" style="--v:0%;display:block;min-height:0"><span class="c-slider__track" style="display:block"><span class="c-slider__fill"></span><span class="c-slider__thumb"></span></span></span><span class="c-slider__value">0:00</span></div>`)}${section('Touch', `${slider('Tug', 60)}${slider('Spring back', 45)}`)}${section('Wear', `${slider('Rate', 30)}${slider('Snap at', 85)}${stack(sw('Heals slowly', true))}${seg(['Fresh', 'Dulled', 'Fuzzed', 'Split', 'Snapped'])}${stack(btn('secondary', 'Mend worn stitches', 'mend'))}`)}</div>`;
const EXPORT = () => head('Export', 'Calla lilies', '120 × 90 squares · 11,840 stitches · 5 colours')
  + `<div class="c-panel__body">${section('Embed', `<div class="c-code"><code>&lt;stitch-piece src="abc123" interactive wear="visitor"&gt;&lt;/stitch-piece&gt;</code>${iconbtn('copy', 'Copy code', 'c-iconbtn--sm')}</div>${stack(sw('Interactive', true))}${prop('Wear', seg(['Off', 'Visitor', 'Shared'], 1))}`)}${section('Video or GIF', `${seg(['GIF', 'MP4'])}${prop('Width', num('Width', 800, 'px', { steps: false }))}${stack(btn('primary', 'Download GIF', 'download'))}`)}${section('Image', `${stack(sw('Transparent background'))}${stack(btn('secondary', 'Download PNG', 'download'))}`)}${section('Pattern chart', `<span class="c-hint">A symbol chart and a thread shopping list, for stitching it for real</span>${stack(btn('secondary', 'Download PDF', 'download'))}`)}</div>`;

// ─── state, render ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const panel = $('panel'), toastEl = $('toast');
let mode = 'stitch', context = 'tool', pillStyle = '';
const pillValues = dialDefaults(SEG_MOTIONS.squash.dials);
const motion = (root) => createSegMotion(root, () => pillValues);
const threadColour = () => getComputedStyle(document.documentElement).getPropertyValue('--terracotta-500').trim();
const STYLE_CLASSES = ['c-seg--soft', 'c-seg--square', 'c-seg--clean', 'c-seg--outline', 'c-seg--ring', 'c-seg--underline', 'c-seg--invert'];
const PILL_STYLES = [['', 'Rounded'], ['c-seg--soft', 'Soft'], ['c-seg--square', 'Square'], ['c-seg--clean', 'Clean'], ['c-seg--clean c-seg--soft', 'Clean, soft'], ['c-seg--outline', 'Outline'], ['c-seg--clean c-seg--ring', 'Ring'], ['c-seg--clean c-seg--ring c-seg--soft', 'Ring, soft'], ['c-seg--clean c-seg--underline', 'Underline'], ['c-seg--invert', 'Invert'], ['c-seg--clean c-seg--invert c-seg--soft', 'Invert, clean, soft']];
$('pill-style').innerHTML = PILL_STYLES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

function stylePills(root = document) {
  root.querySelectorAll('[data-pill]').forEach((el) => { el.classList.remove(...STYLE_CLASSES); if (pillStyle) el.classList.add(...pillStyle.split(' ')); });
}
function wire(root) {
  stylePills(root);
  root.querySelectorAll('[data-pill]').forEach(motion);
  root.querySelectorAll('[data-tiles]').forEach((el) => createSegMotion(el, () => pillValues, { option: '.c-tile' }));
  root.querySelectorAll('[data-stage]').forEach((host) => createStageSlider(host, { setting: host.dataset.stage, style: 'thread', colour: threadColour() }));
  root.querySelectorAll('[data-slider]').forEach(liveSlider);
  root.querySelectorAll('.tz-host').forEach((h) => { const svg = h.querySelector('svg'); Object.assign(svg.dataset, { n: ZOOM_N, o: 5, c: 14 }); zoom.sync(h); });
  // icons centred on their drawing, as on the Controls tab
  root.querySelectorAll('.c-ic svg').forEach((el) => { const b = el.getBBox(); if (b.width || b.height) el.setAttribute('viewBox', `${b.x + b.width / 2 - 12} ${b.y + b.height / 2 - 12} 24 24`); });
}
function render() {
  panel.innerHTML = mode === 'stitch' ? STITCH_TAB[context]() : mode === 'animate' ? ANIMATE() : EXPORT();
  $('context').disabled = mode !== 'stitch';
  wire(panel);
}
function renderStage() {
  $('appbar').innerHTML = `<div class="pp-name"><b>Calla lilies</b><span>14 ct Aida · 120 × 90 · 11,840 stitches</span></div>${seg([['stitch', 'Stitch'], ['animate', 'Animate'], ['export', 'Export']], 0, { lg: true, id: 'mode' })}<span class="c-save">${ic('check')}Saved</span>${iconbtn('undo', 'Undo')}${iconbtn('redo', 'Redo')}`;
  const holes = Array.from({ length: 13 * 10 }, (_, i) => `<circle cx="${(i % 13) * 40 + 20}" cy="${Math.floor(i / 13) * 39 + 20}" r="2" fill="currentColor"/>`).join('');
  $('canvas').innerHTML = `<div class="pp-cloth"><svg viewBox="0 0 520 390" aria-hidden="true">${holes}</svg></div>
    <div class="c-bar c-bar--tools pp-tools" data-tools>${['tool-select', 'tool-stitch', 'tool-fill', 'tool-pattern', 'letters', 'picture', 'tool-erase', 'tool-pan'].map((n, i) => `<button class="c-reset c-tool c-focus" aria-label="${n}" title="${n}" aria-pressed="${i === 1}">${ic(n)}</button>`).join('')}</div>
    <div class="c-bar c-bar--pill pp-zoom">${iconbtn('minus', 'Zoom out', 'c-iconbtn--sm')}<span class="c-bar__zoom">100%</span>${iconbtn('plus', 'Zoom in', 'c-iconbtn--sm')}<span class="c-bar__sep"></span>${iconbtn('fit', 'Fit', 'c-iconbtn--sm')}</div>
    <span class="pp-note">The cloth is a placeholder: this page is for the panel</span>`;
  wire($('appbar')); wire($('canvas'));
}

// ─── live behaviour ──────────────────────────────────────────────────────────
function liveSlider(el) {
  const track = el.querySelector('.c-slider__track'), thumb = el.querySelector('.c-slider__thumb'), unit = el.dataset.unit;
  const set = (v) => { v = Math.max(0, Math.min(100, Math.round(v))); el.classList.remove('is-mixed'); el.style.setProperty('--v', `${v}%`); el.querySelector('.c-slider__value').textContent = `${v}${unit}`; thumb.setAttribute('aria-valuenow', v); };
  const at = (e) => { const r = track.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); el.classList.add('is-dragging'); at(e); thumb.focus({ preventScroll: true }); });
  track.addEventListener('pointermove', (e) => { if (track.hasPointerCapture(e.pointerId)) at(e); });
  track.addEventListener('pointerup', () => el.classList.remove('is-dragging'));
  thumb.addEventListener('keydown', (e) => { const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]; if (d != null) { e.preventDefault(); set(Number(thumb.getAttribute('aria-valuenow')) + d); } });
}
let pop = null;
const closePop = () => { if (pop) { pop.el.remove(); pop.trigger.classList.remove('is-open'); pop = null; } };
function openPop(trigger, html) {
  closePop();
  const el = document.createElement('div'); el.className = 'c-pop'; el.innerHTML = html;
  const box = panel.getBoundingClientRect(), r = trigger.getBoundingClientRect();
  el.style.left = `${r.left - box.left}px`; el.style.top = `${r.bottom - box.top + 4}px`;
  panel.append(el); trigger.classList.add('is-open'); pop = { el, trigger };
  wire(el);
}
const pickerHtml = () => `<div class="c-popover"><div class="c-popover__title">Thread colour</div>${seg(['This piece', 'Floss', 'Mine', 'Image'], 1)}<label class="c-field c-search">${ic('search')}<input placeholder="Search floss" aria-label="Search floss"></label><div class="c-skeingrid">${['--terracotta-500', '--ochre-300', '--leaf-500', '--periwinkle-400', '--lilac-400', '--crimson-500', '--neutral-950', '--neutral-50', '--terracotta-300', '--periwinkle-700'].map((c, i) => skeinBtn(c, i === 0 ? 'is-selected' : '')).join('')}</div></div>`;
createTooltips();
let toastTimer;
const toast = (m) => { toastEl.textContent = m; toastEl.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 1600); };

document.addEventListener('click', (e) => {
  const t = e.target;
  if (pop && !pop.el.contains(t) && !pop.trigger.contains(t)) closePop();
  const modeOpt = t.closest('#mode .c-seg__opt');
  if (modeOpt) { mode = modeOpt.dataset.value; setTimeout(render, 0); return; }
  const sec = t.closest('[data-section]');
  if (sec) { const s = sec.parentElement, open = s.dataset.open !== 'true'; s.dataset.open = open; sec.setAttribute('aria-expanded', open); sec.querySelector('.c-ic').outerHTML = ic(open ? 'chevron-down' : 'chevron-right'); return; }
  const tile = t.closest('[data-tiles] .c-tile');
  if (tile) { tile.parentElement.querySelectorAll('.c-tile').forEach((x) => x.setAttribute('aria-pressed', x === tile)); }
  const tool = t.closest('[data-tools] .c-tool');
  if (tool) tool.parentElement.querySelectorAll('.c-tool').forEach((x) => x.setAttribute('aria-pressed', x === tool));
  const swi = t.closest('[data-switch]');
  if (swi) { swi.classList.remove('is-mixed'); swi.setAttribute('aria-checked', swi.getAttribute('aria-checked') !== 'true'); }
  const tog = t.closest('[data-toggle]');
  if (tog) { tog.classList.toggle('is-selected'); const row = tog.closest('.c-layer'); if (row && tog === row.querySelector('[data-toggle]')) { row.classList.toggle('is-hidden'); tog.innerHTML = ic(row.classList.contains('is-hidden') ? 'eye-off' : 'eye'); } }
  const layer = t.closest('.c-layer');
  if (layer && !tog) layer.parentElement.querySelectorAll('.c-layer').forEach((x) => x.classList.toggle('is-selected', x === layer));
  const sk = t.closest('[data-skein]');
  if (sk && !t.closest('.c-pop')) { sk.closest('.c-piece').querySelectorAll('.c-skein').forEach((x) => x.classList.toggle('is-selected', x === sk)); toast(`Selected the ${sk.parentElement.querySelector('.c-piece__n')?.textContent || ''} stitches in this colour`); }
  if (sk && t.closest('.c-pop')) { sk.parentElement.querySelectorAll('.c-skein').forEach((x) => x.classList.toggle('is-selected', x === sk)); }
  const picker = t.closest('[data-picker]');
  if (picker) { if (pop?.trigger === picker) closePop(); else openPop(picker, pickerHtml()); }
  const sel = t.closest('[data-select]');
  if (sel) {
    if (pop?.trigger === sel) closePop();
    else { const current = sel.querySelector('.c-select__value').textContent; openPop(sel, `<div class="c-menu" style="min-width:${sel.offsetWidth}px">${sel.dataset.select.split('|').map((o) => `<button class="c-reset c-menu__item ${o === current ? 'is-selected' : ''}" data-choose="${o}">${o}${o === current ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('')}</div>`); }
  }
  const choose = t.closest('[data-choose]');
  if (choose && pop) { const trig = pop.trigger; trig.classList.remove('is-mixed'); trig.querySelector('.c-select__value').textContent = choose.dataset.choose; closePop(); }
  if (t.closest('.c-code .c-iconbtn')) toast('Copied the embed code');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
$('context').addEventListener('change', (e) => { context = e.target.value; render(); });
$('pill-style').addEventListener('change', (e) => { pillStyle = e.target.value; stylePills(); try { localStorage.setItem('selvedge-panel-pill', pillStyle); } catch {} });

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('#theme button').forEach((b) => b.classList.toggle('is-selected', b.dataset.themePick === t));
  try { localStorage.setItem('selvedge-controls-theme', t); } catch {}
}
$('theme').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTheme(b.dataset.themePick); });
let saved = null, savedPill = null;
try { saved = localStorage.getItem('selvedge-controls-theme'); savedPill = localStorage.getItem('selvedge-panel-pill'); } catch {}
setTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
if (savedPill !== null && PILL_STYLES.some(([v]) => v === savedPill)) { pillStyle = savedPill; $('pill-style').value = savedPill; }
renderStage();
render();
