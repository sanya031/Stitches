// The Controls tab: draws every control in every state, lists each one's tokens and CSS
// (both read from controls.css, so they can't drift), and copies any state as SVG for Figma.
import { svg } from './icons/icons.js';
import { PRIMITIVES, primitiveSvg, patchSquares } from './icons/primitives.js';
import { createStageSlider } from './stage-slider.js';
import { swatch } from './swatch.js';
import { colourFieldHtml, createColourField } from './colour-field.js';
import { createTooltips } from './tooltip.js';
import { SEG_MOTIONS, createSegMotion, dialDefaults } from './seg-motion.js';
import { createZoomMotion } from './zoom-motion.js';
import { TUNING, motionFrom } from './icons/zoom-css.js';

// ─── small drawing helpers ───────────────────────────────────────────────────
const ic = (name) => `<span class="c-ic">${svg(name)}</span>`;
const spin = `<span class="c-ic c-spin">${svg('loading')}</span>`;
let uid = 0;
const prim = (name, size = 24) => primitiveSvg(name, { size, id: `ct-${uid++}`, frame: 'square', animate: false });
// stitch tiles use the primitives' hover zoom from the design page
const ZOOM_N = patchSquares(24), zoomPrim = (name) => primitiveSvg(name, { size: 24, id: `cz-${uid++}`, frame: 'zoom', n: ZOOM_N, animate: false });
const STATE = { Rest: '', Hover: 'is-hover', Pressed: 'is-pressed', Focus: 'is-focus', Selected: 'is-selected', 'Selected, hover': 'is-selected is-hover', 'Selected, focus': 'is-selected is-focus', Disabled: 'is-disabled', Mixed: 'is-mixed', Loading: 'is-loading', Error: 'is-error', Editing: 'is-focus', Dragging: 'is-dragging', Open: 'is-open' };
const states = (names, fn) => names.map((s) => [s, fn(STATE[s] ?? '', s)]);
const dis = (cls) => (cls.includes('is-disabled') ? ' disabled aria-disabled="true"' : '');
// thread colours are content, drawn from the palettes
const swatchOf = (colour, cls = '', extra = '') => swatch(colour, { cls, extra });
const TABS = ['Canvas', 'Custom', 'Saved', 'From image'];
const SWATCHES = ['--terracotta-500', '--ochre-300', '--leaf-500', '--periwinkle-400', '--lilac-400', '--crimson-500', '--neutral-950', '--neutral-50', '--terracotta-300', '--periwinkle-700'];

const btn = (kind, cls, label, inner = '') => `<button class="c-reset c-btn c-btn--${kind} c-focus ${cls}"${dis(cls)}>${inner}${label}</button>`;
const BTN_STATES = ['Rest', 'Hover', 'Pressed', 'Focus', 'Disabled', 'Loading'];
const btnRow = (kind, label) => states(BTN_STATES, (c, s) => btn(kind, c, s === 'Loading' ? 'Saving' : label, s === 'Loading' ? spin : ''));
const iconbtn = (kind, cls, name = 'undo') => `<button class="c-reset c-iconbtn ${kind ? `c-iconbtn--${kind}` : ''} c-focus ${cls}" aria-label="${name}"${dis(cls)}>${ic(name)}</button>`;
const tool = (cls, name = 'tool-stitch') => `<button class="c-reset c-tool c-focus ${cls}" aria-label="${name}"${dis(cls)}>${ic(name)}</button>`;
const seg = (opts, sel, { cls = '', optCls = {}, live = false, icons = false, motion = '' } = {}) => `<div class="c-seg ${cls} ${icons ? 'c-seg--icons' : ''}" role="group"${motion ? ` data-motion="${motion}"` : live ? ' data-live' : ''}>${opts.map((o, i) => `<button class="c-reset c-seg__opt c-focus ${i === sel && !live ? 'is-selected' : ''} ${optCls[i] || ''}"${live ? ` aria-pressed="${i === sel}"` : ''}${dis(optCls[i] || '')}${motion && !icons ? ` data-label="${o}"` : ''}>${icons ? ic(o) : o}</button>`).join('')}</div>`;
const sw = (cls, label = 'Stitched', live = false) => `<button class="c-reset c-switch c-focus ${cls}" role="switch"${live ? ' data-live aria-checked="false"' : ''}${dis(cls)}><span class="c-switch__track"><span class="c-switch__thumb"></span></span>${label}</button>`;
const check = (cls) => `<button class="c-reset c-check c-focus ${cls}" role="checkbox"${dis(cls)}><span class="c-check__box">${cls.includes('is-on') ? ic('check') : cls.includes('is-mixed') ? ic('minus') : ''}</span>Outline</button>`;
const slider = (cls, { v = 60, label = 'Density', val = `${v}%`, live = false } = {}) => `<div class="c-slider ${cls}" style="--v:${v}%"${live ? ' data-live' : ''}><span>${label}</span><span class="c-slider__track"><span class="c-slider__fill"></span><span class="c-slider__thumb"${live ? ' tabindex="0" role="slider" aria-label="Density" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60"' : ''}></span></span><span class="c-slider__value">${val}</span></div>`;
const num = (cls, { label = 'W', value = '120', unit = 'sq', ph = '', steps = true } = {}) => `<label class="c-field c-field--num ${cls}"><span class="c-field__label">${label}</span><input inputmode="numeric" value="${value}" placeholder="${ph}" aria-label="${label}"${dis(cls)}><span class="c-field__unit">${unit}</span>${steps ? `<span class="c-field__steps">${ic('minus')}${ic('plus')}</span>` : ''}</label>`;
const text = (cls, value, ph = 'Name this piece') => `<label class="c-field ${cls}"><input value="${value}" placeholder="${ph}" aria-label="Text"${dis(cls)}></label>`;
const area = (cls, value) => `<label class="c-field c-textarea ${cls}"><textarea aria-label="Text" placeholder="Type something to stitch"${dis(cls)}>${value}</textarea></label>`;
const search = (cls, value) => `<label class="c-field c-search ${cls}">${ic('search')}<input value="${value}" placeholder="Hex or thread number" aria-label="Search"${dis(cls)}>${value ? ic('close') : ''}</label>`;
const select = (cls, label = 'Stranded cotton') => `<button class="c-reset c-select c-focus ${cls}"${dis(cls)}><span class="c-select__label">Type</span><span class="c-select__value">${label}</span>${ic('chevron-down')}</button>`;
const tile = (cls, name = 'stitch-full') => `<button class="c-reset c-tile c-focus tz-host ${cls}" aria-label="${name}"${dis(cls)}>${zoomPrim(name)}</button>`;
const row = (cls, name = 'Full cross', art = 'stitch-full') => `<button class="c-reset c-row c-focus ${cls}"${dis(cls)}><span class="c-row__art">${prim(art)}</span>${name}<span class="c-ic c-row__end">${svg('chevron-right')}</span></button>`;
const layer = (cls, name = 'Calla lilies', eye = 'eye') => `<div class="c-layer ${cls}">${cls.includes('is-renaming') ? `<input value="${name}" aria-label="Layer name">` : `<span class="c-layer__name">${name}</span>`}${iconbtn('', 'c-iconbtn--sm', eye)}${iconbtn('', 'c-iconbtn--sm', 'lock')}</div>`;
const section = (cls, open = true, action = '') => `<button class="c-reset c-section c-focus ${cls}" aria-expanded="${open}">Appearance${action}${ic(open ? 'chevron-down' : 'chevron-right')}</button>`;
const drop = (cls, body) => `<div class="c-drop ${cls}">${body}</div>`;
const play = (cls, name, v, val) => `<div class="c-play ${cls}">${iconbtn('secondary', '', name)}<span class="c-slider ${cls}" style="--v:${v}%;display:block;min-height:0"><span class="c-slider__track" style="display:block"><span class="c-slider__fill"></span><span class="c-slider__thumb"></span></span></span><span class="c-slider__value">${val}</span></div>`;

const motionCell = (k) => { const m = SEG_MOTIONS[k]; return [m.title, `<div class="c-motion-demo"><strong>${m.title}</strong><p>${m.about}</p>${seg(['Cross', 'Half', 'Back'], 0, { live: true, motion: k })}${seg(['Stitch', 'Animate', 'Export'], 0, { live: true, motion: k, cls: 'c-seg--lg' })}${seg(['tool-stitch', 'tool-fill', 'tool-pattern'], 0, { live: true, motion: k, icons: true })}<button class="c-reset c-btn c-btn--secondary c-btn--sm c-focus" data-copy-motion="${k}">Copy values</button></div>`]; };

const SEG_STYLES = [
  ['Soft', 'Less rounded: square-ish corners on the container and the pill.', 'c-seg--soft'],
  ['Square', 'Nearly square corners. The most structured.', 'c-seg--square'],
  ['Clean', 'No container fill: only the pill moves between the names.', 'c-seg--clean'],
  ['Clean, soft', 'No container fill, with less rounded corners.', 'c-seg--clean c-seg--soft'],
  ['Outline', 'A thin outline instead of a container fill; the pill moves inside it.', 'c-seg--outline'],
  ['Ring', 'No fills at all: a thin ring moves to the chosen name.', 'c-seg--clean c-seg--ring'],
  ['Ring, soft', 'A less rounded ring, no fills.', 'c-seg--clean c-seg--ring c-seg--soft'],
  ['Underline', 'No fills: a short bar slides under the chosen name.', 'c-seg--clean c-seg--underline'],
  ['Invert', 'The pill takes the text colour and the chosen name flips light. The strongest.', 'c-seg--invert'],
  ['Invert, clean, soft', 'No container fill, a less rounded pill in the text colour.', 'c-seg--clean c-seg--invert c-seg--soft']
];
const styleCell = ([title, about, cls]) => [title, `<div class="c-motion-demo"><strong>${title}</strong><p>${about}</p>${seg(['Cross', 'Half', 'Back'], 0, { live: true, motion: 'squash', cls })}${seg(['Stitch', 'Animate', 'Export'], 0, { live: true, motion: 'squash', cls: `${cls} c-seg--lg` })}${seg(['tool-stitch', 'tool-fill', 'tool-pattern'], 0, { live: true, motion: 'squash', icons: true, cls })}<code class="c-hint">${cls}</code></div>`];

// ─── the specs ───────────────────────────────────────────────────────────────
// Each: id, css block(s) in controls.css, title, note, rows of [state, html]. cell = minimum cell width.
const SPECS = [
  { group: 'Actions', id: 'button', title: 'Button', note: 'Primary is the only terracotta in the interface. Hover changes the fill on solid buttons and only brightens the text on the others.', cell: 120, rows: [
    ['Primary', btnRow('primary', 'Stitch it')], ['Secondary', btnRow('secondary', 'Pattern only')], ['Quiet', btnRow('quiet', 'Cancel')], ['Danger', btnRow('danger', 'Delete')],
    ['Sizes and icon', [['Small', btn('primary', 'c-btn--sm', 'Small')], ['Medium', btn('primary', '', 'Medium')], ['Large', btn('primary', 'c-btn--lg', 'Large')], ['With icon', btn('primary', '', 'Download', ic('download'))], ['Secondary, icon', btn('secondary', '', 'Share', ic('share'))]]]
  ] },
  { group: 'Actions', id: 'icon-button', title: 'Icon button and icon toggle', note: 'Looks 36 or 32 px, with an invisible 44 px pointer target. A toggle uses the selected look when on.', rows: [
    ['Quiet', states(['Rest', 'Hover', 'Pressed', 'Focus', 'Disabled'], (c) => iconbtn('', c))],
    ['Secondary', states(['Rest', 'Hover', 'Pressed', 'Focus', 'Disabled'], (c) => iconbtn('secondary', c, 'redo'))],
    ['Primary', states(['Rest', 'Hover', 'Pressed', 'Focus'], (c) => iconbtn('primary', c, 'play'))],
    ['Toggle', [['Off', iconbtn('', '', 'eye-off')], ['On', iconbtn('', 'is-selected', 'eye')], ['On, hover', iconbtn('', 'is-selected is-hover', 'eye')], ['On, focus', iconbtn('', 'is-selected is-focus', 'eye')], ['Disabled', iconbtn('', 'is-disabled', 'eye')], ['Lock off', iconbtn('', '', 'lock')], ['Lock on', iconbtn('', 'is-selected', 'lock')]]]
  ] },
  { group: 'Actions', id: 'tool-button', title: 'Tool button', note: 'For the tool bar.', rows: [
    ['States', states(['Rest', 'Hover', 'Pressed', 'Selected', 'Selected, hover', 'Focus', 'Selected, focus', 'Disabled'], (c) => tool(c))]
  ] },
  { group: 'Choices', id: 'segmented', title: 'Segmented pill', note: 'One choice from a few. The large size is the mode switch. The selected option uses the neutral lighter fill.', cell: 220, rows: [
    ['Live', [['Click me', seg(['Cross', 'Half', 'Back'], 0, { live: true, motion: 'squash' })]]],
    ['States', [['Rest', seg(['Cross', 'Half', 'Back'], 0)], ['Option hover', seg(['Cross', 'Half', 'Back'], 0, { optCls: { 1: 'is-hover' } })], ['Option focus', seg(['Cross', 'Half', 'Back'], 0, { optCls: { 1: 'is-focus' } })], ['Selected focus', seg(['Cross', 'Half', 'Back'], 0, { optCls: { 0: 'is-focus' } })], ['Option disabled', seg(['Cross', 'Half', 'Back'], 0, { optCls: { 2: 'is-disabled' } })], ['All disabled', seg(['Cross', 'Half', 'Back'], 0, { optCls: { 0: 'is-disabled', 1: 'is-disabled', 2: 'is-disabled' } })], ['Mixed, none selected', seg(['Cross', 'Half', 'Back'], -1)]]],
    ['Forms', [['Large, mode switch', seg(['Stitch', 'Animate', 'Export'], 0, { cls: 'c-seg--lg' })], ['Icons', seg(['tool-stitch', 'tool-fill', 'tool-pattern'], 0, { icons: true })], ['Two options', seg(['Sampler', 'Script'], 1)]]]
  ] },
  { group: 'Choices', id: 'segmented-motion', title: 'Segmented pill motion: Squash', note: 'The pill\'s animation. Click the options, use the arrow keys, or press Play in the panel. Its dials are in the DialKit panel, from the button at the bottom right, and it remembers your values in this browser.', blocks: ['segmented-motion', 'segmented', 'shared'], cell: 300, rows: [
    ['Saved now', [motionCell('squash')]],
  ] },
  { group: 'Choices', id: 'segmented-styles', title: 'Segmented pill styles', note: 'Ten looks for the same control, mixing rounded and less rounded, with and without a container. All move with the saved pill motion. The classes under each one combine, so any mix is possible.', blocks: ['segmented-styles', 'segmented-motion', 'segmented', 'shared'], cell: 300, rows: [
    ['Styles', SEG_STYLES.map(styleCell)]
  ] },
  { group: 'Choices', id: 'switch', title: 'Toggle switch', note: 'On or off, applies straight away. Mixed means the selection holds both.', cell: 150, rows: [
    ['Live', [['Click me', sw('', 'Stitched', true)]]],
    ['Off', states(['Rest', 'Hover', 'Focus', 'Disabled'], (c) => sw(c))],
    ['On', states(['Rest', 'Hover', 'Focus', 'Disabled'], (c) => sw(`is-on ${c}`))],
    ['Mixed', [['Mixed', sw('is-mixed')], ['Mixed, focus', sw('is-mixed is-focus')]]]
  ] },
  { group: 'Choices', id: 'checkbox', title: 'Checkbox', note: 'For several independent options in a list.', cell: 130, rows: [
    ['Off', states(['Rest', 'Hover', 'Focus', 'Disabled'], (c) => check(c))],
    ['On', states(['Rest', 'Hover', 'Focus', 'Disabled'], (c) => check(`is-on ${c}`))],
    ['Mixed', [['Mixed', check('is-mixed')]]]
  ] },
  { group: 'Values', id: 'slider', title: 'Slider', note: 'Neutral fill. The value on the right can be typed into. Mixed hides the fill and thumb until you touch it.', cell: 240, rows: [
    ['Live', [['Drag me', slider('', { live: true })]]],
    ['States', [['Rest', slider('')], ['Hover', slider('is-hover')], ['Dragging', slider('is-dragging')], ['Focus', slider('is-focus')], ['Disabled', slider('is-disabled')], ['Mixed', slider('is-mixed', { val: 'Mixed' })], ['At zero', slider('', { v: 0 })], ['At full', slider('', { v: 100 })]]]
  ] },
  { group: 'Values', id: 'stage-slider', title: 'Stage slider', note: 'For settings a newcomer may not know. The whole box is the slider: drag anywhere to move the value from where it is (above or below the box for fine steps). The stitch at the start redraws as you go; the number is a field you can type in. Drag the live ones.', cell: 280, stage: true, rows: [
    ['Live', [['Strands', '<div data-stage="strands" style="width:100%"></div>'], ['Count', '<div data-stage="count" style="width:100%"></div>'], ['Density', '<div data-stage="density" style="width:100%"></div>']]],
    ['In use', [['Strands', '<div data-stage="strands" data-held style="width:100%"></div>'], ['Density', '<div data-stage="density" data-held style="width:100%"></div>']]]
  ] },
  { group: 'Values', id: 'number-field', title: 'Number field', note: 'Drag the label to scrub, or type. Steppers and the unit are optional. Fixed-width digits so values line up.', blocks: ['number-field', 'shared'], cell: 180, rows: [
    ['States', [['Rest', num('')], ['Hover', num('is-hover')], ['Editing', num('is-focus')], ['Disabled', num('is-disabled')], ['Mixed', num('is-mixed', { value: '', ph: 'Mixed' })], ['Error', `<div style="width:100%">${num('is-error', { value: '9000' })}<span class="c-hint c-hint--error">Up to 400 squares</span></div>`]]],
    ['Forms', [['No steppers', num('', { steps: false })], ['Angle', num('', { label: 'Angle', value: '45', unit: '°', steps: false })], ['With hint', `<div style="width:100%">${num('', { label: 'H', value: '90' })}<span class="c-hint">22.5 cm at count 14</span></div>`]]]
  ] },
  { group: 'Values', id: 'text-input', title: 'Text input, text area, search', note: 'Share the field look with the number field.', blocks: ['text-input', 'number-field', 'shared'], cell: 200, rows: [
    ['Text input', [['Placeholder', text('', '')], ['Filled', text('', 'Calla lilies')], ['Hover', text('is-hover', 'Calla lilies')], ['Editing', text('is-focus', 'Calla lilies')], ['Disabled', text('is-disabled', 'Calla lilies')], ['Error', `<div style="width:100%">${text('is-error', '')}<span class="c-hint c-hint--error">Give the piece a name</span></div>`]]],
    ['Text area', [['Placeholder', area('', '')], ['Filled', area('', 'Hello')], ['Editing', area('is-focus', 'Hello')], ['Disabled', area('is-disabled', 'Hello')]]],
    ['Search', [['Empty', search('', '')], ['Filled', search('is-focus', 'rose')], ['Disabled', search('is-disabled', '')]]]
  ] },
  { group: 'Values', id: 'select', title: 'Select and menu', note: 'The open state pairs the field with a menu on the raised surface. Menus use the popover shadow.', cell: 190, rows: [
    ['Select', [['Rest', select('')], ['Hover', select('is-hover')], ['Open', select('is-open')], ['Focus', select('is-focus')], ['Disabled', select('is-disabled')], ['Mixed', select('is-mixed', 'Mixed')]]],
    ['Menu', [['Items', `<div class="c-menu"><button class="c-reset c-menu__item">Stranded cotton</button><button class="c-reset c-menu__item is-hover">Hover</button><button class="c-reset c-menu__item is-selected">Selected<span class="c-ic c-menu__end">${svg('check')}</span></button><div class="c-menu__rule"></div><button class="c-reset c-menu__item is-disabled" disabled>Disabled</button><button class="c-reset c-menu__item">With submenu<span class="c-ic c-menu__end">${svg('chevron-right')}</span></button></div>`]]]
  ] },
  { group: 'Thread and stitches', id: 'swatch', title: 'Swatch', note: 'A thread colour, as a chip. The thread colours here are content, taken from the palettes. A line under it marks hover and selected, on top of the lighter fill.', rows: [
    ['States', states(['Rest', 'Hover', 'Selected', 'Focus'], (c) => swatchOf('--terracotta-500', c))],
    ['Forms', [['Pale colour', swatchOf('--neutral-50')], ['With count', swatchOf('--leaf-500', '', '<span class="c-badge c-swatch__n">3</span>')]]]
  ] },
  { group: 'Thread and stitches', id: 'preview-tile', title: 'Preview tile', note: 'Stitch grid, fill variants, fabrics. Sits on the field; only the selected tile has a fill. In the grid that fill travels to the picked tile with the pill motion, Squash.', blocks: ['preview-tile', 'segmented-motion', 'shared'], rows: [
    ['States', states(['Rest', 'Hover', 'Pressed', 'Selected', 'Selected, hover', 'Focus', 'Selected, focus', 'Disabled'], (c) => `<div class="c-tilewell">${tile(c)}</div>`)],
    ['Forms', [['Stitch', `<div class="c-tilewell">${tile('', 'stitch-half')}</div>`], ['Fill', `<div class="c-tilewell">${tile('', 'fill-weave-3')}</div>`]]],
    ['Grid', [['Live', `<div class="c-tilegrid" data-live>${['stitch-full', 'stitch-half', 'stitch-back', 'stitch-knot', 'fill-columns', 'fill-rows', 'fill-weave-3', 'fill-seed'].map((n, i) => `<button class="c-reset c-tile c-focus tz-host" aria-label="${n}" aria-pressed="${i === 0}">${zoomPrim(n)}</button>`).join('')}</div>`]], 240]
  ] },
  { group: 'Thread and stitches', id: 'stitch-row', title: 'Stitch row and library', note: 'The current stitch in the panel, and the rows in the library, grouped, with a submenu for variants. With detail: a setting and a count on the right, for the stitches on the canvas.', cell: 220, rows: [
    ['Row', states(['Rest', 'Hover', 'Pressed', 'Open', 'Selected', 'Focus', 'Disabled'], (c) => row(c))],
    ['With detail', [['Canvas stitches', `<div style="width:260px">${row('', 'Full cross', 'stitch-full').replace(/<span class="c-ic c-row__end">.*?<\/span>/, '<span class="c-row__detail">Thickness 2 · 6,120</span>')}${row('is-selected', 'Weave 3×3', 'fill-weave-3').replace(/<span class="c-ic c-row__end">.*?<\/span>/, '<span class="c-row__detail">Density 60% · 540</span>')}</div>`]]],
    ['Library', [['Grouped list', `<div class="c-menu" style="width:260px"><div class="c-group-label">Counted</div>${row('is-selected')}${row('', 'Half cross', 'stitch-half')}${row('is-hover', 'Backstitch', 'stitch-back')}<div class="c-group-label">Fill</div>${row('', 'Columns', 'fill-columns')}${row('', 'Weave', 'fill-weave-3')}</div>`]]]
  ] },
  { group: 'Thread and stitches', id: 'colour-picker', title: 'Colour picker', note: 'A popover with four sources as a pill: Canvas (colours already used), Custom (any colour: field, hue, hex, or search a hex or a thread number), Saved (palettes) and From image. Colours are hex.', blocks: ['colour-picker', 'colour-field', 'swatch', 'shared'], cell: 320, rows: [
    ['Forms', [['Canvas', `<div class="c-popover"><div class="c-popover__title">Thread colour</div>${seg(TABS, 0)}<div class="c-swatchgrid">${SWATCHES.slice(0, 5).map((s, i) => swatchOf(s, i === 0 ? 'is-selected' : '')).join('')}</div></div>`], ['Custom', `<div class="c-popover"><div class="c-popover__title">Thread colour</div>${seg(TABS, 1)}<div class="c-picker__body" data-colour-field>${colourFieldHtml()}<label class="c-field"><span class="c-field__label">Hex</span><input value="#B84216" aria-label="Hex code"></label>${search('', '')}</div></div>`], ['Thread number found', `<div class="c-popover"><div class="c-popover__title">Thread colour</div>${seg(TABS, 1)}${search('is-focus', '3830')}<button class="c-reset c-row c-focus"><span class="c-row__art">${swatch('#B95544', { tag: 'span' })}</span>Thread 3830<span class="c-row__detail">#B95544</span></button></div>`], ['Nothing found', `<div class="c-popover"><div class="c-popover__title">Thread colour</div>${seg(TABS, 1)}${search('is-focus', 'zzz')}<div class="c-empty"><strong>Nothing found</strong>Try a hex code or a thread number</div></div>`], ['From image', `<div class="c-popover"><div class="c-popover__title">Thread colour</div>${seg(TABS, 3)}${drop('is-hover', `${ic('picture')}Drop an image to pull its colours`)}</div>`]]]
  ] },
  { group: 'Panel pieces', id: 'layer-row', title: 'Layer row', note: 'Name, show or hide, lock. Drag to reorder.', blocks: ['layer-row', 'icon-button', 'shared'], cell: 240, rows: [
    ['States', [['Rest', layer('')], ['Hover', layer('is-hover')], ['Selected', layer('is-selected')], ['Hidden', layer('is-hidden', 'Calla lilies', 'eye-off')], ['Dragging', layer('is-dragging')], ['Renaming', layer('is-renaming')]]]
  ] },
  { group: 'Panel pieces', id: 'section', title: 'Section', note: 'A collapsible panel group, with an optional action on the right.', blocks: ['section', 'shared'], cell: 240, rows: [
    ['States', [['Open', section('')], ['Closed', section('', false)], ['Hover', section('is-hover')], ['Focus', section('is-focus')], ['With action', section('', true, `<span class="c-section__action">${iconbtn('', 'c-iconbtn--sm', 'plus')}</span>`)], ['Divider', '<div class="c-rule" style="width:100%"></div>']]]
  ] },
  { group: 'Panel pieces', id: 'drop-zone', title: 'Drop zone and progress', note: 'Adding an image. A solid edge, never a dashed one.', cell: 220, rows: [
    ['States', [['Rest', drop('', `${ic('upload')}Add an image`)], ['Hover', drop('is-hover', `${ic('upload')}Add an image`)], ['File over it', drop('is-over', `${ic('upload')}Drop to add`)], ['Uploading', drop('', `${spin}Reading image<span class="c-progress"><span class="c-progress__bar"></span></span>`)], ['Error', drop('is-error', `${ic('alert')}Image could not be read`)]]],
    ['Progress', [['40%', '<span class="c-progress" style="display:block"><span class="c-progress__bar"></span></span>'], ['Spinner', spin]]]
  ] },
  { group: 'Panel pieces', id: 'playback', title: 'Playback bar', note: 'For Animate: play and a scrub track.', blocks: ['playback', 'slider', 'icon-button', 'shared'], cell: 260, rows: [
    ['States', [['Stopped', play('', 'play', 0, '0:00')], ['Playing', play('', 'close', 40, '0:04')], ['Scrubbing', play('is-dragging', 'play', 65, '0:06')]]]
  ] },
  { group: 'Panel pieces', id: 'code-block', title: 'Code block', note: 'The embed code, with a copy button. Copied swaps the icon to a check.', cell: 300, rows: [
    ['States', [['Rest', `<div class="c-code"><code>&lt;stitch-piece src="abc123" interactive&gt;</code>${iconbtn('', 'c-iconbtn--sm', 'copy')}</div>`], ['Hover', `<div class="c-code"><code>&lt;stitch-piece src="abc123" interactive&gt;</code>${iconbtn('', 'c-iconbtn--sm is-hover', 'copy')}</div>`], ['Copied', `<div class="c-code"><code>&lt;stitch-piece src="abc123" interactive&gt;</code>${iconbtn('', 'c-iconbtn--sm is-selected', 'check')}</div>`]]]
  ] },
  { group: 'Floating and feedback', id: 'floating-bars', title: 'Floating bars', note: 'They float over the canvas, so they get the raised surface and a shadow. In Figma, add the shadow as an effect: it is not part of the pasted SVG.', blocks: ['floating-bars', 'tool-button', 'icon-button', 'shared'], cell: 260, rows: [
    ['Bars', [['Tool bar', `<div class="c-bar c-bar--tools">${tool('', 'tool-select')}${tool('is-selected', 'tool-stitch')}${tool('', 'tool-fill')}${tool('', 'tool-pattern')}${tool('', 'tool-erase')}${tool('', 'tool-pan')}</div>`], ['Zoom', `<div class="c-bar c-bar--pill">${iconbtn('', 'c-iconbtn--sm', 'minus')}<span class="c-bar__zoom">100%</span>${iconbtn('', 'c-iconbtn--sm', 'plus')}<span class="c-bar__sep"></span>${iconbtn('', 'c-iconbtn--sm', 'fit')}</div>`], ['Selection bar', `<div class="c-bar">${iconbtn('', '', 'tool-pan')}${iconbtn('', '', 'recolour')}${iconbtn('', '', 'tool-stitch')}<span class="c-bar__sep"></span>${iconbtn('', '', 'clear')}</div>`]]]
  ] },
  { group: 'Floating and feedback', id: 'tooltip', title: 'Tooltip', note: 'As shadcn/ui\'s tooltip. It opens at once on hover or keyboard focus, 4px from the control, its arrow on it; flips below when there is no room above. It only fades in and out, never moves; going straight to the next control switches it with no fade. Add data-tip="Name" (and data-tip-key for a shortcut) to any control; tooltip.js does the rest.', blocks: ['tooltip', 'feedback', 'shared'], cell: 200, rows: [
    ['Forms', [['Label', '<span class="c-tooltip" data-side="top">Undo<span class="c-tooltip__arrow"></span></span>'], ['With shortcut', '<span class="c-tooltip" data-side="top">Undo<span class="c-kbd">⌘Z</span><span class="c-tooltip__arrow"></span></span>'], ['Below', '<span class="c-tooltip" data-side="bottom">Full cross<span class="c-tooltip__arrow"></span></span>']]],
    ['Live', [['Hover or tab', `<div class="c-tilegrid" style="grid-template-columns:repeat(3, var(--stitch-tile))">${['stitch-full', 'stitch-half', 'stitch-knot'].map((n) => `<button class="c-reset c-tile c-focus" aria-label="${n}" data-tip="${PRIMITIVES[n].label}">${prim(n)}</button>`).join('')}</div>`], ['With shortcut', iconbtn('', '', 'undo').replace('<button', '<button data-tip="Undo" data-tip-key="⌘Z"')]]]
  ] },
  { group: 'Floating and feedback', id: 'feedback', title: 'Key, badge, toast, save state, messages', note: 'Small things that tell you something. Errors always carry an icon and words.', cell: 170, rows: [
    ['Small parts', [['Key', '<span class="c-kbd">⌘Z</span>'], ['Badge', '<span class="c-badge">12</span>'], ['Helper text', '<span class="c-hint">22.5 cm at count 14</span>'], ['Error text', '<span class="c-hint c-hint--error">Up to 400 squares</span>']]],
    ['Save state', [['Saved', `<span class="c-save">${ic('check')}Saved</span>`], ['Saving', `<span class="c-save">${spin}Saving</span>`], ['Unsaved', '<span class="c-save"><span class="c-save__dot"></span>Unsaved changes</span>'], ['Failed', `<span class="c-save c-save--error">${ic('alert')}Could not save</span>`]]],
    ['Messages', [['Toast', `<span class="c-toast">${ic('check')}Copied</span>`], ['Error banner', `<div class="c-banner">${ic('alert')}Image could not be read</div>`], ['Empty', '<div class="c-empty"><strong>Nothing here yet</strong>Stitch, drop in an image, or type</div>']]]
  ] },
  { group: 'Floating and feedback', id: 'sheet', title: 'Sheet', note: 'A dialog for settings and confirmations. A destructive one pairs a quiet cancel with a danger button.', blocks: ['sheet', 'button', 'shared'], cell: 380, rows: [
    ['Forms', [['Confirm', `<div class="c-sheet"><div class="c-sheet__title">Delete this piece?</div><div>This can't be undone.</div><div class="c-sheet__actions">${btn('quiet', '', 'Cancel')}${btn('danger', '', 'Delete')}</div></div>`]]]
  ] }
];

// ─── render ──────────────────────────────────────────────────────────────────
const main = document.getElementById('main'), toastEl = document.getElementById('toast');
createTooltips(main);
const cssText = await fetch('controls.css').then((r) => r.text());
const BLOCKS = {};
for (const m of cssText.matchAll(/\/\* @control (\S+) \*\/\n([\s\S]*?)(?=\n\/\* @control |\s*$)/g)) BLOCKS[m[1]] = m[2].trim();
const slug = (s) => s.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

document.getElementById('index').innerHTML = [...new Set(SPECS.map((s) => s.group))].map((g) => `<span>${g}</span>${SPECS.filter((s) => s.group === g).map((s) => `<a href="#${s.id}">${s.title}</a>`).join('')}`).join('');
main.insertAdjacentHTML('beforeend', SPECS.map((s) => {
  const rows = s.rows.map(([label, cells, cell]) => `<div class="ct-row-label">${label}</div><div class="ct-cells" style="--cell:${cell || s.cell || 124}px">${cells.map(([state, html]) => {
    const name = `${s.title}-${label}-${state}`;
    return `<div class="ct-cell" data-name="${slug(name)}"><div class="ct-spec">${html}</div><button class="c-reset ct-copy c-focus" data-nosvg data-copy-state title="Copy as SVG for Figma">${state} <em>· Copy SVG</em></button></div>`;
  }).join('')}</div>`).join('');
  return `<section class="ct-sec" id="${s.id}" data-blocks="${(s.blocks || [s.id, 'shared']).join(' ')}"><h2>${s.title}</h2><p>${s.note}</p><div class="ct-rows">${rows}</div>
    <details class="ct-more"><summary>More info</summary><div class="ct-more-body"><div><h3>Colour tokens</h3><div data-tokens></div></div>
    <div><h3>CSS</h3><pre class="ct-css"></pre><div class="ct-actions"><button class="c-reset c-btn c-btn--secondary c-btn--sm c-focus" data-copy-css>Copy CSS</button><button class="c-reset c-btn c-btn--secondary c-btn--sm c-focus" data-copy-all>Copy all states as SVG</button></div></div></div></details></section>`;
}).join(''));
main.querySelectorAll('.ct-sec').forEach((sec) => { sec.querySelector('.ct-css').textContent = sec.dataset.blocks.split(' ').map((b) => BLOCKS[b]).filter(Boolean).join('\n\n'); });

// centre each line icon on its drawing, not its 24 px frame, so it sits true in small boxes
main.querySelectorAll('.c-ic svg').forEach((el) => {
  const b = el.getBBox(); if (!b.width && !b.height) return;
  el.setAttribute('viewBox', `${b.x + b.width / 2 - 12} ${b.y + b.height / 2 - 12} 24 24`);
});

const zoom = createZoomMotion(() => motionFrom(TUNING));
main.querySelectorAll('.tz-host').forEach((h) => { Object.assign(h.querySelector('svg').dataset, { n: ZOOM_N, o: 5, c: 14 }); zoom.sync(h); });
// the colour field in the picker's Custom form is live
main.querySelectorAll('[data-colour-field]').forEach((el) => createColourField(el, { hex: '#B84216', onChange: (hex) => { el.querySelector('input').value = hex; } }));

// the slider's preview uses a real palette colour as its thread
const rootStyle = () => getComputedStyle(document.documentElement);
const threadColour = rootStyle().getPropertyValue('--terracotta-500').trim();
main.querySelectorAll('[data-stage]').forEach((host) => {
  createStageSlider(host, { setting: host.dataset.stage, colour: threadColour });
  if ('held' in host.dataset) { host.querySelector('.ss').classList.add('ss-on'); host.querySelector('input').tabIndex = -1; host.style.pointerEvents = 'none'; }
});

// colour tokens used by a section, read from its CSS, with the step and value for the theme shown
const PALETTE_ORDER = ['neutral', 'terracotta', 'crimson', 'ochre', 'periwinkle', 'leaf', 'lilac'];
const STEPS = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
function renderTokens() {
  const cs = rootStyle(), byHex = {};
  for (const p of PALETTE_ORDER) for (const n of STEPS) { const v = cs.getPropertyValue(`--${p}-${n}`).trim().toUpperCase(); if (v && !byHex[v]) byHex[v] = `${p} ${n}`; }
  main.querySelectorAll('.ct-sec').forEach((sec) => {
    const names = [...new Set([...sec.querySelector('.ct-css').textContent.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]))];
    const colours = [], others = [];
    for (const n of names) { const v = cs.getPropertyValue(`--${n}`).trim(); (/^#/.test(v) ? colours : others).push([n, v]); }
    sec.querySelector('[data-tokens]').innerHTML = colours.map(([n, v]) => `<div class="ct-token"><i style="background:var(--${n})"></i><code>--${n}</code><span>${byHex[v.toUpperCase()] || ''} · ${v.toUpperCase()}</span></div>`).join('')
      + `<p class="ct-others">Also uses: ${others.map(([n]) => `--${n}`).join(', ')}</p>`;
  });
}

// ─── theme ───────────────────────────────────────────────────────────────────
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('#theme button').forEach((b) => b.classList.toggle('is-selected', b.dataset.themePick === t));
  renderTokens();
  try { localStorage.setItem('selvedge-controls-theme', t); } catch {}
}
let savedTheme = null;
try { savedTheme = localStorage.getItem('selvedge-controls-theme'); } catch {}
setTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
document.getElementById('theme').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTheme(b.dataset.themePick); });

// ─── segmented pill motion, tuned with DialKit ───────────────────────────────
const dialValues = Object.fromEntries(Object.entries(SEG_MOTIONS).map(([k, m]) => [k, dialDefaults(m.dials)]));
const motions = {};
main.querySelectorAll('[data-motion]').forEach((el) => { const k = el.dataset.motion; (motions[k] ||= []).push(createSegMotion(el, () => dialValues[k])); });
// the live stitch grid travels with the same motion
main.querySelectorAll('.c-tilegrid[data-live]').forEach((el) => motions.squash.push(createSegMotion(el, () => dialValues.squash, { option: '.c-tile' })));
// the page still works if the panel can't load
import('https://cdn.jsdelivr.net/npm/dialkit@2.0.0/dist/vanilla/index.js').then(({ createDialKit, createDialRoot }) => {
  const dialRoot = createDialRoot({ position: 'bottom-right', theme: document.documentElement.dataset.theme, defaultOpen: false });
  new MutationObserver(() => { dialRoot.element.querySelectorAll('[data-theme]').forEach((n) => n.setAttribute('data-theme', document.documentElement.dataset.theme)); dialRoot.element.setAttribute('data-theme', document.documentElement.dataset.theme); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  for (const [k, m] of Object.entries(SEG_MOTIONS)) {
    const kit = createDialKit(`Squash: ${m.title}`, m.dials, { id: `selvedge-seg-${k}-2`, persist: true, onAction: () => motions[k].forEach((x) => x.next()) });
    kit.subscribe((vals) => { dialValues[k] = vals; });
  }
}).catch(() => {});

// ─── live specimens ──────────────────────────────────────────────────────────
main.addEventListener('click', (e) => {
  const opt = e.target.closest('[data-live] .c-seg__opt, [data-live] .c-tile');
  if (opt) opt.parentElement.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', b === opt));
  const swi = e.target.closest('.c-switch[data-live]');
  if (swi) swi.setAttribute('aria-checked', swi.getAttribute('aria-checked') !== 'true');
});
function setSlider(el, v) {
  v = Math.max(0, Math.min(100, Math.round(v)));
  el.style.setProperty('--v', `${v}%`);
  el.querySelector('.c-slider__value').textContent = `${v}%`;
  el.querySelector('.c-slider__thumb').setAttribute('aria-valuenow', v);
}
main.querySelectorAll('.c-slider[data-live]').forEach((el) => {
  const track = el.querySelector('.c-slider__track'), thumb = el.querySelector('.c-slider__thumb');
  const at = (e) => { const r = track.getBoundingClientRect(); setSlider(el, ((e.clientX - r.left) / r.width) * 100); };
  track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); el.classList.add('is-dragging'); at(e); thumb.focus({ preventScroll: true }); });
  track.addEventListener('pointermove', (e) => { if (track.hasPointerCapture(e.pointerId)) at(e); });
  track.addEventListener('pointerup', () => el.classList.remove('is-dragging'));
  thumb.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
    if (d == null) return;
    e.preventDefault(); setSlider(el, Number(thumb.getAttribute('aria-valuenow')) + d);
  });
});

// ─── copy as SVG: walks what is on screen, so it is exact for the theme shown ─
const canvasCtx = document.createElement('canvas').getContext('2d');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const round = (n) => Math.round(n * 100) / 100;
const paint = (c) => {
  const m = c && c.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if (a === 0) return null;
  const hex = `#${[m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  return { hex, a };
};
const fillAttr = (p) => `fill="${p.hex}"${p.a < 1 ? ` fill-opacity="${p.a}"` : ''}`;
function textAt(str, x, top, height, cs, color) {
  const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; canvasCtx.font = font;
  const m = canvasCtx.measureText('Hg'), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  const y = top + (height - (asc + desc)) / 2 + asc, p = paint(color); if (!p) return '';
  const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  const ls = cs.letterSpacing === 'normal' ? '' : ` letter-spacing="${parseFloat(cs.letterSpacing)}"`;
  return `<text x="${round(x)}" y="${round(y)}" font-family="${esc(family)}" font-size="${parseFloat(cs.fontSize)}" font-weight="${cs.fontWeight}"${ls} ${fillAttr(p)} xml:space="preserve">${esc(cs.textTransform === 'uppercase' ? str.toUpperCase() : str)}</text>`;
}
function textNode(node, ox, oy) {
  const raw = node.nodeValue; if (!raw.trim()) return '';
  const cs = getComputedStyle(node.parentElement), range = document.createRange();
  let out = '', line = '', lx = 0, lt = 0, lh = 0, lastTop = null;
  for (let i = 0; i < raw.length; i++) {
    range.setStart(node, i); range.setEnd(node, i + 1);
    const r = range.getClientRects()[0]; if (!r || (!r.width && !raw[i].trim())) continue;
    if (lastTop === null || Math.abs(r.top - lastTop) > 2) {
      if (line.trim()) out += textAt(line.trimEnd(), lx - ox, lt - oy, lh, cs, cs.color);
      line = ''; lx = r.left; lt = r.top; lh = r.height; lastTop = r.top;
    }
    line += raw[i];
  }
  if (line.trim()) out += textAt(line.trimEnd(), lx - ox, lt - oy, lh, cs, cs.color);
  return out;
}
function inlineSvg(el, ox, oy) {
  const host = el.parentElement.matches('.c-spin') ? el.parentElement : el, r = host.getBoundingClientRect();
  const vb = el.viewBox.baseVal, sx = vb && vb.width ? r.width / vb.width : 1, sy = vb && vb.height ? r.height / vb.height : 1;
  const clone = el.cloneNode(true), src = el.querySelectorAll('*'), dst = clone.querySelectorAll('*');
  src.forEach((node, i) => {
    const d = dst[i], tag = node.tagName.toLowerCase();
    if (node.classList.contains('tz-many')) d.setAttribute('data-drop', '');
    d.removeAttribute('class'); d.removeAttribute('style');
    if (!['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(tag)) {
      // groups can carry currentColor too: write the resolved colour
      for (const attr of ['fill', 'stroke']) if (d.getAttribute(attr) === 'currentColor') { const c = paint(getComputedStyle(node)[attr]); d.setAttribute(attr, c ? c.hex : 'none'); }
      return;
    }
    const cs = getComputedStyle(node), fill = paint(cs.fill), stroke = paint(cs.stroke);
    if (!(d.getAttribute('fill') || '').includes('url')) d.setAttribute('fill', fill ? fill.hex : 'none');
    if (!(d.getAttribute('stroke') || '').includes('url')) d.setAttribute('stroke', stroke ? stroke.hex : 'none');
    if (stroke) { d.setAttribute('stroke-width', parseFloat(cs.strokeWidth)); d.setAttribute('stroke-linecap', cs.strokeLinecap); d.setAttribute('stroke-linejoin', cs.strokeLinejoin); }
    if (cs.fillOpacity !== '1') d.setAttribute('fill-opacity', cs.fillOpacity);
  });
  clone.querySelectorAll('style, [data-drop], mask').forEach((s) => s.remove());
  clone.querySelectorAll('[mask]').forEach((s) => s.removeAttribute('mask'));
  const vx = vb && vb.width ? vb.x * sx : 0, vy = vb && vb.height ? vb.y * sy : 0;
  return `<g transform="translate(${round(r.left - ox - vx)} ${round(r.top - oy - vy)}) scale(${round(sx * 1000) / 1000} ${round(sy * 1000) / 1000})">${clone.innerHTML}</g>`;
}
function box(el, cs, ox, oy) {
  const r = el.getBoundingClientRect(); if (!r.width && !r.height) return '';
  const x = r.left - ox, y = r.top - oy, w = r.width, h = r.height, rx = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
  let out = '';
  const bg = paint(cs.backgroundColor), sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => ({ w: parseFloat(cs[`border${s}Width`]) || 0, c: cs[`border${s}Style`] === 'none' ? null : paint(cs[`border${s}Color`]) }));
  const uniform = sides.every((s) => s.w === sides[0].w && s.c && sides[0].c && s.c.hex === sides[0].c.hex) && sides[0].w > 0;
  if (bg) out += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${round(rx)}" ${fillAttr(bg)}/>`;
  if (uniform) { const b = sides[0].w; out += `<rect x="${round(x + b / 2)}" y="${round(y + b / 2)}" width="${round(w - b)}" height="${round(h - b)}" rx="${round(Math.max(0, rx - b / 2))}" fill="none" stroke="${sides[0].c.hex}" stroke-width="${b}"/>`; }
  else sides.forEach((s, i) => { if (!s.w || !s.c) return; const a = [[x, y, w, s.w], [x + w - s.w, y, s.w, h], [x, y + h - s.w, w, s.w], [x, y, s.w, h]][i]; out += `<rect x="${round(a[0])}" y="${round(a[1])}" width="${round(a[2])}" height="${round(a[3])}" fill="${s.c.hex}"/>`; });
  if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
    const o = parseFloat(cs.outlineWidth), off = parseFloat(cs.outlineOffset) || 0, c = paint(cs.outlineColor), g = off + o / 2;
    if (c) out += `<rect x="${round(x - g)}" y="${round(y - g)}" width="${round(w + g * 2)}" height="${round(h + g * 2)}" rx="${round(rx + g)}" fill="none" stroke="${c.hex}" stroke-width="${o}"/>`;
  }
  return out;
}
function fieldText(el, cs, ox, oy) {
  const r = el.getBoundingClientRect(), value = el.value, ph = !value;
  const shown = ph ? el.placeholder : value; if (!shown) return '';
  const color = ph ? getComputedStyle(el, '::placeholder').color : cs.color, padL = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
  canvasCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3, top = el.tagName === 'TEXTAREA' ? r.top + parseFloat(cs.paddingTop) : r.top + (r.height - lh) / 2;
  return textAt(shown, r.left + padL - ox, top - oy, lh, cs, color);
}
function rangeInput(el, ox, oy) {
  const r = el.getBoundingClientRect(), root = rootStyle(), track = root.getPropertyValue('--control-track').trim(), fill = root.getPropertyValue('--control-fill').trim(), panel = root.getPropertyValue('--surface-panel').trim();
  const t = (Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min)), x = r.left - ox, cy = r.top - oy + r.height / 2, cx = x + 8 + t * (r.width - 16);
  return `<rect x="${round(x)}" y="${round(cy - 2)}" width="${round(r.width)}" height="4" rx="2" fill="${track}"/><circle cx="${round(cx)}" cy="${round(cy)}" r="7" fill="${panel}" stroke="${fill}" stroke-width="2"/>`;
}
function walk(el, ox, oy) {
  if (el.nodeType === 3) return textNode(el, ox, oy);
  if (el.nodeType !== 1 || el.hasAttribute('data-nosvg')) return '';
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return '';
  if (el.tagName === 'svg' || el.tagName === 'SVG') return inlineSvg(el, ox, oy);
  let out = box(el, cs, ox, oy);
  if (el.tagName === 'INPUT' && el.type === 'range') out = rangeInput(el, ox, oy);
  else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') out += fieldText(el, cs, ox, oy);
  else for (const child of el.childNodes) out += walk(child, ox, oy);
  const name = el.dataset.name;
  return name ? `<g id="${esc(name)}">${out}</g>` : out;
}
function bounds(root) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  [root, ...root.querySelectorAll('*')].forEach((el) => {
    if (el.closest('[data-nosvg]')) return;
    const cs = getComputedStyle(el); if (cs.display === 'none' || Number(cs.opacity) === 0) return;
    const q = el.getBoundingClientRect(); if (!q.width || !q.height) return;
    const pad = cs.outlineStyle !== 'none' ? (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0) : 0;
    l = Math.min(l, q.left - pad); t = Math.min(t, q.top - pad); r = Math.max(r, q.right + pad); b = Math.max(b, q.bottom + pad);
  });
  return { l: Math.floor(l), t: Math.floor(t), w: Math.ceil(r - l), h: Math.ceil(b - t) };
}
function toSvg(root, name, content = root.childNodes) {
  const q = bounds(root); let body = '';
  for (const child of content) body += walk(child, q.l, q.t);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${q.w}" height="${q.h}" viewBox="0 0 ${q.w} ${q.h}"><g id="${esc(name)}">${body}</g></svg>`;
}
let toastTimer;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800); }
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { toast('Copy blocked by the browser'); }
}
main.addEventListener('click', (e) => {
  const state = e.target.closest('[data-copy-state]'), css = e.target.closest('[data-copy-css]'), all = e.target.closest('[data-copy-all]');
  if (state) { const cell = state.closest('.ct-cell'), spec = cell.querySelector('.ct-spec'); copy(toSvg(spec, cell.dataset.name), `Copied SVG: ${state.firstChild.nodeValue.trim()}, paste into Figma`); }
  if (css) copy(css.closest('.ct-more').querySelector('.ct-css').textContent, 'Copied CSS');
  const values = e.target.closest('[data-copy-motion]');
  if (values) { const { replay, ...v } = dialValues[values.dataset.copyMotion]; copy(JSON.stringify(v, null, 2), 'Copied the values'); }
  if (all) { const rows = all.closest('.ct-sec').querySelector('.ct-rows'); copy(toSvg(rows, slug(all.closest('.ct-sec').querySelector('h2').textContent)), 'Copied all states as SVG, paste into Figma'); }
});
window.selvedgeControls = { toSvg };
