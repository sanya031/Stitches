// The skein: a thread colour drawn as a skein, not a flat swatch. One drawing for every page; styled by the
// skein block of controls.css (the twist band and the bar under it that marks hover and selected).
// colour is a token name, e.g. '--terracotta-500'.

/** The skein drawing on its own: a rounded hank in the thread colour with a paper band twisted round its middle. */
export const skeinSvg = (colour) => `<svg viewBox="0 0 32 20" aria-hidden="true" style="color:var(${colour})"><rect x="1" y="3" width="30" height="14" rx="6" fill="currentColor"/><rect class="c-skein__twist" x="12" y="2" width="8" height="16" rx="2"/></svg>`;

/**
 * The skein control. tag 'button' (clickable, focusable) or 'span' (shown only, as in a field).
 * cls: state or form classes (is-selected, is-edge…); attrs: extra attributes; extra: markup after the bar (a count badge).
 */
export const skein = (colour, { tag = 'button', cls = '', attrs = '', extra = '' } = {}) => {
  const role = tag === 'button' ? 'c-focus' : '', aria = tag === 'button' ? '' : ' role="img"';
  return `<${tag} class="c-reset c-skein ${role} ${cls}"${aria} aria-label="Thread"${attrs ? ` ${attrs}` : ''}>${skeinSvg(colour)}<span class="c-skein__bar"></span>${extra}</${tag}>`;
};
