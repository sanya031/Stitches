// Shared-element morph between two stage sliders: each part of the old one (box, label, number, track or fill,
// thumb or handle, markers, bubble, stitch) is matched to the same part of the new one and moves and resizes from
// where it was to where it is now, following the new slider live, so the morph keeps up with a moving value.
// A part only one side has fades out where it was, or in where it lands. While a morph runs, both sliders are
// hidden and a drawing of the parts stands in for them.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const shown = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && Number(getComputedStyle(el).opacity) > 0.02;
const BOX = ['background-color', 'background-image', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius', 'box-shadow',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'color'];
const TEXT = ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-variant-numeric'];

/** The parts of the slider in `layer`: key → { rect, kind, el, opacity, style } */
export function partsOf(layer) {
  const ss = layer.querySelector('.ss'), parts = new Map(), bar = ss.classList.contains('ss--bar');
  const add = (key, el, kind, extra = {}) => {
    if (!extra.rect && !shown(el)) return;
    const cs = el && getComputedStyle(el);
    parts.set(key, { key, el, kind, rect: extra.rect || el.getBoundingClientRect(), opacity: extra.opacity ?? (cs ? Number(cs.opacity) : 1), style: extra.style || cs, text: extra.text });
  };
  add('box', ss.classList.contains('ss--hand') ? ss.querySelector('.ss-clip') : ss, 'box');
  const label = layer.querySelector('.c-label, .ss-label');
  add('label', label, 'text', { text: label?.textContent });
  const num = ss.querySelector('.ss-edit') || ss.querySelector('.ss-out');
  if (num) {
    const t = num.value ?? num.textContent, cs = getComputedStyle(num), r = num.getBoundingClientRect();
    // the digits, not the whole field: an editable number sits in a padded box
    const pad = parseFloat(cs.paddingLeft) || 0, right = cs.textAlign === 'right' || cs.textAlign === 'end';
    const w = measure(t, cs);
    add('number', num, 'text', { text: t, rect: new DOMRect(right ? r.right - (parseFloat(cs.paddingRight) || 0) - w : r.left + pad, r.top, w, r.height), opacity: 1 });
  }
  const input = ss.querySelector('input[type=range]');
  if (bar) {
    add('track', ss.querySelector('.ss-fill'), 'box');
    add('thumb', ss.querySelector('.ss-handle'), 'box');
    ss.querySelectorAll('.ss-mark').forEach((m) => add(`mark${m.dataset.at}`, m, 'box'));
  } else {
    // a native range draws its own track and thumb: drawn here to match controls.css
    const r = input.getBoundingClientRect(), mid = r.top + r.height / 2, f = Number(input.value) / Number(input.max);
    add('track', null, 'box', { rect: new DOMRect(r.left, mid - 2, r.width, 4), style: { 'background-color': 'var(--control-track)', 'border-top-left-radius': '999px', 'border-top-right-radius': '999px', 'border-bottom-left-radius': '999px', 'border-bottom-right-radius': '999px' } });
    const x = r.left + 6 + f * (r.width - 12);
    add('thumb', null, 'box', { rect: new DOMRect(x - 6, mid - 6, 12, 12), style: { 'background-color': 'var(--surface-panel)', 'border-top-left-radius': '999px', 'border-top-right-radius': '999px', 'border-bottom-left-radius': '999px', 'border-bottom-right-radius': '999px', 'box-shadow': 'inset 0 0 0 2px var(--control-fill)' } });
  }
  const bubble = ss.querySelector('.ss-bubble');
  if (shown(bubble)) {
    add('bubble', bubble, 'box');
    add('art', ss.querySelector('.ss-art'), 'art');
    add('tip', ss.querySelector('.ss-value'), 'text', { text: ss.querySelector('.ss-value').textContent });
  }
  const inline = ss.querySelector('.ss-inline');
  if (shown(inline)) add('art', inline.querySelector('svg') || inline, 'art');
  return parts;
}

const ctx = document.createElement('canvas').getContext('2d');
function measure(t, cs) { ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return ctx.measureText(t).width; }

// stacked as on the slider: the box, then fill and markers, the bubble, the handle, the stitch, the words on top
const LAYER = { box: 0, track: 1, bubble: 3, thumb: 4, art: 5, label: 6, number: 6, tip: 6 };
// a drawing of one part, styled as it is on the page
function skin(p) {
  const d = document.createElement('div');
  d.style.zIndex = LAYER[p.key] ?? 2; // markers: over the fill, under the rest
  d.style.position = 'fixed'; d.style.boxSizing = 'border-box'; d.style.left = '0'; d.style.top = '0'; d.style.margin = '0';
  const style = p.style, get = (k) => (style.getPropertyValue ? style.getPropertyValue(k) : style[k]) || '';
  if (p.kind === 'text') { for (const k of TEXT) d.style.setProperty(k, get(k)); d.style.whiteSpace = 'nowrap'; d.style.display = 'flex'; d.style.alignItems = 'center'; d.textContent = p.text; }
  else for (const k of BOX) d.style.setProperty(k, get(k));
  if (p.kind === 'art') { const src = p.el.tagName.toLowerCase() === 'svg' ? p.el : p.el.querySelector('svg'); d.innerHTML = src ? src.outerHTML : ''; const svg = d.querySelector('svg'); if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block'; svg.removeAttribute('width'); svg.removeAttribute('height'); svg.removeAttribute('id'); } }
  return d;
}
const place = (d, r, o) => { d.style.transform = `translate(${r.x}px, ${r.y}px)`; d.style.width = `${r.width}px`; d.style.height = `${r.height}px`; d.style.opacity = o; };
const mix = (a, b, t) => new DOMRect(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.width, b.width, t), lerp(a.height, b.height, t));

/**
 * Morph from the slider in `from` (a layer, about to go) to the one in `to` (a layer, live). Hides both while it runs;
 * shows `to` at the end. Returns { done (a promise), thumb() (the moving thumb's centre, for a hand to follow),
 * finish() (jump to the end) }.
 */
export function morph(from, to, { duration = 520, root = document.body } = {}) {
  const old = partsOf(from), overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:900';
  root.append(overlay);
  from.style.opacity = '0'; to.style.opacity = '0';
  const skins = new Map(); // key → { a: old drawing, b: new drawing }
  for (const [k, p] of old) skins.set(k, { a: skin(p) }); // added to the overlay in frame(), above its new drawing
  const t0 = performance.now();
  let raf = 0, resolve, thumb = null, ended = false;
  const done = new Promise((r) => (resolve = r));
  function frame(now) {
    const t = Math.min(1, (now - t0) / duration), e = ease(t), now2 = partsOf(to);
    for (const [k, q] of now2) {
      let s = skins.get(k);
      if (!s) { s = {}; skins.set(k, s); }
      if (!s.b) { s.b = skin(q); overlay.append(s.b); }
      if (s.a && !s.a.isConnected) overlay.append(s.a);
      if (q.kind === 'text' && s.b.textContent !== q.text) s.b.textContent = q.text;
      if (q.kind === 'art') s.b.querySelector('svg')?.replaceChildren(...[...(q.el.tagName === 'svg' ? q.el : q.el.querySelector('svg') || q.el).cloneNode(true).childNodes]);
    }
    for (const [k, s] of skins) {
      if (s.a && !s.a.isConnected) overlay.append(s.a);
      const p = old.get(k), q = now2.get(k);
      if (p && q) {
        const r = mix(p.rect, q.rect, e);
        // shapes: the new one solid underneath, the old fading off it (two half-clear layers would show through);
        // text: the same words travel as they are; different ones cross on the way
        if (q.kind === 'text' && p.text === q.text) { place(s.a, r, 0); place(s.b, r, q.opacity); } // the same words just travel
        else if (q.kind === 'text') { place(s.a, r, p.opacity * (1 - e)); place(s.b, r, q.opacity * e); }
        else { place(s.b, r, q.opacity); place(s.a, r, p.opacity * (1 - e)); }
        if (k === 'thumb') thumb = r;
      } else if (p) place(s.a, p.rect, p.opacity * Math.max(0, 1 - e * 2));
      else if (q) { place(s.b, q.rect, q.opacity * Math.max(0, e * 2 - 1)); if (k === 'thumb') thumb = q.rect; }
      if (s.b && !q) s.b.style.opacity = 0;
    }
    if (t < 1 && !ended) raf = requestAnimationFrame(frame); else end();
  }
  function end() {
    if (ended) return; ended = true;
    cancelAnimationFrame(raf); overlay.remove(); to.style.opacity = ''; thumb = null; resolve();
  }
  raf = requestAnimationFrame(frame);
  return { done, finish: end, thumb: () => (thumb ? { x: thumb.x + thumb.width / 2, y: thumb.y + thumb.height / 2 } : null) };
}
