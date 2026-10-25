import { cellsHTML, gridToCells, STRAWBERRY, STRAWBERRY_PALETTE, esc } from '../thread.js';

const WEAR = [
  ['off', 'Off', 'Visitors can tug, nothing wears'],
  ['visitor', 'Each visitor', 'Everyone wears their own copy'],
  ['shared', 'Shared', 'Every visit wears the same piece']
];
const TOGGLES = [
  ['hover', 'Tug on hover', 'Stitches lift under the cursor'],
  ['fabric', 'Show fabric', 'Off leaves just the thread'],
  ['sound', 'Thread sounds', 'Soft pulls while rubbing']
];
const CAPTION = { off: 'Hover to tug', visitor: 'Rub it, it wears for you', shared: 'Rubbed by every visitor · [live count]' };
const CELL = 14;
const CELLS = gridToCells(STRAWBERRY, STRAWBERRY_PALETTE, CELL);

function code(s) {
  const attrs = [];
  if (s.hover) attrs.push('interactive');
  if (s.wear !== 'off') attrs.push(`wear="${s.wear}"`);
  if (!s.fabric) attrs.push('fabric="none"');
  if (s.sound) attrs.push('sound');
  return `<script src="https://[your-cdn]/selvedge.js" defer></script>\n<stitch-piece src="strawberry-sampler" ${attrs.join(' ')}></stitch-piece>`;
}

export default {
  title: 'Embed',
  file: 'strawberry-sampler',
  status: 'embed',
  initial: { wear: 'visitor', hover: true, fabric: true, sound: false, copied: false },

  actions: {
    wear: (s, v) => ({ wear: v, copied: false }),
    flip: (s, key) => ({ [key]: !s[key], copied: false }),
    copy: (s) => {
      try { navigator.clipboard.writeText(code(s)); } catch (e) { /* clipboard blocked */ }
      return { copied: true };
    }
  },

  render(s) {
    const box = s.fabric ? 224 : 168;
    const pad = s.fabric ? 28 : 0;
    return `
    <div class="layout">
      <aside class="rail rail-left" aria-label="Embed settings" style="width:360px;max-width:100%">
        <section class="section" style="gap:10px">
          <h1 style="margin:0;font-size:18px;font-weight:600">Put it on a website</h1>
          <p class="note" style="font-size:13px">The piece ships as live thread, not a picture. Visitors can tug it, and wear it down.</p>
        </section>
        <section class="section">
          <h2>Wear on your site</h2>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${WEAR.map(([id, label, hint]) => `
              <button class="option" data-act="wear" data-arg="${id}" aria-pressed="${s.wear === id}">
                <span class="dot"></span><span class="txt"><strong>${label}</strong><span>${hint}</span></span>
              </button>`).join('')}
          </div>
        </section>
        <section class="section" style="gap:14px">
          ${TOGGLES.map(([key, label, hint]) => `
            <div class="toggle-row">
              <span class="label"><strong>${label}</strong><span>${hint}</span></span>
              <button class="switch" role="switch" aria-label="${label}" aria-checked="${!!s[key]}" data-act="flip" data-arg="${key}"></button>
            </div>`).join('')}
        </section>
      </aside>

      <main class="workspace" style="gap:20px;padding:28px 32px">
        <div class="browser">
          <div class="browser-bar">
            <span class="browser-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="browser-url">[yoursite.com]</span>
          </div>
          <div class="site">
            <div style="flex:1 1 280px;display:flex;flex-direction:column;gap:12px">
              <span class="mono" style="color:#6B6457">[YOUR NAME]</span>
              <h2>[Your headline goes here]</h2>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4A4538">[A line about you or your work.]</p>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
              <div class="${s.fabric ? 'aida' : ''}" style="--cell:${CELL}px;position:relative;width:${box}px;height:${box}px;border-radius:6px;${s.fabric ? 'box-shadow:0 14px 30px -12px rgba(40,30,15,.45),0 2px 6px rgba(40,30,15,.2)' : ''}">
                <div class="cells" style="left:${pad}px;top:${pad}px;width:168px;height:168px">${cellsHTML(CELLS, CELL)}</div>
              </div>
              <span style="font-size:12px;color:#6B6457">${s.hover ? CAPTION[s.wear] : 'Still image'}</span>
            </div>
          </div>
        </div>

        <section aria-label="Embed code" style="display:flex;flex-direction:column;gap:10px">
          <div class="row-center">
            <h2 class="h2">Paste this into your site</h2>
            <button class="btn btn-primary" data-act="copy">${s.copied ? 'Copied' : 'Copy code'}</button>
          </div>
          <pre class="code">${esc(code(s))}</pre>
          <span class="dim" style="font-size:12px">Works in plain HTML, React, Webflow and Framer. Falls back to a still image when motion is reduced.</span>
        </section>
      </main>
    </div>`;
  }
};
