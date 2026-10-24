import { wornStitchSVG } from '../thread.js';

const STAGES = [
  ['Fresh', 'Tight twist, full sheen'], ['Dulled', 'Sheen rubs off first'], ['Fuzzed', 'Fibres lift and pill'],
  ['Split', 'Strands drift apart'], ['Snapped', 'A strand breaks, ends curl']
];
// Six stitches; the ones nearer the rub ring are one stage further along.
const LAYOUT = [[0, 0, -2], [1, 0, -1], [2, 0, 0], [0, 1, -1], [1, 1, 0], [2, 1, 0]];
const WEAR_PCT = [0, 24, 52, 78, 100];

export default {
  title: 'Close-up',
  file: 'strawberry-sampler',
  status: 'close-up · 1600%',
  initial: { stage: 2 },

  actions: {
    stage: (s, i) => ({ stage: i }),
    rub: (s) => ({ stage: Math.min(4, s.stage + 1) }),
    mend: () => ({ stage: 0 })
  },

  render(s) {
    let big = '';
    LAYOUT.forEach(([c, r, d], i) => {
      const lvl = Math.max(0, Math.min(4, s.stage + d));
      big += wornStitchSVG(20 + c * 200, 20 + r * 200, 200, lvl, i * 17 + 3);
    });

    return `
    <div class="layout">
      <main class="workspace" style="gap:20px;padding:24px">
        <div class="row-between" style="flex-wrap:wrap">
          <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.01em">Two strands, six stitches, one rub</h1>
          <span class="mono dim">wear under cursor · ${WEAR_PCT[s.stage]}%</span>
        </div>

        <div style="display:flex;justify-content:center">
          <div class="cloth macro" style="width:640px;height:440px;border-radius:6px">
            <svg width="640" height="440" viewBox="0 0 640 440" role="img" aria-label="Six cross stitches magnified, showing ${STAGES[s.stage][0].toLowerCase()} thread" style="position:absolute;left:0;top:0">${big}</svg>
            <div class="rub-ring" aria-hidden="true" style="left:372px;top:132px;width:150px;height:150px;box-shadow:0 0 0 10px rgba(233,185,73,.16)"></div>
          </div>
        </div>

        <section aria-label="Wear stages" style="display:flex;flex-direction:column;gap:12px">
          <div class="row-center" style="flex-wrap:wrap">
            <h2 class="h2">How thread wears</h2>
            <button class="btn btn-outline-accent" data-act="rub">Rub once more</button>
          </div>
          <div class="stage-grid">
            ${STAGES.map(([name, hint], i) => `
              <button class="stage-card" data-act="stage" data-arg="${i}" aria-pressed="${s.stage === i}">
                <span class="thumb mini"><svg width="100%" height="100%" viewBox="0 0 120 120" aria-hidden="true">${wornStitchSVG(10, 10, 100, i, 40 + i * 9)}</svg></span>
                <strong>${i + 1} · ${name}</strong><span class="hint">${hint}</span>
              </button>`).join('')}
          </div>
        </section>
      </main>

      <aside class="rail rail-right" aria-label="Wear settings" style="width:320px;max-width:100%">
        <section class="section">
          <h2>This thread</h2>
          <dl class="kv">
            <dt>Colour</dt><dd>S-321 Berry red</dd>
            <dt>Material</dt><dd>Stranded cotton</dd>
            <dt>Strands</dt><dd>2 of 6</dd>
            <dt>Twist</dt><dd>S-twist, 4 / mm</dd>
          </dl>
        </section>
        <section class="section">
          <h2>Wear behaviour</h2>
          <label class="slider"><span class="row-between"><span>How fast it wears</span><span class="val">gentle</span></span><input type="range" min="0" max="100" value="30"></label>
          <label class="slider"><span class="row-between"><span>Snap threshold</span><span class="val">95%</span></span><input type="range" min="50" max="100" value="95"></label>
          <p class="note">Wear grows with cursor speed × time over a stitch. Slow hovering only tugs; fast scrubbing wears.</p>
        </section>
        <section class="section">
          <h2>Mend</h2>
          <p class="note">Drag the Mend tool over worn stitches to restitch them with fresh thread. Snapped ends are tied off first.</p>
          <button class="btn btn-primary btn-lg" data-act="mend">Mend this area</button>
        </section>
      </aside>
    </div>`;
  }
};
