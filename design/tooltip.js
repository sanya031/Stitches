// Tooltips, as shadcn/ui's (Base UI) tooltip: any element with data-tip="…" (and optionally data-tip-key="⌘Z"
// for a shortcut) shows it in the design system's tooltip (.c-tooltip) when hovered or keyboard-focused.
// It opens at once, on top of its trigger by default (data-tip-side="bottom" to put it below), 4px away,
// with an arrow pointing at the trigger. No room above: it flips below. Near the window's edge it shifts
// along and the arrow stays on the trigger. It only fades in and out (--motion-tooltip-duration), never moves;
// moving straight from one control to the next switches it at once, with no fade.

const EDGE = 8; // px kept clear of the window's edge

const px = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

export function createTooltips(root = document) {
  const tip = document.createElement('span');
  tip.className = 'c-tooltip c-tooltip--float';
  tip.setAttribute('role', 'tooltip');
  tip.id = 'c-tooltip';
  tip.hidden = true;
  document.body.append(tip);

  let target = null;

  function fill(el) {
    const key = el.dataset.tipKey;
    tip.replaceChildren(el.dataset.tip);
    if (key) { const k = document.createElement('span'); k.className = 'c-kbd'; k.textContent = key; tip.append(k); }
    const arrow = document.createElement('span'); arrow.className = 'c-tooltip__arrow'; tip.append(arrow);
  }

  function place(el) {
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = px('--tooltip-offset');
    let side = el.dataset.tipSide === 'bottom' ? 'bottom' : 'top';
    const yTop = r.top - gap - h, yBottom = r.bottom + gap;
    if (side === 'top' && yTop < EDGE) side = 'bottom';
    else if (side === 'bottom' && yBottom + h > innerHeight - EDGE) side = 'top';
    const y = side === 'top' ? yTop : yBottom;
    const x = Math.min(innerWidth - EDGE - w, Math.max(EDGE, r.left + r.width / 2 - w / 2));
    const arrowX = Math.min(w - 10, Math.max(10, r.left + r.width / 2 - x));
    tip.dataset.side = side;
    tip.style.transform = `translate(${x}px, ${y}px)`;
    tip.style.setProperty('--arrow-x', `${arrowX}px`);
  }

  function show(el) {
    // already showing (or still fading out): switch in place, no animation
    const instant = !tip.hidden;
    target = el;
    el.setAttribute('aria-describedby', tip.id);
    fill(el);
    tip.hidden = false;
    tip.removeAttribute('data-state');
    tip.toggleAttribute('data-instant', instant);
    place(el);
    void tip.offsetWidth; // restart the opening fade
    tip.dataset.state = 'open';
  }

  function hide() {
    if (!target) return;
    target.removeAttribute('aria-describedby');
    target = null;
    tip.removeAttribute('data-instant');
    tip.dataset.state = 'closed';
    // gone once the closing animation ends (or its time is up, if the page isn't drawing)
    clearTimeout(gone); gone = setTimeout(done, px('--motion-tooltip-duration') + 50);
  }
  const done = () => { if (tip.dataset.state === 'closed') tip.hidden = true; };
  let gone = 0;

  tip.addEventListener('animationend', done);

  root.addEventListener('pointerover', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && el !== target) show(el); });
  root.addEventListener('pointerout', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hide(); });
  root.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && el.matches(':focus-visible')) show(el); });
  root.addEventListener('focusout', hide);
  root.addEventListener('pointerdown', hide);
  addEventListener('scroll', hide, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { hide };
}
