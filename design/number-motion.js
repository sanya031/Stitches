// Number motion: a changing number drawn digit by digit, so each digit can move on its own when it changes.
// Styled by the number-motion block of controls.css. Motions:
//   'none'  — the text just changes
//   'roll'  — like a combination lock: each digit is a wheel of 0–9 that turns to the new digit, passing the ones
//             between; going up, the new digit comes down from above (down, from below)
//   'slide' — only the digits that changed move: the new one drops in from above as the old one leaves below (the
//             other way going down), with an optional blur
//   'blur'  — the digits that changed cross-fade through a blur, without moving
// Places are kept by their value (ones, tens, tenths…), so a digit keeps its wheel while the number grows or
// gains a decimal. Reduced motion: the text just changes.

const EASE = { smooth: 'cubic-bezier(0.22, 1, 0.36, 1)', spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', linear: 'linear' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const WHEEL = 30; // three turns of 0–9, so a wheel can keep turning one way; it rests in the middle turn

export const NUMBER_MOTION = {
  motion: 'none',  // 'none' | 'roll' | 'slide' | 'blur'
  duration: 220,   // ms a digit takes to change
  stagger: 0,      // ms each place waits after the one to its right
  distance: 0.6,   // slide: how far a digit travels, in lines
  blur: 2,         // px, slide and blur: how soft a digit is while it changes
  fade: 0.6,       // roll and slide: 0 a hard edge at the line, 1 digits fade out over half a line beyond it
  ease: 'smooth',  // 'smooth' | 'spring' (overshoots a little) | 'linear'
};

const span = (cls, text = '') => Object.assign(document.createElement('span'), { className: cls, textContent: text });

/** Draw numbers in el. set(text, options) shows text, moving the digits that changed. */
export function createNumberMotion(el) {
  let cols = new Map(), lastValue = null, lastText = null, lastMotion = null;
  el.classList.add('c-num');

  // ─── roll: a wheel per digit ───
  const wheelAt = (c) => { c.strip.style.transform = `translateY(calc(${-(WHEEL - 1 - c.p)} * (var(--num-h) + var(--num-pad))))`; };
  function makeWheel(d) {
    const col = span('c-num__col'), strip = span('c-num__strip');
    for (let i = 0; i < WHEEL; i++) strip.append(span('', String((WHEEL - 1 - i) % 10))); // top to bottom 9…0, so a rising digit comes from above
    col.append(strip);
    const c = { el: col, strip, p: 10 + d, d, t: 0 };
    wheelAt(c);
    return c;
  }
  const rest = (c) => { // back to the middle turn, with no motion, so the wheel never runs out
    if (c.p >= 10 && c.p < 20) return;
    c.strip.style.transition = 'none'; c.p = 10 + c.d; wheelAt(c); void c.strip.offsetHeight;
  };
  function turn(c, d, dir, o, delay) {
    if (d === c.d) return;
    const step = dir > 0 ? (d - c.d + 10) % 10 : dir < 0 ? -((c.d - d + 10) % 10) : d - c.d;
    if (c.p + step < 0 || c.p + step >= WHEEL) rest(c);
    c.p += step; c.d = d;
    c.strip.style.transition = `transform ${o.duration}ms ${EASE[o.ease] || EASE.smooth} ${delay}ms`;
    wheelAt(c);
    clearTimeout(c.t); c.t = setTimeout(() => rest(c), o.duration + delay + 30);
  }

  // ─── slide and blur: a slot per digit, the old digit leaving as the new one arrives ───
  function makeSlot(ch) {
    const col = span('c-num__col'), cur = span('c-num__d', ch);
    col.append(cur);
    return { el: col, cur, ch, out: [] };
  }
  function swap(c, ch, dir, o, delay, motion) {
    if (ch === c.ch) return;
    const old = c.cur, next = span('c-num__d', ch), up = dir < 0 ? -1 : 1; // up: rising (or unknown), the new digit comes from above
    old.classList.add('c-num__out');
    c.out.push(old); while (c.out.length > 2) c.out.shift().remove(); // a fast drag: drop the oldest leavers
    c.el.append(next); c.cur = next; c.ch = ch;
    const dist = motion === 'slide' ? o.distance : 0, b = `blur(${o.blur}px)`;
    const timing = { duration: o.duration, easing: EASE[o.ease] || EASE.smooth, delay };
    next.animate([{ transform: `translateY(${-up * dist * 100}%)`, opacity: 0, filter: b }, { transform: 'none', opacity: 1, filter: 'blur(0)' }], { ...timing, fill: 'backwards' });
    old.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: `translateY(${up * dist * 100}%)`, opacity: 0, filter: b }], { ...timing, fill: 'forwards' })
      .finished.then(() => { old.remove(); c.out = c.out.filter((x) => x !== old); }, () => {});
  }

  function set(text, opts = {}) {
    const o = { ...NUMBER_MOTION, ...opts };
    const motion = reduced.matches ? 'none' : o.motion;
    if (text === lastText && motion === lastMotion) return;
    const m = /^(-?)(\d+)(?:\.(\d+))?(.*)$/.exec(text);
    if (motion === 'none' || !m) { el.replaceChildren(text); cols = new Map(); lastText = text; lastMotion = motion; lastValue = m ? parseFloat(text) : null; return; }
    if (motion !== lastMotion) { el.replaceChildren(); cols = new Map(); }
    const [, sign, int, frac = '', tail] = m, value = parseFloat(`${sign}${int}.${frac || 0}`);
    const dir = lastValue == null ? 0 : Math.sign(value - lastValue);
    el.style.setProperty('--num-fade', o.fade);

    // what to show, keyed by place so a digit keeps its wheel or slot
    const parts = [];
    if (sign) parts.push({ key: 'sign', ch: sign });
    [...int].forEach((ch, j) => parts.push({ key: `i${int.length - 1 - j}`, ch, digit: true }));
    if (frac) { parts.push({ key: 'dot', ch: '.' }); [...frac].forEach((ch, j) => parts.push({ key: `f${j}`, ch, digit: true })); }
    if (tail) parts.push({ key: 'tail', ch: tail });

    const next = new Map();
    let fromRight = parts.filter((p) => p.digit).length; // the rightmost digit moves first, each place to its left waits a stagger more
    for (const p of parts) {
      let c = cols.get(p.key);
      const wait = p.digit ? --fromRight * o.stagger : 0;
      if (!p.digit) { if (!c) c = { el: span('c-num__char', p.ch) }; else c.el.textContent = p.ch; }
      else if (!c) {
        c = motion === 'roll' ? makeWheel(Number(p.ch)) : makeSlot(p.ch);
        if (lastText != null) c.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: o.duration, easing: 'ease-out' }); // a new place fades in
      } else if (motion === 'roll') turn(c, Number(p.ch), dir, o, wait);
      else swap(c, p.ch, dir, o, wait, motion);
      next.set(p.key, c);
    }
    // put them in order, moving only what has to move (moving a node would cut its motion short)
    for (const [k, c] of cols) if (!next.has(k)) c.el.remove();
    [...next.values()].forEach((c, i) => { if (el.children[i] !== c.el) el.insertBefore(c.el, el.children[i] || null); });
    cols = next; lastText = text; lastMotion = motion; lastValue = value;
  }

  return { set };
}
