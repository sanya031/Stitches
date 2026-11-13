// The thread colour picker: one popover for every way a colour is chosen. Top to bottom:
//   pills      Custom (any colour), Extract (pull colours from an image), Saved (palettes)
//   preview    the colour as thread on cloth: 2 × 2 of the chosen stitch on the chosen fabric (icon dropdowns)
//   body       the pill's own part: the colour field and hue (with the eyedropper), a drop zone, or palettes
//   value      the colour as text in a field, in a notation from a dropdown (Hex, RGB, HSL)
//   on canvas  the colours already stitched, always there: reusing one is the most common pick
// Colours sit in pans, like a set of paints: one block of small boxes with no gaps, filled or empty; hover rings a box
// and its tooltip gives the hex.
// Built from the system's parts (segmented pill, field, select, menu, tile grid, button, drop zone);
// styled by the colour-picker and colour-preview blocks of controls.css.
// colourPickerHtml(state) draws it held still (the Controls tab); createColourPicker(root, options) makes it live.
import { svg } from './icons/icons.js';
import { threadSvg } from './icons/thread.js';
import { PRIMITIVES, primitiveSvg } from './icons/primitives.js';
import { fieldHtml, hueHtml, createColourField, hexOf, NOTATIONS, formatColour, parseColour, colourParts, colourFromParts } from './colour-field.js';

// the fabrics a canvas can be, as the lab draws them (lab/main.js SURFACES)
export const FABRICS = [['dots', 'Dot grid', '#F2EEE6'], ['aida', 'Aida', '#F4F2EC'], ['linen', 'Linen', '#D9CCB2'], ['denim', 'Denim', '#3C5A86']];
// one per stitch type, as in the panel's stitch grid
const STITCHES = Object.keys(PRIMITIVES).filter((n) => !/-(tr|bl|br)$/.test(n)).sort((x, y) => (x.startsWith('fill') - y.startsWith('fill')));
const PILLS = [['custom', 'Custom'], ['extract', 'Extract'], ['saved', 'Saved']];
const MODES = NOTATIONS;
const PARTS = { rgb: ['Red', 'Green', 'Blue'], hsl: ['Hue', 'Saturation', 'Lightness'] };
const PART_MAX = { rgb: [255, 255, 255], hsl: [360, 100, 100] };

const ic = (n) => `<span class="c-ic">${svg(n)}</span>`;
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const label = (list, v) => list.find(([k]) => k === v)?.[1] ?? v;
const stitchName = (n) => PRIMITIVES[n].label.replace(/, top left$/, '');
let uid = 0;
const PAN_ROW = 10;
const pan = (hex, current) => `<button class="c-reset c-pan c-focus ${hex === current ? 'is-selected' : ''}" style="--pan:${hex}" data-pk-pick="${hex}" data-tip="${hex}" aria-label="${hex}"><span class="c-pan__colour"></span></button>`;
// a set of pans: the colours, then empty pans to the end of the row (at least `rows` rows); an empty pan can add the colour
// del: each colour gets a small cross on hover that removes it (the colours pulled from an image)
// slots: every empty pan takes the colour in hand when tapped (the palette in Custom); the first shows a plus, and
// hovering one shows the colour it would take
export const pans = (cs, current, { add = null, rows = 1, lead = '', del = false, pal = null, slots = false } = {}) => {
  const used = cs.length + (add != null ? 1 : 0) + (lead ? 1 : 0), n = Math.max(PAN_ROW * rows, Math.ceil((used + (slots ? 1 : 0)) / PAN_ROW) * PAN_ROW);
  const empty = Array.from({ length: n - used + (add != null ? 1 : 0) }, (_, i) => (slots
    ? `<button class="c-reset c-pan c-pan--slot c-focus ${i === 0 ? 'is-next' : ''}" data-pk-slot data-tip="Add this colour" aria-label="Add this colour">${ic('plus')}</button>`
    : add != null && i === 0
    ? `<button class="c-reset c-pan c-pan--add c-focus" data-pk-add="${add}" data-tip="Add this colour" aria-label="Add this colour">${ic('plus')}</button>`
    : '<span class="c-pan is-empty"></span>'));
  const one = (h) => (del ? `<span class="c-panwrap">${pan(h, current)}<button class="c-reset c-pan__del c-focus" aria-label="Remove ${h}" data-tip="Remove" data-pk-del="${h}"${pal != null ? ` data-pk-pal="${pal}"` : ''}>${ic('close')}</button></span>` : pan(h, current));
  return `<div class="c-pans">${lead}${cs.map(one).join('')}${empty.join('')}</div>`;
};

export const DEFAULTS = { hex: '#B84216', tab: 'custom', notation: 'hex', stitch: 'stitch-full', fabric: 'aida', canvas: [], saved: [], extracted: null, image: null, extractSaved: false, paletteName: '', extractLayout: 'card', extractBottom: 'both', canvasOpen: true, canvasOpenExtract: false, canvasOpenSaved: false, savedHere: false, savedOpenExtract: false, palette: null, paletteOut: false, palHover: false, menu: null };

// ─── the parts, each a region that redraws on its own ────────────────────────
const head = (s) => `<div class="c-picker__head"><div class="c-seg c-seg--soft" role="group" aria-label="Colour source" data-pill>${PILLS.map(([v, l]) => `<button class="c-reset c-seg__opt c-focus" aria-pressed="${v === s.tab}" data-value="${v}" data-label="${l}" data-pk-tab="${v}">${l}</button>`).join('')}</div>`
  + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Close" data-tip="Close" data-tip-key="Esc" data-pk="close">${ic('close')}</button></div>`;

const fabricOf = (s) => FABRICS.find(([k]) => k === s.fabric) || FABRICS[1];
// two by two stitches; on the dot grid the holes are the printed dots, so they show in full
const previewArt = (s) => threadSvg(s.stitch, { colour: s.hex, size: 84, frame: 'patch', n: 2, holes: s.fabric === 'dots' ? 1 : 0.35, id: `pk${uid++}` });
const preview = (s) => `<div class="c-preview" style="--cloth:${fabricOf(s)[2]}"><span class="c-preview__art" data-pk-region="art">${previewArt(s)}</span>`
  + `<div class="c-preview__opts">`
  + `<button class="c-reset c-chip c-focus ${s.menu === 'stitch' ? 'is-open' : ''}" data-pk-menu="stitch" aria-haspopup="true" aria-label="Stitch: ${stitchName(s.stitch)}" data-tip="Stitch: ${stitchName(s.stitch)}">${primitiveSvg(s.stitch, { size: 20, id: `pkc${uid++}`, animate: false })}${ic('chevron-down')}</button>`
  + `<button class="c-reset c-chip c-focus ${s.menu === 'fabric' ? 'is-open' : ''}" data-pk-menu="fabric" aria-haspopup="true" aria-label="Fabric: ${fabricOf(s)[1]}" data-tip="Fabric: ${fabricOf(s)[1]}">${ic(`canvas-${fabricOf(s)[0]}`)}${ic('chevron-down')}</button>`
  + `</div></div>`;

// ─── Extract, once an image is in: three ways to lay out the image, its colours, the palette's name and Save ───
const thumb = (s, cls = '') => (s.image ? `<img class="${cls}" src="${s.image.url}" alt="" data-tip="${esc(s.image.name)}">` : '');
const nameInput = (s) => `<input class="c-picker__name" value="${esc(s.paletteName)}" placeholder="Palette name" aria-label="Palette name" spellcheck="false" autocomplete="off" data-pk-name>`;
const saveWords = (s) => `<button class="c-reset c-picker__save c-focus ${s.extractSaved ? 'is-saved' : ''}" data-pk="save-extract"${s.extractSaved ? ' aria-disabled="true"' : ''}><span class="c-picker__save-a" data-label="Save palette">Save palette</span><span class="c-picker__save-b">${ic('check')}Saved</span></button>`;
// Save as an icon: a bookmark with a Save palette tooltip, that turns into a tick (Saved) once saved
const saveIcon = (s) => `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus c-picker__saveicon ${s.extractSaved ? 'is-saved' : ''}" data-pk="save-extract" aria-label="${s.extractSaved ? 'Saved' : 'Save palette'}" data-tip="${s.extractSaved ? 'Saved' : 'Save palette'}"${s.extractSaved ? ' aria-disabled="true"' : ''}>${ic('bookmark')}${ic('check')}</button>`;
const removeImage = `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Remove image" data-tip="Remove image" data-pk="remove-image">${ic('bin')}</button>`;
export const EXTRACT_LAYOUTS = {
  // two rows, each with its action after it in one column: the image and the palette's name, then the bin; the
  // colours, then Save (an icon)
  stack: (s) => `<div class="c-picker__palrow"><div class="c-picker__image">${thumb(s)}${nameInput(s)}</div>${removeImage}</div><div class="c-picker__palrow">${pans(s.extracted, s.hex, { del: true })}${saveIcon(s)}</div>`,
  // one card: the image, name, Save and the cross in its top row, the colours along its bottom
  card: (s) => `<div class="c-picker__card"><div class="c-picker__cardhead">${thumb(s)}${nameInput(s)}${saveWords(s)}${removeImage}</div>${pans(s.extracted, s.hex, { del: true })}</div>`,
  // two rows: the image as the first box of the colours, then the name with Save and the cross
  strip: (s) => `${pans(s.extracted, s.hex, { del: true, lead: `<span class="c-pan c-pan--image">${thumb(s)}</span>` })}<div class="c-picker__namerow">${nameInput(s)}${saveWords(s)}${removeImage}</div>`,
};
export const EXTRACT_BOTTOMS = ['canvas', 'saved', 'both', 'none'];

const BODY = {
  custom: () => `${fieldHtml()}<div class="c-picker__hue"><button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Pick from the screen" data-tip="${typeof EyeDropper === 'function' ? 'Pick from the screen' : 'Picking from the screen needs Chrome or Edge'}" data-pk="eyedrop"${typeof EyeDropper === 'function' ? '' : ' disabled'}>${ic('eyedropper')}</button>${hueHtml()}</div>`,
  extract: (s) => s.extracted
    ? EXTRACT_LAYOUTS[s.extractLayout]?.(s) ?? EXTRACT_LAYOUTS.stack(s)
    : `<label class="c-drop c-focus" tabindex="0">${ic('picture')}Drop or choose an image to extract its colours<input type="file" accept="image/*" hidden data-pk-file></label>`,
  // each palette's name is a field to rename it; each colour has the hover cross to remove it
  saved: (s) => s.saved.map(([name, cs], i) => `<div class="c-picker__palette"><input class="c-picker__name c-picker__palinput" value="${esc(name)}" placeholder="Palette name" aria-label="Palette name" spellcheck="false" autocomplete="off" data-pk-palname="${i}">${pans(cs, s.hex, { add: i, del: true, pal: i })}</div>`).join('')
    + `<button class="c-reset c-btn c-btn--quiet c-btn--sm c-focus c-picker__new" data-pk="new-palette">${ic('plus')}New palette</button>`,
};

// the field for a notation: Hex is one field, RGB and HSL are one box per number side by side in one field
const valueField = (s) => (PARTS[s.notation]
  ? `<div class="c-fieldgroup" role="group" aria-label="Colour as ${label(MODES, s.notation)}">${colourParts(s.hex, s.notation).map((n, i) => `<input class="c-fieldgroup__cell" value="${n}" inputmode="numeric" aria-label="${PARTS[s.notation][i]}" spellcheck="false" autocomplete="off" data-pk-part="${i}">`).join('')}</div>`
  : `<label class="c-field"><input value="${formatColour(s.hex, s.notation)}" aria-label="Colour as ${label(MODES, s.notation)}" spellcheck="false" autocomplete="off" data-pk-value></label>`);
// the notation's name: every name stacked in one place, so the select is as wide as the widest and never resizes,
// and changing it is a crossfade
const valueNames = (s) => `<span class="c-select__value c-picker__names">${MODES.map(([k, l]) => `<span class="${k === s.notation ? 'is-on' : ''}" data-name="${k}">${l}</span>`).join('')}</span>`;
const value = (s) => `<div class="c-picker__value"><button class="c-reset c-select c-select--compact c-focus ${s.menu === 'notation' ? 'is-open' : ''}" data-pk-menu="notation" aria-haspopup="true" aria-label="Notation: ${label(MODES, s.notation)}">${valueNames(s)}${ic('chevron-down')}</button>`
  + `<div class="c-picker__field" data-pk-region="field">${valueField(s)}</div></div>`;

// A folding section (On canvas, Saved palettes): open, its colours as boxes; folded, one line with colours small at
// its end. key names it ('canvas', 'saved'); minis are the colours on the folded line.
const fold = (key, title, minis, open, body) => `<div class="c-picker__canvas ${open ? 'is-open' : ''}" data-fold="${key}"><button class="c-reset c-picker__fold c-focus" aria-expanded="${open}" data-pk="fold" data-key="${key}"><span class="c-group-label">${title}</span>`
  + `<span class="c-picker__mini" aria-hidden="true">${open ? '' : minis.map((h) => `<i style="--pan:${h}"></i>`).join('')}</span>${ic(open ? 'chevron-down' : 'chevron-right')}</button>${open ? body : ''}</div>`;
const canvasFold = (s, open) => (s.canvas.length ? fold('canvas', 'On canvas', s.canvas, open, pans(s.canvas, s.hex, { rows: 3 })) : '');
// Saved palettes, newest first: folded, the newest palette's colours; open, every palette, one line each
// (only the newest SAVED_SHOWN; the rest are still saved, in the Saved pill)
const SAVED_SHOWN = 3;
const savedFold = (s, open) => (s.saved.length ? fold('saved', 'Saved palettes', s.saved.at(-1)[1], open,
  s.saved.map((p, i) => [p, i]).reverse().slice(0, SAVED_SHOWN).map(([[name, cs], i]) => `<div class="c-picker__palette" data-saved="${i}"><span class="c-picker__palname">${esc(name)}</span>${pans(cs, s.hex)}</div>`).join('')) : '');
// The palette in hand (Custom), as in a paint app: pick a colour with the field, tap an empty pan to keep it in the
// palette; the select above switches palette or starts a new one. palette is an index into saved; none (the start)
// is a new palette, made when its first colour goes in.
// The palette can float: drag its name row out of the picker (it resists, then tears free past FLOAT_TUNING.tear
// px) or press the pop-out button, and it floats over the cloth (floating-palette.js); here a line says it's out,
// with Bring back.
export const palIndex = (s) => (s.saved[s.palette] ? s.palette : -1);
export const palName = (s) => s.saved[palIndex(s)]?.[0] ?? 'New palette';
const palRow = (s) => {
  const i = palIndex(s), p = s.saved[i], name = palName(s);
  if (s.paletteOut) return `<div class="c-picker__canvas c-picker__away" data-palrow><span class="c-picker__awaytext">${esc(name)} is floating</span><button class="c-reset c-picker__bringback c-focus" data-pk="dock">Bring back</button></div>`;
  return `<div class="c-picker__canvas c-picker__palrow-float ${s.palHover ? 'is-hover' : ''}" data-palrow><div class="c-picker__palhead" data-pk-drag><button class="c-reset c-select c-select--compact c-focus ${s.menu === 'palette' ? 'is-open' : ''}" data-pk-menu="palette" aria-haspopup="true" aria-label="Palette: ${esc(name)}"><span class="c-select__value">${esc(name)}</span>${ic('chevron-down')}</button>`
    + `<span class="c-picker__grip" aria-hidden="true">${ic('grip')}</span><button class="c-reset c-iconbtn c-iconbtn--sm c-focus c-picker__popout" aria-label="Float over the cloth" data-tip="Float over the cloth" data-pk="pop-out">${ic('pop-out')}</button></div>`
    + `${pans(p ? p[1] : [], s.hex, { slots: true, del: !!p, pal: i })}</div>`;
};
// the palettes, then a new one (the picker's and the floating palette's menu)
export const paletteMenu = (s) => `<div class="c-menu">${s.saved.map(([name], i) => `<button class="c-reset c-menu__item ${i === palIndex(s) ? 'is-selected' : ''}" data-pk-palette="${i}">${esc(name)}${i === palIndex(s) ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('')}`
  + `${s.saved.length ? '<div class="c-menu__rule"></div>' : ''}<button class="c-reset c-menu__item ${palIndex(s) < 0 ? 'is-selected' : ''}" data-pk-palette="new">${ic('plus')}New palette${palIndex(s) < 0 ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button></div>`;
// how the palette tears off and floats: tear (px before it comes free), resist (how far it follows before that,
// 0..1), lift (its scale while carried), snap (px from the cloth's edge it snaps at), fly (ms) and stagger (ms
// between colours when it flies out or back)
export const FLOAT_TUNING = { tear: 24, resist: 0.35, lift: 1.03, snap: 24, fly: 380, stagger: 30 };
// under the value: in Custom, the palette in hand and On canvas; in Extract, Saved palettes once one is saved here, and On canvas, both folded to start (as the
// Extract bottom says); elsewhere, On canvas
const onCanvas = (s) => {
  if (s.tab === 'custom') return palRow(s) + canvasFold(s, s.canvasOpen);
  if (s.tab === 'saved') return canvasFold(s, s.canvasOpenSaved); // folded to start, as in Extract
  const b = s.extractBottom;
  // a palette saved here always shows its Saved palettes line, whatever the Extract bottom says
  return (s.savedHere ? savedFold(s, s.savedOpenExtract) : '') + (b === 'canvas' || b === 'both' ? canvasFold(s, s.canvasOpenExtract) : '');
};

const MENUS = {
  // one column, like the fabric menu: every stitch's drawing and name in one list; it scrolls past a height
  stitch: (s) => `<div class="c-menu c-picker__stitchmenu" role="group" aria-label="Stitch">${STITCHES.map((n) => `<button class="c-reset c-menu__item ${n === s.stitch ? 'is-selected' : ''}" data-pk-stitch="${n}">${primitiveSvg(n, { size: 20, id: `pkm${uid++}`, animate: false })}${stitchName(n)}${n === s.stitch ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('')}</div>`,
  fabric: (s) => `<div class="c-menu">${FABRICS.map(([k, l]) => `<button class="c-reset c-menu__item ${k === s.fabric ? 'is-selected' : ''}" data-pk-fabric="${k}">${ic(`canvas-${k}`)}${l}${k === s.fabric ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('')}</div>`,
  palette: (s) => paletteMenu(s),
  notation: (s) => `<div class="c-menu">${MODES.map(([k, l]) => `<button class="c-reset c-menu__item ${k === s.notation ? 'is-selected' : ''}" data-pk-notation="${k}">${l}${k === s.notation ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('')}</div>`,
};

/** The preview on its own, for a state (the Controls tab shows it apart). */
export const previewHtml = (state = {}) => preview({ ...DEFAULTS, ...state });

const region = (name, html) => `<div class="c-picker__region" data-pk-region="${name}">${html}</div>`;

/** The whole picker for a state, held still. */
export function colourPickerHtml(state = {}) {
  const s = { ...DEFAULTS, ...state };
  return `<div class="c-popover c-picker" role="dialog" aria-label="Thread colour" data-hex="${s.hex}" style="--hand:${s.hex}">${head(s)}${region('preview', preview(s))}${region('body', BODY[s.tab](s))}${region('value', value(s))}${region('canvas', onCanvas(s))}`
    + `<div class="c-picker__menu" data-pk-region="menu" data-for="${s.menu || ''}">${s.menu ? MENUS[s.menu](s) : ''}</div></div>`;
}

// ─── live ────────────────────────────────────────────────────────────────────
/** Pull the main colours from an image: k-means on a small copy, biggest groups first. */
export function extractColours(img, k = 6) {
  const c = document.createElement('canvas'), side = 48;
  c.width = side; c.height = side;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, side, side);
  const d = ctx.getImageData(0, 0, side, side).data, px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push([d[i], d[i + 1], d[i + 2]]);
  if (!px.length) return [];
  const lum = (p) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  const sorted = [...px].sort((a, b) => lum(a) - lum(b));
  let cs = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)].slice());
  let groups;
  for (let it = 0; it < 10; it++) {
    groups = cs.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let b = 0, bd = Infinity;
      cs.forEach((q, j) => { const e = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (e < bd) { bd = e; b = j; } });
      const g = groups[b]; g[0] += p[0]; g[1] += p[1]; g[2] += p[2]; g[3]++;
    }
    cs = groups.map((g, j) => (g[3] ? [g[0] / g[3], g[1] / g[3], g[2] / g[3]] : cs[j]));
  }
  const hex = (p) => `#${p.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  return [...new Set(cs.map((p, j) => [hex(p), groups[j][3]]).sort((a, b) => b[1] - a[1]).filter(([, n]) => n).map(([h]) => h))];
}

/**
 * Make the picker in root live. options: hex, canvas (hexes on the canvas), saved ([[name, [hex]]]), stitch,
 * fabric, onChange(hex), onClose(), onRender(el) (to wire pills and tooltips in what it draws).
 * Returns { set(hex), state }.
 */
export function createColourPicker(root, options = {}) {
  const { onChange = () => {}, onClose = () => {}, onRender = () => {}, onPalette = () => {}, onFloat = () => {}, onDock = () => {}, onSaved = () => {} } = options;
  // saved palettes are shared, not copied: the floating palette and the picker change the same list
  const saved = options.saved || [];
  saved.forEach((p) => { p[1] = p[1].map(hexOf); });
  const s = { ...DEFAULTS, ...options, canvas: (options.canvas || []).map(hexOf), saved };
  s.hex = hexOf(s.hex);
  root.innerHTML = colourPickerHtml(s);
  const el = root.querySelector('.c-picker'), $r = (n) => el.querySelector(`[data-pk-region="${n}"]`);
  let field = null, artQueued = false;

  const draw = (name, html) => { const r = $r(name); r.innerHTML = html; onRender(r); return r; };
  function drawBody() {
    draw('body', BODY[s.tab](s));
    field = s.tab === 'custom' ? createColourField($r('body'), { hex: s.hex, onChange: (hex) => set(hex, 'field'), hand: true }) : null;
  }
  // another pill: the old part fades out, then the height eases to the new part's while it fades in, so the picker
  // grows or shrinks smoothly from the bottom
  const SWAP = { out: 110, size: 260, in: 180, ease: 'cubic-bezier(.22, 1, .36, 1)' };
  let swapId = 0, sizing = null;
  function switchBody() {
    const reg = $r('body'), id = ++swapId;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { drawBody(); draw('canvas', onCanvas(s)); return; }
    sizing?.cancel();
    reg.style.transition = `opacity ${SWAP.out}ms ease`; reg.style.opacity = '0';
    setTimeout(() => {
      if (id !== swapId) return;
      const h0 = reg.offsetHeight;
      drawBody(); draw('canvas', onCanvas(s));
      const h1 = reg.offsetHeight;
      reg.style.overflow = 'hidden';
      sizing = reg.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: SWAP.size, easing: SWAP.ease });
      sizing.onfinish = sizing.oncancel = () => { if (id === swapId) reg.style.overflow = ''; };
      reg.style.transition = `opacity ${SWAP.in}ms ease`; reg.style.opacity = '1';
    }, SWAP.out);
  }
  function drawMenu() {
    const m = $r('menu');
    m.dataset.for = s.menu || '';
    m.innerHTML = s.menu ? MENUS[s.menu](s) : '';
    el.querySelectorAll('[data-pk-menu]').forEach((b) => b.classList.toggle('is-open', b.dataset.pkMenu === s.menu));
    if (!s.menu) return;
    // under its trigger, kept inside the picker
    const t = el.querySelector(`[data-pk-menu="${s.menu}"]`).getBoundingClientRect(), box = el.getBoundingClientRect();
    m.style.top = `${t.bottom - box.top + 4}px`;
    m.style.left = `${Math.max(8, Math.min(t.left - box.left, box.width - m.offsetWidth - 8))}px`;
    onRender(m);
    m.querySelector('[aria-pressed="true"], .is-selected, button')?.focus({ preventScroll: true, focusVisible: false });
    const list = m.querySelector('.c-picker__stitchmenu'), on = list?.querySelector('.is-selected');
    if (on) list.scrollTop = on.offsetTop - (list.clientHeight - on.offsetHeight) / 2; // the current stitch in view
  }
  const closeMenu = () => { if (!s.menu) return false; const was = s.menu; s.menu = null; drawMenu(); el.querySelector(`[data-pk-menu="${was}"]`)?.focus({ preventScroll: true, focusVisible: false }); return true; };

  function set(hex, from) {
    if (!hex) return;
    s.hex = hex;
    el.style.setProperty('--hand', hex); // an empty pan in the palette shows it on hover
    if (from !== 'field') field?.set(hex);
    const input = el.querySelector('[data-pk-value]');
    if (input && from !== 'value') input.value = formatColour(hex, s.notation);
    if (from !== 'value') el.querySelectorAll('[data-pk-part]').forEach((x, i) => { x.value = colourParts(hex, s.notation)[i]; });
    el.querySelectorAll('.c-pan[data-pk-pick]').forEach((x) => x.classList.toggle('is-selected', x.dataset.pkPick === hex));
    if (!artQueued) { artQueued = true; requestAnimationFrame(() => { artQueued = false; $r('art').innerHTML = previewArt(s); }); } // the thread redraws once a frame while dragging
    onChange(hex);
  }

  // a new notation crossfades in: the name in the select, and the field (the old one fades out on top of the new,
  // in the same place, so nothing moves)
  function changeNotation() {
    const sel = el.querySelector('[data-pk-menu="notation"]');
    sel.setAttribute('aria-label', `Notation: ${label(MODES, s.notation)}`);
    sel.querySelectorAll('[data-name]').forEach((n) => n.classList.toggle('is-on', n.dataset.name === s.notation));
    const reg = $r('field'), old = [...reg.children];
    old.forEach((o) => {
      o.querySelectorAll('[data-pk-value], [data-pk-part]').forEach((x) => { x.removeAttribute('data-pk-value'); x.removeAttribute('data-pk-part'); });
      o.inert = true; o.classList.add('is-leaving');
      setTimeout(() => o.remove(), 220);
    });
    reg.insertAdjacentHTML('beforeend', valueField(s));
    const next = reg.lastElementChild;
    next.classList.add('is-entering'); void next.offsetWidth; next.classList.remove('is-entering');
  }

  // On canvas opening: each colour travels from its small box on the folded line to its box in the grid, one after
  // another, and the empty boxes fade in after; folding: the grid closes and the small boxes slide in from the right,
  // one after another. The section's height eases either way.
  const FOLD = { duration: 380, ease: 'cubic-bezier(.22, 1, .36, 1)', fade: 200, stagger: 60, slide: 16 }; // stagger: ms between one colour and the next; slide: px each small box comes in from, folding
  function foldSection(key) {
    const sec = () => el.querySelector(`[data-fold="${key}"]`);
    const boxes = (x) => [...(x?.querySelectorAll('.c-picker__mini i, .c-pan[data-pk-pick]') || [])];
    const reg = $r('canvas'), h0 = reg.offsetHeight, from = boxes(sec()).map((b) => b.getBoundingClientRect());
    draw('canvas', onCanvas(s));
    el.querySelector(`[data-fold="${key}"] [data-pk="fold"]`)?.focus({ preventScroll: true, focusVisible: false });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const now = sec(), to = boxes(now), h1 = reg.offsetHeight;
    reg.style.overflow = 'clip';
    const opening = h1 > h0, n = Math.min(from.length, to.length);
    const grow = reg.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: FOLD.duration, easing: FOLD.ease });
    if (opening) {
      // opening: each colour travels from its small box on the folded line to its box in the grid, one after another
      to.forEach((b, i) => {
        const a = from[i]; if (!a) return;
        const r = b.getBoundingClientRect();
        b.style.transformOrigin = '0 0';
        b.animate([{ transform: `translate(${a.left - r.left}px, ${a.top - r.top}px) scale(${a.width / r.width}, ${a.height / r.height})` }, { transform: 'none' }], { duration: FOLD.duration, easing: FOLD.ease, delay: i * FOLD.stagger, fill: 'backwards' });
      });
      now?.querySelectorAll('.c-pan.is-empty').forEach((b) => b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FOLD.fade, delay: FOLD.duration * 0.5 + n * FOLD.stagger, easing: 'ease', fill: 'backwards' }));
    } else {
      // folding: the grid closes, and the small boxes slide in from the right one after another
      to.forEach((b, i) => b.animate([{ transform: `translateX(${FOLD.slide}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: FOLD.duration, easing: FOLD.ease, delay: FOLD.duration * 0.3 + i * FOLD.stagger, fill: 'backwards' }));
    }
    grow.onfinish = grow.oncancel = () => { reg.style.overflow = ''; };
  }

  // Saved: the palette's colours fly into Saved palettes one after another, from their boxes up top. Folded (or
  // appearing for the first time), to the small boxes at its line's end; open, to the new palette's row at the top
  // of the list, the rows below making room.
  function flyToSaved() {
    const from = [...$r('body').querySelectorAll('.c-pans .c-pan[data-pk-pick]')].map((b) => b.getBoundingClientRect());
    const reg = $r('canvas'), h0 = reg.offsetHeight, had = !!el.querySelector('[data-fold="saved"]');
    // where the rows were, so the ones below the new palette slide down to make room
    const tops = (x) => [...x.querySelectorAll('[data-fold="saved"] .c-picker__palette, [data-fold="canvas"]')].map((r) => r.getBoundingClientRect().top);
    const before = tops(reg);
    // the oldest row shown, if the new palette pushes it past SAVED_SHOWN: it fades out where it was
    const shown = [...reg.querySelectorAll('[data-fold="saved"] .c-picker__palette')], leaving = s.savedOpenExtract && shown.length >= SAVED_SHOWN ? shown.at(-1) : null;
    const leftAt = leaving && [leaving.getBoundingClientRect()];
    draw('canvas', onCanvas(s));
    if (leaving) {
      const [r] = leftAt, regNow = reg.getBoundingClientRect();
      Object.assign(leaving.style, { position: 'absolute', left: `${r.left - regNow.left}px`, top: `${r.top - regNow.top}px`, width: `${r.width}px`, pointerEvents: 'none' });
      reg.append(leaving);
      const fade = leaving.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${FOLD.slide}px)` }], { duration: FOLD.duration * 0.6, easing: 'ease-in', fill: 'forwards' });
      fade.onfinish = () => leaving.remove(); setTimeout(() => leaving.remove(), FOLD.duration + 100);
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sec = el.querySelector('[data-fold="saved"]'), h1 = reg.offsetHeight;
    if (!sec) return;
    const open = s.savedOpenExtract, row = open ? sec.querySelector('.c-picker__palette') : null, mini = sec.querySelector('.c-picker__mini');
    reg.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: FOLD.duration, easing: FOLD.ease });
    if (open) row.querySelector('.c-picker__palname').animate([{ opacity: 0 }, { opacity: 1 }], { duration: FOLD.fade, easing: 'ease' });
    if (!had) sec.querySelector('.c-picker__fold').animate([{ opacity: 0 }, { opacity: 1 }], { duration: FOLD.fade, easing: 'ease' });
    if (!open) mini.classList.add('is-flying');
    // old row i is new row i + 1 when a palette joins the open list (On canvas stays last)
    const rows = [...reg.querySelectorAll('[data-fold="saved"] .c-picker__palette, [data-fold="canvas"]')];
    rows.forEach((r, i) => {
      const j = open ? i - 1 : i, was = before[r.matches('[data-fold="canvas"]') ? before.length - 1 : j];
      if (was == null || (open && i === 0)) return;
      const d = was - r.getBoundingClientRect().top;
      if (Math.abs(d) > 0.5) r.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: FOLD.duration, easing: FOLD.ease });
    });
    const boxes = open ? [...row.querySelectorAll('.c-pan[data-pk-pick]')] : [...mini.querySelectorAll('i')];
    boxes.forEach((b, i) => {
      const a = from[i]; if (!a) return;
      const r = b.getBoundingClientRect();
      b.style.transformOrigin = '0 0';
      b.animate([{ transform: `translate(${a.left - r.left}px, ${a.top - r.top}px) scale(${a.width / r.width}, ${a.height / r.height})` }, { transform: 'none' }], { duration: FOLD.duration + 120, easing: FOLD.ease, delay: i * FOLD.stagger, fill: 'backwards' });
    });
    if (!open) setTimeout(() => mini.classList.remove('is-flying'), FOLD.duration + 120 + boxes.length * FOLD.stagger);
  }
  // a colour pulled from the image, removed: it shrinks away, then the rest close up (and the saved palette follows)
  function removeColour(btn) {
    const hex = btn.dataset.pkDel, wrap = btn.closest('.c-panwrap'), pal = btn.dataset.pkPal;
    if (pal != null) s.saved[Number(pal)][1] = s.saved[Number(pal)][1].filter((h) => h !== hex); // a saved palette's colour
    else {
      s.extracted = s.extracted.filter((h) => h !== hex);
      if (s.extractSaved) s.saved[s.extractSaved - 1][1] = [...s.extracted];
    }
    let gone = false;
    const inBody = $r('body').contains(btn);
    const done = () => { if (gone) return; gone = true; if (inBody) drawBody(); draw('canvas', onCanvas(s)); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !wrap) { done(); return; }
    wrap.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.4)', opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).onfinish = done;
    setTimeout(done, 220); // in case the animation never finishes (a hidden tab)
  }

  // an empty pan tapped: the colour in hand goes into the palette (a new one if there is none) and pops into its
  // pan; a colour already there gives its pan a nudge instead
  function keepColour() {
    if (palIndex(s) < 0) { s.saved.push([`Palette ${s.saved.length + 1}`, []]); s.palette = s.saved.length - 1; onPalette(s.palette); }
    const pal = s.saved[palIndex(s)][1], had = pal.includes(s.hex);
    if (!had) pal.push(s.hex);
    draw('canvas', onCanvas(s));
    const box = el.querySelector(`[data-palrow] .c-pan[data-pk-pick="${s.hex}"]`);
    if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    box.animate(had ? [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }] : [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: had ? 240 : FOLD.duration, easing: had ? 'ease-in-out' : 'cubic-bezier(.34, 1.4, .64, 1)' });
  }

  // ─── the palette, floating ───
  const panRects = () => [...el.querySelectorAll('[data-palrow] .c-pan[data-pk-pick]')].map((b) => b.getBoundingClientRect());
  // the row gives way to the line saying it's out (or back), the section's height easing
  function swapRow(after) {
    const reg = $r('canvas'), h0 = reg.offsetHeight;
    draw('canvas', onCanvas(s));
    after?.();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const h1 = reg.offsetHeight;
    reg.style.overflow = 'clip';
    const a = reg.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: FOLD.duration, easing: FOLD.ease });
    a.onfinish = a.oncancel = () => { reg.style.overflow = ''; };
    el.querySelector('.c-picker__away')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FOLD.fade, delay: FOLD.duration * 0.3, easing: 'ease', fill: 'backwards' });
  }
  // out: drag (grab = the pointer, carried on by the floating palette) or the pop-out button (grab null: it flies
  // to its place)
  function float(grab) {
    const row = el.querySelector('[data-palrow]'), rect = row.getBoundingClientRect(), rects = panRects();
    s.paletteOut = true; closeMenu();
    swapRow();
    onFloat({ grab, rect, rects });
  }
  // back: the colours fly home from where they were floating, one after another
  function dock(rects = []) {
    s.paletteOut = false;
    swapRow(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      [...el.querySelectorAll('[data-palrow] .c-pan[data-pk-pick]')].forEach((b, i) => {
        const a = rects[i]; if (!a) return;
        const r = b.getBoundingClientRect();
        b.style.transformOrigin = '0 0';
        b.animate([{ transform: `translate(${a.left - r.left}px, ${a.top - r.top}px) scale(${a.width / r.width}, ${a.height / r.height})` }, { transform: 'none' }], { duration: FLOAT_TUNING.fly, easing: FOLD.ease, delay: i * FLOAT_TUNING.stagger, fill: 'backwards' });
      });
    });
  }
  // dragging the name row: it follows the pointer reluctantly (resist), then past tear px it comes free and the
  // floating palette carries on with the pointer; let go before that and it springs back
  el.addEventListener('pointerdown', (e) => {
    const head = e.target.closest('[data-pk-drag]');
    if (!head || e.button !== 0 || e.target.closest('[data-pk-menu], [data-pk]')) return;
    const row = head.closest('[data-palrow]'), x0 = e.clientX, y0 = e.clientY;
    e.preventDefault();
    head.setPointerCapture(e.pointerId);
    row.classList.add('is-pulling');
    const move = (m) => {
      const dx = m.clientX - x0, dy = m.clientY - y0;
      if (Math.hypot(dx, dy) < FLOAT_TUNING.tear) { row.style.transform = `translate(${dx * FLOAT_TUNING.resist}px, ${dy * FLOAT_TUNING.resist}px)`; return; }
      stop(); row.style.transform = '';
      float({ x: m.clientX, y: m.clientY, dx: x0 - row.getBoundingClientRect().left, dy: y0 - row.getBoundingClientRect().top, pointerId: m.pointerId });
    };
    const up = () => {
      stop();
      row.animate([{ transform: row.style.transform || 'none' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.34, 1.4, .64, 1)' });
      row.style.transform = '';
    };
    const stop = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); row.classList.remove('is-pulling'); if (head.hasPointerCapture(e.pointerId)) head.releasePointerCapture(e.pointerId); };
    head.addEventListener('pointermove', move); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
  });

  const forgetImage = () => { if (s.image?.url.startsWith('blob:')) URL.revokeObjectURL(s.image.url); s.image = null; };
  function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { forgetImage(); s.image = { url, name: file.name }; s.paletteName = file.name.replace(/\.[^.]+$/, ''); s.extracted = extractColours(img); s.extractSaved = false; switchBody(); if (s.extracted[0]) set(s.extracted[0]); };
    img.src = url;
  }

  el.addEventListener('click', async (e) => {
    const t = e.target;
    const tab = t.closest('[data-pk-tab]');
    if (tab && tab.dataset.pkTab !== s.tab) { s.tab = tab.dataset.pkTab; closeMenu(); switchBody(); return; }
    const opener = t.closest('[data-pk-menu]');
    if (opener) { s.menu = s.menu === opener.dataset.pkMenu ? null : opener.dataset.pkMenu; drawMenu(); return; }
    const st = t.closest('[data-pk-stitch]'), fb = t.closest('[data-pk-fabric]'), nt = t.closest('[data-pk-notation]');
    if (st || fb) { if (st) s.stitch = st.dataset.pkStitch; else s.fabric = fb.dataset.pkFabric; closeMenu(); draw('preview', preview(s)); el.querySelector(`[data-pk-menu="${st ? 'stitch' : 'fabric'}"]`)?.focus({ preventScroll: true, focusVisible: false }); return; }
    const pl = t.closest('[data-pk-palette]');
    if (pl) {
      s.palette = pl.dataset.pkPalette === 'new' ? null : Number(pl.dataset.pkPalette); // a new one is made by its first colour
      onPalette(s.palette);
      closeMenu(); draw('canvas', onCanvas(s)); el.querySelector('[data-pk-menu="palette"]')?.focus({ preventScroll: true, focusVisible: false }); return;
    }
    if (nt) { if (nt.dataset.pkNotation !== s.notation) { s.notation = nt.dataset.pkNotation; changeNotation(); } closeMenu(); return; }
    if (s.menu && !t.closest('[data-pk-region="menu"]')) closeMenu();
    if (t.closest('[data-pk-slot]')) { keepColour(); return; }
    const p = t.closest('[data-pk-pick]');
    if (p) { set(p.dataset.pkPick); return; }
    const act = t.closest('[data-pk]')?.dataset.pk, add = t.closest('[data-pk-add]');
    if (add) { const pal = s.saved[Number(add.dataset.pkAdd)][1]; if (!pal.includes(s.hex)) pal.push(s.hex); drawBody(); }
    if (act === 'close') onClose();
    if (act === 'pop-out') float(null);
    if (act === 'dock') onDock();
    if (act === 'eyedrop') { try { const { sRGBHex } = await new EyeDropper().open(); set(parseColour(sRGBHex) || hexOf(sRGBHex)); } catch {} }
    // a new palette starts with the colour in hand; it fades in with its name selected, ready to type over
    if (act === 'new-palette') {
      s.saved.push([`Palette ${s.saved.length + 1}`, [s.hex]]); drawBody();
      const row = [...$r('body').querySelectorAll('.c-picker__palette')].at(-1), name = row?.querySelector('[data-pk-palname]');
      row?.animate([{ opacity: 0, transform: `translateY(${FOLD.slide / 2}px)` }, { opacity: 1, transform: 'none' }], { duration: FOLD.duration, easing: FOLD.ease });
      name?.focus({ preventScroll: true }); name?.select();
    }
    // saved under the name in the name field (the image's name until changed); the words turn into "Saved" with a tick
    // and stay so for this image; changing the name afterwards renames the saved palette
    if (act === 'save-extract' && s.extracted && !s.extractSaved) {
      s.saved.push([s.paletteName.trim() || 'From image', [...s.extracted]]); s.extractSaved = s.saved.length;
      const b = t.closest('[data-pk]'); b.classList.add('is-saved'); b.setAttribute('aria-disabled', 'true');
      if (b.dataset.tip) { b.dataset.tip = 'Saved'; b.setAttribute('aria-label', 'Saved'); }
      if (s.tab === 'extract') { s.savedHere = true; flyToSaved(); } // open or folded, Saved palettes stays as it is
    }
    if (act === 'fold') {
      const key = t.closest('[data-pk]').dataset.key;
      if (key === 'saved') s.savedOpenExtract = !s.savedOpenExtract;
      else if (s.tab === 'extract') s.canvasOpenExtract = !s.canvasOpenExtract; else if (s.tab === 'saved') s.canvasOpenSaved = !s.canvasOpenSaved; else s.canvasOpen = !s.canvasOpen;
      foldSection(key);
    }
    const del = t.closest('[data-pk-del]');
    if (del) { removeColour(del); return; }
    if (act === 'remove-image') { forgetImage(); s.extracted = null; s.extractSaved = false; switchBody(); }
  });
  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-pk-palname]')) {
      const i = Number(e.target.dataset.pkPalname), name = e.target.value.trim();
      if (name) { s.saved[i][0] = name; if (s.extractSaved - 1 === i) s.paletteName = name; }
      return;
    }
    if (e.target.matches('[data-pk-name]')) {
      s.paletteName = e.target.value;
      if (s.extractSaved && e.target.value.trim()) { s.saved[s.extractSaved - 1][0] = e.target.value.trim(); el.querySelectorAll(`[data-saved="${s.extractSaved - 1}"] .c-picker__palname`).forEach((n) => { n.textContent = e.target.value.trim(); }); }
      return;
    }
    if (e.target.matches('[data-pk-part]')) { set(colourFromParts([...el.querySelectorAll('[data-pk-part]')].map((x) => x.value), s.notation), 'value'); return; }
    if (!e.target.matches('[data-pk-value]')) return;
    const hex = parseColour(e.target.value, s.notation);
    if (hex) set(hex, 'value');
  });
  // leaving the field writes the colour back in full (a typed '#b42' becomes '#BB4422')
  el.addEventListener('focusout', (e) => {
    if (e.target.matches('[data-pk-value]')) e.target.value = formatColour(s.hex, s.notation);
    if (e.target.matches('[data-pk-part]')) el.querySelectorAll('[data-pk-part]').forEach((x, i) => { x.value = colourParts(s.hex, s.notation)[i]; });
  });
  el.addEventListener('change', (e) => { if (e.target.matches('[data-pk-file]')) loadImage(e.target.files[0]); });
  el.addEventListener('dragover', (e) => { const d = e.target.closest('.c-drop'); if (d) { e.preventDefault(); d.classList.add('is-over'); } });
  el.addEventListener('dragleave', (e) => e.target.closest('.c-drop')?.classList.remove('is-over'));
  el.addEventListener('drop', (e) => { if (!e.target.closest('.c-drop')) return; e.preventDefault(); loadImage(e.dataTransfer.files[0]); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (!closeMenu()) onClose(); }
    if (e.key === 'Enter' && e.target.matches('[data-pk-name], [data-pk-palname]')) e.target.blur();
    // a number box steps with the arrow keys (shift for ten), within its range
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.matches('[data-pk-part]')) {
      e.preventDefault();
      const i = Number(e.target.dataset.pkPart), max = PART_MAX[s.notation][i], d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
      e.target.value = Math.max(0, Math.min(max, (Number(e.target.value) || 0) + d));
      e.target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.c-drop')) { e.preventDefault(); e.target.querySelector('input').click(); }
  });

  // anything done here may have changed the saved palettes: the floating palette redraws
  el.addEventListener('click', () => onSaved());
  el.addEventListener('input', () => onSaved());

  onRender(el);
  drawBody();
  return {
    set: (hex) => set(hexOf(hex)), state: s,
    /** Change how Extract is laid out (extractLayout, extractBottom, canvasOpen) and redraw. */
    layout(o) { Object.assign(s, o); if (s.tab === 'extract') drawBody(); draw('canvas', onCanvas(s)); },
    /** Open a pill, and load an image into Extract (for reviewing its states). */
    tab(name) { if (name !== s.tab) el.querySelector(`[data-pk-tab="${name}"]`)?.click(); },
    loadImage,
    /** The palette came back (rects: where its colours were floating), or changed while away (redraw its line). */
    dock, refresh() { if (s.tab === 'custom') draw('canvas', onCanvas(s)); },
    /** The palette the floating one switched to. */
    palette(i) { s.palette = i; if (s.tab === 'custom') draw('canvas', onCanvas(s)); },
  };
}
