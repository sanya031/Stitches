// Cell size: one square of the canvas, in px. A box of number blocks, "12 px | 12 px" (a square is as wide as it is
// tall, so both blocks are the one number; type in either), with − and + beside it. Drag on the box in any
// direction to scrub it (right or up for bigger, left or down for smaller, a step every 6px); a click without moving
// types in it; arrow keys step it (shift for four).
// cellSizeHtml(value, layout) draws it (layout: CELL_SIZE.layout, see CELL_LAYOUTS); wireCellSize(root, { get, set, min, max }) makes every one in root live.
// Styled by the cell-size block of controls.css.
import { svg } from './icons/icons.js';

const ic = (n) => `<span class="c-ic">${svg(n)}</span>`;

/** Where − and + go (the Panel tab's and the studio's Cell size dials try them): 'beside' (plain icons after the
 * box), 'inside' (two more blocks in the box), 'box' (beside, sharing a field box of their own), 'each' (beside,
 * each in a small field box) */
export const CELL_SIZE = { layout: 'box' };   // chosen: C, − and + beside the numbers in one field box
export const CELL_LAYOUTS = [['beside', 'A · beside'], ['inside', 'B · inside the box'], ['box', 'C · beside, in one box'], ['each', 'D · beside, each in a box']];

export const cellSizeHtml = (v, layout = CELL_SIZE.layout) => {
  const numbers = ['Cell width', 'Cell height'].map((l) => `<label class="c-field__cell c-field__cell--num"><input value="${v}" inputmode="numeric" aria-label="${l} in px" data-cell><span class="c-field__unit">px</span></label>`).join('');
  const steps = (cls) => [['minus', 'Smaller cells', -1], ['plus', 'Bigger cells', 1]].map(([n, l, d]) => `<button class="c-reset ${cls} c-focus" aria-label="${l}" data-cell-step="${d}">${ic(n)}</button>`).join('');
  const box = (inner) => `<div class="c-field c-field--split c-cellsize__box" role="group" aria-label="Cell size in px">${inner}</div>`;
  return `<div class="c-cellsize c-cellsize--${layout}" data-cellsize>${layout === 'inside'
    ? box(numbers + steps('c-field__cell c-cellsize__step'))
    : box(numbers) + (layout === 'box' ? `<div class="c-cellsize__steps">${steps('c-iconbtn c-iconbtn--sm')}</div>` : steps('c-iconbtn c-iconbtn--sm'))}</div>`;
};

export function wireCellSize(root, { get, set, min = 8, max = 48 } = {}) {
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v)));
  const show = (box, v) => box.querySelectorAll('[data-cell]').forEach((i) => { if (document.activeElement !== i) i.value = v; });
  const put = (box, v) => { v = clamp(v); show(box, v); if (v !== get()) set(v); };
  root.querySelectorAll('[data-cellsize]').forEach((box) => {
    if (box._wired) return; box._wired = true;
    box.addEventListener('click', (e) => { const s = e.target.closest('[data-cell-step]'); if (s) put(box, get() + Number(s.dataset.cellStep)); });
    box.addEventListener('change', (e) => { if (e.target.matches('[data-cell]')) { const v = Number(e.target.value); put(box, Number.isFinite(v) && v ? v : get()); show(box, get()); } });
    box.addEventListener('keydown', (e) => {
      const i = e.target.closest('[data-cell]'); if (!i) return;
      if (e.key === 'Enter') i.blur();
      if (e.key === 'Escape') { i.value = get(); i.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); put(box, get() + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 4 : 1)); }
    });
    // scrub: drag on the box in any direction; right and up add, left and down take away
    box.querySelector('.c-cellsize__box').addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-cell-step]')) return;   // − and + inside the box are buttons, not a place to scrub
      const input = e.target.closest('[data-cell]');
      if (input && document.activeElement === input) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY, v: get() };
      let moved = false;
      const move = (ev) => {
        const d = (ev.clientX - start.x) - (ev.clientY - start.y);
        if (!moved && Math.abs(d) < 3) return;
        moved = true; document.body.style.cursor = 'move';
        put(box, start.v + Math.round(d / 6));
      };
      const up = () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        if (!moved && input) { input.focus(); input.select(); }
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  });
  return { show: (v) => root.querySelectorAll('[data-cellsize]').forEach((b) => show(b, v)) };
}
