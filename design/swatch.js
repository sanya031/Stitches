// The swatch: a thread colour as a chip, a small rounded square in the colour with a faint edge so pale and dark
// colours still show. One drawing for every page; styled by the swatch block of controls.css (the bar under it
// marks hover and selected). colour is a token name ('--terracotta-500') or any CSS colour ('#B84216').

/** The chip on its own. */
export const swatchSvg = (colour) => `<svg viewBox="0 0 16 16" aria-hidden="true" style="color:${colour.startsWith('--') ? `var(${colour})` : colour}"><rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill="currentColor"/><rect class="c-swatch__edge" x="0.5" y="0.5" width="15" height="15" rx="3.5"/></svg>`;

/**
 * The swatch control. tag 'button' (clickable, focusable) or 'span' (shown only, as in a field).
 * cls: state classes (is-selected…); attrs: extra attributes; extra: markup after the bar (a count badge).
 */
export const swatch = (colour, { tag = 'button', cls = '', attrs = '', extra = '' } = {}) => {
  const role = tag === 'button' ? 'c-focus' : '', aria = tag === 'button' ? '' : ' role="img"';
  return `<${tag} class="c-reset c-swatch ${role} ${cls}"${aria} aria-label="Thread colour"${attrs ? ` ${attrs}` : ''}>${swatchSvg(colour)}<span class="c-swatch__bar"></span>${extra}</${tag}>`;
};
