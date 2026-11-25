// The Panel tab: the properties panel assembled from the controls, to see them together. Built with the same
// classes as the Controls tab and the same tokens. The mode switch changes the tab (Stitch, Animate, Export);
// "Showing" changes what the Stitch tab acts on. Every pill moves with the saved pill motion.
import { svg } from './icons/icons.js';
import { PRIMITIVES, primitiveSvg, patchSquares } from './icons/primitives.js';
import { createStageSlider, opacitySquare } from './stage-slider.js';
import { swatch } from './swatch.js';
import { hexOf, parseHex } from './colour-field.js';
import { createColourPicker, FLOAT_TUNING } from './colour-picker.js';
import { OUTLINE_STITCHES, outlineSvg } from './outline-stitches.js';
import { createPicturePopup } from './picture-popup.js';
import { cellSizeHtml, wireCellSize, CELL_SIZE, CELL_LAYOUTS } from './cell-size.js';
import { coverageHtml } from './coverage.js';
import { fabricHtml } from './fabric.js';
import { drawCallaLilies } from '../lab/starter.js';
import { createFloatingPalette } from './floating-palette.js';
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
// a switch: the field with its label, Off and On always in view as a small pill; mixed, neither is pressed
const sw = (label, on = false, mixed = false) => `<button class="c-reset c-switch c-focus ${mixed ? 'is-mixed' : ''}" role="switch" aria-checked="${mixed ? 'mixed' : on}" data-switch>${label}<span class="c-seg c-seg--soft" aria-hidden="true">${['Off', 'On'].map((w, i) => `<span class="c-seg__opt" data-label="${w}" aria-pressed="${!mixed && on === (i === 1)}">${w}</span>`).join('')}</span></button>`;
const slider = (label, v, { unit = '%', mixed = false } = {}) => `<div class="c-slider ${mixed ? 'is-mixed' : ''}" style="--v:${v}%" data-slider data-unit="${unit}"><span>${label}</span><span class="c-slider__track"><span class="c-slider__fill"></span><span class="c-slider__thumb" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"></span></span><span class="c-slider__value">${mixed ? 'Mixed' : `${v}${unit}`}</span></div>`;
const num = (label, value, unit = '', { mixed = false, steps = true } = {}) => `<label class="c-field c-field--num ${mixed ? 'is-mixed' : ''}"><span class="c-field__label">${label}</span><input inputmode="numeric" value="${mixed ? '' : value}" placeholder="${mixed ? 'Mixed' : ''}" aria-label="${label}"><span class="c-field__unit">${unit}</span>${steps ? `<span class="c-field__steps">${ic('minus')}${ic('plus')}</span>` : ''}</label>`;
// an option "Name · detail" shows just its name when chosen; its menu shows the detail too, smaller and muted
const optionHtml = (o) => (o.includes(' · ') ? o.split(' · ')[0] : o);   // closed, just the name (the size's numbers show in the menu)
const select = (label, value, options, { mixed = false } = {}) => `<button class="c-reset c-select c-focus ${mixed ? 'is-mixed' : ''}" data-select="${options.join('|')}" data-value="${value}">${label ? `<span class="c-select__label">${label}</span>` : ''}<span class="c-select__value">${mixed ? 'Mixed' : optionHtml(value)}</span>${ic('chevron-down')}</button>`;
const swatchShow = (colour, cls = '') => swatch(colour, { tag: 'span', cls });
const swatchBtn = (colour, cls = '', count = '') => swatch(colour, { cls, attrs: 'data-swatch', extra: count ? `<span class="c-badge c-swatch__n">${count}</span>` : '' });
const prop = (label, control) => control; // the label lives inside the control now
const stack = (control) => `<div class="c-prop c-prop--stack">${control}</div>`;
// add: a + in the header, just before the chevron (Pattern, Outline); action: one after it (the parked Layers)
const section = (title, body, { action = '', open = true, add = '' } = {}) => `<div class="c-panel__section" data-open="${open}"><div class="c-panel__sechead">${add ? `<span class="c-panel__secadd">${add}</span>` : ''}<button class="c-reset c-section c-focus" aria-expanded="${open}" data-section>${title}${ic(open ? 'chevron-down' : 'chevron-right')}</button>${action}</div>${body}</div>`;
const head = (eyebrow, title, sub, actions = '') => `<div class="c-panel__head"><span class="c-panel__eyebrow">${eyebrow}</span><span class="c-panel__title">${title}</span>${sub ? `<span class="c-panel__sub">${sub}</span>` : ''}${actions ? `<div class="c-panel__actions">${actions}</div>` : ''}</div>`;
// the colour row: the thread as a swatch and its hex code; any colour can be used
const swatchHtml = (hex, mixed = false) => `${swatchShow(mixed ? '--neutral-500' : hex)}<span>${mixed ? 'Mixed' : hex}</span>`;
// with an eye (hide the stitches in this colour on the cloth) and a bin (delete them) after it, like the rows below
const colourRow = (mixed = false) => `<div class="c-labelled"><span class="c-label" id="colour-label">Colour</span><div class="c-row c-row--field" data-thread-row><button class="c-reset c-swatchrow c-focus" data-picker="thread" aria-labelledby="colour-label colour-value" aria-haspopup="dialog"><span class="c-swatchrow__swatch" id="colour-value">${swatchHtml(threadHex, mixed)}</span></button>`
  + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Hide stitches in this colour" data-tip="Hide" data-thread-eye>${ic('eye')}</button>`
  + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Delete stitches in this colour" data-tip="Delete" data-thread-remove>${ic('bin')}</button></div></div>`;
const stage = (setting, initial) => `<div data-stage="${setting}"${initial != null ? ` data-initial="${initial}"` : ''}></div>`;

// every stitch and fill in one grid: stitches first, then fills
// one tile per stitch type: quarter and three-quarter show one corner, the panel doesn't pick a direction
const STITCHES = Object.keys(PRIMITIVES).filter((n) => !/-(tr|bl|br)$/.test(n)).sort((x, y) => (x.startsWith('fill') - y.startsWith('fill')));
const stitchName = (n) => PRIMITIVES[n].label.replace(/, top left$/, '');
const tiles = (sel = 0) => `<div class="c-tilegrid" data-tiles>${STITCHES.map((n, i) => `<button class="c-reset c-tile c-focus tz-host" aria-label="${stitchName(n)}" data-tip="${stitchName(n)}" aria-pressed="${i === sel}">${zoomPrim(n)}</button>`).join('')}</div>`;
// every stitch on the canvas by type and setting: the same stitch at another thickness is its own row
// [stitch, strands, density (% or null), count]. Each row is one split field like the panel's others: the stitch's
// drawing and its count, then strands and density, each behind its icon and typed into in place (a stitch with no
// density shows a dash there); hide and delete sit outside the field, and clicking the field selects them. The words are in the tooltips.
// after each row's field: hide (or show) and delete every stitch in it; clicking the field itself selects them
const rowActions = (hidden) => `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="${hidden ? 'Show' : 'Hide'} these stitches" aria-pressed="${!!hidden}" data-tip="${hidden ? 'Show' : 'Hide'}" data-row-hide>${ic(hidden ? 'eye-off' : 'eye')}</button>`
  + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Delete these stitches" data-tip="Delete" data-row-delete>${ic('bin')}</button>`;
const CANVAS_STITCHES = [['stitch-full', 2, null, 6120], ['stitch-half', 1, null, 2840], ['stitch-full', 3, null, 980], ['stitch-back', 1, null, 1210], ['fill-weave-3', 2, 60, 540], ['stitch-knot', 2, null, 150]];
const stitchWords = (n, strands, density, count) => `${stitchName(n)}, ${strands} strand${strands > 1 ? 's' : ''}${density != null ? `, density ${density}%` : ''}, ${count.toLocaleString('en')} stitches`;
const canvasStitches = () => section('Canvas stitches', `<div data-canvas-stitches>${CANVAS_STITCHES.map(([n, strands, density, count, hidden]) => {
  const words = stitchWords(n, strands, density, count);
  return `<div class="c-row c-row--field${hidden ? ' is-hidden' : ''}" data-count="${count}" data-stitch="${n}"><div class="c-field c-field--split" role="group" aria-label="${words}">`
    + `<span class="c-field__cell c-field__cell--lead tz-host" data-tip="${words}"><span class="c-row__art">${zoomPrim(n)}</span>${count.toLocaleString('en')}</span>`
    + `<label class="c-field__cell c-field__cell--num" data-tip="Strands">${ic('strands')}<input value="${strands}" inputmode="numeric" maxlength="1" aria-label="Strands" data-stitch-set="strands"></label>`
    + (density != null
      ? `<label class="c-field__cell c-field__cell--num" data-tip="Density">${ic('density')}<input value="${density}" inputmode="numeric" maxlength="3" aria-label="Density" data-stitch-set="density"></label>`
      : `<span class="c-field__cell c-field__cell--num is-disabled" data-tip="No density for this stitch">${ic('density')}<span class="c-field__none">–</span></span>`)
    + `</div>${rowActions(hidden)}</div>`;
}).join('')}</div>`);
const PIECE = [['--terracotta-500', 412], ['--leaf-500', 236], ['--ochre-300', 188], ['--periwinkle-400', 97], ['--neutral-950', 64]];
// Canvas colours: rows like Canvas stitches, one split field each (the colour's chip and its hex, typed into in
// place, then its stitch count), with hide and delete after the field
const inPiece = () => section('Canvas colours', `<div data-canvas-colours>${PIECE.map(([c, n, hidden]) => { const hex = hexOf(c); return `<div class="c-row c-row--field${hidden ? ' is-hidden' : ''}" data-count="${n}" data-hex="${hex}"><div class="c-field c-field--split" role="group" aria-label="${hex}, ${n.toLocaleString('en')} stitches">`
  + `<span class="c-field__cell c-field__cell--lead"><span class="c-row__art">${swatchShow(c)}</span><input value="${hex}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex for ${n} stitches" data-hex-edit></span>`
  + `<span class="c-field__cell c-field__cell--count" data-tip="${n.toLocaleString('en')} stitches">${n.toLocaleString('en')}</span>`
  + `</div>${rowActions(hidden)}</div>`; }).join('')}</div>`);
const layerRow = (name, cls = '', eye = 'eye') => `<div class="c-layer ${cls}"><span class="c-layer__name">${name}</span><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Show or hide" data-toggle>${ic(eye)}</button><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Lock" data-toggle>${ic('lock')}</button></div>`;
// Layers: out of the panel for now (it may live somewhere else); kept here, built as it was, to place again
const layers = section('Layers', `<div>${layerRow('Lettering')}${layerRow('Stitches', 'is-selected')}${layerRow('Calla lilies photo', 'is-hidden', 'eye-off')}</div>`, { action: iconbtn('plus', 'Add layer', 'c-iconbtn--sm') });
// Pattern: the squares to stitch over. Two ways in, both in view while it's empty: Picture (a field like Colour; once a
// picture is in, its thumbnail and name, and it opens the picture pop-up beside the panel) and Pattern colours (empty,
// "Add a pattern square", which does what the header's + does: adds the Thread colour to place squares with). With a
// picture: the pattern's colours as rows like Canvas colours (clicking one focuses it, its eye hides it), then Opacity. Add stitches (a setting of the picture) is in the picture pop-up.
// the colours "Add a pattern square" offers after the Thread colour, one each time
const PATTERN_DEFAULTS = ['--leaf-500', '--periwinkle-400', '--ochre-300', '--lilac-400', '--crimson-500', '--neutral-950', '--terracotta-300', '--leaf-300'];
const pattern = { opacity: {}, active: null, picture: null, name: '', thumb: '', result: null, state: {}, hand: [], hidden: false, deleted: new Set() }; // deleted: colours whose squares were taken out // hand: colours added with +
const patternColours = () => [...(pattern.result?.palette.filter((p) => !p.outline).map((p) => [p.hex.toUpperCase(), p.count]) || []), ...pattern.hand.map((h) => [h, 0])].filter(([h]) => !pattern.deleted.has(h));
// each colour's opacity: its drawing (a grid of dots, the pattern's squares, filled as strongly) and its number; drag up or
// down on it to change it,
// a click types in it, arrow keys step it (shift for ten)
const opacityOf = (hex) => pattern.opacity[hex] ?? 100;
const opacityCell = (hex) => `<label class="c-field__cell c-field__cell--num c-field__cell--opacity" data-tip="Opacity" data-pattern-opacity><span class="c-field__op" aria-hidden="true">${opacitySquare(opacityOf(hex), { size: 16 })}</span><input value="${opacityOf(hex)}" inputmode="numeric" maxlength="3" aria-label="Opacity of ${hex}" data-pattern-op><span class="c-field__unit">%</span></label>`;
function setOpacity(row, v) {
  v = Math.max(0, Math.min(100, Math.round(v)));
  pattern.opacity[row.dataset.patternHex] = v;
  row.querySelector('[data-pattern-op]').value = v;
  row.querySelector('.c-field__op').innerHTML = opacitySquare(v, { size: 16 });
}
const patternRows = () => patternColours().map(([hex, n]) => `<div class="c-row c-row--field${hex === pattern.active ? ' is-selected' : ''}" data-count="${n}" data-pattern-hex="${hex}"><div class="c-field c-field--split" role="group" aria-label="${hex}, ${n.toLocaleString('en')} squares">`
  + `<span class="c-field__cell c-field__cell--lead"><span class="c-row__art">${swatchShow(hex)}</span>${hex}</span>${opacityCell(hex)}</div>`
  + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Hide this colour" data-tip="Hide" data-pattern-eye>${ic('eye')}</button>`
  + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Delete this colour's squares" data-tip="Delete" data-pattern-remove>${ic('bin')}</button></div>`).join('');
const setRowHidden = (row, hidden) => { row.classList.toggle('is-hidden', hidden); const eye = row.querySelector('[data-pattern-eye]'); eye.innerHTML = ic(hidden ? 'eye-off' : 'eye'); eye.dataset.tip = hidden ? 'Show' : 'Hide'; eye.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} this colour`); };
const patternSection = () => {
  const has = pattern.picture || pattern.hand.length;
  // with a picture, the field is shorter: its eye (hide what the picture made) and bin (remove it) come after it
  const field = `<button class="c-reset c-swatchrow c-focus" data-picture aria-haspopup="dialog">${pattern.picture
    ? `<img src="${pattern.thumb}" alt=""><span>${pattern.name}</span>` : `${ic('picture')}<span class="c-swatchrow__muted">Choose or drop a picture</span>`}</button>`;
  const picture = `<div class="c-labelled"><span class="c-label">Picture</span>${pattern.picture
    ? `<div class="c-row c-row--field${pattern.hidden ? ' is-hidden' : ''}" data-picture-row>${field}<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="${pattern.hidden ? 'Show' : 'Hide'} the picture" data-tip="${pattern.hidden ? 'Show' : 'Hide'}" data-picture-eye>${ic(pattern.hidden ? 'eye-off' : 'eye')}</button><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Remove the picture" data-tip="Remove" data-picture-remove>${ic('bin')}</button></div>`
    : field}</div>`;
  // "Add a pattern square" is always the list's last row, so placing squares by hand stays one click away with a picture in
  const addRow = `<button class="c-reset c-swatchrow c-focus" data-pattern-add>${ic('plus')}<span class="c-swatchrow__muted">Add a pattern square</span></button>`;
  const colours = has
    ? `<div class="c-labelled"><span class="c-label">Pattern colours</span><div class="c-rowlist"><div data-pattern-colours>${patternRows()}</div>${addRow.replace('c-swatchrow c-focus', 'c-swatchrow c-swatchrow--quiet c-focus')}</div></div>`
    : `<div class="c-labelled"><span class="c-label">Pattern colours</span>${addRow}</div>`;
  return section('Pattern', picture + colours,
    { add: `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Add a pattern colour" data-tip="Add a pattern colour" data-pattern-add>${ic('plus')}</button>` });
};
// the picture pop-up beside the panel, as the colour picker opens; what it was set to is kept for next time
function openPicture(trigger) {
  closePop();
  const el = document.createElement('div'); el.className = 'c-pop c-pop--side';
  document.body.append(el); trigger.classList.add('is-open'); pop = { el, trigger };
  pop.popup = createPicturePopup(el, {
    image: pattern.picture, name: pattern.name, state: pattern.state,
    onChange: (r) => {
      pattern.result = r;
      const list = panel.querySelector('[data-pattern-colours]'); if (list) list.innerHTML = patternRows();
      if (pop?.popup) { pattern.thumb = pop.popup.thumb(); panel.querySelector('[data-picture] img')?.setAttribute('src', pattern.thumb); } // turned or cropped
    },
    onClose: () => { closePop(); trigger.focus(); },
    onAction: (a, on) => {
      if (a === 'remove') removePicture();
      if (a === 'crop' && on) toast('Crop on the cloth: drag its frame');
    },
  });
  pattern.state = pop.popup.state;
  let top = null;
  const place = () => {
    const p = panel.getBoundingClientRect(), r = trigger.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, gap = 8;
    const beside = p.left >= w + gap * 2;
    el.style.left = `${beside ? p.left - w - gap : Math.max(gap, Math.min(r.left, innerWidth - w - gap))}px`;
    top = Math.max(gap, Math.min(top ?? (beside ? r.top - 8 : r.bottom + 4), innerHeight - h - gap));
    el.style.top = `${top}px`;
  };
  pop.place = place; place();
  pop.resize = new ResizeObserver(place); pop.resize.observe(el);
}
function removePicture() { if (pop?.popup) closePop(); Object.assign(pattern, { picture: null, name: '', thumb: '', result: null, state: {}, hidden: false, deleted: new Set() }); render(); toast('Picture removed'); }
// a picture chosen (here, the sample calla lilies): the field shows it and the pop-up opens on it
function choosePicture() {
  pattern.picture = drawCallaLilies(450, 800); pattern.name = 'calla-lilies.png'; pattern.state = {};
  render();
  const trigger = panel.querySelector('[data-picture]');
  openPicture(trigger);
  pattern.thumb = pop.popup.thumb();
  trigger.querySelector('img')?.setAttribute('src', pattern.thumb);
  const list = panel.querySelector('[data-pattern-colours]'); if (list) list.innerHTML = patternRows();
}

// Canvas: the cloth itself. Fabric (fabric.js: a swatch of each with its name under it), Coverage (the count, drawn: a cross whose thread fills
// more of its square from option to option; words and count in the tooltips), Cell size (cell-size.js: "12 | 12 px" with − and + beside it, scrubbed in any direction) and the
// sheet's Size (a menu of set sizes, and Custom; its W | H in px always under it, filled in by the set size)
const sheetField = (w, h) => `<div class="c-labelled"><span class="c-label">Size</span><div class="c-field c-field--split c-field--pair" role="group" aria-label="Sheet size in px">${[['w', 'W', w, 'Width'], ['h', 'H', h, 'Height']].map(([k, l, v, tip]) => `<label class="c-field__cell c-field__cell--num" data-tip="${tip} in px"><span class="c-field__letter" aria-hidden="true">${l}</span><input inputmode="numeric" value="${v}" aria-label="${tip} in px" data-sheet="${k}"><span class="c-field__unit">px</span></label>`).join('')}</div></div>`;
export const SHEETS = [['Square', 900, 900], ['Landscape', 1200, 900], ['Large', 1600, 1200], ['Wide', 1600, 900], ['Portrait', 900, 1200]];
const sheetName = ([n, w, h]) => `${n} · ${w} × ${h}`;
let panelCell = 12;
const cellField = (v) => `<div class="c-labelled"><span class="c-label">Cell size</span>${cellSizeHtml(v)}</div>`;
const canvasSection = () => section('Canvas', `<div class="c-labelled"><span class="c-label">Fabric</span>${fabricHtml('dots')}</div><div class="c-labelled"><span class="c-label">Coverage</span>${coverageHtml(14)}</div>${cellField(12)}`
  + `<div class="c-labelled" data-sheet-size><span class="c-label">Size</span>${select('', sheetName(SHEETS[2]), [...SHEETS.map(sheetName), 'Custom'])}${sheetField(1600, 1200).replace(/^<div class="c-labelled"><span class="c-label">Size<\/span>/, '').replace(/<\/div>$/, '')}</div>`);

// Outline: a line around a picture or a selection, like a stroke in Figma. Empty, just its + and an Add an outline
// field that does the same; added, its colour (a colour field that opens the picker, the bin after it removes the
// outline), the stitch it's worked in (tiles, names in the tooltips), strands, detail (how many edges get a line) and
// which edges (all of them, or only the outer edge, around the shape)
let outline = null; // { hex, stitch, edges }
const outlineSection = () => section('Outline', outline
  ? `<div class="c-labelled"><span class="c-label">Colour</span><div class="c-row c-row--field"><button class="c-reset c-swatchrow c-focus" data-picker="outline" aria-haspopup="dialog" aria-label="Outline colour"><span class="c-swatchrow__swatch">${swatchHtml(outline.hex)}</span></button><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Remove outline" data-tip="Remove outline" data-outline-remove>${ic('bin')}</button></div></div>`
    + `<div class="c-labelled"><span class="c-label">Stitch</span><div class="c-tilegrid" data-tiles data-outline-stitch>${OUTLINE_STITCHES.map(([k, name]) => `<button class="c-reset c-tile c-focus" aria-label="${name}" data-tip="${name}" data-value="${k}" aria-pressed="${k === outline.stitch}">${outlineSvg(k)}</button>`).join('')}</div></div>`
    + `${stage('strands')}${stage('detail', 50)}`
    + `<div class="c-labelled"><span class="c-label">Edges</span><div class="c-seg" role="group" data-pill data-outline-edges>${[['all', 'All edges', 'Around the shape and between its colours'], ['outside', 'Outer edge', 'Only around the shape']].map(([v, l, tip]) => `<button class="c-reset c-seg__opt c-focus" data-value="${v}" data-label="${l}" data-tip="${tip}" aria-pressed="${v === outline.edges}">${l}</button>`).join('')}</div></div>`
  : `<div class="c-labelled"><span class="c-label">Outline</span><button class="c-reset c-swatchrow c-focus" data-outline-add><span class="c-ic">${svg('plus')}</span><span class="c-swatchrow__muted">Add an outline</span></button></div>`,
  { add: outline ? '' : `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Add an outline" data-tip="Add an outline" data-outline-add>${ic('plus')}</button>` });
// colour, strands, then density (no fill angle: the fills' own drawings set their direction)
const thread = (mixed = false) => section('Thread', `${stack(colourRow(mixed))}${stage('strands')}${mixed ? slider('Density', 0, { mixed: true }) : stage('density')}`);

// ─── the panel for each tab and context ──────────────────────────────────────
// the floating tool bar: the system's tool icons, each moving on hover (icons.css; si-host lets the button carry it)
const TOOLS = [['tool-select', 'Select', 'V'], ['tool-stitch', 'Stitch', 'S'], ['tool-fill', 'Fill', 'F'], ['tool-pattern', 'Pattern', 'P'], ['letters', 'Letters', 'T'], ['picture', 'Picture', 'I'], ['tool-erase', 'Erase', 'E'], ['tool-pan', 'Pan', 'H']];
const STITCH_TAB = {
  tool: () => head('Tool', 'Stitch', '')
    + `<div class="c-panel__body">${section('Stitch', `${tiles(STITCHES.indexOf('stitch-full'))}`)}${thread()}${patternSection()}${outlineSection()}${canvasSection()}${inPiece()}${canvasStitches()}</div>`,
  selection: () => head('Selection', '142 stitches', '3 colours · 2 stitch types', `${iconbtn('tool-pan', 'Move')}${iconbtn('recolour', 'Recolour')}${iconbtn('rotate', 'Rotate')}${iconbtn('clear', 'Delete')}`)
    + `<div class="c-panel__body">${section('Stitch', `${tiles(-1)}<span class="c-hint">Mixed: pick one to change them all</span>`)}${thread(true)}${patternSection()}${outlineSection()}${canvasSection()}${inPiece()}${canvasStitches()}</div>`,
  image: () => head('Image', 'Calla lilies photo', '2400 × 1800 px → 120 × 90 squares', `${iconbtn('picture', 'Replace image')}${iconbtn('clear', 'Remove image')}`)
    + `<div class="c-panel__body">${section('Turn into', `${stack(sw('Pattern', true))}${stack(sw('Stitched', true))}`)}${section('Colours', `${prop('Colours', num('Colours', 11, 'threads'))}${slider('Detail', 70)}${stack(sw('Dither'))}${stack(sw('Remove background', true))}`)}${section('Size on fabric', `<div class="c-prop__pair">${num('W', 120, 'sq')}${num('H', 90, 'sq')}</div>${seg(['Squares', 'cm', 'in'])}<span class="c-hint">21.8 × 16.3 cm at 14 count</span>`)}${outlineSection()}</div>`,
  text: () => head('Text', '“Hello”', 'Script · stem stitch · 2 strands')
    + `<div class="c-panel__body">${section('Text', `${stack('<label class="c-field"><input value="Hello" aria-label="Text"></label>')}${seg(['Sampler', 'Script'], 1)}${prop('Font', select('Font', 'Pacifico line', ['Pacifico line', 'Sampler 7', 'Sampler 9']))}${prop('Size', num('Size', 18, 'sq'))}${slider('Spacing', 40)}`)}${section('Baseline', `${seg(['Straight', 'Arc'], 1)}${slider('Curve', 30)}`)}${thread()}${outlineSection()}</div>`
};
const ANIMATE = () => head('Animate', 'Calla lilies', 'Stitches in, then reacts to touch and wear')
  + `<div class="c-panel__body">${section('Stitch in', `${prop('Order', select('Order', 'By colour', ['By colour', 'By row', 'Like a hand', 'By layer']))}${slider('Speed', 55)}<div class="c-play"><button class="c-reset c-iconbtn c-iconbtn--secondary c-focus" aria-label="Play">${ic('play')}</button><span class="c-slider" style="--v:0%;display:block;min-height:0"><span class="c-slider__track" style="display:block"><span class="c-slider__fill"></span><span class="c-slider__thumb"></span></span></span><span class="c-slider__value">0:00</span></div>`)}${section('Touch', `${slider('Tug', 60)}${slider('Spring back', 45)}`)}${section('Wear', `${slider('Rate', 30)}${slider('Snap at', 85)}${stack(sw('Heals slowly', true))}${seg(['Fresh', 'Dulled', 'Fuzzed', 'Split', 'Snapped'])}${stack(btn('secondary', 'Mend worn stitches', 'mend'))}`)}</div>`;
const EXPORT = () => head('Export', 'Calla lilies', '120 × 90 squares · 11,840 stitches · 5 colours')
  + `<div class="c-panel__body">${section('Embed', `<div class="c-code"><code>&lt;stitch-piece src="abc123" interactive wear="visitor"&gt;&lt;/stitch-piece&gt;</code>${iconbtn('copy', 'Copy code', 'c-iconbtn--sm')}</div>${stack(sw('Interactive', true))}${prop('Wear', seg(['Off', 'Visitor', 'Shared'], 1))}`)}${section('Video or GIF', `${seg(['GIF', 'MP4'])}${prop('Width', num('Width', 800, 'px', { steps: false }))}${stack(btn('primary', 'Download GIF', 'download'))}`)}${section('Image', `${stack(sw('Transparent background'))}${stack(btn('secondary', 'Download PNG', 'download'))}`)}${section('Pattern chart', `<span class="c-hint">A symbol chart and a thread shopping list, for stitching it for real</span>${stack(btn('secondary', 'Download PDF', 'download'))}`)}</div>`;

// ─── state, render ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const panel = $('panel'), toastEl = $('toast');
let mode = 'stitch', context = 'tool', pillStyle = '';
let threadHex = hexOf('--terracotta-500');
const pillValues = dialDefaults(SEG_MOTIONS.squash.dials);
const motion = (root) => createSegMotion(root, () => pillValues);
const threadColour = () => getComputedStyle(document.documentElement).getPropertyValue('--terracotta-500').trim();
const STYLE_CLASSES = ['c-seg--soft', 'c-seg--square', 'c-seg--clean', 'c-seg--outline', 'c-seg--ring', 'c-seg--underline', 'c-seg--invert'];
const PILL_STYLES = [['', 'Rounded'], ['c-seg--soft', 'Soft'], ['c-seg--square', 'Square'], ['c-seg--clean', 'Clean'], ['c-seg--clean c-seg--soft', 'Clean, soft'], ['c-seg--outline', 'Outline'], ['c-seg--clean c-seg--ring', 'Ring'], ['c-seg--clean c-seg--ring c-seg--soft', 'Ring, soft'], ['c-seg--clean c-seg--underline', 'Underline'], ['c-seg--invert', 'Invert'], ['c-seg--clean c-seg--invert c-seg--soft', 'Invert, clean, soft']];
$('pill-style').innerHTML = PILL_STYLES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

function stylePills(root = document) {
  root.querySelectorAll('[data-pill]:not(.c-picker [data-pill])').forEach((el) => { el.classList.remove(...STYLE_CLASSES); if (pillStyle) el.classList.add(...pillStyle.split(' ')); });
}
function wire(root) {
  stylePills(root);
  root.querySelectorAll('[data-pill], [data-coverage]').forEach(motion);
  root.querySelectorAll('[data-fabric]').forEach((el) => createSegMotion(el, () => pillValues, { option: '.c-fabric' }));
  root.querySelectorAll('[data-switch] .c-seg').forEach((el) => { el._motion = motion(el); });
  root.querySelectorAll('[data-tiles]').forEach((el) => createSegMotion(el, () => pillValues, { option: '.c-tile' }));
  root.querySelectorAll('[data-tools]').forEach((el) => createSegMotion(el, () => pillValues, { option: '.c-tool' })); // the tool bar's fill moves like a pill
  root.querySelectorAll('[data-stage]').forEach((host) => createStageSlider(host, { setting: host.dataset.stage, colour: threadColour(), initial: host.dataset.initial ? Number(host.dataset.initial) : undefined }));
  root.querySelectorAll('[data-slider]').forEach(liveSlider);
  wireCellSize(root, { get: () => panelCell, set: (v) => { panelCell = v; } }); // on the Panel tab it only holds its number
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
    <div class="c-bar c-bar--tools pp-tools" data-tools data-tip-delay="700">${TOOLS.map(([n, label, key], i) => `<button class="c-reset c-tool c-focus si-host" aria-label="${label}" data-tip="${label}" data-tip-key="${key}" data-tip-side="right" aria-pressed="${i === 1}">${ic(n)}</button>`).join('')}</div>
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
const closePop = () => { if (pop) { pop.popup?.destroy(); pop.resize?.disconnect(); pop.el.remove(); pop.trigger.classList.remove('is-open'); pop = null; } };
function openPop(trigger, html) {
  closePop();
  const el = document.createElement('div'); el.className = 'c-pop'; el.innerHTML = html;
  const box = panel.getBoundingClientRect(), r = trigger.getBoundingClientRect();
  el.style.left = `${r.left - box.left}px`; el.style.top = `${r.bottom - box.top + 4}px`;
  panel.append(el); trigger.classList.add('is-open'); pop = { el, trigger };
  // keep it inside the panel: shift left if it would run past the right edge
  el.style.left = `${Math.max(0, Math.min(r.left - box.left, box.width - el.offsetWidth))}px`;
  wire(el);
}
// The colour picker (colour-picker.js) opens beside the panel, over the cloth, so it never runs past the panel's
// edge or covers the panel; on a narrow screen it opens under the colour row instead.
// how the picker's Extract is laid out, from the Colour picker dials (DialKit, bottom right)
const pickerLayout = { extractLayout: 'card', extractBottom: 'both', canvasOpen: true };
let dialEl = null;
const SAVED = [['Calla lilies', ['--terracotta-500', '--leaf-500', '--ochre-300', '--neutral-50']], ['Spring', ['--periwinkle-400', '--lilac-400', '--leaf-500', '--ochre-300', '--crimson-500']]];
// The palette in hand: shared by the picker and, torn off, the floating palette over the cloth (one at a time).
// Where it floats and which way it lies are remembered.
const palStore = { saved: SAVED, palette: null, orient: 'row', pos: null, out: false };
try { const k = JSON.parse(localStorage.getItem('selvedge-floating-palette')); if (k) Object.assign(palStore, { pos: k.pos, orient: k.orient }); } catch {}
let floating = null;
// the thread colour changed in the picker: the colour row and the floating palette follow
function onThread(hex) {
  threadHex = hex;
  const row = panel.querySelector('[data-picker="thread"] .c-swatchrow__swatch'); if (row) row.innerHTML = swatchHtml(hex);
  floating?.setHex();
}
// a colour tapped in the floating palette: through the picker when it's open, so it follows too
const pickThread = (hex) => (pop?.picker ? pop.picker.set(hex) : onThread(hex));
function floatPalette({ grab, rects }) {
  palStore.out = true;
  floating?.remove(false);
  floating = createFloatingPalette({
    store: palStore, getHex: () => threadHex, onPick: pickThread,
    onPalette: (i) => pop?.picker?.palette(i), onChange: () => pop?.picker?.refresh(), onDock: dockPalette,
    // the cloth's area, right of the tool bar
    bounds: () => { const c = $('canvas').getBoundingClientRect(), t = document.querySelector('[data-tools]').getBoundingClientRect(); return new DOMRect(t.right, c.top, c.right - t.right, c.height); },
    dockTarget: () => pop?.el, onRender: wire,
  });
  if (grab) {
    // torn off: it carries on with the pointer, held where it was taken (within its own, narrower, width)
    grab.dx = Math.min(grab.dx, floating.el.offsetWidth - 24); grab.dy = Math.min(grab.dy, 16);
    floating.grab(grab);
    return;
  }
  // popped out: it flies to where it last floated, or the cloth's top left, beside the tool bar
  const tools = document.querySelector('[data-tools]').getBoundingClientRect(), c = $('canvas').getBoundingClientRect();
  floating.place(palStore.pos || { x: tools.right + 16, y: c.top + 16 });
  floating.flyFrom(rects);
}
function dockPalette() {
  if (!floating) return;
  const rects = floating.rects();
  floating.remove(!pop?.picker); floating = null; palStore.out = false;
  pop?.picker?.dock(rects);
}
// the outline's colour changed in the picker
function onOutline(hex) {
  outline.hex = hex;
  const row = panel.querySelector('[data-picker="outline"] .c-swatchrow__swatch'); if (row) row.innerHTML = swatchHtml(hex);
}
function openPicker(trigger) {
  closePop();
  const forOutline = trigger.dataset.picker === 'outline';
  const el = document.createElement('div'); el.className = 'c-pop c-pop--side';
  document.body.append(el); trigger.classList.add('is-open'); pop = { el, trigger };
  pop.picker = createColourPicker(el, {
    ...pickerLayout, hex: forOutline ? outline.hex : threadHex, canvas: PIECE.map(([c]) => c), saved: palStore.saved, palette: palStore.palette, paletteOut: palStore.out,
    onChange: forOutline ? onOutline : onThread,
    onPalette: (i) => { palStore.palette = i; floating?.redraw(); }, onSaved: () => floating?.redraw(),
    onFloat: floatPalette, onDock: dockPalette,
    onClose: () => { closePop(); trigger.focus(); },
    onRender: (part) => { wire(part); pop?.place?.(); },
  });
  // placed again whenever it changes size (another pill), so it stays inside the window. Once open its top edge
  // stays put: it grows and shrinks from the bottom, and only moves up if it would run past the window's bottom.
  let top = null;
  const place = () => {
    const p = panel.getBoundingClientRect(), r = trigger.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, gap = 8;
    const beside = p.left >= w + gap * 2;
    el.style.left = `${beside ? p.left - w - gap : Math.max(gap, Math.min(r.left, innerWidth - w - gap))}px`;
    const want = top ?? (beside ? r.top - 8 : r.bottom + 4);
    top = Math.max(gap, Math.min(want, innerHeight - h - gap));
    el.style.top = `${top}px`;
  };
  pop.place = place; place();
  pop.resize = new ResizeObserver(place); pop.resize.observe(el);
  el.querySelector('.c-seg__opt[aria-pressed="true"]')?.focus({ preventScroll: true, focusVisible: false });
}
createTooltips();
let toastTimer;
const toast = (m) => { toastEl.textContent = m; toastEl.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 1600); };

document.addEventListener('click', (e) => {
  const t = e.target;
  if (floating?.justDragged()) return; // the click a drag ends with (torn off the picker, let go over the cloth)
  if (pop && !e.composedPath().includes(pop.el) && !pop.trigger.contains(t) && !dialEl?.contains(t) && !(floating && e.composedPath().includes(floating.el)) && !t.closest('.c-menu--float')) closePop(); // a part the picker just redrew is no longer in it, but was
  const modeOpt = t.closest('#mode .c-seg__opt');
  if (modeOpt) { mode = modeOpt.dataset.value; setTimeout(render, 0); return; }
  const sec = t.closest('[data-section]');
  if (sec) { const s = sec.closest('.c-panel__section'), open = s.dataset.open !== 'true'; s.dataset.open = open; sec.setAttribute('aria-expanded', open); sec.querySelector('.c-ic').outerHTML = ic(open ? 'chevron-down' : 'chevron-right'); return; }
  const tile = t.closest('[data-tiles] .c-tile');
  if (tile) { tile.parentElement.querySelectorAll('.c-tile').forEach((x) => x.setAttribute('aria-pressed', x === tile)); }
  const tool = t.closest('[data-tools] .c-tool');
  if (tool) tool.parentElement.querySelectorAll('.c-tool').forEach((x) => x.setAttribute('aria-pressed', x === tool));
  const swi = t.closest('[data-switch]');
  if (swi) {
    // a click on Off or On sets that; anywhere else on the field flips it
    const opt = t.closest('.c-switch .c-seg__opt'), on = opt ? opt.dataset.label === 'On' : swi.getAttribute('aria-checked') !== 'true';
    swi.classList.remove('is-mixed'); swi.setAttribute('aria-checked', on);
    swi.querySelectorAll('.c-seg__opt').forEach((o, i) => o.setAttribute('aria-pressed', i === (on ? 1 : 0)));
    swi.querySelector('.c-seg')._motion?.select(on ? 1 : 0);
  }
  const tog = t.closest('[data-toggle]');
  if (tog) { tog.classList.toggle('is-selected'); const row = tog.closest('.c-layer'); if (row && tog === row.querySelector('[data-toggle]')) { row.classList.toggle('is-hidden'); tog.innerHTML = ic(row.classList.contains('is-hidden') ? 'eye-off' : 'eye'); } }
  const layer = t.closest('.c-layer');
  if (layer && !tog) layer.parentElement.querySelectorAll('.c-layer').forEach((x) => x.classList.toggle('is-selected', x === layer));
  const fieldRow = t.closest('[data-pattern-opacity]') ? null : t.closest('.c-row--field .c-field--split')?.closest('.c-row'); // the opacity cell only changes opacity
  if (fieldRow) { selectRow(fieldRow, !t.closest('input')); if (fieldRow.dataset.patternHex) pattern.active = fieldRow.classList.contains('is-selected') ? fieldRow.dataset.patternHex : null; }
  const hideBtn = t.closest('[data-row-hide]');
  if (hideBtn) hideRow(hideBtn.closest('.c-row'));
  const delBtn = t.closest('[data-row-delete]');
  if (delBtn) deleteRow(delBtn.closest('.c-row'));
  const sk = t.closest('[data-swatch]');
  if (sk && t.closest('.c-pop')) { sk.parentElement.querySelectorAll('.c-swatch').forEach((x) => x.classList.toggle('is-selected', x === sk)); }
  const pic = t.closest('[data-picture]');
  if (pic) { if (!pattern.picture) choosePicture(); else if (pop?.trigger === pic) closePop(); else openPicture(pic); return; }
  if (t.closest('[data-pattern-add]')) {
    // a colour to place squares with, added to the list and selected: the Thread colour first; once that's in the
    // list, the next default colour not in it yet
    const have = new Set(patternColours().map(([h]) => h)), hex = [threadHex, ...PATTERN_DEFAULTS].map((c) => hexOf(c).toUpperCase()).find((h) => !have.has(h));
    if (!hex) { toast('Every default colour is in the pattern: pick another in Thread'); return; }
    pattern.hand.push(hex); pattern.deleted.delete(hex); pattern.active = hex;
    render(); toast(`Placing squares in ${hex}`); return;
  }
  if (t.closest('[data-picture-remove]')) { removePicture(); return; }
  const threadEye = t.closest('[data-thread-eye]');
  if (threadEye) { const row = threadEye.closest('.c-row'), hidden = row.classList.toggle('is-hidden'); threadEye.innerHTML = ic(hidden ? 'eye-off' : 'eye'); threadEye.dataset.tip = hidden ? 'Show' : 'Hide'; threadEye.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} stitches in this colour`); toast(`${hidden ? 'Hid' : 'Showing'} stitches in ${threadHex.toUpperCase()}`); return; }
  if (t.closest('[data-thread-remove]')) { toast(`Deleted stitches in ${threadHex.toUpperCase()}`); return; }
  const picEye = t.closest('[data-picture-eye]');
  if (picEye) { pattern.hidden = !pattern.hidden; const row = picEye.closest('.c-row'); row.classList.toggle('is-hidden', pattern.hidden); picEye.innerHTML = ic(pattern.hidden ? 'eye-off' : 'eye'); picEye.dataset.tip = pattern.hidden ? 'Show' : 'Hide'; picEye.setAttribute('aria-label', `${pattern.hidden ? 'Show' : 'Hide'} the picture`); return; }
  const patternBin = t.closest('[data-pattern-remove]');
  if (patternBin) {
    const row = patternBin.closest('.c-row'), hex = row.dataset.patternHex;
    pattern.deleted.add(hex); pattern.hand = pattern.hand.filter((h) => h !== hex);
    toast(`Deleted ${rowWords(row)}`);
    const done = () => { row.remove(); if (!patternColours().length) render(); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else { row.style.overflow = 'hidden'; row.animate([{ height: `${row.offsetHeight}px`, opacity: 1 }, { height: '0px', marginTop: '0px', opacity: 0 }], { duration: 200, easing: 'ease-in' }).onfinish = done; setTimeout(() => row.isConnected && done(), 260); }
    return;
  }
  const eye = t.closest('[data-pattern-eye]');
  if (eye) { const row = eye.closest('.c-row'); setRowHidden(row, !row.classList.contains('is-hidden')); return; }
  if (t.closest('[data-outline-add]')) { outline = { hex: context === 'image' ? hexOf('--neutral-950') : threadHex, stitch: 'back', edges: 'all' }; render(); return; }
  if (t.closest('[data-outline-remove]')) { if (pop?.trigger?.dataset.picker === 'outline') closePop(); outline = null; render(); return; }
  const outlineTile = t.closest('[data-outline-stitch] .c-tile'); if (outlineTile) outline.stitch = outlineTile.dataset.value;
  const outlineEdge = t.closest('[data-outline-edges] .c-seg__opt'); if (outlineEdge) outline.edges = outlineEdge.dataset.value;
  const picker = t.closest('[data-picker]');
  if (picker) { if (pop?.trigger === picker) closePop(); else openPicker(picker); }
  const sel = t.closest('[data-select]');
  if (sel) {
    if (pop?.trigger === sel) closePop();
    else { const current = sel.dataset.value || sel.querySelector('.c-select__value').textContent; openPop(sel, `<div class="c-menu" style="min-width:${sel.offsetWidth}px">${sel.dataset.select.split('|').map((o) => `<button class="c-reset c-menu__item ${o === current ? 'is-selected' : ''}" data-choose="${o}">${o.includes(' · ') ? `${o.split(' · ')[0]}<span class="c-menu__meta">${o.split(' · ')[1]}</span>` : o}${o === current ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('')}</div>`); }
  }
  const choose = t.closest('[data-choose]');
  if (choose && pop) {
    const trig = pop.trigger, o = choose.dataset.choose; trig.classList.remove('is-mixed'); trig.dataset.value = o;
    trig.querySelector('.c-select__value').innerHTML = optionHtml(o); closePop();
    // the sheet's size: Custom shows W | H to type; a set size hides them
    const sizeBox = trig.closest('[data-sheet-size]');
    if (sizeBox) { const m = /(\d+) × (\d+)/.exec(o); if (m) sizeBox.querySelectorAll('[data-sheet]').forEach((i) => { i.value = i.dataset.sheet === 'w' ? m[1] : m[2]; }); }   // the size's W | H follow the set size; Custom leaves them to type
  }
  if (t.closest('.c-code .c-iconbtn')) toast('Copied the embed code');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
// pattern opacity: drag up or down on the number (a step every 2px), or type, or arrow keys
let opDrag = null;
document.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('[data-pattern-opacity]'), input = cell?.querySelector('input');
  if (!cell || document.activeElement === input) return;
  e.preventDefault();
  opDrag = { row: cell.closest('.c-row'), input, y: e.clientY, from: Number(input.value), moved: false };
});
addEventListener('pointermove', (e) => {
  if (!opDrag) return;
  const dy = opDrag.y - e.clientY; if (!opDrag.moved && Math.abs(dy) < 3) return;
  opDrag.moved = true; document.body.style.cursor = 'ns-resize';
  setOpacity(opDrag.row, opDrag.from + dy / 2);
});
addEventListener('pointerup', () => { if (!opDrag) return; if (!opDrag.moved) { opDrag.input.focus(); opDrag.input.select(); } opDrag = null; document.body.style.cursor = ''; });
document.addEventListener('keydown', (e) => {
  const input = e.target.closest?.('[data-pattern-op]'); if (!input) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setOpacity(input.closest('.c-row'), Number(input.value) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
  if (e.key === 'Enter') input.blur();
});
document.addEventListener('change', (e) => { const input = e.target.closest?.('[data-pattern-op]'); if (input) { const v = Number(input.value); setOpacity(input.closest('.c-row'), Number.isFinite(v) ? v : opacityOf(input.closest('.c-row').dataset.patternHex)); } });
// Canvas colours and Canvas stitches rows: clicking (or typing into) a field selects its stitches on the canvas;
// clicking a selected one again, outside its inputs, lets them go. Hide and delete act on the whole row.
const rowData = (row) => row.dataset.hex ? PIECE.find(([c]) => hexOf(c) === row.dataset.hex) : CANVAS_STITCHES[[...row.parentElement.children].indexOf(row)];
const rowWords = (row) => (row.dataset.patternHex ? `${Number(row.dataset.count).toLocaleString('en')} squares in ${row.dataset.patternHex}` : `${Number(row.dataset.count).toLocaleString('en')} stitches${row.dataset.hex ? ` in ${row.dataset.hex}` : ''}`);
function selectRow(row, toggle = true) {
  const on = !(toggle && row.classList.contains('is-selected'));
  if (on === row.classList.contains('is-selected')) return;
  panel.querySelectorAll('.c-row--field.is-selected').forEach((x) => x.classList.remove('is-selected'));
  row.classList.toggle('is-selected', on);
  toast(on ? `Selected ${rowWords(row)}` : 'Selection cleared');
}
function hideRow(row) {
  const hidden = !row.classList.contains('is-hidden'), btn = row.querySelector('[data-row-hide]'), d = rowData(row);
  row.classList.toggle('is-hidden', hidden);
  if (d) d[row.dataset.hex ? 2 : 4] = hidden;
  btn.innerHTML = ic(hidden ? 'eye-off' : 'eye');
  btn.setAttribute('aria-pressed', hidden); btn.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} these stitches`); btn.dataset.tip = hidden ? 'Show' : 'Hide';
  toast(`${hidden ? 'Hid' : 'Showing'} ${rowWords(row)}`);
}
function deleteRow(row) {
  const list = row.dataset.hex ? PIECE : CANVAS_STITCHES, i = list.indexOf(rowData(row));
  if (i >= 0) list.splice(i, 1);
  toast(`Deleted ${rowWords(row)}`);
  const done = () => row.remove();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
  row.style.overflow = 'hidden';
  row.animate([{ height: `${row.offsetHeight}px`, opacity: 1 }, { height: '0px', marginTop: '0px', opacity: 0 }], { duration: 200, easing: 'ease-in' }).onfinish = done;
  setTimeout(done, 260);
}
document.addEventListener('focusin', (e) => { const row = e.target.closest?.('.c-row--field'); if (row && e.target.matches('input')) selectRow(row, false); });
// Canvas colours: type a new hex over a colour and every stitch in it changes; Enter or leaving the field keeps it,
// Escape (or something that isn't a colour) puts the old one back
const hexEdit = (input, keep) => {
  const row = input.closest('.c-row'), old = row.dataset.hex, hex = keep && parseHex(input.value);
  input.value = hex || old;
  input.closest('.c-field').classList.remove('is-error');
  if (!hex || hex === old) return;
  const i = PIECE.findIndex(([c]) => hexOf(c) === old);
  if (i >= 0) PIECE[i][0] = hex;
  row.dataset.hex = hex;
  row.querySelector('.c-row__art').innerHTML = swatchShow(hex);
  row.querySelector('.c-field--split').setAttribute('aria-label', `${hex}, ${Number(row.dataset.count).toLocaleString('en')} stitches`);
  toast(`Changed ${Number(row.dataset.count).toLocaleString('en')} stitches to ${hex}`);
};
document.addEventListener('keydown', (e) => {
  const input = e.target.closest?.('[data-hex-edit]');
  if (!input) return;
  if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
  if (e.key === 'Escape') { e.stopPropagation(); input.value = input.closest('.c-row').dataset.hex; input.blur(); }
});
document.addEventListener('focusout', (e) => { if (e.target.matches?.('[data-hex-edit]')) hexEdit(e.target, true); });
// Canvas stitches: a new strands (1–6) or density (10–100%) changes every stitch in that row; Enter or leaving keeps
// it (held to its range), Escape puts the old one back
document.addEventListener('focusin', (e) => { if (e.target.matches?.('[data-stitch-set]')) { e.target.dataset.was = e.target.value; e.target.select(); } });
document.addEventListener('keydown', (e) => {
  const input = e.target.closest?.('[data-stitch-set]');
  if (!input) return;
  if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
  if (e.key === 'Escape') { e.stopPropagation(); input.value = input.dataset.was; input.blur(); }
});
document.addEventListener('change', (e) => {
  const input = e.target.closest?.('[data-stitch-set]');
  if (!input) return;
  const density = input.dataset.stitchSet === 'density', [lo, hi] = density ? [10, 100] : [1, 6], v = parseInt(input.value, 10);
  if (Number.isNaN(v)) { input.value = input.dataset.was; return; }
  input.value = Math.max(lo, Math.min(hi, v));
  if (input.value === input.dataset.was) return;
  input.dataset.was = input.value;
  const row = input.closest('.c-row'), get = (k) => row.querySelector(`[data-stitch-set="${k}"]`)?.value;
  const words = stitchWords(row.dataset.stitch, Number(get('strands')), get('density') ?? null, Number(row.dataset.count));
  row.querySelector('.c-field--split').setAttribute('aria-label', words);
  row.querySelector('.c-field__cell--lead').dataset.tip = words;
  toast(`${Number(row.dataset.count).toLocaleString('en')} stitches now ${density ? `at density ${input.value}%` : `in ${input.value} strand${input.value > 1 ? 's' : ''}`}`);
});
document.addEventListener('input', (e) => { if (e.target.matches?.('[data-hex-edit]')) e.target.closest('.c-field').classList.toggle('is-error', !parseHex(e.target.value)); });
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


// ─── Colour picker dials: try the Extract layouts ────────────────────────────
import('https://cdn.jsdelivr.net/npm/dialkit@2.0.0/dist/vanilla/index.js').then(({ createDialKit, createDialRoot }) => {
  dialEl = createDialRoot({ position: 'bottom-right', theme: document.documentElement.dataset.theme, defaultOpen: true }).element; // clicks in it leave the picker open
  const kit = createDialKit('Colour picker', {
    extractLayout: { type: 'select', label: 'Extract layout', options: [{ value: 'card', label: 'Card' }, { value: 'strip', label: 'Strip' }, { value: 'stack', label: 'Stacked' }], default: pickerLayout.extractLayout },
    extractBottom: { type: 'select', label: 'Under Extract', options: [{ value: 'both', label: 'Saved + canvas' }, { value: 'saved', label: 'Saved' }, { value: 'canvas', label: 'Canvas' }, { value: 'none', label: 'Nothing' }], default: pickerLayout.extractBottom },
    canvasOpen: pickerLayout.canvasOpen,
    sample: { type: 'action', label: 'Open Extract with a sample image' },
  }, {
    id: 'selvedge-picker-extract', persist: true,
    onAction: async () => {
      // after this click has finished (it would otherwise count as a click outside the picker and close it)
      await new Promise((r) => setTimeout(r, 0));
      if (!pop?.picker) document.querySelector('[data-picker="thread"]')?.click();
      await new Promise((r) => setTimeout(r, 50));
      // a stand-in picture: a dusk harbour in bands
      const c = Object.assign(document.createElement('canvas'), { width: 120, height: 90 }), x = c.getContext('2d');
      [['#F4F1DE', 0, 30], ['#E9C46A', 30, 15], ['#E76F51', 45, 10], ['#2A6F97', 55, 20], ['#264653', 75, 15]].forEach(([col, y, h]) => { x.fillStyle = col; x.fillRect(0, y, 120, h); });
      const blob = await new Promise((r) => c.toBlob(r));
      pop?.picker?.tab('extract');
      pop?.picker?.loadImage(new File([blob], 'harbour-at-dusk.png', { type: 'image/png' }));
    },
  });
  // how the palette tears off and floats (FLOAT_TUNING in colour-picker.js)
  const fk = createDialKit('Floating palette', {
    tear: [FLOAT_TUNING.tear, 8, 80, 1], resist: [FLOAT_TUNING.resist, 0, 1, 0.05], lift: [FLOAT_TUNING.lift, 1, 1.12, 0.01],
    snap: [FLOAT_TUNING.snap, 0, 80, 1], fly: [FLOAT_TUNING.fly, 100, 900, 10], stagger: [FLOAT_TUNING.stagger, 0, 120, 5],
  }, { id: 'selvedge-floating-palette-dials', persist: true });
  Object.assign(FLOAT_TUNING, fk.getValues()); fk.subscribe((v) => Object.assign(FLOAT_TUNING, v));
  // where Cell size's − and + go (CELL_SIZE in cell-size.js): A to D, redrawn in place
  const ck = createDialKit('Cell size', { layout: { type: 'select', label: 'Minus and plus', options: CELL_LAYOUTS.map(([value, label]) => ({ value, label })), default: CELL_SIZE.layout } }, { id: 'selvedge-cell-size', persist: true });
  const cellLayout = (v) => { CELL_SIZE.layout = v.layout; panel.querySelectorAll('[data-cellsize]').forEach((el) => { el.outerHTML = cellSizeHtml(panelCell); }); wireCellSize(panel, { get: () => panelCell, set: (n) => { panelCell = n; } }); };
  cellLayout(ck.getValues()); ck.subscribe(cellLayout);
  const apply = (v) => { Object.assign(pickerLayout, { extractLayout: v.extractLayout, extractBottom: v.extractBottom, canvasOpen: v.canvasOpen }); pop?.picker?.layout({ ...pickerLayout }); };
  apply(kit.getValues());
  kit.subscribe(apply);
}).catch(() => {});
