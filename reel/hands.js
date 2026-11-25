// Hands that play stage sliders by themselves: one drawn cursor per slider, all moving together.
// A page's own events can't make :hover match or move a native range input, so each move is played on the
// slider directly: the box gets .r-hover (styled like hover in reel.css); a box that takes the pointer itself
// (hand feel) gets pointer events; a native range gets its value set, with input and change events.
const ARROW = '<path d="M3 2 L3 18 L7.2 14.2 L10 20 L12.6 18.8 L9.9 13 L15.5 13 Z" fill="#fff" stroke="#121418" stroke-width="1.4" stroke-linejoin="round"/>';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** A drawn cursor (styled by .r-cursor in reel.css; .is-down while pressed). */
export function makeCursor() {
  const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  cursor.setAttribute('class', 'r-cursor'); cursor.setAttribute('viewBox', '0 0 22 22'); cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = ARROW;
  document.body.append(cursor);
  return cursor;
}

/** A hand for the stage slider `box`. */
export function createHand(box, id) {
  const cursor = makeCursor();
  const input = box.querySelector('input[type=range]'), hand = box.classList.contains('ss--hand');
  let x = 0, y = 0, held = null;
  const pe = (type, extra = {}) => box.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'mouse', bubbles: true, ...extra }));
  return {
    /** where to grab: on the value's place (the handle). Presses go to the box itself, so the number field never takes them */
    grip() {
      const bar = box.classList.contains('ss--bar'), r = (bar ? box : input).getBoundingClientRect(), thumb = bar ? 0 : 12;
      const step = (r.width - thumb) / Number(input.max), pos = Number(input.value);
      const gx = r.left + thumb / 2 + pos * step;
      return { x: gx, y: box.getBoundingClientRect().top + box.offsetHeight / 2, pos, step };
    },
    at(nx, ny) {
      x = nx; y = ny;
      cursor.style.left = `${x}px`; cursor.style.top = `${y}px`; cursor.style.opacity = 1;
      if (!held) return;
      if (hand) pe('pointermove', { buttons: 1 });
      else { input.value = Math.max(0, Math.min(Number(input.max), held.pos + (x - held.x) / held.step)); input.dispatchEvent(new Event('input', { bubbles: true })); }
    },
    hover(on) { box.classList.toggle('r-hover', on); },
    press(g) {
      held = g; cursor.classList.add('is-down');
      if (hand) pe('pointerdown', { button: 0, buttons: 1 });
      else { input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
    },
    release() {
      held = null; cursor.classList.remove('is-down');
      if (hand) pe('pointerup', { button: 0 });
      else input.dispatchEvent(new Event('change', { bubbles: true }));
      if (box.contains(document.activeElement)) document.activeElement.blur(); // let go, it rests as untouched
    },
    get x() { return x; }, get y() { return y; },
  };
}

/** Move every hand at once, each from where it is to to(hand, i), over ms. */
export async function together(hands, to, ms) {
  const from = hands.map((h) => [h.x, h.y]), dest = hands.map(to), t0 = performance.now();
  for (;;) {
    const t = Math.min(1, (performance.now() - t0) / ms), e = ease(t);
    hands.forEach((h, i) => h.at(from[i][0] + (dest[i][0] - from[i][0]) * e, from[i][1] + (dest[i][1] - from[i][1]) * e));
    if (t >= 1) return;
    await new Promise(requestAnimationFrame);
  }
}
