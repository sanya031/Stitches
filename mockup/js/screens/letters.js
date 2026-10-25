import { cellsHTML, esc } from '../thread.js';

// 5×7 sampler font, rows top to bottom, 35 chars per glyph.
const FONT = {
  A: '.###.#...##...#######...##...##...#', B: '####.#...##...#####.#...##...#####.', C: '.###.#...##....#....#....#...#.###.',
  D: '####.#...##...##...##...##...#####.', E: '######....#....####.#....#....#####', F: '######....#....####.#....#....#....',
  G: '.###.#...##....#.####...##...#.####', H: '#...##...##...#######...##...##...#', I: '.###...#....#....#....#....#...###.',
  J: '..###...#....#....#....##..#..##...', K: '#...##..#.#.#..##...#.#..#..#.#...#', L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#', N: '#...##...###..##.#.##..###...##...#', O: '.###.#...##...##...##...##...#.###.',
  P: '####.#...##...#####.#....#....#....', Q: '.###.#...##...##...##.#.##..#..##.#', R: '####.#...##...#####.#.#..#..#.#...#',
  S: '.#####....#.....###.....#....#####.', T: '#####..#....#....#....#....#....#..', U: '#...##...##...##...##...##...#.###.',
  V: '#...##...##...##...##...#.#.#...#..', W: '#...##...##...##.#.##.#.##.#.#.#.#.', X: '#...##...#.#.#...#...#.#.#...##...#',
  Y: '#...##...#.#.#...#....#....#....#..', Z: '#####....#...#...#...#...#....#####', '&': '.##..#..#.#.#...#...#.#.##..#..##.#',
  '!': '..#....#....#....#....#.........#..', ',': '....................##....#...#....', '.': '.........................##....##..',
  "'": '..#....#...........................', '?': '.###.#...#....#...#...#.........#..', '*': '.#.#.###############.###...#.......',
  0: '.###.#...##..###.#.###..##...#.###.', 1: '..#...##....#....#....#....#...###.', 2: '.###.#...#....#...#...#...#...#####',
  3: '####.....#....#.###.....#....#####.', 4: '...#...##..#.#.#..#.#####...#....#.', 5: '######....####.....#....##...#.###.',
  6: '.###.#....#....####.#...##...#.###.', 7: '#####....#...#...#...#....#....#...', 8: '.###.#...##...#.###.#...##...#.###.',
  9: '.###.#...##...#.####....#....#.###.'
};

const SKEINS = [
  ['Berry', '#C8343B', '#8E1D24', '#F08A8E'], ['Marigold', '#E39A2B', '#A9661A', '#FFD08A'], ['Sage', '#6E9A6A', '#4E7A4C', '#B8DDB2'],
  ['Lagoon', '#5E93C2', '#3D6C96', '#B5D6F2'], ['Lilac', '#9C8FD3', '#6E62A6', '#D6CFF6'], ['Ink', '#2A2B33', '#121318', '#6B6E7A']
];

const CELL = 12, COLS = 65, ROWS = 40, MAX_LINE = 10;
const pressed = (on) => `aria-pressed="${on ? 'true' : 'false'}"`;

function layoutSampler(s) {
  const words = (s.text || '').toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = [], len = 0;
  for (const w of words) {
    const add = (cur.length ? 1 : 0) + w.length;
    if (cur.length && len + add > MAX_LINE) { lines.push(cur); cur = [w]; len = w.length; }
    else { cur.push(w); len += add; }
  }
  if (cur.length) lines.push(cur);
  const use = lines.slice(0, 3);
  const totalRows = use.length * 7 + Math.max(0, use.length - 1) * 4;
  let y0 = Math.floor((ROWS - totalRows) / 2) + (s.arc ? 1 : 0);
  const cells = [];
  let wordIdx = 0;
  for (const lw of use) {
    const chars = lw.join(' ').split('');
    const wCells = chars.reduce((a, ch) => a + (ch === ' ' ? 3 : 6), 0) - 1;
    let x = Math.floor((COLS - wCells) / 2);
    let wi = wordIdx;
    chars.forEach((ch, j) => {
      if (ch === ' ') { x += 3; wi += 1; return; }
      const g = FONT[ch] || FONT['?'];
      const p = SKEINS[s.multi ? (s.color + wi) % SKEINS.length : s.color];
      const lift = s.arc ? Math.round(4 * Math.sin(Math.PI * (j + 0.5) / chars.length)) : 0;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (g[r * 5 + c] === '#') cells.push({ x: (x + c) * CELL, y: (y0 + r - lift) * CELL, base: p[1], dark: p[2], light: p[3] });
      }
      x += 6;
    });
    wordIdx = wi + 1;
    y0 += 11;
  }
  return { cells, lines: use.length };
}

function scriptSVG(s) {
  const p = SKEINS[s.color];
  const n = (s.text || '').length;
  const size = n <= 10 ? 104 : (n <= 16 ? 84 : 60);
  const angle = s.scStitch === 'satin' ? 60 : (s.scStitch === 'stem' ? 25 : 0);
  const dash = s.scStitch === 'chain' ? '5 2' : 'none';
  const t = esc(s.text || '');
  const common = `font-family="Pacifico, cursive" font-size="${size}" text-anchor="middle"`;
  const body = s.arc
    ? `<text ${common} fill="rgba(40,24,10,.25)" transform="translate(2 4)"><textPath href="#arcline" startOffset="50%">${t}</textPath></text>
       <text ${common} fill="url(#threadfill)" stroke="${p[2]}" stroke-width="1" stroke-dasharray="${dash}"><textPath href="#arcline" startOffset="50%">${t}</textPath></text>`
    : `<text x="392" y="274" ${common} fill="rgba(40,24,10,.25)">${t}</text>
       <text x="390" y="270" ${common} fill="url(#threadfill)" stroke="${p[2]}" stroke-width="1" stroke-dasharray="${dash}">${t}</text>`;
  return `
    <svg width="780" height="480" viewBox="0 0 780 480" role="img" aria-label="${t} stitched in script" style="position:absolute;left:0;top:0">
      <defs>
        <pattern id="threadfill" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
          <rect width="5" height="5" fill="${p[2]}"/>
          <line x1="0" y1="2.5" x2="5" y2="2.5" stroke="${p[1]}" stroke-width="3.4"/>
          <line x1="0" y1="1.8" x2="5" y2="1.8" stroke="${p[3]}" stroke-width=".6" opacity=".8"/>
        </pattern>
        <path id="arcline" d="M 70 360 Q 390 60 710 360" fill="none"/>
      </defs>
      ${body}
    </svg>`;
}

export default {
  title: 'Letters',
  file: 'frame-lettering',
  status: 'saved',
  initial: { text: 'hello there', mode: 'pix', arc: false, color: 0, multi: true, scStitch: 'satin' },

  actions: {
    text: (s, v) => ({ text: v.slice(0, 32) }),
    mode: (s, m) => ({ mode: m }),
    arc: (s, v) => ({ arc: v }),
    color: (s, i) => ({ color: i }),
    multi: (s) => ({ multi: !s.multi }),
    scStitch: (s, id) => ({ scStitch: id })
  },

  render(s) {
    const script = s.mode === 'script';
    const sampler = script ? null : layoutSampler(s);
    const n = (s.text || '').length;
    const summary = script
      ? `Script · ${s.scStitch} stitch · ${n} letters`
      : `${sampler.cells.length} cross stitches · ${sampler.lines} ${sampler.lines === 1 ? 'line' : 'lines'} · Aida 14`;

    return `
    <div class="layout">
      <aside class="rail rail-left" aria-label="Lettering settings" style="width:360px;max-width:100%">
        <section class="section" style="gap:10px">
          <label for="words" class="h2">Your words</label>
          <input id="words" class="text-input" type="text" maxlength="32" value="${esc(s.text)}" data-input="text" autocomplete="off">
          <span class="dim" style="font-size:12px">Type to restitch live · ${n} / 32</span>
        </section>

        <section class="section">
          <h2>Lettering style</h2>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
            <button class="style-card" data-act="mode" data-arg="pix" ${pressed(!script)}>
              <svg width="72" height="36" viewBox="0 0 72 36" aria-hidden="true"><path d="M4 32V8l8-4 8 4v24M4 20h16M28 4v28h16M52 4h16M60 4v28M52 32h16" fill="none" stroke="currentColor" stroke-width="3.2" stroke-dasharray="3 1.6"/></svg>
              <strong>Sampler</strong><span>Counted cross stitch</span>
            </button>
            <button class="style-card" data-act="mode" data-arg="script" ${pressed(script)}>
              <span aria-hidden="true" style="font-family:'Pacifico',cursive;font-size:26px;line-height:36px;opacity:1">Ab</span>
              <strong>Script</strong><span>Stitched along the path</span>
            </button>
          </div>
          ${script ? `
            <div class="seg" role="group" aria-label="Script stitch" style="grid-template-columns:repeat(3,minmax(0,1fr))">
              ${[['satin', 'Satin'], ['stem', 'Stem'], ['chain', 'Chain']].map(([id, label]) => `<button data-act="scStitch" data-arg="${id}" ${pressed(s.scStitch === id)}>${label}</button>`).join('')}
            </div>` : ''}
        </section>

        <section class="section">
          <h2>Baseline</h2>
          <div class="seg" role="group" aria-label="Baseline" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <button data-act="arc" data-arg="false" ${pressed(!s.arc)}>Straight</button>
            <button data-act="arc" data-arg="true" ${pressed(s.arc)}>Arc</button>
          </div>
        </section>

        <section class="section">
          <div class="row-center">
            <h2>Thread</h2>
            <span style="display:flex;align-items:center;gap:10px;font-size:12px" class="muted">Colour each word
              <button class="switch" role="switch" aria-label="Colour each word" aria-checked="${s.multi}" data-act="multi"></button>
            </span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            ${SKEINS.map(([name, hex], i) => `
              <button class="skein-btn" data-act="color" data-arg="${i}" aria-label="${name}" ${pressed(s.color === i)}>
                <span class="skein skein-sm" style="background-color:${hex}"></span>
              </button>`).join('')}
          </div>
        </section>
      </aside>

      <main class="workspace">
        <div class="stage" style="padding-top:32px">
          <div class="cloth aida" style="--cell:${CELL}px;width:780px;height:480px">
            ${script ? scriptSVG(s) : `<div class="cells" style="left:0;top:0;width:780px;height:480px">${cellsHTML(sampler.cells, CELL)}</div>`}
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 24px 20px;border-top:1px solid var(--line);background:#15171C">
          <span class="mono dim">${summary}</span>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn">Export SVG</button>
            <a class="btn" href="#stitch">Place in a piece</a>
            <a class="btn btn-primary" href="#embed">Embed as live text</a>
          </div>
        </div>
      </main>
    </div>`;
  }
};
