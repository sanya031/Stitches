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
export const fieldHtml = () => `<div class="c-colourfield" tabindex="0" role="slider" aria-label="Saturation and brightness"><span class="c-colourfield__thumb"></span></div>`;
export const hueHtml = () => `<div class="c-hue" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="360"><span class="c-hue__thumb"></span></div>`;

// The hue bar's hand feel, as the stage slider's (STAGE_TUNING.hand): drag moves the hue from where it is, the bar
// grows while held, moving the pointer above or below it slows the drag, and it stops at the ends. No stops along
// it: hue is continuous, so it stays where you let go.
export const HUE_TUNING = {
  tapJump: 3,      // px: a press that moves less than this jumps to where it was pressed
  fine: 80,        // px above or below the bar for quarter speed
};
export const colourFieldHtml = () => fieldHtml() + hueHtml();

/**
 * Wire a field and hue slider inside root. onChange(hex) on every move; set(hex) moves them without calling it.
 * hand: the hue bar takes the hand feel (HUE_TUNING).
 */
export function createColourField(root, { hex = '#B84216', onChange = () => {}, hand = false } = {}) {
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
  if (hand) handHue(); else drag(hue, (x) => { c.h = Math.min(359.9, x * 360); });

  function handHue() {
    hue.classList.add('c-hue--hand');
    hue.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); hue.focus({ preventScroll: true, focusVisible: false });
      hue.setPointerCapture(e.pointerId);
      const r = hue.getBoundingClientRect(), x0 = e.clientX;
      let last = e.clientX, moved = false;
      hue.classList.add('is-held');
      const move = (ev) => {
        if (Math.abs(ev.clientX - x0) >= HUE_TUNING.tapJump) moved = true;
        if (!moved) return;
        const off = Math.max(0, r.top - ev.clientY, ev.clientY - r.bottom), speed = 1 / (1 + 3 * Math.min(1, off / HUE_TUNING.fine));
        c.h = clamp(c.h + ((ev.clientX - last) / r.width) * 360 * speed, 0, 359.9);
        last = ev.clientX; change();
      };
      const up = (ev) => {
        if (!moved) { c.h = Math.min(359.9, clamp((ev.clientX - r.left) / r.width) * 360); change(); }
        hue.classList.remove('is-held');
        hue.removeEventListener('pointermove', move); hue.removeEventListener('pointerup', up); hue.removeEventListener('pointercancel', up);
      };
      hue.addEventListener('pointermove', move); hue.addEventListener('pointerup', up); hue.addEventListener('pointercancel', up);
    });
  }

  field.addEventListener('keydown', (e) => {
    const k = e.shiftKey ? 0.1 : 0.01, d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, k], ArrowDown: [0, -k] }[e.key];
    if (!d) return; e.preventDefault(); c.s = clamp(c.s + d[0]); c.v = clamp(c.v + d[1]); change();
  });
  hue.addEventListener('keydown', (e) => {
    const k = e.shiftKey ? 10 : 1, d = { ArrowLeft: -k, ArrowDown: -k, ArrowRight: k, ArrowUp: k }[e.key];
    if (!d) return; e.preventDefault(); c.h = clamp(c.h + d, 0, 359.9); change();
  });

  draw();
  return { set(next) { const h = c.h; c = hexToHsv(next); if (!c.s || !c.v) c.h = h; draw(); } };
}

// ─── notations: the same colour as hex, RGB or HSL, to show in a field and read back what's typed ───
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hexFromRgb = (rgb) => `#${rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
function hslOf(hex) {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, { h } = hexToHsv(hex);
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hexFromHsl([h, s, l]) {
  s = clamp(s / 100); l = clamp(l / 100);
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return hexFromRgb([0, 8, 4].map((n) => (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255));
}
export const NOTATIONS = [['hex', 'Hex'], ['rgb', 'RGB'], ['hsl', 'HSL']];

/** The colour written in a notation: '#B84216', '184, 66, 22' or '16°, 79%, 40%'. */
export function formatColour(hex, notation = 'hex') {
  if (notation === 'rgb') return rgbOf(hex).join(', ');
  if (notation === 'hsl') { const [h, s, l] = hslOf(hex); return `${h}°, ${s}%, ${l}%`; }
  return hex;
}
/** What's typed in a notation as #RRGGBB, or null while it isn't a colour yet. */
export function parseColour(text, notation = 'hex') {
  if (notation === 'hex') return parseHex(text);
  const n = text.match(/-?\d+(\.\d+)?/g);
  if (!n || n.length !== 3) return null;
  const v = n.map(Number);
  return notation === 'rgb' ? hexFromRgb(v) : hexFromHsl(v);
}

/** The colour as its three numbers in a notation: [r, g, b] or [h, s, l]; for fields with one box per number. */
export const colourParts = (hex, notation) => (notation === 'hsl' ? hslOf(hex) : rgbOf(hex));
/** Three typed numbers in a notation as #RRGGBB, or null while one isn't a number yet. RGB 0–255; HSL 0–360, 0–100, 0–100. */
export function colourFromParts(parts, notation) {
  const v = parts.map((t) => (String(t).trim() === '' ? NaN : Number(t)));
  if (v.some((x) => !Number.isFinite(x))) return null;
  return notation === 'hsl' ? hexFromHsl([((v[0] % 360) + 360) % 360, v[1], v[2]]) : hexFromRgb(v);
}
