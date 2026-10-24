import { cellsHTML } from '../thread.js';

const STEPS = [
  ['Upload', 'Photo, drawing or sprite'], ['Crop', 'Frame the subject'], ['Size', 'Fabric count & cm'],
  ['Colours', 'Match to real floss'], ['Background', 'Keep, remove or fill'], ['Outline', 'Auto backstitch edges']
];

const FLOSS = [
  ['S-3823', 'Butter', '#F7DDA8', 128], ['S-3770', 'Pale sun', '#FFF1C2', 37], ['S-3341', 'Apricot', '#F2B886', 112],
  ['S-3712', 'Dusk rose', '#E3907A', 66], ['S-3363', 'Sage', '#6E9A6A', 98], ['S-3346', 'Moss', '#3B6B43', 113],
  ['S-890', 'Pine', '#1F3B26', 150], ['S-3371', 'Bark (outline)', '#14261A', 32]
];

const TOGGLES = [
  ['dither', 'Dither', 'Blend neighbouring colours'],
  ['outline', 'Auto outline', 'Backstitch along strong edges'],
  ['bg', 'Remove background', 'Leave bare fabric behind subject']
];

const CELL = 14;

// Procedural stand-in for a converted photo: evening sky, sun, three hill bands.
function hills() {
  const C = {
    s1: ['#F7DDA8', '#E9C27F', '#FFFFFF'], s2: ['#F2B886', '#DA9564', '#FFFFFF'], s3: ['#E3907A', '#C26C5A', '#FFE2D8'],
    sun: ['#FFF1C2', '#F5D27E', '#FFFFFF'], h1: ['#6E9A6A', '#4E7A4C', '#C7E6C1'], h2: ['#3B6B43', '#28502F', '#9CCB9E'], h3: ['#1F3B26', '#142A1A', '#6F9A77']
  };
  const light = { s1: 1, s2: 1, sun: 1 };
  const cells = [];
  const ridge = [];
  for (let c = 0; c < 32; c++) {
    const h1 = Math.round(11 + 2.2 * Math.sin(c / 4.2));
    const h2 = Math.round(15 + 1.8 * Math.sin(c / 3.1 + 1.3));
    ridge.push(`${c * CELL + CELL / 2},${h1 * CELL + 2}`);
    for (let r = 0; r < 22; r++) {
      const dx = c - 23, dy = r - 6;
      let k;
      if (r >= 19) k = 'h3';
      else if (r >= h2) k = 'h2';
      else if (r >= h1) k = 'h1';
      else if (dx * dx + dy * dy <= 10) k = 'sun';
      else if (r < 4) k = 's1';
      else if (r < 8) k = 's2';
      else k = 's3';
      cells.push({ x: c * CELL, y: r * CELL, base: C[k][0], dark: C[k][1], light: C[k][2], half: !!light[k], sheen: light[k] ? 0.35 : 0.55 });
    }
  }
  return { cells, ridge: ridge.join(' ') };
}
const HILLS = hills();

const pressed = (on) => `aria-pressed="${on ? 'true' : 'false'}"`;

export default {
  title: 'Picture',
  file: 'evening-hills',
  status: 'converting',
  initial: { step: 3, side: true, dither: false, outline: true, bg: false, colours: 8 },

  actions: {
    step: (s, i) => ({ step: i }),
    side: (s, v) => ({ side: v }),
    flip: (s, key) => ({ [key]: !s[key] }),
    colours: (s, v) => ({ colours: Number(v) })
  },

  render(s) {
    return `
    <div class="layout">
      <nav class="rail rail-left steps" aria-label="Conversion steps">
        <span class="dim" style="font-size:12px;font-weight:600;padding:0 8px 8px">Turn a picture into thread</span>
        ${STEPS.map(([label, hint], i) => `
          <button class="step ${i < s.step ? 'done' : ''}" data-act="step" data-arg="${i}" ${i === s.step ? 'aria-current="step"' : ''}>
            <span class="badge">${i < s.step ? '✓' : i + 1}</span>
            <span class="txt"><strong>${label}</strong><span>${hint}</span></span>
          </button>`).join('')}
      </nav>

      <main class="workspace">
        <div class="meta-bar">
          <div class="seg" role="group" aria-label="Compare view" style="grid-template-columns:repeat(2,auto)">
            <button data-act="side" data-arg="true" ${pressed(s.side)}>Side by side</button>
            <button data-act="side" data-arg="false" ${pressed(!s.side)}>Thread only</button>
          </div>
          <span class="mono">32 × 22 cells · Aida 14 · 5.8 × 4.0 cm</span>
        </div>

        <div class="stage" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:28px">
          ${s.side ? `
            <figure style="margin:0;display:flex;flex-direction:column;gap:10px">
              <div role="img" aria-label="Your uploaded photo" style="width:240px;max-width:100%;height:166px;border-radius:6px;border:1px dashed var(--line-3);background:linear-gradient(180deg,#2A2E36 0%,#1E2128 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#A3A8B3">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>
                <span style="font-size:13px">[Your photo]</span>
              </div>
              <figcaption class="dim" style="font-size:12px">Source · cropped 3 : 2</figcaption>
            </figure>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>` : ''}
          <figure style="margin:0;display:flex;flex-direction:column;gap:10px">
            <div class="cloth aida" style="--cell:${CELL}px;width:480px;height:340px">
              <div class="cells" style="left:16px;top:16px;width:448px;height:308px">
                ${cellsHTML(HILLS.cells, CELL)}
                ${s.outline ? `<svg width="448" height="308" viewBox="0 0 448 308" aria-hidden="true" style="position:absolute;left:0;top:0;overflow:visible"><polyline points="${HILLS.ridge}" fill="none" stroke="#14261A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14 2"/></svg>` : ''}
              </div>
            </div>
            <figcaption class="dim" style="font-size:12px">Thread · half crosses in the light sky, full crosses below${s.outline ? ', backstitch on the ridge' : ''}</figcaption>
          </figure>
        </div>
      </main>

      <aside class="rail rail-right" aria-label="Colour matching" style="width:340px;max-width:100%">
        <section class="section">
          <div class="row-between"><h2>Matched floss</h2><span class="mono dim">${Math.min(s.colours, FLOSS.length)} colours</span></div>
          <label class="slider"><span class="row-between"><span>Max colours</span><span class="val">${s.colours}</span></span>
            <input type="range" min="2" max="24" value="${s.colours}" data-change="colours"></label>
          <ul class="floss-list">
            ${FLOSS.slice(0, s.colours).map(([code, name, hex, n]) => `
              <li><span class="chip" style="background:${hex}"></span>
                <span class="name">${name}<span class="mono dim" style="font-size:11px">${code}</span></span>
                <span class="mono" style="color:#C9CDD4">${n}</span></li>`).join('')}
          </ul>
        </section>
        <section class="section">
          <h2>Tone → stitch</h2>
          <dl class="kv">
            <dt>Light tones</dt><dd>Half cross</dd>
            <dt>Mid tones</dt><dd>Full cross</dd>
            <dt>Dark tones</dt><dd>Full cross, 3 strands</dd>
            <dt>Edges</dt><dd>Backstitch outline</dd>
          </dl>
        </section>
        <section class="section" style="gap:14px">
          ${TOGGLES.map(([key, label, hint]) => `
            <div class="toggle-row">
              <span class="label"><strong>${label}</strong><span>${hint}</span></span>
              <button class="switch" role="switch" aria-label="${label}" aria-checked="${!!s[key]}" data-act="flip" data-arg="${key}"></button>
            </div>`).join('')}
          <a class="btn btn-primary btn-lg" href="#stitch" style="margin-top:6px">Open in Stitch to edit</a>
        </section>
      </aside>
    </div>`;
  }
};
