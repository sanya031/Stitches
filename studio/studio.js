// The studio: the panel designed on the design pages, on the lab's live thread renderer. The editor (lab/editor.js)
// owns the piece, the canvas and the tools; this page builds the panel, the tool bar and the zoom from the design
// system's parts and drives the editor with them. Sections: Stitch, Thread, Pattern (with the picture pop-up),
// Outline, Canvas colours, Canvas stitches.
import { svg } from '../design/icons/icons.js';
import { PRIMITIVES, primitiveSvg, patchSquares } from '../design/icons/primitives.js';
import { createStageSlider, opacitySquare } from '../design/stage-slider.js';
import { swatch } from '../design/swatch.js';
import { selectionBarHtml } from '../design/selection-bar.js';
import { hexOf, parseHex } from '../design/colour-field.js';
import { createColourPicker } from '../design/colour-picker.js';
import { createPicturePopup } from '../design/picture-popup.js';
import { OUTLINE_STITCHES, outlineSvg } from '../design/outline-stitches.js';
import { createTooltips } from '../design/tooltip.js';
import { SEG_MOTIONS, createSegMotion, dialDefaults } from '../design/seg-motion.js';
import { createZoomMotion } from '../design/zoom-motion.js';
import { TUNING, motionFrom } from '../design/icons/zoom-css.js';
import { createEditor } from '../lab/editor.js';
import { outlineShade } from '../lab/floss.js';
import { cellSizeHtml, wireCellSize, CELL_SIZE, CELL_LAYOUTS } from '../design/cell-size.js';
import { coverageHtml } from '../design/coverage.js';
import { fabricHtml } from '../design/fabric.js';

const $ = (id) => document.getElementById(id);
const ic = (n) => `<span class="c-ic">${svg(n)}</span>`;
const iconbtn = (n, label, extra = '') => `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="${label}" data-tip="${label}" ${extra}>${ic(n)}</button>`;
const pillValues = dialDefaults(SEG_MOTIONS.squash.dials);
const ZOOM_N = patchSquares(24), zoom = createZoomMotion(() => motionFrom(TUNING));
let uid = 0;
const toastEl = $('toast');
let toastT = 0;
const toast = (m) => { toastEl.textContent = m; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, 1600); };
const up = (h) => hexOf(h).toUpperCase();

// ─── the editor ──────────────────────────────────────────────────────────────
const ed = createEditor({
  stage: $('stage'), canvas: $('gl'), overlay: $('overlay'),
  onChange: (kind) => { if (kind === 'piece') refreshPiece(); if (kind === 'selection') { renderHead(); syncOutlineList(); syncThreadSwatch(); syncColourList(); queueMicrotask(renderSelbar); } if (kind === 'piece') queueMicrotask(renderSelbar); if (kind === 'state') syncTools(); },
  onView: (v) => { view = v; const z = $('panel').querySelector('[data-zoom-value]'); if (z && document.activeElement !== z) z.value = Math.round(v.fit * 100); },
  onImage: (file) => choosePicture(file),
  // the bench around the cloth is the page's own bench colour, in either theme
  ground: () => hexOf('--surface-bench').match(/\w\w/g).map((h) => parseInt(h, 16) / 255),
  accent: hexOf('--primary'),
});
if (!ed) { $('gl').hidden = true; $('fallback').style.display = 'grid'; throw new Error('WebGL2 unavailable'); }

// the colour list's title and rows follow the selection (not while a hex in it is being typed)
function syncColourList() {
  const ss = $('panel').querySelector('[data-sec="stitches"]');
  if (ss) {
    const b = ss.querySelector('[data-section="stitches"]');
    if (b && b.firstChild.textContent !== stitchTitle()) b.firstChild.textContent = stitchTitle();
    const l = ss.querySelector('[data-canvas-stitches]');
    if (l) { l.innerHTML = canvasStitchRows(); wire(l); }
  }
  const sec = $('panel').querySelector('[data-sec="colours"]'); if (!sec) return;
  const btn = sec.querySelector('[data-section="colours"]');
  if (btn && btn.firstChild.textContent !== colourTitle()) btn.firstChild.textContent = colourTitle();
  const list = sec.querySelector('[data-canvas-colours]');
  if (list && !list.contains(document.activeElement)) { list.innerHTML = canvasColourRows(); wire(list); }
}
function syncThreadSwatch() {
  const sw = document.querySelector('[data-picker="thread"] .c-swatchrow__swatch'), html = threadSwatchHtml();
  if (sw && sw.innerHTML !== html) sw.innerHTML = html;
  const eye = document.querySelector('[data-thread-eye]'), hid = threadHidden();
  if (eye && (eye.getAttribute('aria-label') === 'Show') !== hid) eye.outerHTML = rowBtns('data-thread-eye', 'data-thread-bin', hid).split('</button>')[0] + '</button>';
}

// ─── the stitch grid: the design system's stitch drawings, each one of the editor's stitches or fills ───
// [drawing, tool, editor kind]; the French knot isn't a stitch the editor has yet
const KINDS = [['stitch-full', 'stitch', 'full'], ['stitch-half', 'stitch', 'half'], ['stitch-quarter-tl', 'stitch', 'quarter'], ['stitch-three-quarter-tl', 'stitch', 'threeq'], ['stitch-back', 'stitch', 'back'],
  ['fill-cross', 'fill', 'f-cross'], ['fill-tweed', 'fill', 'f-tweed'], ['fill-rows', 'fill', 'rows'], ['fill-columns', 'fill', 'columns'], ['fill-hatch', 'fill', 'hatch'], ['fill-weave-3', 'fill', 'weave3'],
  ['fill-weave-5', 'fill', 'weave5'], ['fill-weave-diamond', 'fill', 'diamond'], ['fill-blocks', 'fill', 'blocks'], ['fill-fern', 'fill', 'fern'], ['fill-seed', 'fill', 'seed'], ['fill-knots', 'fill', 'knots'], ['fill-burst', 'fill', 'burst']];
const nameOf = (prim) => PRIMITIVES[prim].label.replace(/, top left$/, '').replace(/ \/$/, '');
// a picture's tones can also be satin (long stitches that follow the picture): drawn as columns
const primOfKind = (kind) => (kind === 'satin' ? 'fill-columns' : KINDS.find(([, , k]) => k === kind)?.[0]);
const kindName = (kind) => (kind === 'satin' ? 'Satin' : nameOf(primOfKind(kind) || 'stitch-full'));
const zoomPrim = (n) => primitiveSvg(n, { size: 24, id: `sz-${uid++}`, frame: 'zoom', n: ZOOM_N, animate: false });
const pickedKind = () => (ed.state.tool === 'fill' ? ed.state.fill : ed.state.stitch);

// ─── the floating tool bar and zoom ──────────────────────────────────────────
const TOOLS = [['tool-select', 'select', 'Select', 'V'], ['tool-stitch', 'stitch', 'Stitch', 'S'], ['tool-fill', 'fill', 'Fill', 'F'], ['tool-pattern', 'pattern', 'Pattern', 'P'], ['picture', 'picture', 'Picture', ''], ['tool-erase', 'erase', 'Erase', 'E'], ['tool-pan', 'pan', 'Pan', 'H']];
function renderFloating() {
  $('floating').innerHTML = `<div class="c-bar c-bar--tools st-tools" data-tools data-tip-delay="700">${TOOLS.map(([icon, tool, label, key]) => `<button class="c-reset c-tool c-focus si-host" aria-label="${label}" data-tip="${label}" ${key ? `data-tip-key="${key}"` : ''} data-tip-side="right" data-tool="${tool}" aria-pressed="${ed.state.tool === tool}">${ic(icon)}</button>`).join('')}</div>`;
  const bar = document.querySelector('[data-tools]');
  bar._motion = createSegMotion(bar, () => pillValues, { option: '.c-tool' });
}
// the editor's tool changed (a key, a tile): the bar and the grid follow
function syncTools() {
  const bar = document.querySelector('[data-tools]');
  if (bar) { const i = TOOLS.findIndex(([, t]) => t === ed.state.tool); if (i >= 0) bar._motion?.select(i); }
  const grid = document.querySelector('[data-tiles]');
  // a tool with no tile (select, pattern, erase, pan) leaves the grid's fill where it was
  if (grid) { const i = KINDS.findIndex(([, t, k]) => t === ed.state.tool && k === pickedKind()); if (i >= 0) grid._motion?.select(i); }
  syncEraser();
  renderHead();
}

// ─── the app bar ─────────────────────────────────────────────────────────────
function renderBar() {
  const [c, r] = ed.grid(), s = ed.stats();
  $('bar').innerHTML = `<div class="st-name"><b>${picture.name || 'Untitled'}</b><span>${c} × ${r} squares · ${s.stitches.toLocaleString('en')} stitches · ${s.squares.toLocaleString('en')} pattern squares</span></div>`;
}

// ─── the panel ───────────────────────────────────────────────────────────────
const section = (key, title, body, { add = '' } = {}) => { const open = secs[key] !== false; return `<div class="c-panel__section" data-open="${open}" data-sec="${key}"><div class="c-panel__sechead">${add ? `<span class="c-panel__secadd">${add}</span>` : ''}<button class="c-reset c-section c-focus" aria-expanded="${open}" data-section="${key}">${title}${ic(open ? 'chevron-down' : 'chevron-right')}</button></div>${body}</div>`; };
const labelled = (label, html) => `<div class="c-labelled"><span class="c-label">${label}</span>${html}</div>`;
const secs = {};
const rowBtns = (eye, bin, hidden = false) => `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="${hidden ? 'Show' : 'Hide'}" data-tip="${hidden ? 'Show' : 'Hide'}" ${eye}>${ic(hidden ? 'eye-off' : 'eye')}</button><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Delete" data-tip="Delete" ${bin}>${ic('bin')}</button>`;
const colourField = (hex, attr) => `<button class="c-reset c-swatchrow c-focus" ${attr} aria-haspopup="dialog"><span class="c-swatchrow__swatch">${swatch(hex, { tag: 'span' })}<span>${hex}</span></span></button>`;

const hidden = { thread: new Set(), pattern: new Set() };   // colours hidden on the cloth
const pattern = { hand: [], active: null, opacity: {} };     // hand: colours added to place squares with
// Outlines: each round the whole cloth (area null; with a picture on the cloth, its conversion draws that one) or round
// an area (the squares selected when it was added), each kept with its own colour, stitch, strands, detail and edges
const OUTLINE_DEFAULT = { match: true, hex: '#3B2C55', stitch: 'back', strands: 1, detail: 50, edges: 'all' };
const outlines = [];
let outlineId = 0, areaCount = 0, currentOutline = null;
const curOutline = () => outlines.find((o) => o.id === currentOutline) || null;
const wholeOutline = () => outlines.find((o) => !o.area && !o.hidden) || null;   // the one the picture draws
const sameArea = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));
const selectionOutline = () => { const keys = ed.selectionKeys(); return keys.size ? outlines.find((o) => o.area && sameArea(o.area, keys)) || null : null; };
function addOutline(area) {
  const from = curOutline() || OUTLINE_DEFAULT;
  const o = { ...OUTLINE_DEFAULT, match: from.match, hex: from.hex, stitch: from.stitch, strands: from.strands, edges: from.edges,
    id: ++outlineId, area, hidden: false, name: area ? `Area ${++areaCount}` : 'Whole canvas', main: up((area ? ed.selection().colours : ed.threadColours())[0]?.[0] || ed.state.color) };
  outlines.push(o); currentOutline = o.id;
  return o;
}
function removeOutline(o) {
  outlines.splice(outlines.indexOf(o), 1);
  if (currentOutline === o.id) currentOutline = outlines.at(-1)?.id ?? null;
  if (!o.area) picture.popup?.rebuild();
}
const picture = { image: null, name: '', popup: null, el: null };

function renderHead() {
  const sel = ed.selection(), tool = TOOLS.find(([, t]) => t === ed.state.tool);
  const head = sel.size
    ? `<div class="c-panel__head"><span class="c-panel__eyebrow">Selection</span><span class="c-panel__title">${sel.stitches.toLocaleString('en')} ${sel.stitches === 1 ? 'stitch' : 'stitches'}</span><span class="c-panel__sub">${sel.colours.length} colour${sel.colours.length === 1 ? '' : 's'}</span><div class="c-panel__actions">${iconbtn('close', 'Clear selection', 'data-act="clear-selection"')}</div></div>`
    : `<div class="c-panel__head"><span class="c-panel__eyebrow">Tool</span><span class="c-panel__title">${ed.state.tool === 'stitch' || ed.state.tool === 'fill' ? nameOf(primOfKind(pickedKind()) || 'stitch-full') : tool?.[2] || ''}</span></div>`;
  const el = $('panel').querySelector('.c-panel__head');
  if (el) el.outerHTML = head;
}

function stitchSection() {
  const sel = KINDS.findIndex(([, t, k]) => t === ed.state.tool && k === pickedKind());
  return section('stitch', 'Stitch', `<div class="c-tilegrid" data-tiles>${KINDS.map(([n], i) => `<button class="c-reset c-tile c-focus tz-host" aria-label="${nameOf(n)}" data-tip="${nameOf(n)}" data-kind="${i}" aria-pressed="${i === sel}">${zoomPrim(n)}</button>`).join('')}</div>`);
}
// the Colour field's colour: the selection's colour while there is one ('Mixed' when it has several), else the colour to stitch with
const threadHex = () => { const sel = ed.selection(); return up((sel.size && sel.colours[0]?.[0]) || ed.state.color); };
const threadMixed = () => { const sel = ed.selection(); return sel.size > 0 && sel.colours.length > 1; };
// a mixed colour shows an empty chip (the well colour) and the word
const threadSwatchHtml = () => threadMixed() ? `${swatch('--surface-well', { tag: 'span' })}<span>Mixed</span>` : `${swatch(threadHex(), { tag: 'span' })}<span>${threadHex()}</span>`;
// with a selection, the eye and bin act on the selection's stitches
const threadHidden = () => { const sel = ed.selection(); return sel.size ? sel.colours.length > 0 && sel.colours.every(([, n]) => n.hidden) : hidden.thread.has(threadHex()); };
function threadSection() {
  return section('thread', 'Thread', labelled('Colour', `<div class="c-row c-row--field"><button class="c-reset c-swatchrow c-focus" data-picker="thread" aria-haspopup="dialog"><span class="c-swatchrow__swatch">${threadSwatchHtml()}</span></button>${rowBtns('data-thread-eye', 'data-thread-bin', threadHidden())}</div>`)
    + '<div data-stage="strands"></div><div data-stage="density"></div>');
}
const patternRows = () => {
  const have = ed.patternColours(), hexes = [...have.map(([h]) => h), ...pattern.hand.filter((h) => !have.some(([x]) => x === h))];
  return hexes.map((hex) => {
    const op = pattern.opacity[hex] ?? 100, hid = hidden.pattern.has(hex);
    return `<div class="c-row c-row--field${hex === pattern.active ? ' is-selected' : ''}${hid ? ' is-hidden' : ''}" data-pattern-hex="${hex}"><div class="c-field c-field--split" role="group" aria-label="${hex}">`
      + `<span class="c-field__cell c-field__cell--lead"><span class="c-row__art">${swatch(hex, { tag: 'span' })}</span>${hex}</span>`
      + `<label class="c-field__cell c-field__cell--num c-field__cell--opacity" data-tip="Opacity" data-pattern-opacity><span class="c-field__op" aria-hidden="true">${opacitySquare(op, { size: 16 })}</span><input value="${op}" inputmode="numeric" maxlength="3" aria-label="Opacity of ${hex}" data-pattern-op><span class="c-field__unit">%</span></label></div>`
      + rowBtns('data-pattern-eye', 'data-pattern-bin', hid) + '</div>';
  }).join('');
};
function patternSection() {
  const has = picture.image || ed.patternColours().length || pattern.hand.length;
  const field = `<button class="c-reset c-swatchrow c-focus" data-picture aria-haspopup="dialog">${picture.image ? `<img src="${picture.popup?.thumb() || ''}" alt=""><span>${picture.name}</span>` : `${ic('picture')}<span class="c-swatchrow__muted">Choose or drop a picture</span>`}</button>`;
  const pic = labelled('Picture', picture.image ? `<div class="c-row c-row--field">${field}${rowBtns('data-picture-eye', 'data-picture-bin', picture.hidden)}</div>` : field);
  const add = `<button class="c-reset c-swatchrow${has ? ' c-swatchrow--quiet' : ''} c-focus" data-pattern-add>${ic('plus')}<span class="c-swatchrow__muted">Add a pattern square</span></button>`;
  const list = labelled('Pattern colours', has ? `<div class="c-rowlist"><div data-pattern-colours>${patternRows()}</div>${add}</div>` : add);
  return section('pattern', 'Pattern', pic + list);
}
// the add row: outlines the selection when there is one, else the whole cloth (once); gone when neither applies
const outlineAddLabel = () => (ed.selection().size ? (selectionOutline() ? '' : 'Outline the selection') : (outlines.some((o) => !o.area) ? '' : 'Add an outline'));
const outlineAdd = () => { const l = outlineAddLabel(); return `<button class="c-reset c-swatchrow c-focus${outlines.length ? ' c-swatchrow--quiet' : ''}" data-outline-add${l ? '' : ' hidden'}>${ic('plus')}<span class="c-swatchrow__muted">${l}</span></button>`; };
const outlineRows = () => outlines.map((o) => {
  const chip = o.match ? outlineShade(o.main) : o.hex, name = OUTLINE_STITCHES.find(([k]) => k === o.stitch)?.[1];
  return `<div class="c-row c-row--field${o.id === currentOutline ? ' is-selected' : ''}${o.hidden ? ' is-hidden' : ''}" data-outline-id="${o.id}"><div class="c-field c-field--split" role="group" aria-label="${o.name} outline">`
    + `<span class="c-field__cell c-field__cell--lead" data-tip="${o.match ? 'Matched' : up(o.hex)}"><span class="c-row__art">${swatch(chip, { tag: 'span' })}</span>${o.name}</span>`
    + `<span class="c-field__cell c-field__cell--count" data-tip="${name}">${outlineSvg(o.stitch, { size: 20 })}</span></div>${rowBtns('data-outline-eye', 'data-outline-bin', o.hidden)}</div>`;
}).join('');
function outlineSection() {
  const o = curOutline();
  if (!o) return section('outline', 'Outline', labelled('Outline', outlineAdd()));
  const body = labelled('Outlines', `<div class="c-rowlist"><div data-outline-list>${outlineRows()}</div>${outlineAdd()}</div>`)
    + labelled('Colour', `<div class="c-seg c-seg--soft" role="group" aria-label="Outline colour" data-outline-match style="display:flex">${[['match', 'Matched', 'A darker shade of each colour it borders'], ['one', 'One colour', 'The same thread all round']].map(([v, l, tip]) => `<button class="c-reset c-seg__opt c-focus" style="flex:1" data-value="${v}" data-label="${l}" data-tip="${tip}" aria-pressed="${(v === 'match') === o.match}">${l}</button>`).join('')}</div>`
      + `<div class="c-row c-row--field" data-outline-one${o.match ? ' hidden' : ''}>${colourField(up(o.hex), 'data-picker="outline"')}</div>`)
    + labelled('Stitch', `<div class="c-tilegrid" data-outline-tiles>${OUTLINE_STITCHES.map(([k, name]) => `<button class="c-reset c-tile c-focus" aria-label="${name}" data-tip="${name}" data-outline-stitch="${k}" aria-pressed="${k === o.stitch}">${outlineSvg(k)}</button>`).join('')}</div>`)
    + '<div data-stage="outline-strands"></div>' + (!o.area && picture.popup ? '<div data-stage="outline-detail"></div>' : '')
    + labelled('Edges', `<div class="c-seg c-seg--soft" role="group" data-outline-edges style="display:flex">${[['all', 'All edges', 'Around the shape and between its colours'], ['outside', 'Outer edge', 'Only around the shape']].map(([v, l, tip]) => `<button class="c-reset c-seg__opt c-focus" style="flex:1" data-value="${v}" data-label="${l}" data-tip="${tip}" aria-pressed="${v === o.edges}">${l}</button>`).join('')}</div>`);
  return section('outline', 'Outline', body);
}
// keeps the add row and the selected row in step with the selection, without redrawing the section
function syncOutlineList() {
  const sec = $('panel').querySelector('[data-sec="outline"]'); if (!sec) return;
  const add = sec.querySelector('[data-outline-add]'), l = outlineAddLabel();
  if (add) { add.hidden = !l; add.querySelector('.c-swatchrow__muted').textContent = l; }
}
// the colour list: Canvas colours, or Selection colours (counts, hex, eye, bin and select only inside it) while something is selected
const colourScope = () => (ed.selection().size ? 'selection' : 'canvas');
const colourTitle = () => (colourScope() === 'selection' ? 'Selection colours' : 'Canvas colours');
const canvasColourRows = () => (colourScope() === 'selection' ? ed.selection().colours : ed.threadColours()).map(([hex, n]) => {
  hex = up(hex);
  const count = n.squares + n.backs, hid = colourScope() === 'selection' ? n.hidden : hidden.thread.has(hex);
  return `<div class="c-row c-row--field${hid ? ' is-hidden' : ''}" data-hex="${hex}"><div class="c-field c-field--split" role="group" aria-label="${hex}, ${count} stitches">`
    + `<span class="c-field__cell c-field__cell--lead"><span class="c-row__art">${swatch(hex, { tag: 'span' })}</span><input value="${hex}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex" data-hex-edit></span>`
    + `<span class="c-field__cell c-field__cell--count" data-tip="${count.toLocaleString('en')} stitches">${count.toLocaleString('en')}</span></div>${rowBtns('data-colour-eye', 'data-colour-bin', hid)}</div>`;
}).join('');
// the stitch list, like the colour list: Canvas stitches, or Selection stitches (counts, delete and select only inside it)
const stitchTitle = () => (colourScope() === 'selection' ? 'Selection stitches' : 'Canvas stitches');
const canvasStitchRows = () => (colourScope() === 'selection' ? ed.selection().kindCounts : ed.stitchKinds()).map(([kind, n]) => {
  const prim = primOfKind(kind) || 'stitch-full';
  return `<div class="c-row c-row--field" data-stitch-kind="${kind}"><div class="c-field c-field--split" role="group" aria-label="${kindName(kind)}, ${n} stitches">`
    + `<span class="c-field__cell c-field__cell--lead tz-host" data-tip="${kindName(kind)}"><span class="c-row__art">${zoomPrim(prim)}</span>${n.toLocaleString('en')}</span></div>`
    + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Delete these stitches" data-tip="Delete" data-kind-bin>${ic('bin')}</button></div>`;
}).join('');
// Canvas: Fabric (swatches with names), Coverage (the count, drawn as fuller and fuller thread), Cell size (cell-size.js: "12 | 12 px", − and +, scrubbed)
// and the sheet's Size (a menu of set sizes, its W | H in px always under it: type there for any other size, Custom)
const SHEETS = [['Square', 900, 900], ['Landscape', 1200, 900], ['Large', 1600, 1200], ['Wide', 1600, 900], ['Portrait', 900, 1200]];
let sheetCustom = false;
const sheetNow = () => { const sh = ed.sheet(); return sheetCustom ? null : SHEETS.find(([, w, h]) => w === sh.w && h === sh.h); };
// Zoom, in the Canvas section, drawn as Cell size is (C: the number in a field box, the buttons beside it in one box of
// their own): the percentage (100% = the cloth fits the window), typed into (Enter), arrow keys ±10 (shift ±50); − + and Fit
let view = null;
const zoomField = () => `<div class="c-cellsize c-cellsize--box st-zoomfield">`
  + `<div class="c-field c-field--split c-cellsize__box" role="group" aria-label="Zoom"><label class="c-field__cell c-field__cell--num"><input value="${Math.round((view?.fit ?? 1) * 100)}" inputmode="numeric" maxlength="4" aria-label="Zoom in percent" data-zoom-value><span class="c-field__unit">%</span></label></div>`
  + `<div class="c-cellsize__steps"><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Zoom out" data-zoom="out">${ic('minus')}</button><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Zoom in" data-zoom="in">${ic('plus')}</button><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Fit" data-tip="Fit" data-tip-key="0" data-zoom="fit">${ic('fit')}</button></div></div>`;
const zoomToPercent = (pct) => { if (!view || !Number.isFinite(pct) || pct <= 0) return; ed.zoomTo(view.z / view.fit * pct / 100); };
function canvasSection() {
  const sh = ed.sheet(), set = sheetNow();
  return section('canvas', 'Canvas', labelled('Zoom', zoomField())
    + labelled('Fabric', fabricHtml(ed.state.surface))
    + labelled('Coverage', coverageHtml(ed.state.count))
    + labelled('Cell size', cellSizeHtml(sh.cell))
    + labelled('Size', `<button class="c-reset c-select c-focus" data-sheet-menu aria-haspopup="true"><span class="c-select__value">${set ? set[0] : 'Custom'}</span>${ic('chevron-down')}</button>`)
    + (`<div class="c-field c-field--split c-field--pair" role="group" aria-label="Sheet size in px">${[['w', 'W', sh.w, 'Width'], ['h', 'H', sh.h, 'Height']].map(([k, l, v, tip]) => `<label class="c-field__cell c-field__cell--num" data-tip="${tip} in px"><span class="c-field__letter" aria-hidden="true">${l}</span><input inputmode="numeric" value="${v}" aria-label="${tip} in px" data-sheet="${k}"><span class="c-field__unit">px</span></label>`).join('')}</div>`));
}
// the Size menu floats under its box, as the Tones menus do
let sheetMenu = null;
const closeSheetMenu = () => { sheetMenu?.remove(); sheetMenu = null; $('panel').querySelector('[data-sheet-menu]')?.classList.remove('is-open'); };
function openSheetMenu(btn) {
  if (sheetMenu) { closeSheetMenu(); return; }
  const cur = sheetNow(), r = btn.getBoundingClientRect();
  sheetMenu = document.createElement('div');
  sheetMenu.className = 'c-menu c-menu--float';
  sheetMenu.innerHTML = [...SHEETS.map(([n, w, h]) => [n, `${w} × ${h}`, `${w}x${h}`, cur?.[0] === n]), ['Custom', '', 'custom', !cur]].map(([l, dims, v, on]) => `<button class="c-reset c-menu__item ${on ? 'is-selected' : ''}" data-sheet-pick="${v}">${l}${dims ? `<span class="c-menu__meta">${dims}</span>` : ''}${on ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('');
  document.body.append(sheetMenu); btn.classList.add('is-open');
  const h = sheetMenu.offsetHeight;
  Object.assign(sheetMenu.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.bottom + 4 + h <= innerHeight - 8 ? r.bottom + 4 : Math.max(8, r.top - 4 - h)}px` });
}
// the sheet changed (cell size, W or H): the grid is recounted, a picture is placed again to fit it, the view fits
function resheet(w, h, cell) {
  const sh = ed.sheet();
  w = Math.max(200, Math.min(2400, Math.round(w ?? sh.w))); h = Math.max(200, Math.min(2400, Math.round(h ?? sh.h))); cell = cell ?? sh.cell;
  ed.canvasSize(w, h, cell);
  const [c, r] = ed.grid();
  if (picture.fit) { picture.fit[0] = c; picture.fit[1] = r; picture.popup?.rebuild(); }
  ed.fit(); renderBar(); refreshPiece();
  $('panel').querySelectorAll('[data-sheet]').forEach((i) => { i.value = ed.sheet()[i.dataset.sheet]; });

}
const canvasSections = () => section('colours', colourTitle(), `<div data-canvas-colours>${canvasColourRows()}</div>`) + section('stitches', stitchTitle(), `<div data-canvas-stitches>${canvasStitchRows()}</div>`);

// the Eraser section, only while the eraser is the tool, just after Canvas: its Size, a stage slider (1–12 squares a side)
// and what it takes, a pill: Stitches (the default), Pattern (the pattern squares only) or Both
const ERASES = [['stitches', 'Stitches'], ['pattern', 'Pattern'], ['both', 'Both']];
const eraserSection = () => section('eraser', 'Eraser', labelled('Erases', `<div class="c-seg c-seg--soft" role="group" aria-label="Erases" data-erase-what style="display:flex">${ERASES.map(([v, l]) => `<button class="c-reset c-seg__opt c-focus" style="flex:1" data-value="${v}" data-label="${l}" aria-pressed="${v === ed.state.eraseWhat}">${l}</button>`).join('')}</div>`)
  + '<div data-stage="eraser"></div>');
const eraserNow = () => (ed.state.tool === 'erase' ? eraserSection() : '');
function syncEraser() {
  const el = $('panel').querySelector('[data-sec="eraser"]'), want = ed.state.tool === 'erase';
  if (!!el === want) return;
  if (el) { el.remove(); return; }
  $('panel').querySelector('[data-sec="canvas"]')?.insertAdjacentHTML('afterend', eraserSection());
  wire($('panel').querySelector('[data-sec="eraser"]'));
}
function renderPanel() {
  $('panel').innerHTML = '<div class="c-panel__head"></div>' + `<div class="c-panel__body">${canvasSection()}${eraserNow()}${stitchSection()}${threadSection()}${patternSection()}${outlineSection()}${canvasSections()}</div>`;
  renderHead();
  wire($('panel'));
}
function wire(root) {
  root.querySelectorAll('[data-tiles]').forEach((el) => { el._motion = createSegMotion(el, () => pillValues, { option: '.c-tile' }); });
  root.querySelectorAll('[data-outline-tiles]').forEach((el) => createSegMotion(el, () => pillValues, { option: '.c-tile' }));
  root.querySelectorAll('[data-outline-edges], [data-outline-match], [data-erase-what]').forEach((el) => createSegMotion(el, () => pillValues));
  root.querySelectorAll('.tz-host').forEach((h) => { const s = h.querySelector('svg'); if (s) { Object.assign(s.dataset, { n: ZOOM_N, o: 5, c: 14 }); zoom.sync(h); } });
  const stage = (key, setting, initial, onChange) => { const host = root.querySelector(`[data-stage="${key}"]`); if (host) createStageSlider(host, { setting, initial, colour: ed.state.color, onChange }); };
  stage('strands', 'strands', ed.state.strands, (v) => ed.set('strands', v));
  stage('density', 'density', Math.round(ed.state.density * 100), (v) => ed.set('density', v / 100));
  stage('eraser', 'eraser', ed.state.eraseSize, (v) => ed.set('eraseSize', v));
  root.querySelectorAll('[data-coverage]').forEach((el) => createSegMotion(el, () => pillValues));
  root.querySelectorAll('[data-fabric]').forEach((el) => createSegMotion(el, () => pillValues, { option: '.c-fabric' }));
  wireCellSize(root, { get: () => ed.sheet().cell, set: (v) => resheet(null, null, v) });
  stage('outline-strands', 'strands', curOutline()?.strands ?? 1, (v) => { const o = curOutline(); if (o) { o.strands = v; styleOutline(); } });
  stage('outline-detail', 'detail', curOutline()?.detail ?? 50, (v) => { const o = curOutline(); if (o) { o.detail = v; picture.popup?.rebuild(); } });
}
// the piece changed: the lists and the app bar follow, without redrawing what you're working in
function refreshPiece() {
  const swap = (sel, html) => { const el = $('panel').querySelector(sel); if (el) { el.innerHTML = html; wire(el); } };
  swap('[data-canvas-colours]', canvasColourRows());
  swap('[data-canvas-stitches]', canvasStitchRows());
  const list = $('panel').querySelector('[data-pattern-colours]');
  if (list) list.innerHTML = patternRows();
  else if (ed.patternColours().length && !$('panel').querySelector('[data-pattern-colours]')) replaceSection('pattern', patternSection());
  renderBar();
}
const replaceSection = (key, html) => { const el = $('panel').querySelector(`[data-sec="${key}"]`); if (!el) return; el.outerHTML = html; wire($('panel').querySelector(`[data-sec="${key}"]`)); };

// ─── pop-ups beside the panel: the colour picker, the picture ───────────────
let pop = null;
const closePop = () => { if (!pop) return; pop.resize?.disconnect(); if (pop.keep) pop.el.hidden = true; else pop.el.remove(); pop.trigger?.classList.remove('is-open'); pop = null; };
function place(el, trigger) {
  let top = null;
  const fit = () => {
    const p = $('panel').getBoundingClientRect(), r = trigger.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, gap = 8;
    const beside = p.left >= w + gap * 2;
    el.style.left = `${beside ? p.left - w - gap : Math.max(gap, Math.min(r.left, innerWidth - w - gap))}px`;
    top = Math.max(gap, Math.min(top ?? (beside ? r.top - 8 : r.bottom + 4), innerHeight - h - gap));
    el.style.top = `${top}px`;
  };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(el);
  return ro;
}
function openPicker(trigger, hex, onChange) {
  closePop();
  const el = document.createElement('div'); el.className = 'c-pop c-pop--side';
  document.body.append(el); trigger.classList.add('is-open');
  pop = { el, trigger };
  pop.picker = createColourPicker(el, { hex, canvas: ed.threadColours().map(([h]) => h), onChange, onClose: () => { closePop(); trigger.focus(); }, onRender: (part) => wire(part) });
  pop.resize = place(el, trigger);
}

// a colour row's chip opens the picker, and the colour changes live as you pick, on the cloth and in the panel, one undo
// step per opening. Stitches and pattern squares in that colour change together (on a picture they're the same thread):
// from Canvas or Pattern colours everywhere, from Selection colours only inside the selection.
function openRowPicker(trigger, scope, hex0) {
  let cur = up(hex0), grab = null;
  const rowSel = (h) => (scope === 'pattern' ? `[data-pattern-hex="${h}"]` : `[data-hex="${h}"]`);
  openPicker(trigger, cur, (hex) => {
    hex = up(hex); if (hex === cur) return;
    grab ||= ed.grabColour(cur, { within: scope === 'selection' });
    grab.set(hex);
    // what the panel keeps by colour moves with it
    const move = (set) => { if (set.delete(cur)) set.add(hex); };
    move(hidden.thread); move(hidden.pattern);
    if (hidden.thread.has(hex)) { ed.hideColour(cur, false); ed.hideColour(hex, true); }
    if (hidden.pattern.has(hex)) { ed.hidePattern(cur, false); ed.hidePattern(hex, true); }
    pattern.hand = pattern.hand.map((h) => (h === cur ? hex : h));
    if (pattern.active === cur) pattern.active = hex;
    if (cur in pattern.opacity) { pattern.opacity[hex] = pattern.opacity[cur]; delete pattern.opacity[cur]; ed.setPatternOpacity(hex, pattern.opacity[hex] / 100); }
    if (scope !== 'selection' && up(ed.state.color) === cur) ed.set('color', hex);
    cur = hex;
    // the panel: lists (refreshPiece runs on the editor's 'piece'), the Thread field, and the picker's own On canvas
    syncThreadSwatch();
    if (pop?.picker) { pop.picker.state.canvas = ed.threadColours().map(([h]) => up(h)); pop.picker.refresh(); }
    // the row was drawn again under its new colour: the picker stays put beside it
    const row = $('panel').querySelector(rowSel(hex));
    if (row && pop) { pop.trigger = row.querySelector('.c-row__art'); pop.trigger?.classList.add('is-open'); }
  });
}

// ─── the selection bar (design/selection-bar.js): floats above the selection, below it when there's no room ───
// Thread (stitch | colour, each with its pop-up), Outline, Hide, Delete, More. Hidden while a selection is being drawn or moved.
let selPop = null, selbarKey = '';
const closeSelPop = () => { selPop?.el.remove(); selPop?.btn.classList.remove('is-open'); selPop = null; };
function selbarState() {
  const sel = ed.selection(), kinds = sel.kinds.filter((k) => k !== 'back' || sel.kinds.length === 1);
  const kind = kinds[0] || 'full', prim = kind === 'back' ? 'stitch-back' : primOfKind(kind) || 'stitch-full';
  return { stitch: prim, stitchName: kindName(kind), colour: up(sel.colours[0]?.[0] || ed.state.color), mixedStitch: kinds.length > 1, mixedColour: sel.colours.length > 1,
    stitches: kinds.map((k) => (k === 'back' ? 'stitch-back' : primOfKind(k) || 'stitch-full')), colours: sel.colours.map(([h]) => up(h)),
    outline: !!selectionOutline(), hidden: sel.colours.length > 0 && sel.colours.every(([, n]) => n.hidden), open: selPop?.part || null };
}
function renderSelbar() {
  const host = $('selbar');
  if (!ed.selection().size) { host.hidden = true; host.innerHTML = ''; selbarKey = ''; closeSelPop(); return; }
  const st = selbarState(), key = JSON.stringify(st);
  if (key !== selbarKey) {
    host.innerHTML = selectionBarHtml(st); selbarKey = key;
    // a pop-up stays with its button, drawn again
    if (selPop) selPop.btn = host.querySelector(`[data-selbar="${selPop.part}"]`) || selPop.btn;
    if (pop?.trigger && !pop.trigger.isConnected && pop.trigger.dataset?.selbar) pop.trigger = host.querySelector('[data-selbar="colour"]');
  }
  placeSelbar();
}
function placeSelbar() {
  const host = $('selbar'), r = ed.selectionRect();
  if (!r || !ed.selection().size) return;
  host.hidden = false;
  host.style.opacity = ed.isMoving() ? '0' : '1';
  host.style.pointerEvents = ed.isMoving() ? 'none' : '';
  const stage = $('stage').getBoundingClientRect(), w = host.offsetWidth, h = host.offsetHeight, gap = 10, edge = 8;
  let top = r.top - h - gap;
  if (top < edge) top = r.bottom + gap;
  top = Math.max(edge, Math.min(stage.height - h - edge, top));
  const left = Math.max(edge, Math.min(stage.width - w - edge, (r.left + r.right) / 2 - w / 2));
  host.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  if (selPop) placeSelPop();
}
// follow the view (zoom, pan) and moves without waiting for an event
(function follow() { requestAnimationFrame(follow); if (!$('selbar').hidden) placeSelbar(); })();
// The selection on screen, in window px
const selClientRect = () => {
  const r = ed.selectionRect(), s = $('stage').getBoundingClientRect();
  return r && { left: r.left + s.left, top: r.top + s.top, right: r.right + s.left, bottom: r.bottom + s.top };
};
const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
// A pop-up that covers the selection with nowhere else to go: the view glides (zooming out only as far as it must) so
// the selection sits in the largest part of the cloth the pop-up leaves free, with room above it for the bar
function keepSelectionClear(box) {
  const sel = selClientRect();
  if (!overlaps(box, sel)) return false;
  const s = $('stage').getBoundingClientRect(), m = 16, bar = ($('selbar').offsetHeight || 40) + 10;
  const free = [
    { left: s.left, right: s.right, top: s.top, bottom: box.top },
    { left: s.left, right: s.right, top: box.bottom, bottom: s.bottom },
    { left: s.left, right: box.left, top: s.top, bottom: s.bottom },
    { left: box.right, right: s.right, top: s.top, bottom: s.bottom },
  ].map((f) => ({ left: f.left + m - s.left, right: f.right - m - s.left, top: f.top + m + bar - s.top, bottom: f.bottom - m - s.top }))
    .filter((f) => f.right - f.left > 40 && f.bottom - f.top > 40)
    .sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top));
  if (free[0]) ed.showSelectionIn(free[0]);
  return true;
}
// The bar's pop-up opens on the side of the bar away from the selection (above a bar that sits above it), then the
// other side, then beside the selection, level with its top; the first of those that covers none of the selection and
// fits in the window. When none does, it opens under the bar and stays put while the view moves the selection clear.
function placeSelPop() {
  const el = selPop.el, b = selPop.btn.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, gap = 6, edge = 8;
  if (selPop.pinned) return;
  // kept over the cloth, never over the panel
  const st = $('stage').getBoundingClientRect(), x0 = st.left + edge, x1 = st.right - edge;
  const sel = selClientRect(), x = Math.max(x0, Math.min(x1 - w, b.left));
  const ok = ([l, t]) => t >= edge && t + h <= innerHeight - edge && l >= x0 && l + w <= x1 && !overlaps({ left: l, top: t, right: l + w, bottom: t + h }, sel);
  const below = [x, b.bottom + gap], above = [x, b.top - gap - h];
  const tries = sel && b.bottom <= sel.top + 1 ? [above, below] : [below, above];
  if (sel) {
    const t = Math.max(edge, Math.min(innerHeight - h - edge, sel.top));
    tries.push([sel.right + gap * 2, t], [sel.left - gap * 2 - w, t]);
  }
  let spot = tries.find(ok);
  if (!spot) {
    spot = [x, b.bottom + gap + h <= innerHeight - edge ? b.bottom + gap : Math.max(edge, b.top - gap - h)];
    if (!ed.isMoving() && keepSelectionClear({ left: spot[0], top: spot[1], right: spot[0] + w, bottom: spot[1] + h })) selPop.pinned = true;
  }
  Object.assign(el.style, { left: `${spot[0]}px`, top: `${spot[1]}px` });
}
function openSelPop(btn, part, html) {
  closeSelPop();
  const el = document.createElement('div');
  el.className = part === 'stitch' ? 'c-popover c-menu--float st-selpop' : 'c-menu c-menu--float st-selpop';
  el.innerHTML = html;
  document.body.append(el);
  selPop = { el, btn, part }; btn.classList.add('is-open');
  placeSelPop();
  if (!reducedMotion.matches) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' });
  if (part === 'stitch') wireSelPop(el);
}
// the stitch pop-up: with one stitch, every stitch to change it to. Mixed, first which of the selection's stitches to change,
// then every stitch to change it to. How that first part looks is MIXED_MENU.variant (the studio's Mixed menu dial):
//   list    In selection: All, then each kind with its count, one row each
//   select  one select box with the chosen kind (All to start) and its count; open, the same rows; ↑ ↓ change it
//   pills   a pill per kind (drawing and count), All first, four to a row: past three kinds the rest wrap onto rows below
//   groups  one menu for stitch and colour both: a row per stitch-and-colour group, its colour and stitch each in a box
//           of their own (as on the bar) and its count; the stitch box opens the tiles for that group, the colour box
//           the picker for it. Both halves of the bar open it.
// In every variant ↑ ↓ move through the choices while the pop-up is open.
const MIXED_MENU = { variant: 'pills' };
const kindArt = (k, size = 20) => `<span class="c-selbar__art">${primitiveSvg(k === 'back' ? 'stitch-back' : primOfKind(k) || 'stitch-full', { size, frame: 'square', animate: false, holes: 0, id: `so${uid++}` })}</span>`;
const changeTiles = (cur) => `<div class="c-tilegrid" data-sel-tiles>${KINDS.map(([n, , k], i) => `<button class="c-reset c-tile c-focus tz-host" aria-label="${nameOf(n)}" data-tip="${nameOf(n)}" data-sel-kind="${i}" aria-pressed="${cur === k}">${zoomPrim(n)}</button>`).join('')}</div>`;
// the choices ↑ ↓ move through: kinds (null = all), or groups ('kind|hex')
const selChoices = () => {
  const sel = ed.selection();
  if (MIXED_MENU.variant === 'groups') return sel.groups.filter(([k]) => k !== 'back').map(([k, c]) => `${k}|${c}`);
  return [null, ...sel.kindCounts.filter(([k]) => k !== 'back').map(([k]) => k)];
};
const selStitchTiles = () => {
  const sel = ed.selection(), counts = sel.kindCounts.filter(([k]) => k !== 'back'), mixed = counts.length > 1 || sel.colours.length > 1 && MIXED_MENU.variant === 'groups';
  if (!mixed) return changeTiles(counts.length === 1 ? counts[0][0] : null);
  const v = MIXED_MENU.variant, only = selPop?.only ?? null, total = counts.reduce((t, [, n]) => t + n, 0);
  const row = (k, label, n, lead) => `<button class="c-reset c-menu__item ${only === k ? 'is-selected' : ''}" data-sel-only="${k ?? ''}">${lead}${label}<span class="c-menu__meta">${n.toLocaleString('en')}</span></button>`;
  const allLead = `<span class="c-selbar__stack">${counts.slice(0, 2).map(([k]) => kindArt(k)).join('')}</span>`;
  const rows = () => `<div class="c-selbar-list">${row(null, 'All stitches', total, allLead)}${counts.map(([k, n]) => row(k, kindName(k), n, kindArt(k))).join('')}</div>`;
  const change = `<span class="c-group-label">${only ? `Change ${kindName(only)} to` : 'Change all to'}</span>${changeTiles(only)}`;
  if (v === 'select') {
    const n = only ? counts.find(([k]) => k === only)?.[1] || 0 : total;
    return `<button class="c-reset c-select c-focus st-kindsel ${selPop?.drop ? 'is-open' : ''}" data-sel-drop data-tip="Which stitches" data-tip-key="↑ ↓">${only ? kindArt(only) : allLead}<span class="c-select__value">${only ? kindName(only) : 'All stitches'}</span><span class="c-menu__meta">${n.toLocaleString('en')}</span>${ic('chevron-down')}</button>`
      + (selPop?.drop ? rows() : '') + change;
  }
  if (v === 'pills') {
    const pill = (k, inner, tip) => `<button class="c-reset c-seg__opt c-focus" data-sel-only="${k ?? ''}" data-tip="${tip}" aria-pressed="${only === k}">${inner}</button>`;
    return `<div class="c-seg c-seg--soft st-kindpills" role="group" aria-label="Which stitches">${pill(null, `All<span class="st-pilln">${total}</span>`, 'All stitches')}`
      + counts.map(([k, n]) => pill(k, `${kindArt(k, 16)}<span class="st-pilln">${n}</span>`, kindName(k))).join('') + `</div>` + change;
  }
  if (v === 'groups') {
    const g = sel.groups.filter(([k]) => k !== 'back'), chosen = selPop?.only ?? null;
    const grow = ([k, c, n]) => { const key = `${k}|${c}`; return `<div class="c-menu__item st-grouprow ${chosen === key ? 'is-selected' : ''}" data-grp="${key}">`
      + `<span class="c-selbar__thread"><button class="c-reset c-selbar__half c-focus" data-grp-colour="${key}" data-tip="Colour">${swatch(c, { tag: 'span' })}</button><button class="c-reset c-selbar__half c-focus ${chosen === key ? 'is-open' : ''}" data-grp-kind="${key}" data-tip="Stitch">${kindArt(k)}</button></span>`
      + `<span>${kindName(k)}</span><span class="c-menu__meta">${n.toLocaleString('en')}</span></div>`; };
    const [ck, cc] = chosen ? chosen.split('|') : [];
    return `<span class="c-group-label">In selection</span><div class="c-selbar-list st-grouplist">${g.map(grow).join('')}</div>`
      + (chosen ? `<span class="c-group-label">Change ${kindName(ck)} in ${cc} to</span>${changeTiles(ck)}` : '');
  }
  return `<span class="c-group-label">In selection</span>${rows()}${change}`;
};
// the colour menu, for a mixed selection: All (one colour for everything), then each colour with its count; each opens the picker
const selColourMenu = () => {
  const cols = ed.selection().colours;
  const row = (hex, label, n, lead) => `<button class="c-reset c-menu__item" data-sel-colour="${hex ?? ''}">${lead}${label}<span class="c-menu__meta">${n.toLocaleString('en')}</span></button>`;
  return `<span class="c-group-label">In selection</span><div class="c-selbar-list">${row(null, 'All colours', cols.reduce((t, [, c]) => t + c.squares + c.backs, 0), `<span class="c-selbar__chips">${cols.slice(0, 3).map(([h]) => swatch(h, { tag: 'span' })).join('')}</span>`)}`
    + cols.map(([h, c]) => row(up(h), up(h), c.squares + c.backs, swatch(h, { tag: 'span' }))).join('') + '</div>';
};
// Escape closes an open bar pop-up before it lets go of the selection
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selPop) { closeSelPop(); renderSelbar(); e.stopImmediatePropagation(); return; }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && selPop?.part === 'stitch' && !e.target.closest?.('input')) {
    const ch = selChoices(); if (ch.length < 2) return;
    const i = ch.indexOf(selPop.only ?? (MIXED_MENU.variant === 'groups' ? undefined : null));
    selPop.only = ch[(i + (e.key === 'ArrowDown' ? 1 : -1) + ch.length) % ch.length];
    redrawSelPop(); e.preventDefault(); e.stopImmediatePropagation();
  }
}, true);
const wireSelPop = (el) => { wire(el); el.querySelectorAll('.st-kindpills').forEach((p) => { p._seg = createSegMotion(p, () => pillValues); }); };
// Drawing the pop-up again after a change morphs it (MORPH): pills for kinds no longer in the selection fade out where
// they were (a kind changed into one already there merges into it), new ones fade in, the rest glide to their new
// places, the fill with them, and the pop-up's height eases. When the pills are the same ones, they're kept as they
// are, so the fill moves with the pill motion.
// A change to the stitches from the bar fades in: the cloth as it was is laid over the new and fades out (FADE)
const FADE = { ms: 260, ease: 'ease-out' };
function fadeChange(fn) {
  const c = $('fade');
  if (reducedMotion.matches) return fn();
  c.getAnimations().forEach((a) => a.cancel());
  ed.snapshot(c);
  const out = fn();
  c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE.ms, easing: FADE.ease, fill: 'forwards' });
  return out;
}
const MORPH = { ms: 220, ease: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fadeIn: 0.35 };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const morphKey = (n) => (n.dataset.selOnly !== undefined ? `pill:${n.dataset.selOnly}` : n.matches('[data-sel-tiles]') ? 'tiles' : n.matches('.c-group-label') ? 'label' : null);
const redrawSelPop = () => {
  if (!selPop) return;
  const el = selPop.el, stitch = selPop.part === 'stitch', html = stitch ? selStitchTiles() : selColourMenu();
  const oldPills = el.querySelector('.st-kindpills'), pillKeys = (c) => c && [...c.querySelectorAll('[data-sel-only]')].map((b) => b.dataset.selOnly).join();
  const before = new Map();
  el.querySelectorAll('[data-sel-only], [data-sel-tiles], .c-group-label').forEach((n) => { const k = morphKey(n); if (k) before.set(k, { n, r: n.getBoundingClientRect() }); });
  const thumb0 = oldPills?.querySelector('.c-seg__thumb:not([hidden])')?.getBoundingClientRect();
  const box0 = el.getBoundingClientRect();
  el.innerHTML = html;
  const pills = el.querySelector('.st-kindpills');
  if (stitch && oldPills && pills && pillKeys(oldPills) === pillKeys(pills)) {
    // the same pills: keep them; only their counts and which is chosen change
    const fresh = [...pills.querySelectorAll('[data-sel-only]')];
    oldPills.querySelectorAll('[data-sel-only]').forEach((b, i) => { b.querySelector('.st-pilln').textContent = fresh[i].querySelector('.st-pilln').textContent; });
    pills.replaceWith(oldPills);
    oldPills._seg?.select(fresh.findIndex((b) => b.getAttribute('aria-pressed') === 'true'));
    wire(el);
  } else if (stitch) wireSelPop(el);
  placeSelPop();
  if (reducedMotion.matches) return;
  const box1 = el.getBoundingClientRect(), anim = { duration: MORPH.ms, easing: MORPH.ease };
  if (Math.abs(box1.height - box0.height) > 0.5) el.animate([{ height: `${box0.height}px`, top: `${box0.top}px`, overflow: 'hidden' }, { height: `${box1.height}px`, top: `${box1.top}px`, overflow: 'hidden' }], anim);
  const dy = box1.top - box0.top, dx = box1.left - box0.left;   // the pop-up itself moved: things glide from where they were in it
  const seen = new Set();
  el.querySelectorAll('[data-sel-only], [data-sel-tiles], .c-group-label').forEach((n) => {
    const k = morphKey(n); if (!k) return; seen.add(k);
    const was = before.get(k), r = n.getBoundingClientRect();
    if (!was) { n.animate([{ opacity: 0 }, { opacity: 1 }], { ...anim, delay: MORPH.ms * MORPH.fadeIn, fill: 'backwards' }); return; }
    if (was.n === n) return;
    const mx = was.r.left - r.left + dx, my = was.r.top - r.top + dy;
    if (Math.abs(mx) > 0.5 || Math.abs(my) > 0.5) n.animate([{ transform: `translate(${mx}px, ${my}px)` }, { transform: 'none' }], anim);
    if (k === 'label' && was.n.textContent !== n.textContent) n.animate([{ opacity: 0.2 }, { opacity: 1 }], anim);
  });
  // the fill follows its pill from where it was
  const thumb = pills && pills !== oldPills && pills.querySelector('.c-seg__thumb:not([hidden])');
  if (thumb && thumb0) { const t = thumb.getBoundingClientRect(); thumb.animate([{ transform: `translate(${thumb0.left - t.left + dx}px, ${thumb0.top - t.top + dy}px)` }, { transform: 'translate(0, 0)' }], { ...anim, composite: 'add' }); }
  // pills that went: drawn once more where they were, fading out
  const host = el.querySelector('.st-kindpills');
  if (!host) return;
  const hr = host.getBoundingClientRect();
  for (const [k, { n, r }] of before) {
    if (seen.has(k) || !k.startsWith('pill:')) continue;
    const g = n.cloneNode(true);
    g.removeAttribute('data-sel-only'); g.setAttribute('aria-pressed', 'false'); g.inert = true; g.classList.add('st-ghost');
    Object.assign(g.style, { position: 'absolute', margin: 0, left: `${r.left - hr.left - host.clientLeft + dx}px`, top: `${r.top - hr.top - host.clientTop + dy}px`, width: `${r.width}px`, height: `${r.height}px`, pointerEvents: 'none' });
    host.append(g);
    g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MORPH.ms * 0.8, easing: 'ease-out', fill: 'forwards' }).onfinish = () => g.remove();
  }
};
const MORE = [['duplicate', 'Duplicate', '⌘D'], ['copy', 'Copy', '⌘C'], ['paste', 'Paste', '⌘V'], ['flip-h', 'Flip horizontally', ''], ['flip-v', 'Flip vertically', ''], ['invert', 'Invert selection', ''], ['to-pattern', 'Turn into pattern', '']];
const moreMenu = () => MORE.map(([v, l, key]) => `<button class="c-reset c-menu__item" data-sel-more="${v}">${l}${key ? `<span class="c-menu__meta">${key}</span>` : ''}</button>`).join('');
document.addEventListener('click', (e) => {
  const t = e.target;
  if (selPop && !selPop.el.contains(t) && !selPop.btn.contains(t)) closeSelPop();
  const b = t.closest('[data-selbar]');
  if (b) {
    const part = b.dataset.selbar;
    if (selPop?.btn === b) { closeSelPop(); return; }
    if (part === 'stitch') openSelPop(b, 'stitch', selStitchTiles());
    if (part === 'colour' && MIXED_MENU.variant === 'groups' && (selbarState().mixedColour || selbarState().mixedStitch)) { openSelPop(b, 'stitch', selStitchTiles()); return; }
    if (part === 'colour' && selbarState().mixedColour) { openSelPop(b, 'colour', selColourMenu()); return; }
    if (part === 'colour') {
      if (pop?.trigger === b) { closePop(); return; }
      let first = true;
      openPicker(b, selbarState().colour, (hex) => { if (ed.selection().size) { ed.restyleSelection({ color: up(hex) }, { history: first }); first = false; } });
    }
    if (part === 'outline') { fadeChange(() => { const was = selectionOutline(); if (was) removeOutline(was); else addOutline(ed.selectionKeys()); syncOutline(); }); replaceSection('outline', outlineSection()); renderSelbar(); }
    if (part === 'hide') fadeChange(() => ed.hideInSelection(null, !selbarState().hidden));
    if (part === 'delete') { const n = ed.selection().stitches; fadeChange(() => ed.deleteInSelection(null)); toast(`Deleted ${n.toLocaleString('en')} stitches`); }
    if (part === 'more') openSelPop(b, 'more', moreMenu());
    renderSelbar();
    return;
  }
  const tile = t.closest('[data-sel-kind]');
  if (tile) {
    const kind = KINDS[Number(tile.dataset.selKind)][2], only = selPop?.only ?? null;
    if (MIXED_MENU.variant === 'groups' && only?.includes('|')) {
      const [k, c] = only.split('|');
      fadeChange(() => ed.restyleSelection({ kind, only: k, onlyColour: c }));
      selPop.only = `${kind}|${c}`;
    } else {
      fadeChange(() => ed.restyleSelection({ kind, only }));
      // the changed stitches are now that kind: keep them chosen, so the next tile changes them again
      if (selPop && only) selPop.only = kind;
    }
    queueMicrotask(redrawSelPop);
    return;
  }
  const oRow = t.closest('[data-sel-only]');
  if (oRow && selPop) { selPop.only = oRow.dataset.selOnly || null; selPop.drop = false; redrawSelPop(); return; }
  if (t.closest('[data-sel-drop]') && selPop) { selPop.drop = !selPop.drop; redrawSelPop(); return; }
  const gKind = t.closest('[data-grp-kind]');
  if (gKind && selPop) { selPop.only = selPop.only === gKind.dataset.grpKind ? null : gKind.dataset.grpKind; redrawSelPop(); return; }
  const gCol = t.closest('[data-grp-colour]');
  if (gCol && selPop) {
    const [k, c] = gCol.dataset.grpColour.split('|'), btn = selPop.btn;
    closeSelPop();
    let cur = c, grab = null;
    openPicker(btn, c, (hex) => { hex = up(hex); if (hex === cur) return; grab ||= ed.grabColour(cur, { within: true, kind: k }); grab.set(hex); cur = hex; });
    return;
  }
  const cRow2 = t.closest('[data-sel-colour]');
  if (cRow2 && selPop) {
    const hex = cRow2.dataset.selColour, btn = selPop.btn;
    closeSelPop();
    if (hex) openRowPicker(btn, 'selection', hex);
    else { let first = true; openPicker(btn, selbarState().colour, (h) => { if (ed.selection().size) { ed.restyleSelection({ color: up(h) }, { history: first }); first = false; } }); }
    return;
  }
  const m = t.closest('[data-sel-more]');
  if (m) {
    const v = m.dataset.selMore;
    closeSelPop();
    ({ duplicate: () => ed.duplicateSelection(), copy: () => { ed.copySelection(); toast('Copied'); }, paste: () => ed.paste(), 'flip-h': () => fadeChange(() => ed.flipSelection(true)), 'flip-v': () => fadeChange(() => ed.flipSelection(false)),
      invert: () => ed.invertSelection(), 'to-pattern': () => { ed.selectionToPattern(); toast('Turned into pattern squares'); } })[v]?.();
    renderSelbar();
  }
});

// ─── the picture: chosen or dropped; the pop-up turns it into the pattern (and stitches) on the cloth ───
function choosePicture(file) {
  if (!file?.type?.startsWith('image/')) return;
  const img = new Image();
  img.onload = () => {
    closePop();
    picture.el?.remove(); picture.popup?.destroy();
    picture.image = img; picture.name = file.name || 'Pasted picture'; picture.hidden = false;
    const el = document.createElement('div'); el.className = 'c-pop c-pop--side'; el.hidden = true; document.body.append(el);
    picture.el = el;
    picture.fit = [...ed.grid()];
    picture.popup = createPicturePopup(el, {
      image: img, name: picture.name, fit: picture.fit,
      options: () => ({ outline: !!wholeOutline(), outlineStrength: (wholeOutline()?.detail ?? 50) / 100 }),
      onChange: placeOnCloth,
      onClose: () => closePop(),
      onAction: (a, on) => {
        if (a === 'remove') removePicture();
        if (a === 'compare') compare(on);
        if (a === 'crop') { if (on) startCrop(); else endCrop(false); }
      },
    });
    replaceSection('pattern', patternSection());
    syncOutline();
    openPicture();
    toast(`${picture.name} is on the cloth`);
  };
  img.src = URL.createObjectURL(file);
}
// the conversion, placed in the middle of the cloth: stitched over its pattern, or the pattern alone (Add stitches)
function placeOnCloth(res) {
  const whole = wholeOutline();
  if (whole && whole.edges === 'outside') {
    const inside = (x, y) => res.blocks.has(`${x},${y}`);
    res = { ...res, backs: res.backs.filter((b) => { const v = b.a[0] === b.b[0], [x, y] = b.a; return !(v ? inside(x - 1, y) && inside(x, y) : inside(x, y - 1) && inside(x, y)); }) };
  }
  ed.placePicture(res, { stitched: picture.popup ? picture.popup.state.stitched !== false : true, name: picture.name });
  if (whole) styleOutline();
  const img = $('panel').querySelector('[data-picture] img'); if (img && picture.popup) img.src = picture.popup.thumb();
}
function openPicture() {
  const trigger = $('panel').querySelector('[data-picture]');
  if (!picture.popup || !trigger) return;
  closePop();
  picture.el.hidden = false; trigger.classList.add('is-open');
  pop = { el: picture.el, trigger, keep: true };
  pop.resize = place(picture.el, trigger);
}
function removePicture() {
  closePop(); picture.popup?.destroy(); picture.el?.remove();
  Object.assign(picture, { image: null, name: '', popup: null, el: null });
  ed.clearPicture();
  replaceSection('pattern', patternSection()); renderBar(); syncOutline();
  toast('Picture removed');
}
function styleOutline() { const w = wholeOutline(); if (picture.popup && w) ed.styleOutline({ color: w.match ? null : w.hex, strands: w.strands }); syncOutline(); }
// With a picture on the cloth its conversion draws the outline (Detail sets how much); without one, the editor draws a
// live outline round whatever is stitched, in the Outline section's colour, strands, edges and stitch
function syncOutline() {
  ed.setOutlines(outlines.filter((o) => !o.hidden && (o.area || !picture.popup)).map((o) => ({ color: o.hex, match: o.match, strands: o.strands, edges: o.edges, kind: o.stitch, area: o.area })));
  const list = $('panel').querySelector('[data-outline-list]'); if (list) list.innerHTML = outlineRows();
}

// compare: the picture laid over its stitching while held
let compareEl = null;
function compare(on) {
  compareEl?.remove(); compareEl = null;
  const r = on && ed.pictureRect(), src = picture.popup?.source();
  if (!r || !src) return;
  compareEl = document.createElement('img');
  compareEl.src = src.toDataURL();
  Object.assign(compareEl.style, { position: 'absolute', left: `${r[0]}px`, top: `${r[1]}px`, width: `${r[2]}px`, height: `${r[3]}px`, pointerEvents: 'none', zIndex: 5 });
  $('stage').append(compareEl);
}

// crop: the whole picture over the cloth with a frame; drag its corners or move it; Enter keeps it, Escape doesn't
let crop = null;
function startCrop() {
  const img = picture.popup?.turned(); if (!img) return;
  const cv = document.createElement('canvas'); cv.className = 'st-crop';
  Object.assign(cv.style, { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 6, touchAction: 'none', cursor: 'move' });
  $('stage').append(cv);
  const bar = document.createElement('div');
  bar.className = 'c-bar c-bar--pill';
  Object.assign(bar.style, { position: 'absolute', left: '50%', bottom: 'var(--space-16)', transform: 'translateX(-50%)', zIndex: 7, gap: 'var(--space-8)', padding: 'var(--space-6)' });
  bar.innerHTML = `<button class="c-reset c-btn c-btn--secondary c-focus" data-crop="cancel" data-tip="Cancel" data-tip-key="Esc">Cancel</button><button class="c-reset c-btn c-btn--primary c-focus" data-crop="done" data-tip="Crop" data-tip-key="Enter">Done</button>`;
  $('stage').append(bar);
  crop = { cv, bar, img, rect: { ...picture.popup.state.crop }, drag: null, view: null };
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-crop]'); if (b) endCrop(b.dataset.crop === 'done'); });
  cv.addEventListener('pointerdown', cropDown); cv.addEventListener('pointermove', cropMove); cv.addEventListener('pointerup', () => { if (crop) crop.drag = null; });
  drawCrop();
}
function drawCrop() {
  const { cv, img, rect: k } = crop, box = cv.getBoundingClientRect(), d = devicePixelRatio || 1, x = cv.getContext('2d');
  cv.width = box.width * d; cv.height = box.height * d; x.setTransform(d, 0, 0, d, 0, 0);
  const s = Math.min((box.width - 96) / img.width, (box.height - 160) / img.height), w = img.width * s, h = img.height * s, ox = (box.width - w) / 2, oy = (box.height - 64 - h) / 2;
  crop.view = { ox, oy, w, h };
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, box.width, box.height);
  x.drawImage(img, ox, oy, w, h);
  const X = ox + k.x * w, Y = oy + k.y * h, W = k.w * w, H = k.h * h;
  x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.rect(ox, oy, w, h); x.rect(X, Y, W, H); x.fill('evenodd');
  x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.strokeRect(X, Y, W, H);
  x.fillStyle = '#fff'; for (const [a, b] of [[X, Y], [X + W, Y], [X, Y + H], [X + W, Y + H]]) x.fillRect(a - 5, b - 5, 10, 10);
}
function cropDown(e) {
  const { ox, oy, w, h } = crop.view, k = crop.rect, px = (e.offsetX - ox) / w, py = (e.offsetY - oy) / h;
  const near = (a, b) => Math.abs((a - px) * w) < 12 && Math.abs((b - py) * h) < 12;
  const corner = [[k.x, k.y, 'tl'], [k.x + k.w, k.y, 'tr'], [k.x, k.y + k.h, 'bl'], [k.x + k.w, k.y + k.h, 'br']].find(([a, b]) => near(a, b));
  crop.drag = { mode: corner ? corner[2] : px > k.x && px < k.x + k.w && py > k.y && py < k.y + k.h ? 'move' : null, px, py, start: { ...k } };
  if (crop.drag.mode) crop.cv.setPointerCapture(e.pointerId);
}
function cropMove(e) {
  if (!crop?.drag?.mode) return;
  const { ox, oy, w, h } = crop.view, px = (e.offsetX - ox) / w, py = (e.offsetY - oy) / h, s = crop.drag.start, dx = px - crop.drag.px, dy = py - crop.drag.py, min = 0.08;
  let { x, y, w: cw, h: ch } = s;
  if (crop.drag.mode === 'move') { x = Math.min(1 - cw, Math.max(0, s.x + dx)); y = Math.min(1 - ch, Math.max(0, s.y + dy)); }
  else {
    let x2 = s.x + s.w, y2 = s.y + s.h;
    if (crop.drag.mode.includes('l')) x = Math.min(x2 - min, Math.max(0, s.x + dx)); else x2 = Math.max(x + min, Math.min(1, x2 + dx));
    if (crop.drag.mode.includes('t')) y = Math.min(y2 - min, Math.max(0, s.y + dy)); else y2 = Math.max(y + min, Math.min(1, y2 + dy));
    cw = x2 - x; ch = y2 - y;
  }
  crop.rect = { x, y, w: cw, h: ch }; drawCrop();
}
function endCrop(keep) {
  if (!crop) return;
  if (keep) { picture.popup.state.crop = crop.rect; picture.popup.rebuild(); }
  crop.cv.remove(); crop.bar.remove(); crop = null;
  picture.popup.state.cropping = false; picture.el.querySelector('[data-pp="crop"]')?.setAttribute('aria-pressed', 'false');
}
addEventListener('keydown', (e) => { if (!crop) return; if (e.key === 'Enter') endCrop(true); if (e.key === 'Escape') { e.stopPropagation(); endCrop(false); } }, true);

// ─── events ──────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const t = e.target;
  if (pop && !e.composedPath().includes(pop.el) && !pop.trigger?.contains(t) && !t.closest('.c-menu--float')) closePop();
  const tool = t.closest('[data-tool]');
  if (tool) {
    if (tool.dataset.tool === 'picture') { picture.image ? openPicture() : $('file').click(); return; }
    ed.set('tool', tool.dataset.tool); return;
  }
  const z = t.closest('[data-zoom]'); if (z) { if (z.dataset.zoom === 'fit') ed.fit(); else ed.zoomBy(z.dataset.zoom === 'in' ? 1.25 : 0.8); return; }
  const act = t.closest('[data-act]')?.dataset.act;
  if (act === 'clear-selection') { ed.clearSelection(); return; }
  const sec = t.closest('[data-section]');
  if (sec) { const k = sec.dataset.section; secs[k] = secs[k] === false; replaceSection(k, { stitch: stitchSection, thread: threadSection, pattern: patternSection, outline: outlineSection, canvas: canvasSection, eraser: eraserSection }[k]?.() || section(k, k === 'colours' ? colourTitle() : stitchTitle(), `<div data-canvas-${k}>${k === 'colours' ? canvasColourRows() : canvasStitchRows()}</div>`)); return; }
  const tile = t.closest('[data-kind]');
  if (tile) {
    const [, tl, kind] = KINDS[Number(tile.dataset.kind)];
    // with a selection, the tile changes the selected stitches and the selection stays
    if (ed.selection().size) { ed.restyleSelection({ kind }); [...tile.parentNode.children].forEach((x) => x.setAttribute('aria-pressed', x === tile)); return; }
    ed.set(tl === 'fill' ? 'fill' : 'stitch', kind); ed.set('tool', tl); return;
  }
  // thread
  const pick = t.closest('[data-picker]');
  if (pick) {
    if (pop?.trigger === pick) { closePop(); return; }
    // with a selection, the colour is the selection's (its main colour to start) and changing it recolours the selected
    // stitches, one undo step for the whole time the picker is open
    const sel = ed.selection(), selFrom = sel.size ? sel.colours[0]?.[0] : null;
    let firstChange = true;
    if (pick.dataset.picker === 'thread') openPicker(pick, up(selFrom || ed.state.color), (hex) => {
      if (selFrom && ed.selection().size) { ed.restyleSelection({ color: hex }, { history: firstChange }); firstChange = false; } else ed.set('color', hex);
      syncThreadSwatch();
    });
    else openPicker(pick, up(curOutline().hex), (hex) => { curOutline().hex = hex; styleOutline(); pick.querySelector('.c-swatchrow__swatch').innerHTML = `${swatch(hex, { tag: 'span' })}<span>${up(hex)}</span>`; });
    return;
  }
  if (t.closest('[data-thread-eye]')) {
    if (ed.selection().size) { ed.hideInSelection(null, !threadHidden()); syncThreadSwatch(); return; }
    toggleHidden('thread', up(ed.state.color)); replaceSection('thread', threadSection()); return;
  }
  if (t.closest('[data-thread-bin]') && ed.selection().size) { const n = ed.selection().stitches; ed.deleteInSelection(null); toast(`Deleted ${n.toLocaleString('en')} selected stitches`); return; }
  if (t.closest('[data-thread-bin]')) { ed.deleteColour(ed.state.color); toast(`Deleted stitches in ${up(ed.state.color)}`); return; }
  // pattern
  const picBtn = t.closest('[data-picture]'); if (picBtn) { if (!picture.image) $('file').click(); else if (pop?.trigger === picBtn) closePop(); else openPicture(); return; }
  if (t.closest('[data-picture-bin]')) { removePicture(); return; }
  if (t.closest('[data-picture-eye]')) { picture.hidden = !picture.hidden; for (const [h] of ed.patternColours()) ed.hidePattern(h, picture.hidden); for (const [h] of ed.threadColours()) ed.hideColour(h, picture.hidden); replaceSection('pattern', patternSection()); return; }
  if (t.closest('[data-pattern-add]')) { addPatternColour(); return; }
  // a colour row's chip: the picker for that colour
  const art = t.closest('[data-hex] .c-row__art, [data-pattern-hex] .c-row__art');
  if (art) {
    if (pop?.trigger === art) { closePop(); return; }
    const pr = art.closest('[data-pattern-hex]');
    openRowPicker(art, pr ? 'pattern' : colourScope(), pr ? pr.dataset.patternHex : art.closest('[data-hex]').dataset.hex);
    return;
  }
  const pRow = t.closest('[data-pattern-hex]');
  if (pRow && t.closest('[data-pattern-eye]')) { const h = pRow.dataset.patternHex; const on = !hidden.pattern.has(h); toggleHidden('pattern', h); ed.hidePattern(h, on); refreshPiece(); return; }
  if (pRow && t.closest('[data-pattern-bin]')) { const h = pRow.dataset.patternHex; pattern.hand = pattern.hand.filter((x) => x !== h); ed.deleteColour(h, { pattern: true }); toast(`Deleted the ${h} squares`); return; }
  if (pRow && !t.closest('[data-pattern-opacity]') && t.closest('.c-field--split')) { pattern.active = pRow.dataset.patternHex; ed.set('color', pattern.active); ed.set('tool', 'pattern'); refreshPiece(); replaceSection('thread', threadSection()); return; }
  // outline
  if (t.closest('[data-outline-add]')) {
    const sel = ed.selection().size, o = addOutline(sel ? ed.selectionKeys() : null);
    replaceSection('outline', outlineSection()); if (!o.area) picture.popup?.rebuild(); syncOutline(); renderSelbar(); return;
  }
  const orow = t.closest('[data-outline-id]');
  if (orow) {
    const o = outlines.find((x) => x.id === +orow.dataset.outlineId);
    if (t.closest('[data-outline-eye]')) { o.hidden = !o.hidden; if (!o.area) picture.popup?.rebuild(); syncOutline(); return; }
    if (t.closest('[data-outline-bin]')) { removeOutline(o); replaceSection('outline', outlineSection()); syncOutline(); renderSelbar(); toast(`Removed the ${o.name.toLowerCase()} outline`); return; }
    // a row makes that outline the one the settings below change, and selects its area on the cloth
    currentOutline = o.id;
    if (o.area) ed.selectCells(o.area); else ed.clearSelection();
    replaceSection('outline', outlineSection()); return;
  }
  const os = t.closest('[data-outline-stitch]'); if (os) { curOutline().stitch = os.dataset.outlineStitch; syncOutline(); return; }
  const fab = t.closest('[data-fabric] .c-fabric'); if (fab) { ed.set('surface', fab.dataset.value); return; }
  const cv = t.closest('[data-coverage] .c-seg__opt'); if (cv) { ed.set('count', Number(cv.dataset.value)); return; }
  const sm = t.closest('[data-sheet-menu]'); if (sm) { openSheetMenu(sm); return; }
  const sp = t.closest('[data-sheet-pick]');
  if (sp) {
    closeSheetMenu();
    if (sp.dataset.sheetPick === 'custom') sheetCustom = true;
    else { sheetCustom = false; const [w, h] = sp.dataset.sheetPick.split('x').map(Number); resheet(w, h); }
    replaceSection('canvas', canvasSection()); return;
  }
  if (sheetMenu && !t.closest('.c-menu--float')) closeSheetMenu();
  const ew = t.closest('[data-erase-what] .c-seg__opt'); if (ew) { ed.set('eraseWhat', ew.dataset.value); return; }
  const om = t.closest('[data-outline-match] .c-seg__opt'); if (om) { curOutline().match = om.dataset.value === 'match'; $('panel').querySelector('[data-outline-one]').hidden = curOutline().match; styleOutline(); return; }
  const oe = t.closest('[data-outline-edges] .c-seg__opt'); if (oe) { const o = curOutline(); o.edges = oe.dataset.value; if (!o.area) picture.popup?.rebuild(); syncOutline(); return; }
  // canvas colours and stitches
  const cRow = t.closest('[data-hex]');
  const inSel = colourScope() === 'selection';
  if (cRow && t.closest('[data-colour-eye]')) {
    const h = cRow.dataset.hex;
    if (inSel) { ed.hideInSelection(h, !cRow.classList.contains('is-hidden')); return; }
    const on = !hidden.thread.has(h); toggleHidden('thread', h); ed.hideColour(h, on); refreshPiece(); return;
  }
  if (cRow && t.closest('[data-colour-bin]')) { const h = cRow.dataset.hex; inSel ? ed.deleteInSelection(h) : ed.deleteColour(h); toast(`Deleted ${inSel ? 'selected ' : ''}stitches in ${h}`); return; }
  if (cRow && t.closest('.c-field__cell--count')) { ed.selectColour(cRow.dataset.hex, { within: inSel }); toast(`Selected ${cRow.dataset.hex}`); return; }
  const kRow = t.closest('[data-stitch-kind]');
  if (kRow && t.closest('[data-kind-bin]')) { ed.deleteKind(kRow.dataset.stitchKind, { within: colourScope() === 'selection' }); return; }
  if (kRow && t.closest('.c-field--split')) { ed.selectKind(kRow.dataset.stitchKind, { within: colourScope() === 'selection' }); return; }
});
const toggleHidden = (set, h) => { hidden[set].has(h) ? hidden[set].delete(h) : hidden[set].add(h); if (set === 'thread') ed.hideColour(h, hidden.thread.has(h)); };
// a colour to place squares with: the Thread colour first, then a default not in the pattern yet; picked and selected
const PATTERN_DEFAULTS = ['--leaf-500', '--periwinkle-400', '--ochre-300', '--lilac-400', '--crimson-500', '--neutral-950', '--terracotta-300', '--leaf-300'];
function addPatternColour() {
  const have = new Set([...ed.patternColours().map(([h]) => h), ...pattern.hand]);
  const hex = [ed.state.color, ...PATTERN_DEFAULTS].map(up).find((h) => !have.has(h));
  if (!hex) { toast('Every default colour is in the pattern: pick another in Thread'); return; }
  pattern.hand.push(hex); pattern.active = hex;
  ed.set('color', hex); ed.set('tool', 'pattern');
  replaceSection('pattern', patternSection()); replaceSection('thread', threadSection());
  toast(`Placing squares in ${hex}`);
}
// canvas colours: type a new hex over a colour and every stitch in it changes
document.addEventListener('focusout', (e) => {
  const input = e.target.closest?.('[data-hex-edit]'); if (!input) return;
  const row = input.closest('[data-hex]'), hex = parseHex(input.value);
  if (hex && up(hex) !== row.dataset.hex) {
    if (colourScope() === 'selection') { ed.recolourSelection(row.dataset.hex, up(hex), { pattern: false }); refreshPiece(); toast(`Changed ${row.dataset.hex} to ${up(hex)} in the selection`); }
    else { ed.recolourAll(row.dataset.hex, up(hex)); toast(`Changed ${row.dataset.hex} to ${up(hex)}`); }
  } else input.value = row.dataset.hex;
});
document.addEventListener('keydown', (e) => {
  const input = e.target.closest?.('[data-hex-edit], [data-pattern-op]'); if (!input) return;
  if (e.key === 'Enter') input.blur();
  if (e.key === 'Escape' && input.matches('[data-hex-edit]')) { input.value = input.closest('[data-hex]').dataset.hex; input.blur(); }
  if (input.matches('[data-pattern-op]') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); setOpacity(input.closest('[data-pattern-hex]'), Number(input.value) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
});
document.addEventListener('change', (e) => { const sh = e.target.closest?.('[data-sheet]'); if (sh) { resheet(sh.dataset.sheet === 'w' ? Number(sh.value) : null, sh.dataset.sheet === 'h' ? Number(sh.value) : null); sheetCustom = false; const v = $('panel').querySelector('[data-sheet-menu] .c-select__value'); if (v) v.textContent = sheetNow()?.[0] || 'Custom'; } });
document.addEventListener('keydown', (e) => {
  const sh = e.target.closest?.('[data-sheet]'); if (!sh) return;
  if (e.key === 'Enter') sh.blur();
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const v = Number(sh.value) + (e.key === 'ArrowUp' ? 10 : -10) * (e.shiftKey ? 10 : 1); resheet(sh.dataset.sheet === 'w' ? v : null, sh.dataset.sheet === 'h' ? v : null); }
});
// the zoom field: typed (Enter or leaving), arrow keys ±10 (shift ±50), Escape puts the zoom back
document.addEventListener('change', (e) => { const z = e.target.closest?.('[data-zoom-value]'); if (z) { zoomToPercent(Number(z.value)); if (!(Number(z.value) > 0)) z.value = Math.round((view?.fit ?? 1) * 100); } });
document.addEventListener('keydown', (e) => {
  const z = e.target.closest?.('[data-zoom-value]'); if (!z) return;
  if (e.key === 'Enter') z.blur();
  if (e.key === 'Escape') { z.value = Math.round((view?.fit ?? 1) * 100); z.blur(); }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(10, Math.round((view?.fit ?? 1) * 100) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 50 : 10)); z.value = v; zoomToPercent(v); }
});
document.addEventListener('change', (e) => { const input = e.target.closest?.('[data-pattern-op]'); if (input) setOpacity(input.closest('[data-pattern-hex]'), Number(input.value)); });
// pattern opacity: drag up or down on the number (a step every 2px), or type, or arrow keys
function setOpacity(row, v) {
  if (!Number.isFinite(v)) v = pattern.opacity[row.dataset.patternHex] ?? 100;
  v = Math.max(0, Math.min(100, Math.round(v)));
  pattern.opacity[row.dataset.patternHex] = v;
  ed.setPatternOpacity(row.dataset.patternHex, v / 100);
  row.querySelector('[data-pattern-op]').value = v;
  row.querySelector('.c-field__op').innerHTML = opacitySquare(v, { size: 16 });
}
let opDrag = null;
document.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('[data-pattern-opacity]'), input = cell?.querySelector('input');
  if (!cell || document.activeElement === input) return;
  e.preventDefault();
  opDrag = { row: cell.closest('[data-pattern-hex]'), input, y: e.clientY, from: Number(input.value), moved: false };
});
addEventListener('pointermove', (e) => {
  if (!opDrag) return;
  const dy = opDrag.y - e.clientY; if (!opDrag.moved && Math.abs(dy) < 3) return;
  opDrag.moved = true; document.body.style.cursor = 'ns-resize';
  setOpacity(opDrag.row, opDrag.from + dy / 2);
});
addEventListener('pointerup', () => { if (!opDrag) return; if (!opDrag.moved) { opDrag.input.focus(); opDrag.input.select(); } opDrag = null; document.body.style.cursor = ''; });
$('file').addEventListener('change', (e) => { choosePicture(e.target.files[0]); e.target.value = ''; });

// ─── start: the starter calla lilies on the cloth, the panel and the bars drawn ───
ed.starter();
picture.name = 'Calla lilies';
renderFloating();
renderBar();
renderPanel();
createTooltips();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => ed.redraw());
requestAnimationFrame(() => ed.fit());

// ─── the selection is being edited (the fill clears so its stitches show true): the pointer on the panel or a pop-up, the colour picker open, or a dial's change under way
let changing = false, overPanel = false;
const syncEditing = () => ed.setSelectionEditing(changing || overPanel || !!document.querySelector('.c-pop--side:not([hidden])'));
document.addEventListener('pointerover', (e) => { const on = !!e.target.closest?.('#panel, .c-pop, .st-selbar, .st-selpop'); if (on !== overPanel) { overPanel = on; syncEditing(); } });
new MutationObserver(syncEditing).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

// ─── dials (DialKit, bottom left): try design choices live ──────────────────
import('https://cdn.jsdelivr.net/npm/dialkit@2.0.0/dist/vanilla/index.js').then(({ createDialKit, createDialRoot }) => {
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = 'https://cdn.jsdelivr.net/npm/dialkit@2.0.0/dist/vanilla/styles.css'; document.head.append(style);
  createDialRoot({ position: 'bottom-left', defaultOpen: false });   // bottom left: the feedback toolbar has the bottom right
  // where Cell size's − and + go (CELL_SIZE in cell-size.js), redrawn in place
  const ck = createDialKit('Cell size', { layout: { type: 'select', label: 'Minus and plus', options: CELL_LAYOUTS.map(([value, label]) => ({ value, label })), default: CELL_SIZE.layout } }, { id: 'selvedge-cell-size', persist: true });
  const cellLayout = (v) => { CELL_SIZE.layout = v.layout; $('panel').querySelectorAll('[data-cellsize]').forEach((el) => { el.outerHTML = cellSizeHtml(ed.sheet().cell); }); wireCellSize($('panel'), { get: () => ed.sheet().cell, set: (n) => resheet(null, null, n) }); };
  cellLayout(ck.getValues()); ck.subscribe(cellLayout);
  // the selection's colour: the primary, or a colour that stays clear of warm thread
  const SEL_COLOURS = { primary: () => hexOf('--primary'), blue: () => '#1E6FE8', ink: () => hexOf('--text-strong') };
  // how the selection shows (setSelectionLook in lab/editor.js); Select sample selects the same patch every time to compare them
  const LOOKS = [['halo-dim', '1 · Halo + dim outside'], ['thick-fill', '2 · 2px + light fill'], ['ants-dim', '3 · Marching ants + dim'], ['halo-fill', '4 · Halo + light fill']];
  const sk = createDialKit('Selection', {
    look: { type: 'select', label: 'Look', options: LOOKS.map(([value, label]) => ({ value, label })), default: 'thick-fill' },
    colour: { type: 'select', label: 'Colour', options: [{ value: 'primary', label: 'Primary (terracotta)' }, { value: 'blue', label: 'Blue' }, { value: 'ink', label: 'Ink' }], default: 'primary' },
    fill: { type: 'select', label: 'Fill shows', options: [{ value: 'edit-dim', label: 'A + dim · Clears, outside dims while editing' }, { value: 'edit', label: 'A · Clears while editing' }, { value: 'fade', label: 'B · Fades after selecting' }, { value: 'always', label: 'Always' }], default: 'edit-dim' },
    holdAltForNoDim: true,
    sample: { type: 'action', label: 'Select sample' },
    change: { type: 'action', label: 'Change colour' },
  }, { id: 'selvedge-selection-2', persist: true, onAction: (a) => {
    if (a.endsWith('change')) { changeSample(); return; }
    if (!a.endsWith('sample')) return;
    // the top of the lily: a rectangle over its edge and some empty cloth, a third of the way in
    const [c, r] = ed.grid();
    ed.selectArea(Math.round(c * 0.3), Math.round(r * 0.08), Math.round(c * 0.55), Math.round(r * 0.4));
  } });
  // how a mixed selection's pop-up lists what's in it (MIXED_MENU), with Select sample to try each on the same patch
  const mk = createDialKit('Mixed menu', {
    variant: { type: 'select', label: 'Variant', options: [{ value: 'list', label: 'A · List' }, { value: 'select', label: 'B · Dropdown' }, { value: 'pills', label: 'C · Pills' }, { value: 'groups', label: 'D · Stitch and colour groups' }], default: 'pills' },
    sampleStitches: { type: 'select', label: 'Sample stitches', options: [{ value: 'asis', label: 'As stitched' }, ...[2, 3, 4, 5, 6, 8].map((n) => ({ value: String(n), label: `${n} kinds` }))], default: 'asis' },
    sample: { type: 'action', label: 'Select sample' },
  }, { id: 'selvedge-mixed-menu-2', persist: true, onAction: (a) => { if (a.endsWith('sample')) selectSample(mk.getValues().sampleStitches); } });
  // the sample patch, as stitched, or restitched in n bands of different stitches (one undo step each) to see the menu with that many kinds
  const SAMPLE_KINDS = ['full', 'columns', 'half', 'rows', 'hatch', 'seed', 'threeq', 'blocks'];
  function selectSample(types) {
    const [c, r] = ed.grid(), x0 = Math.round(c * 0.3), y0 = Math.round(r * 0.08), x1 = Math.round(c * 0.55), y1 = Math.round(r * 0.4);
    const n = Number(types) || 0;
    for (let i = 0; i < n; i++) {
      ed.selectArea(x0 + Math.floor((x1 - x0 + 1) * i / n), y0, x0 + Math.floor((x1 - x0 + 1) * (i + 1) / n) - 1, y1);
      ed.restyleSelection({ kind: SAMPLE_KINDS[i] });
    }
    ed.selectArea(x0, y0, x1, y1);
  }
  const mixedMenu = (v) => { MIXED_MENU.variant = v.variant; if (selPop) { selPop.only = null; selPop.drop = false; redrawSelPop(); } };
  mixedMenu(mk.getValues()); mk.subscribe(mixedMenu);
  const selColour = (v) => { ed.setSelectionLook(v.look); ed.setAccent((SEL_COLOURS[v.colour] || SEL_COLOURS.primary)()); ed.setSelectionFill(v.fill, v.holdAltForNoDim); };
  // Change colour: recolour the selection's main colour to the next of a few threads, as the colour picker would, and
  // count as editing for a moment, so the fill clears as it would while you pick
  const CHANGE = ['#3E7CB1', '#E0A030', '#4F8A4B', '#8E1D24', '#7A5BA6'];
  let changeAt = 0, changeT = 0;
  function changeSample() {
    const sel = ed.selection();
    if (!sel.size) { toast('Select something first'); return; }
    const from = sel.colours[0]?.[0];
    if (!from) return;
    const to = CHANGE[changeAt++ % CHANGE.length];
    changing = true; syncEditing();
    ed.recolourSelection(from, to);
    clearTimeout(changeT); changeT = setTimeout(() => { changing = false; syncEditing(); }, 1400);
  }
  selColour(sk.getValues()); sk.subscribe(selColour);
}).catch(() => {});
