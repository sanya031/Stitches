// Tooltips: any element with data-tip="…" shows that text in the design system's tooltip (.c-tooltip)
// when hovered or focused. One tooltip for the page, placed above the element (below if there's no room),
// kept inside the window. The first shows after a short wait; moving straight to another shows it at once.

const DELAY = 400, WARM = 300, GAP = 6, EDGE = 8; // ms before the first, ms that the next stays instant, px

export function createTooltips(root = document) {
  const tip = document.createElement('span');
  tip.className = 'c-tooltip c-tooltip--float';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);

  let target = null, timer = 0, warmUntil = 0;

  function place() {
    const r = target.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let y = r.top - GAP - t.height;
    if (y < EDGE) y = r.bottom + GAP;
    const x = Math.min(innerWidth - EDGE - t.width, Math.max(EDGE, r.left + r.width / 2 - t.width / 2));
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function show(el) {
    target = el;
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    place();
    tip.classList.add('is-shown');
  }
  function hide() {
    clearTimeout(timer);
    if (!target) return;
    target = null;
    tip.classList.remove('is-shown');
    tip.hidden = true;
    warmUntil = performance.now() + WARM;
  }
  function enter(el) {
    if (el === target) return;
    clearTimeout(timer);
    if (target || performance.now() < warmUntil) show(el);
    else timer = setTimeout(() => show(el), DELAY);
  }

  root.addEventListener('pointerover', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) enter(el); });
  root.addEventListener('pointerout', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hide(); });
  root.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && el.matches(':focus-visible')) enter(el); });
  root.addEventListener('focusout', hide);
  addEventListener('scroll', hide, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { hide };
}
