// The floating palette: the colour picker's palette, torn off and floating over the cloth, so changing thread is
// one tap while you stitch. A small raised surface: a head (grip, the palette's name as a boxless select, a cross
// that puts it back in the picker) and the palette's pans, the same as in the picker: tap a colour to stitch with
// it, tap an empty pan to keep the colour in hand, hover a colour for its cross. Drag it by its head; let go near
// the cloth's edge and it snaps there (to the left or right edge it stands up as a column); let go over the picker
// and it goes back in. One at a time.
// floatingPaletteHtml(state) draws it held still (the Controls tab); createFloatingPalette(options) makes it live.
// Styled by the floating-palette block of controls.css; tuned by FLOAT_TUNING in colour-picker.js.
import { svg } from './icons/icons.js';
import { pans, esc, palIndex, palName, paletteMenu, FLOAT_TUNING } from './colour-picker.js';

const ic = (n) => `<span class="c-ic">${svg(n)}</span>`;
const EASE = 'cubic-bezier(.22, 1, .36, 1)';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** state: { saved, palette, hex, orient ('row' | 'column'), menu, dragging } */
export function floatingPaletteHtml(st) {
  const i = palIndex(st), p = st.saved[i], name = palName(st);
  return `<div class="c-floatpal c-floatpal--${st.orient || 'row'} ${st.dragging ? 'is-dragging' : ''}" role="toolbar" aria-label="Palette" style="--hand:${st.hex}">`
    + `<div class="c-floatpal__head" data-fp-drag><span class="c-floatpal__grip" aria-hidden="true">${ic('grip')}</span>`
    + `<button class="c-reset c-select c-select--compact c-focus ${st.menu ? 'is-open' : ''}" data-fp-menu aria-haspopup="true" aria-label="Palette: ${esc(name)}" data-tip="${esc(name)}"><span class="c-select__value">${esc(name)}</span>${ic('chevron-down')}</button>`
    + `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="Put back in the picker" data-tip="Put back in the picker" data-fp="dock">${ic('close')}</button></div>`
    + `${pans(p ? p[1] : [], st.hex, { slots: true, del: !!p, pal: i })}`
    + `<div class="c-floatpal__menu">${st.menu ? paletteMenu(st) : ''}</div></div>`;
}

/**
 * Make one live. options: store ({ saved, palette, orient, pos }; shared with the picker), getHex(), onPick(hex),
 * onPalette(i), onChange() (the saved palettes changed), onDock(), bounds() (the cloth's rect, to snap to),
 * dockTarget() (the picker, to drop it back into), onRender(el).
 * Returns { el, grab(pointer), flyFrom(rects), rects(), setHex(hex), redraw(), remove(animated), justDragged() }.
 */
export function createFloatingPalette(o) {
  const { store, getHex, onPick = () => {}, onPalette = () => {}, onChange = () => {}, onDock = () => {}, bounds = () => null, dockTarget = () => null, onRender = () => {} } = o;
  const host = document.createElement('div');
  host.className = 'c-floatpal-host';
  document.body.append(host);
  let menu = false, dragEnd = 0;
  const pal = () => host.firstElementChild;
  const draw = () => {
    host.innerHTML = floatingPaletteHtml({ ...store, hex: getHex(), menu });
    onRender(host);
  };
  const place = () => { host.style.left = `${store.pos.x}px`; host.style.top = `${store.pos.y}px`; };
  const clamp = () => {
    const w = host.offsetWidth, h = host.offsetHeight, m = 8;
    store.pos = { x: Math.max(m, Math.min(store.pos.x, innerWidth - w - m)), y: Math.max(m, Math.min(store.pos.y, innerHeight - h - m)) };
  };

  // carried: it follows the pointer from where it was taken, lifted a little; let go and it snaps or docks
  function grab(p) {
    const off = { x: p.dx ?? 16, y: p.dy ?? 12 };
    pal().classList.add('is-dragging');
    host.style.setProperty('--lift', FLOAT_TUNING.lift);
    const move = (e) => { store.pos = { x: e.clientX - off.x, y: e.clientY - off.y }; place(); };
    const up = (e) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      pal()?.classList.remove('is-dragging');
      dragEnd = performance.now();
      const t = dockTarget()?.getBoundingClientRect();
      if (t && e.clientX >= t.left && e.clientX <= t.right && e.clientY >= t.top && e.clientY <= t.bottom) { onDock(); return; }
      settle();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    if (p.x != null) move({ clientX: p.x, clientY: p.y });
  }
  // let go: within snap px of the cloth's edge it lands on that edge (8px in); at the left or right edge it stands
  // up as a column, anywhere else it lies as a row. It glides from where it was let go.
  function settle() {
    const r0 = host.getBoundingClientRect(), b = bounds(), m = 8, S = FLOAT_TUNING.snap;
    let orient = 'row', x = r0.left, y = r0.top;
    if (b) {
      const nearL = Math.abs(r0.left - (b.left + m)) < S, nearR = Math.abs(r0.right - (b.right - m)) < S;
      orient = nearL || nearR ? 'column' : 'row';
      if (orient !== store.orient) { store.orient = orient; draw(); }
      const w = host.offsetWidth, h = host.offsetHeight;
      if (nearL) x = b.left + m; else if (nearR) x = b.right - m - w;
      if (Math.abs(y - (b.top + m)) < S) y = b.top + m; else if (Math.abs(y + h - (b.bottom - m)) < S) y = b.bottom - m - h;
    }
    store.pos = { x, y }; clamp(); place();
    const r1 = host.getBoundingClientRect();
    if (!still() && (Math.abs(r0.left - r1.left) > 0.5 || Math.abs(r0.top - r1.top) > 0.5)) host.animate([{ transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px)` }, { transform: 'none' }], { duration: 260, easing: EASE });
    save();
  }
  const save = () => { try { localStorage.setItem('selvedge-floating-palette', JSON.stringify({ pos: store.pos, orient: store.orient })); } catch {} };

  // the colours fly in from where they were (the picker's row), one after another; the surface fades in around them
  function flyFrom(rects = []) {
    if (still()) return;
    pal().animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease' });
    [...host.querySelectorAll('.c-pan[data-pk-pick]')].forEach((b, i) => {
      const a = rects[i]; if (!a) return;
      const r = b.getBoundingClientRect();
      b.style.transformOrigin = '0 0';
      b.animate([{ transform: `translate(${a.left - r.left}px, ${a.top - r.top}px) scale(${a.width / r.width}, ${a.height / r.height})` }, { transform: 'none' }], { duration: FLOAT_TUNING.fly, easing: EASE, delay: i * FLOAT_TUNING.stagger, fill: 'backwards' });
    });
  }

  // an empty pan tapped keeps the colour in hand (a new palette if there's none), as in the picker
  function keep() {
    if (palIndex(store) < 0) { store.saved.push([`Palette ${store.saved.length + 1}`, []]); store.palette = store.saved.length - 1; onPalette(store.palette); }
    const cs = store.saved[store.palette][1], hex = getHex(), had = cs.includes(hex);
    if (!had) cs.push(hex);
    draw(); onChange();
    const box = host.querySelector(`.c-pan[data-pk-pick="${hex}"]`);
    if (box && !still()) box.animate(had ? [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }] : [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: had ? 240 : 380, easing: had ? 'ease-in-out' : 'cubic-bezier(.34, 1.4, .64, 1)' });
  }

  host.addEventListener('pointerdown', (e) => {
    const head = e.target.closest('[data-fp-drag]');
    if (!head || e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    const r = host.getBoundingClientRect();
    grab({ dx: e.clientX - r.left, dy: e.clientY - r.top });
  });
  host.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-fp-menu]')) { menu = !menu; draw(); return; }
    const pl = t.closest('[data-pk-palette]');
    if (pl) { store.palette = pl.dataset.pkPalette === 'new' ? null : Number(pl.dataset.pkPalette); menu = false; draw(); onPalette(store.palette); return; }
    if (menu) { menu = false; draw(); }
    if (t.closest('[data-fp="dock"]')) { onDock(); return; }
    const del = t.closest('[data-pk-del]');
    if (del) {
      const cs = store.saved[Number(del.dataset.pkPal)][1], hex = del.dataset.pkDel, wrap = del.closest('.c-panwrap');
      let gone = false;
      const done = () => { if (gone) return; gone = true; store.saved[Number(del.dataset.pkPal)][1] = cs.filter((h) => h !== hex); draw(); onChange(); };
      if (still() || !wrap) done(); else { wrap.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.4)', opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).onfinish = done; setTimeout(done, 220); }
      return;
    }
    if (t.closest('[data-pk-slot]')) { keep(); return; }
    const p = t.closest('[data-pk-pick]');
    if (p) onPick(p.dataset.pkPick);
  });
  host.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu) { e.stopPropagation(); menu = false; draw(); host.querySelector('[data-fp-menu]')?.focus({ focusVisible: false }); } });

  draw();
  if (store.pos) { clamp(); place(); }
  return {
    el: host, grab, flyFrom, settle,
    rects: () => [...host.querySelectorAll('.c-pan[data-pk-pick]')].map((b) => b.getBoundingClientRect()),
    setHex() { const hex = getHex(); pal()?.style.setProperty('--hand', hex); host.querySelectorAll('.c-pan[data-pk-pick]').forEach((b) => b.classList.toggle('is-selected', b.dataset.pkPick === hex)); },
    redraw: draw,
    place: (pos) => { store.pos = pos; clamp(); place(); },
    remove(animated = true) {
      if (!animated || still()) { host.remove(); return; }
      const a = host.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = () => host.remove(); setTimeout(() => host.remove(), 260);
    },
    justDragged: () => performance.now() - dragEnd < 80,
  };
}
