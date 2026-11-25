// The selection bar: floats over the cloth just above a selection (below it when there's no room), with what you do to a
// selection right after making it. Left to right:
//   Thread   one split box, stitch | colour: the stitch drawn in its colour, then the colour's chip and hex, each half
//            with a chevron and its own pop-up (the stitch tiles, the colour picker). When the selection holds several,
//            each half shows what's in it: the stitches' drawings side by side, the colours' chips overlapping, up to
//            three or four and then +n; the pop-ups then list them first, to change one at a time or all at once
//   Outline  the backstitch drawing, at the icon buttons' weight; pressed once the selection has an outline round it
//   Hide / Show, Delete
//   More     what's used less: duplicate, flip, invert the selection, turn it into pattern
// Moving is direct (drag the selection, arrow keys), and copy, paste and duplicate are keys, so neither has a button.
// selectionBarHtml(state) draws it; the studio places it and wires data-selbar="stitch|colour|outline|hide|delete|more".
// Styled by the selection-bar block of controls.css.
import { svg } from './icons/icons.js';
import { threadSvg } from './icons/thread.js';
import { swatch } from './swatch.js';
import { primitiveSvg } from './icons/primitives.js';

const ic = (n) => `<span class="c-ic">${svg(n)}</span>`;
let uid = 0;

const more = (n) => (n > 0 ? `<span class="c-selbar__more">+${n}</span>` : '');
/** The stitches in a mixed selection: their line drawings side by side (primitive names), three at most, then +n */
const stitchStack = (names) => `<span class="c-selbar__stack">${names.slice(0, 3).map((n) => `<span class="c-selbar__art">${primitiveSvg(n, { size: 20, frame: 'square', animate: false, holes: 0, id: `sbs${uid++}` })}</span>`).join('')}</span>${more(names.length - 3)}`;
/** The colours in a mixed selection: chips overlapping, four at most, then +n */
const colourStack = (hexes) => `<span class="c-selbar__chips">${hexes.slice(0, 4).map((h) => swatch(h, { tag: 'span' })).join('')}</span>${more(hexes.length - 4)}`;

/** state: stitch (a thread icon name), colour (hex), mixedStitch, mixedColour, stitches (primitive names in a mixed
 * selection, most first), colours (hexes in a mixed selection, most first), outline (on), hidden, open ('stitch' |
 * 'colour' | 'more'), hover (a part held in its hover look) */
export function selectionBarHtml({ stitch = 'stitch-full', colour = '#D27FA8', mixedStitch = false, mixedColour = false, stitches = ['stitch-full', 'fill-columns', 'stitch-back'], colours = ['#D27FA8', '#E0A3CA', '#F8F6F0', '#B43184', '#4F8A4B'], outline = false, hidden = false, open = null, hover = null, stitchName = 'Full cross' } = {}) {
  const st = (part) => `${open === part ? ' is-open' : ''}${hover === part ? ' is-hover' : ''}`;
  const art = mixedStitch ? stitchStack(stitches)
    : `<span class="c-selbar__art">${threadSvg(stitch, { colour, size: 20, id: `sb${uid++}`, animate: false, holes: 0 })}</span>`;
  const col = mixedColour ? colourStack(colours) : `${swatch(colour, { tag: 'span' })}<span>${colour.toUpperCase()}</span>`;
  const btn = (part, icon, label, extra = '') => `<button class="c-reset c-iconbtn c-focus${st(part)}" aria-label="${label}" data-tip="${label}" data-selbar="${part}" ${extra}>${icon}</button>`;
  return `<div class="c-bar c-selbar" role="toolbar" aria-label="Selection">`
    + `<span class="c-selbar__thread" role="group" aria-label="Thread">`
    + `<button class="c-reset c-selbar__half c-focus${st('stitch')}" aria-haspopup="true" aria-label="Stitch: ${mixedStitch ? `${stitches.length} kinds` : stitchName}" data-tip="${mixedStitch ? `${stitches.length} stitches` : 'Stitch'}" data-selbar="stitch">${art}${ic('chevron-down')}</button>`
    + `<button class="c-reset c-selbar__half c-focus${st('colour')}" aria-haspopup="dialog" aria-label="Colour: ${mixedColour ? `${colours.length} colours` : colour}" data-tip="${mixedColour ? `${colours.length} colours` : 'Colour'}" data-selbar="colour">${col}${ic('chevron-down')}</button>`
    + `</span><span class="c-bar__sep"></span>`
    // the backstitch drawing at the icon buttons' weight (2.25), its holes as strong as the icons' dots
    + btn('outline', `<span class="c-selbar__art">${primitiveSvg('stitch-back', { size: 20, stroke: 2.25, holes: 1, frame: 'square', animate: false, id: `sbo${uid++}` })}</span>`, outline ? 'Remove outline' : 'Add outline', `aria-pressed="${outline}"`)
    + '<span class="c-bar__sep"></span>'
    + btn('hide', ic(hidden ? 'eye-off' : 'eye'), hidden ? 'Show' : 'Hide')
    + btn('delete', ic('bin'), 'Delete')
    + '<span class="c-bar__sep"></span>'
    + btn('more', ic('more'), 'More', 'aria-haspopup="menu"')
    + '</div>';
}
