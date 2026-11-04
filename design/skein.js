// The skein: a thread colour drawn as a skein, not a flat swatch. One drawing for every page; styled by the
// skein block of controls.css (the twist band and the bar under it that marks hover and selected).
// colour is a token name ('--terracotta-500') or any CSS colour ('#B84216').

import { primitiveSvg } from './icons/primitives.js';

// Ways to show a thread colour. 'skein' is the default; the others are being tried on the Panel tab (DialKit).
// Each draws in the same 32 × 20 box, in currentColor, with a faint edge so pale and dark colours still show.
const EDGE = 'class="c-skein__edge"';
export const SKEIN_LOOKS = {
  skein: { label: 'Skein', body: () => '<rect x="1" y="3" width="30" height="14" rx="6" fill="currentColor"/><rect class="c-skein__twist" x="12" y="2" width="8" height="16" rx="2"/>' },
  dot: { label: 'Dot', body: () => `<circle cx="16" cy="10" r="8" fill="currentColor"/><circle ${EDGE} cx="16" cy="10" r="8"/>` },
  chip: { label: 'Chip', body: () => `<rect x="8" y="2" width="16" height="16" rx="4" fill="currentColor"/><rect ${EDGE} x="8" y="2" width="16" height="16" rx="4"/>` },
  cross: { label: 'Cross stitch', svg: (style) => primitiveSvg('stitch-full', { size: 20, stroke: 3, holes: 0 }).replace('<svg ', `<svg style="${style}" `) },
  strand: { label: 'Thread', body: () => '<path d="M4 14C9 3 13 17 18 8S26 5 28 6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path class="c-skein__groove" d="M4 14C9 3 13 17 18 8S26 5 28 6"/>' },
  spool: { label: 'Spool', body: () => '<rect x="10" y="4" width="12" height="12" rx="1.5" fill="currentColor"/><rect class="c-skein__twist" x="7" y="2" width="3" height="16" rx="1"/><rect class="c-skein__twist" x="22" y="2" width="3" height="16" rx="1"/>' },
};
let look = 'skein';
/** Switch every skein drawn from now on to another look (a SKEIN_LOOKS key). */
export const setSkeinLook = (name) => { if (SKEIN_LOOKS[name]) look = name; };

/** The colour drawing on its own, in the current look. */
export const skeinSvg = (colour) => {
  const style = `color:${colour.startsWith('--') ? `var(${colour})` : colour}`, l = SKEIN_LOOKS[look];
  return l.svg ? l.svg(style) : `<svg viewBox="0 0 32 20" aria-hidden="true" style="${style}">${l.body()}</svg>`;
};

/**
 * The skein control. tag 'button' (clickable, focusable) or 'span' (shown only, as in a field).
 * cls: state or form classes (is-selected, is-edge…); attrs: extra attributes; extra: markup after the bar (a count badge).
 */
export const skein = (colour, { tag = 'button', cls = '', attrs = '', extra = '' } = {}) => {
  const role = tag === 'button' ? 'c-focus' : '', aria = tag === 'button' ? '' : ' role="img"';
  return `<${tag} class="c-reset c-skein ${role} ${cls}"${aria} aria-label="Thread"${attrs ? ` ${attrs}` : ''}>${skeinSvg(colour)}<span class="c-skein__bar"></span>${extra}</${tag}>`;
};
