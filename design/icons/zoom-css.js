// The hover zoom, tuned on the design page, baked into standalone SVG as CSS.
//
// One source for the tuning: TUNING holds the two dials (duration, smoothness) and motionFrom() turns them
// into the full motion, used live by design/zoom-motion.js and here for the exported *-zoom files.
//
// Baking: CSS can't run a spring, but it can follow any curve with linear(). Each animated property is
// simulated with the same spring the page uses, sampled, and written as a linear() timing function; the
// even (geometric) zoom and the reveal/hand-off windows are folded into those samples. Hover plays the
// zoom-out spring; leaving plays the zoom-back spring (CSS reverses from wherever it is).
// Older browsers without linear() fall back to a plain ease-out.

export const TUNING = { duration: 0.4, smoothness: 0.6 };

/** Everything the zoom does, from the two dials. Smoother = less overshoot and a softer reveal edge. */
export function motionFrom({ duration, smoothness }) {
  return {
    trigger: 'hover', hoverDelay: 60, evenZoom: true, lift: 0, anchor: { x: 0, y: 1 },
    zoomOut: { type: 'spring', visualDuration: duration, bounce: 0.3 * (1 - smoothness) },
    zoomBack: { type: 'spring', visualDuration: duration * 0.8, bounce: 0 },
    reveal: 'sweep', revealStart: 0.05, revealEnd: 0.85, softness: 0.25 + 0.45 * smoothness, handoffStart: 0.88, handoffEnd: 1,
  };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-4, b - a))); return t * t * (3 - 2 * t); };
const r3 = (v) => +v.toFixed(3);

/** Progress over time for a time spring from `from` to `to`, as Motion converts one: [times (s), values]. */
function simulate(spring, from, to) {
  const root = (2 * Math.PI) / (spring.visualDuration * 1.2), k = root * root, c = 2 * Math.min(1, Math.max(0, 1 - spring.bounce)) * Math.sqrt(k);
  let p = from, v = 0, t = 0;
  const dt = 1 / 240, ps = [p];
  while (t < 4) {
    const a = -k * (p - to) - c * v;
    v += a * dt; p += v * dt; t += dt;
    ps.push(p);
    if (Math.abs(p - to) < 1e-3 && Math.abs(v) < 1e-2) break;
  }
  return { T: t, ps };
}

/** A linear() timing function for a property whose value is V(p), as p springs from `from` to `to`. */
function timing(sim, V, from, to) {
  const v0 = V(from), v1 = V(to);
  if (Math.abs(v1 - v0) < 1e-6) return 'linear';
  const N = 40, pts = [];
  for (let i = 0; i <= N; i++) pts.push(r3((V(sim.ps[Math.round((i / N) * (sim.ps.length - 1))]) - v0) / (v1 - v0)));
  pts[0] = 0; pts[N] = 1;
  return `linear(${pts.join(',')})`;
}

/**
 * Markup for a zoom icon: style, reveal mask and the two groups. The patch (n × n squares drawn in the square
 * [o, o + c] of the viewBox) starts magnified n× about the square's top-left corner, so its first square is the
 * single stitch; on hover the stitch shrinks in place and the rest sweeps in from it. Plays on hovering the svg
 * or an ancestor with class tz-host. Reduced motion gets a plain crossfade.
 */
export function zoomMarkup({ id, o, c, n, many, one }) {
  const m = motionFrom(TUNING), cell = c / n;
  const out = simulate(m.zoomOut, 0, 1), back = simulate(m.zoomBack, 1, 0);
  // reveal: a soft circle from the first square's centre; its full radius reaches past the far corner
  const cx = r3(o + cell / 2), far = Math.hypot(c - cell / 2, c - cell / 2);
  const R = cell * 0.5 + far / (1 - m.softness) + cell, s0 = (cell * 0.5) / R;
  const props = {
    zoom: (p) => n ** (1 - p),                                              // scale of both groups, relative
    hand: (p) => 1 - smooth(m.handoffStart, m.handoffEnd, p),               // the stitch, and the cover over the patch's first square
    sweep: (p) => s0 + (1 - s0) * smooth(m.revealStart, m.revealEnd, p),     // reveal circle scale
    show: (p) => smooth(0, 0.05, p),                                         // the patch switches on as the zoom starts
  };
  const ease = (prop, dir) => (dir === 'out' ? timing(out, props[prop], 0, 1) : timing(back, props[prop], 1, 0));
  const t = (prop, dir) => {
    const sim = dir === 'out' ? out : back;
    return `${r3(sim.T)}s ${ease(prop, dir)}`;
  };
  const delay = `${m.hoverDelay / 1000}s`;
  const sel = (part) => `#${id} .${part}`, on = (part) => `#${id}:hover .${part},.tz-host:hover #${id} .${part},.tz-host:focus-visible #${id} .${part}`;
  // each property's own curve, for leaving (base rule) and for hovering (hover rule); ease-out first as the fallback
  const tr = (list, dir) => {
    const fallback = list.map(([p, prop]) => `${p} ${r3((dir === 'out' ? out : back).T)}s cubic-bezier(.2,.8,.2,1)${dir === 'out' ? ' ' + delay : ''}`).join(',');
    const exact = list.map(([p, prop]) => `${p} ${t(prop, dir)}${dir === 'out' ? ' ' + delay : ''}`).join(',');
    return `transition:${fallback};transition:${exact}`;
  };
  const css = [
    `${sel('tz-many')},${sel('tz-one')},${sel('tz-reveal')}{transform-box:view-box}`,
    `${sel('tz-many')}{transform-origin:${o}px ${o}px;transform:scale(${n});opacity:0;${tr([['transform', 'zoom'], ['opacity', 'show']], 'back')}}`,
    `${sel('tz-one')}{transform-origin:${o}px ${o}px;transform:scale(1);opacity:1;${tr([['transform', 'zoom'], ['opacity', 'hand']], 'back')}}`,
    `${sel('tz-reveal')}{transform-origin:${cx}px ${cx}px;transform:scale(${r3(s0)});${tr([['transform', 'sweep']], 'back')}}`,
    `${sel('tz-cover')}{opacity:1;${tr([['opacity', 'hand']], 'back')}}`,
    `${on('tz-many')}{transform:scale(1);opacity:1;${tr([['transform', 'zoom'], ['opacity', 'show']], 'out')}}`,
    `${on('tz-one')}{transform:scale(${r3(1 / n)});opacity:0;${tr([['transform', 'zoom'], ['opacity', 'hand']], 'out')}}`,
    `${on('tz-reveal')}{transform:scale(1);${tr([['transform', 'sweep']], 'out')}}`,
    `${on('tz-cover')}{opacity:0;${tr([['opacity', 'hand']], 'out')}}`,
    `@media (prefers-reduced-motion:reduce){${sel('tz-many')},${sel('tz-one')},${sel('tz-reveal')}{transform:none!important;transition:opacity .2s!important}}`,
  ].join('');
  const mask = `<defs><radialGradient id="${id}-rg"><stop offset="${r3(1 - m.softness)}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>`
    + `<mask id="${id}-rm" maskUnits="userSpaceOnUse" x="-500" y="-500" width="1000" height="1000">`
    + `<circle class="tz-reveal" cx="${cx}" cy="${cx}" r="${r3(R)}" fill="url(#${id}-rg)"/>`
    + `<rect class="tz-cover" x="${o}" y="${o}" width="${r3(cell)}" height="${r3(cell)}" fill="#000"/></mask></defs>`;
  return `<style>${css}</style>${mask}<g class="tz-many" mask="url(#${id}-rm)">${many}</g><g class="tz-one">${one}</g>`;
}
