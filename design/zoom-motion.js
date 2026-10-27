// Hover zoom on the design page, driven from JS so it can be tuned live (DialKit) and feels like a hover:
// each icon has a progress p (0 = the single square, 1 = the n × n patch) that a spring pulls toward the
// pointer's intent. Leaving midway reverses from where it is, keeping its speed; nothing plays to the end.
//
// The hovered stitch is the anchor: it shrinks in place toward its corner of the frame and stays on screen,
// while the rest of the patch spreads out from it onto the cloth around it.
//
//   anchor   the patch square (i, j) the hovered stitch becomes; top-left by default, so the others appear
//            to its right and below. The fixed point is that square's matching spot in the frame:
//            o + c · i / (n − 1), so the square ends exactly where the stitch shrank to.
//   p → patch scale  n^(1 − p)   (even zoom: equal steps of p feel like equal steps of camera distance)
//       stitch scale n^(−p)      (always exactly the patch's anchor square, so the two stay registered)
//   reveal   'sweep': the other squares appear in a soft circle growing from the stitch over p in
//            [revealStart, revealEnd]; 'fade': they fade in over the same span
//   hand-off the stitch stays until p reaches [handoffStart, handoffEnd], then the patch's own anchor square
//            takes over (for fills, where lines run on into the neighbours)
//
// Settings (all live): trigger 'hover' | 'scrub', zoomOut / zoomBack (DialKit TransitionConfig), hoverDelay (ms),
// evenZoom, lift, anchor { x, y } (0..1, y up), reveal, revealStart, revealEnd, softness, handoffStart, handoffEnd.

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/** A DialKit TransitionConfig as a stepper: spring (time or physics) or a cubic Bézier tween. */
function stepper(t) {
  if (t.type === 'easing') return { tween: true, duration: Math.max(0.01, t.duration), ease: bezier(...t.ease) };
  let k = t.stiffness ?? 100, c = t.damping ?? 10, m = t.mass ?? 1;
  if (t.visualDuration != null) {
    // as Motion converts a time spring: the period sets stiffness, bounce sets how far below critical damping it sits
    const root = (2 * Math.PI) / (t.visualDuration * 1.2);
    k = root * root; m = 1; c = 2 * Math.min(1, Math.max(0, 1 - (t.bounce ?? 0))) * Math.sqrt(k);
  }
  return { tween: false, k, c, m };
}

function bezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
    return Y(Math.min(1, Math.max(0, t)));
  };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-4, b - a))); return t * t * (3 - 2 * t); };

export function createZoomMotion(settings) {
  const states = new Map();   // host element → { p, v, target, tween, timer }
  let raf = 0, last = 0, frozen = null;   // frozen: a progress every icon is held at, for inspecting a frame

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  /** The patch's reveal mask: everything starts hidden; a soft circle grows from the anchor; the anchor square stays covered until the hand-off. */
  const maskFor = (svg, many) => {
    if (svg._reveal) return svg._reveal;
    const id = `${svg.id || 'z' + Math.random().toString(36).slice(2)}-reveal`;
    let defs = svg.querySelector('defs');
    if (!defs) { defs = el('defs', {}); svg.prepend(defs); }
    const grad = el('radialGradient', { id: `${id}-g` });
    const stopIn = el('stop', { offset: '0.6', 'stop-color': '#fff' }), stopOut = el('stop', { offset: '1', 'stop-color': '#000' });
    grad.append(stopIn, stopOut);
    const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -500, y: -500, width: 1000, height: 1000 });
    const circle = el('circle', { fill: `url(#${id}-g)` }), cover = el('rect', { fill: '#000' });
    mask.append(circle, cover);
    defs.append(grad, mask);
    many.setAttribute('mask', `url(#${id})`);
    return (svg._reveal = { circle, cover, stopIn });
  };

  const paint = (host, s) => {
    const svg = host.querySelector('svg'), one = svg?.querySelector('.tz-one'), many = svg?.querySelector('.tz-many');
    if (!one || !many) return;
    const cfg = settings(), p = s.p;
    const n = Number(svg.dataset.n || 4), o = Number(svg.dataset.o), c = Number(svg.dataset.c), cell = c / n;
    const i = Math.round(Math.min(1, Math.max(0, cfg.anchor.x)) * (n - 1)), j = Math.round((1 - Math.min(1, Math.max(0, cfg.anchor.y))) * (n - 1));
    const fx = o + (c * i) / (n - 1), fy = o + (c * j) / (n - 1);
    const scale = reduced.matches ? 1 : cfg.evenZoom ? n ** (1 - p) : n - (n - 1) * p;
    for (const [g, sc] of [[many, scale], [one, scale / n]]) {
      g.style.transformOrigin = `${fx}px ${fy}px`;
      g.style.transform = `scale(${sc})`;
      g.style.transition = 'none';
    }

    // reveal: a soft circle from the anchor square's centre out past the farthest corner
    const m = maskFor(svg, many), cx = o + (i + 0.5) * cell, cy = o + (j + 0.5) * cell;
    const far = Math.max(...[[o, o], [o + c, o], [o, o + c], [o + c, o + c]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    const soft = Math.min(0.95, Math.max(0.02, cfg.softness)), r = smooth(cfg.revealStart, cfg.revealEnd, p);
    const sweep = cfg.reveal === 'sweep' && !reduced.matches;
    const radius = sweep ? (cell * 0.5 + (far / (1 - soft) + cell) * r) : far * 4;
    m.circle.setAttribute('cx', cx); m.circle.setAttribute('cy', cy); m.circle.setAttribute('r', Math.max(0.01, radius));
    m.stopIn.setAttribute('offset', String(1 - soft));
    many.style.opacity = String(sweep ? (r > 0 ? 1 : 0) : r);

    // hand-off: the stitch stays on top of its covered square, then gives way to the patch's own
    const h = smooth(cfg.handoffStart, cfg.handoffEnd, p);
    for (const [k, v] of Object.entries({ x: o + i * cell, y: o + j * cell, width: cell, height: cell })) m.cover.setAttribute(k, v);
    m.cover.setAttribute('opacity', String(1 - h));
    one.style.opacity = String(1 - h);

    const art = host.querySelector('.art');
    if (art) art.style.transform = cfg.lift ? `scale(${1 + cfg.lift * Math.min(1.2, Math.max(0, p))})` : '';
  };

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let busy = false;
    for (const [host, s] of states) {
      if (!host.isConnected) { states.delete(host); continue; }
      const cfg = settings(), st = stepper(s.target > s.p ? cfg.zoomOut : cfg.zoomBack);
      if (st.tween) {
        if (!s.tween || s.tween.to !== s.target) s.tween = { from: s.p, to: s.target, t: 0 };
        s.tween.t += dt / (st.duration * Math.max(0.15, Math.abs(s.tween.to - s.tween.from)));
        s.p = s.tween.from + (s.tween.to - s.tween.from) * st.ease(Math.min(1, s.tween.t));
        s.v = 0;
        if (s.tween.t < 1) busy = true; else { s.p = s.target; s.tween = null; }
      } else {
        s.tween = null;
        // semi-implicit Euler in small substeps: stable for stiff springs
        for (let i = 0; i < 4; i++) {
          const h = dt / 4, a = (-st.k * (s.p - s.target) - st.c * s.v) / st.m;
          s.v += a * h; s.p += s.v * h;
        }
        if (Math.abs(s.p - s.target) > 1e-3 || Math.abs(s.v) > 1e-3) busy = true; else { s.p = s.target; s.v = 0; }
      }
      paint(host, s);
    }
    raf = busy ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const state = (host) => { if (!states.has(host)) states.set(host, { p: 0, v: 0, target: 0, tween: null, timer: 0 }); return states.get(host); };
  const aim = (host, target) => { if (frozen != null) return; const s = state(host); s.target = target; kick(); };

  // events on the page, delegated so re-rendered tiles keep working
  const hostOf = (e) => e.target.closest?.('.tz-host');
  document.addEventListener('pointerover', (e) => {
    const host = hostOf(e); if (!host || host.contains(e.relatedTarget)) return;
    const s = state(host), cfg = settings();
    clearTimeout(s.timer);
    if (cfg.trigger === 'hover') s.timer = setTimeout(() => aim(host, 1), cfg.hoverDelay);
  });
  document.addEventListener('pointerout', (e) => {
    const host = hostOf(e); if (!host || host.contains(e.relatedTarget)) return;
    const s = state(host);
    clearTimeout(s.timer);
    aim(host, 0);
  });
  document.addEventListener('pointermove', (e) => {
    const host = hostOf(e); if (!host || settings().trigger !== 'scrub') return;
    // left edge = the square, right edge = the patch; the spring smooths the pointer
    const r = host.getBoundingClientRect();
    aim(host, Math.min(1, Math.max(0, (e.clientX - r.left - r.width * 0.15) / (r.width * 0.7))));
  });
  document.addEventListener('focusin', (e) => { const host = hostOf(e); if (host) aim(host, 1); });
  document.addEventListener('focusout', (e) => { const host = hostOf(e); if (host) aim(host, 0); });

  return {
    /** Paint a freshly rendered host at its current progress (after a re-render). */
    sync(host) { const s = state(host); if (frozen != null) s.p = s.target = frozen; paint(host, s); },
    /** Repaint every icon, e.g. after the anchor or reveal dials change while nothing is moving. */
    repaint() { document.querySelectorAll('.tz-host').forEach((h) => paint(h, state(h))); },
    /** Hold every icon at progress p (null lets them go back to following the pointer). */
    freeze(p) {
      frozen = p;
      document.querySelectorAll('.tz-host').forEach((h) => { const s = state(h); if (p == null) { s.target = 0; kick(); } else { s.p = p; s.v = 0; s.target = p; paint(h, s); } });
    },
    /** Send every host on the page to a target, e.g. to compare all patches at once. */
    all(target) { document.querySelectorAll('.tz-host').forEach((h) => aim(h, target)); },
  };
}
