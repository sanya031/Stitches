// Colour field and hue slider: pick any colour. The field is saturation (left to right) by brightness (top to
// bottom) at the current hue; the slider sets the hue. Drag, click, or use the arrow keys (shift for bigger
// steps). Styled by the colour-field block of controls.css. Also: hex helpers shared by the colour picker.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** #rrggbb for any CSS colour or token name ('--terracotta-500'), as the browser draws it. */
export function hexOf(colour) {
  const css = colour.startsWith('--') ? getComputedStyle(document.documentElement).getPropertyValue(colour).trim() : colour;
  const ctx = (hexOf.ctx ||= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true }));
  ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** A typed hex (with or without #, 3 or 6 digits) as #RRGGBB, or null. */
export function parseHex(text) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
}

function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const f = (k) => { const x = (k + h / 60) % 6; return v - v * s * Math.max(0, Math.min(x, 4 - x, 1)); };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Markup for the field and the hue slider; createColourField() brings it to life. */
export const colourFieldHtml = () => `<div class="c-colourfield" tabindex="0" role="slider" aria-label="Saturation and brightness"><span class="c-colourfield__thumb"></span></div>`
  + `<div class="c-hue" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="360"><span class="c-hue__thumb"></span></div>`;

/** Wire a field and hue slider inside root. onChange(hex) on every move; set(hex) moves them without calling it. */
export function createColourField(root, { hex = '#B84216', onChange = () => {} } = {}) {
  const field = root.querySelector('.c-colourfield'), hue = root.querySelector('.c-hue');
  let c = hexToHsv(hex);

  function draw() {
    const pure = hsvToHex({ h: c.h, s: 1, v: 1 });
    field.style.setProperty('--hue', pure);
    field.style.setProperty('--x', `${c.s * 100}%`);
    field.style.setProperty('--y', `${(1 - c.v) * 100}%`);
    field.style.setProperty('--colour', hsvToHex(c));
    field.setAttribute('aria-valuetext', `Saturation ${Math.round(c.s * 100)}%, brightness ${Math.round(c.v * 100)}%`);
    hue.style.setProperty('--h', `${(c.h / 360) * 100}%`);
    hue.style.setProperty('--hue', pure);
    hue.setAttribute('aria-valuenow', Math.round(c.h));
  }
  const change = () => { draw(); onChange(hsvToHex(c)); };

  function drag(el, move) {
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      const at = (ev) => { const r = el.getBoundingClientRect(); move(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height)); change(); };
      at(e);
      const up = () => { el.removeEventListener('pointermove', at); el.removeEventListener('pointerup', up); };
      el.addEventListener('pointermove', at); el.addEventListener('pointerup', up);
    });
  }
  drag(field, (x, y) => { c.s = x; c.v = 1 - y; });
  drag(hue, (x) => { c.h = Math.min(359.9, x * 360); });

  field.addEventListener('keydown', (e) => {
    const k = e.shiftKey ? 0.1 : 0.01, d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, k], ArrowDown: [0, -k] }[e.key];
    if (!d) return; e.preventDefault(); c.s = clamp(c.s + d[0]); c.v = clamp(c.v + d[1]); change();
  });
  hue.addEventListener('keydown', (e) => {
    const k = e.shiftKey ? 10 : 1, d = { ArrowLeft: -k, ArrowDown: -k, ArrowRight: k, ArrowUp: k }[e.key];
    if (!d) return; e.preventDefault(); c.h = (c.h + d + 360) % 360; change();
  });

  draw();
  return { set(next) { const h = c.h; c = hexToHsv(next); if (!c.s || !c.v) c.h = h; draw(); } };
}
